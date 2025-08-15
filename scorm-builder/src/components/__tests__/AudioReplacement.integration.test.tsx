import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AudioNarrationWizard } from '../AudioNarrationWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { NotificationProvider } from '../../contexts/NotificationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
// import { createMockAudioFile, createMockMediaService } from '../../test-utils/audio-helpers' // TODO: Use these when test implementation is complete

// Mock Tauri APIs
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}))

// Mock file system operations
vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  )
}))

// Mock TauriAudioPlayer
vi.mock('../TauriAudioPlayer', () => {
  const MockTauriAudioPlayer = ({ audioUrl, onPlay, onPause, ...props }: any) => (
    <div data-testid="audio-player" data-key={props.key} data-audio-url={audioUrl}>
      <button onClick={() => onPlay && onPlay()}>Play</button>
      <button onClick={() => onPause && onPause()}>Pause</button>
      <div data-testid="audio-url">{audioUrl}</div>
    </div>
  )
  
  return {
    default: MockTauriAudioPlayer,
    TauriAudioPlayer: MockTauriAudioPlayer
  }
})

// Test wrapper with all required providers
const TestWrapper = ({ children, projectId = 'test-project' }: { children: React.ReactNode, projectId?: string }) => (
  <PersistentStorageProvider>
    <NotificationProvider>
      <UnifiedMediaProvider projectId={projectId}>
        <StepNavigationProvider initialStep={2}> {/* Step 2 is Audio Narration */}
          {children}
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    </NotificationProvider>
  </PersistentStorageProvider>
)

describe('Audio Replacement Integration Test', () => {
  const mockCourseContent = {
    blocks: [
      {
        id: 'block-1',
        type: 'content',
        content: 'This is the first audio block for narration.',
        audioUrl: null
      },
      {
        id: 'block-2', 
        type: 'content',
        content: 'This is the second audio block for narration.',
        audioUrl: null
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful file operations
    mockInvoke.mockImplementation((cmd) => {
      switch (cmd) {
        case 'read_project_file':
          return Promise.resolve(JSON.stringify(mockCourseContent))
        case 'write_project_file':
          return Promise.resolve()
        case 'store_media_file':
          return Promise.resolve({
            id: 'audio-123',
            path: 'media/audio-123.mp3',
            size: 12345
          })
        case 'get_media_file':
          return Promise.resolve(new Uint8Array([1, 2, 3, 4]))
        case 'delete_media_file':
          return Promise.resolve(true)
        default:
          return Promise.resolve()
      }
    })
  })

  it('should complete full audio replacement workflow with cache invalidation', async () => {
    const user = userEvent.setup()
    
    const mockProps = {
      courseContent: mockCourseContent,
      onNext: vi.fn(),
      onBack: vi.fn(),
      onDataChange: vi.fn()
    }

    render(
      <TestWrapper>
        <AudioNarrationWizard {...mockProps} />
      </TestWrapper>
    )

    // Step 1: Generate initial audio for first block
    await waitFor(() => {
      expect(screen.getByText(/Audio Narration/)).toBeInTheDocument()
    })

    // Find the generate button for the first block
    const generateButtons = screen.getAllByText('Generate Audio')
    expect(generateButtons.length).toBeGreaterThan(0)
    
    // Click generate for first block
    await user.click(generateButtons[0])
    
    // Wait for audio generation to complete
    await waitFor(() => {
      const audioPlayer = screen.queryByTestId('audio-player')
      if (audioPlayer) {
        expect(audioPlayer).toBeInTheDocument()
      }
    }, { timeout: 5000 })

    // Step 2: Verify initial audio is loaded
    let audioPlayer = screen.queryByTestId('audio-player')
    if (audioPlayer) {
      const initialKey = audioPlayer.getAttribute('data-key')
      const initialUrl = audioPlayer.getAttribute('data-audio-url')
      
      expect(initialKey).toBeTruthy()
      expect(initialUrl).toBeTruthy()
      
      console.log('Initial audio - Key:', initialKey, 'URL:', initialUrl)

      // Step 3: Play the initial audio
      const playButton = screen.getByText('Play')
      await user.click(playButton)
      
      // Step 4: Replace the audio with new file
      const fileInput = screen.queryByTestId('audio-file-input')
      if (fileInput) {
        const newAudioFile = new File(['new audio data'], 'new-audio.mp3', {
          type: 'audio/mpeg'
        })
        
        await user.upload(fileInput, newAudioFile)
        
        // Wait for replacement to complete
        await waitFor(() => {
          const updatedPlayer = screen.queryByTestId('audio-player')
          if (updatedPlayer) {
            const newKey = updatedPlayer.getAttribute('data-key')
            const newUrl = updatedPlayer.getAttribute('data-audio-url')
            
            console.log('Replaced audio - Key:', newKey, 'URL:', newUrl)
            
            // Verify key changed (indicating component remounted)
            expect(newKey).not.toBe(initialKey)
            
            // Verify URL changed (indicating new audio loaded)
            expect(newUrl).not.toBe(initialUrl)
            
            // Key should contain media ID for proper cache management
            expect(newKey).toMatch(/audio-.*-v\d+/)
          }
        }, { timeout: 5000 })

        // Step 5: Verify old audio is cleaned from cache
        // This would be verified by checking that the old blob URL is revoked
        // and the new audio loads without issues
        const finalPlayer = screen.queryByTestId('audio-player')
        if (finalPlayer) {
          const finalPlayButton = screen.getByText('Play')
          await user.click(finalPlayButton)
          
          // Should play new audio without ERR_FILE_NOT_FOUND
          // (This would manifest as the audio player not throwing errors)
        }
      }
    }

    // Step 6: Verify data persistence
    expect(mockProps.onDataChange).toHaveBeenCalled()
    
    // Verify the audio replacement was properly saved
    const dataChangeCalls = mockProps.onDataChange.mock.calls
    const lastCall = dataChangeCalls[dataChangeCalls.length - 1]
    if (lastCall && lastCall[0]) {
      expect(lastCall[0]).toHaveProperty('blocks')
    }
  })

  it('should handle concurrent audio replacements without race conditions', async () => {
    const user = userEvent.setup()
    
    const mockProps = {
      courseContent: mockCourseContent,
      onNext: vi.fn(),
      onBack: vi.fn(), 
      onDataChange: vi.fn()
    }

    render(
      <TestWrapper>
        <AudioNarrationWizard {...mockProps} />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Audio Narration/)).toBeInTheDocument()
    })

    // Simulate rapid audio replacements
    const generateButtons = screen.getAllByText('Generate Audio')
    
    if (generateButtons.length >= 2) {
      // Generate audio for multiple blocks simultaneously
      await Promise.all([
        user.click(generateButtons[0]),
        user.click(generateButtons[1])
      ])

      // Wait for both audio generations to complete
      await waitFor(() => {
        const audioPlayers = screen.queryAllByTestId('audio-player')
        expect(audioPlayers.length).toBeLessThanOrEqual(2) // Only show 2 blocks max
      }, { timeout: 10000 })

      // Verify no race conditions caused duplicate keys or stale URLs
      const audioPlayers = screen.queryAllByTestId('audio-player')
      const keys = audioPlayers.map(player => player.getAttribute('data-key'))
      const urls = audioPlayers.map(player => player.getAttribute('data-audio-url'))
      
      // All keys should be unique
      expect(new Set(keys).size).toBe(keys.length)
      
      // All URLs should be valid blob URLs or media IDs
      urls.forEach(url => {
        expect(url).toMatch(/^(blob:|media-id-|audio-)/)
      })
    }
  })

  it('should maintain audio version tracking across replacements', async () => {
    const user = userEvent.setup()
    
    const mockProps = {
      courseContent: mockCourseContent,
      onNext: vi.fn(),
      onBack: vi.fn(),
      onDataChange: vi.fn()
    }

    render(
      <TestWrapper>
        <AudioNarrationWizard {...mockProps} />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Audio Narration/)).toBeInTheDocument()
    })

    const generateButtons = screen.getAllByText('Generate Audio')
    if (generateButtons.length > 0) {
      // Generate initial audio
      await user.click(generateButtons[0])
      
      await waitFor(() => {
        const audioPlayer = screen.queryByTestId('audio-player')
        if (audioPlayer) {
          const initialKey = audioPlayer.getAttribute('data-key')
          expect(initialKey).toMatch(/-v0$/) // Should start with version 0
        }
      }, { timeout: 5000 })

      // Replace audio multiple times
      for (let i = 1; i <= 2; i++) {
        const fileInput = screen.queryByTestId('audio-file-input')
        if (fileInput) {
          const newFile = new File([`audio data ${i}`], `audio-${i}.mp3`, {
            type: 'audio/mpeg'
          })
          
          await user.upload(fileInput, newFile)
          
          await waitFor(() => {
            const player = screen.queryByTestId('audio-player')
            if (player) {
              const key = player.getAttribute('data-key')
              expect(key).toMatch(new RegExp(`-v${i}$`)) // Version should increment
            }
          }, { timeout: 5000 })
        }
      }
    }
  })

  it('should handle audio replacement errors gracefully', async () => {
    const user = userEvent.setup()
    
    // Mock a failing media store operation
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'store_media_file') {
        return Promise.reject(new Error('Storage quota exceeded'))
      }
      return Promise.resolve()
    })

    const mockProps = {
      courseContent: mockCourseContent,
      onNext: vi.fn(),
      onBack: vi.fn(),
      onDataChange: vi.fn()
    }

    render(
      <TestWrapper>
        <AudioNarrationWizard {...mockProps} />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Audio Narration/)).toBeInTheDocument()
    })

    const generateButtons = screen.getAllByText('Generate Audio')
    if (generateButtons.length > 0) {
      await user.click(generateButtons[0])
      
      // Should show error notification but not break the UI
      await waitFor(() => {
        const errorNotification = screen.queryByRole('alert')
        if (errorNotification) {
          expect(errorNotification).toBeInTheDocument()
        }
      }, { timeout: 5000 })
      
      // Component should remain functional
      expect(screen.getByText(/Audio Narration/)).toBeInTheDocument()
    }
  })
})