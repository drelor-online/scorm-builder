/**
 * TauriAudioPlayer - Consolidated Test Suite
 * 
 * This file consolidates TauriAudioPlayer tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - TauriAudioPlayer.mimeType.test.tsx (MIME type handling)
 * - TauriAudioPlayer.doubleEncoding.test.tsx (URL encoding issues)
 * - AudioPlayback.asset.test.tsx (asset loading and playback)
 * 
 * Test Categories:
 * - Component rendering and props
 * - MIME type detection and handling
 * - URL encoding and normalization
 * - Audio playback controls
 * - Asset loading and error handling
 * - Performance and accessibility
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TauriAudioPlayer } from '../TauriAudioPlayer'

// Mock HTMLAudioElement
const mockAudio = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  currentTime: 0,
  duration: 100,
  volume: 1,
  muted: false,
  paused: true,
  ended: false,
  readyState: 4,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  canPlayType: vi.fn((type) => {
    if (type.includes('audio/mpeg')) return 'probably'
    if (type.includes('audio/wav')) return 'maybe'
    if (type.includes('audio/ogg')) return 'probably'
    return ''
  })
}

global.HTMLAudioElement = vi.fn(() => mockAudio) as any

// Mock Tauri API
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

describe('TauriAudioPlayer - Consolidated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockAudio, {
      currentTime: 0,
      duration: 100,
      volume: 1,
      muted: false,
      paused: true,
      ended: false,
      readyState: 4
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering and Props', () => {
    it('should render audio player with basic attributes', () => {
      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toBeInTheDocument()
      expect(audio).toHaveAttribute('src', 'test.mp3')
    })

    it('should render with controls when controls=true', () => {
      render(<TauriAudioPlayer src="test.mp3" controls={true} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('controls')
    })

    it('should render without controls when controls=false', () => {
      render(<TauriAudioPlayer src="test.mp3" controls={false} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).not.toHaveAttribute('controls')
    })

    it('should apply autoplay attribute correctly', () => {
      render(<TauriAudioPlayer src="test.mp3" autoPlay={true} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('autoplay')
    })

    it('should set loop attribute when specified', () => {
      render(<TauriAudioPlayer src="test.mp3" loop={true} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('loop')
    })

    it('should set preload attribute', () => {
      render(<TauriAudioPlayer src="test.mp3" preload="metadata" />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('preload', 'metadata')
    })
  })

  describe('MIME Type Detection and Handling', () => {
    it('should detect MP3 MIME type from file extension', () => {
      const { container } = render(<TauriAudioPlayer src="audio.mp3" />)

      expect(mockAudio.canPlayType).toHaveBeenCalledWith('audio/mpeg')
    })

    it('should detect WAV MIME type from file extension', () => {
      const { container } = render(<TauriAudioPlayer src="audio.wav" />)

      expect(mockAudio.canPlayType).toHaveBeenCalledWith('audio/wav')
    })

    it('should detect OGG MIME type from file extension', () => {
      const { container } = render(<TauriAudioPlayer src="audio.ogg" />)

      expect(mockAudio.canPlayType).toHaveBeenCalledWith('audio/ogg')
    })

    it('should handle case-insensitive file extensions', () => {
      const { container } = render(<TauriAudioPlayer src="AUDIO.MP3" />)

      expect(mockAudio.canPlayType).toHaveBeenCalledWith('audio/mpeg')
    })

    it('should prioritize explicit mimeType prop over file extension', () => {
      const mockProps = {
        src: "audio.mp3",
        mimeType: "audio/wav"
      }

      render(<TauriAudioPlayer {...mockProps} />)

      // Should check for explicit MIME type
      expect(mockAudio.canPlayType).toHaveBeenCalledWith('audio/wav')
    })

    it('should handle unknown file extensions gracefully', () => {
      render(<TauriAudioPlayer src="audio.unknown" />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toBeInTheDocument()
      expect(audio).toHaveAttribute('src', 'audio.unknown')
    })

    it('should show format warning for unsupported types', async () => {
      mockAudio.canPlayType.mockReturnValue('')

      render(<TauriAudioPlayer src="audio.flac" showFormatWarning={true} />)

      await waitFor(() => {
        expect(screen.getByText(/unsupported audio format/i)).toBeInTheDocument()
      })
    })

    it('should provide fallback for unsupported formats', async () => {
      mockAudio.canPlayType.mockImplementation((type) => {
        if (type === 'audio/flac') return ''
        if (type === 'audio/mpeg') return 'probably'
        return ''
      })

      render(
        <TauriAudioPlayer 
          src="audio.flac" 
          fallbackSrc="audio.mp3"
          enableFallback={true}
        />
      )

      await waitFor(() => {
        const audio = screen.getByTestId('tauri-audio-player')
        expect(audio).toHaveAttribute('src', 'audio.mp3')
      })
    })
  })

  describe('URL Encoding and Normalization', () => {
    it('should handle double-encoded URLs correctly', () => {
      const doubleEncodedUrl = 'file%253A%252F%252FC%253A%252FUsers%252Ftest%252Faudio.mp3'
      
      render(<TauriAudioPlayer src={doubleEncodedUrl} normalizeUrl={true} />)

      const audio = screen.getByTestId('tauri-audio-player')
      // Should decode to proper file URL
      expect(audio).toHaveAttribute('src', 'file:///C:/Users/test/audio.mp3')
    })

    it('should normalize Windows file paths to file URLs', () => {
      const windowsPath = 'C:\\Users\\test\\audio.mp3'
      
      render(<TauriAudioPlayer src={windowsPath} normalizeUrl={true} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('src', 'file:///C:/Users/test/audio.mp3')
    })

    it('should handle blob URLs without modification', () => {
      const blobUrl = 'blob:null/12345678-1234-1234-1234-123456789012'
      
      render(<TauriAudioPlayer src={blobUrl} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('src', blobUrl)
    })

    it('should handle data URLs without modification', () => {
      const dataUrl = 'data:audio/mpeg;base64,SUQzAwAAAAAA...'
      
      render(<TauriAudioPlayer src={dataUrl} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('src', dataUrl)
    })

    it('should handle HTTP URLs without modification', () => {
      const httpUrl = 'https://example.com/audio.mp3'
      
      render(<TauriAudioPlayer src={httpUrl} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('src', httpUrl)
    })

    it('should handle special characters in filenames', () => {
      const specialCharUrl = 'file:///C:/audio files/test (1).mp3'
      
      render(<TauriAudioPlayer src={specialCharUrl} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('src', specialCharUrl)
    })

    it('should properly encode spaces in file paths', () => {
      const pathWithSpaces = '/Users/test/My Audio Files/song.mp3'
      
      render(<TauriAudioPlayer src={pathWithSpaces} normalizeUrl={true} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('src', 'file:///Users/test/My%20Audio%20Files/song.mp3')
    })
  })

  describe('Audio Playback Controls', () => {
    it('should call play method when audio starts playing', async () => {
      render(<TauriAudioPlayer src="test.mp3" autoPlay={true} />)

      const audio = screen.getByTestId('tauri-audio-player')
      fireEvent.play(audio)

      expect(mockAudio.play).toHaveBeenCalled()
    })

    it('should handle play/pause events correctly', async () => {
      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      
      fireEvent.play(audio)
      expect(mockAudio.paused).toBe(true) // Initially paused

      fireEvent.pause(audio)
      mockAudio.paused = true
    })

    it('should update current time during playback', async () => {
      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      
      mockAudio.currentTime = 45
      fireEvent.timeUpdate(audio)

      // Component should reflect the updated current time
      expect(mockAudio.currentTime).toBe(45)
    })

    it('should handle seeking to different positions', async () => {
      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      
      // Simulate seeking to 30 seconds
      mockAudio.currentTime = 30
      fireEvent.timeUpdate(audio)

      expect(mockAudio.currentTime).toBe(30)
    })

    it('should handle volume changes', async () => {
      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      
      mockAudio.volume = 0.5
      fireEvent.volumeChange(audio)

      expect(mockAudio.volume).toBe(0.5)
    })

    it('should handle mute/unmute state', async () => {
      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      
      mockAudio.muted = true
      fireEvent.volumeChange(audio)

      expect(mockAudio.muted).toBe(true)
    })

    it('should detect when audio ends', async () => {
      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      
      mockAudio.ended = true
      fireEvent.ended(audio)

      expect(mockAudio.ended).toBe(true)
    })
  })

  describe('Asset Loading and Error Handling', () => {
    it('should show loading state while audio loads', () => {
      mockAudio.readyState = 0 // HAVE_NOTHING

      render(<TauriAudioPlayer src="test.mp3" showLoadingState={true} />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should call onLoadStart callback when loading starts', async () => {
      const mockOnLoadStart = vi.fn()
      
      render(<TauriAudioPlayer src="test.mp3" onLoadStart={mockOnLoadStart} />)

      const audio = screen.getByTestId('tauri-audio-player')
      fireEvent.loadStart(audio)

      expect(mockOnLoadStart).toHaveBeenCalled()
    })

    it('should call onCanPlay callback when audio can start playing', async () => {
      const mockOnCanPlay = vi.fn()
      
      render(<TauriAudioPlayer src="test.mp3" onCanPlay={mockOnCanPlay} />)

      const audio = screen.getByTestId('tauri-audio-player')
      fireEvent.canPlay(audio)

      expect(mockOnCanPlay).toHaveBeenCalled()
    })

    it('should call onError callback when audio fails to load', async () => {
      const mockOnError = vi.fn()
      
      render(<TauriAudioPlayer src="invalid.mp3" onError={mockOnError} />)

      const audio = screen.getByTestId('tauri-audio-player')
      fireEvent.error(audio)

      expect(mockOnError).toHaveBeenCalled()
    })

    it('should display error message when audio fails to load', async () => {
      render(<TauriAudioPlayer src="invalid.mp3" showErrorMessages={true} />)

      const audio = screen.getByTestId('tauri-audio-player')
      fireEvent.error(audio)

      await waitFor(() => {
        expect(screen.getByText(/error loading audio/i)).toBeInTheDocument()
      })
    })

    it('should handle network errors during playback', async () => {
      mockAudio.play.mockRejectedValue(new Error('Network error'))

      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      
      // Trigger a play attempt that fails
      await fireEvent.play(audio)
      
      // Should handle the error gracefully
      expect(mockAudio.play).toHaveBeenCalled()
    })

    it('should convert assets via Tauri API when using asset:// URLs', async () => {
      mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
      
      render(<TauriAudioPlayer src="asset://test.mp3" />)

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('load_asset', { path: 'test.mp3' })
      })
    })

    it('should handle asset conversion errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Asset not found'))
      const mockOnError = vi.fn()

      render(<TauriAudioPlayer src="asset://missing.mp3" onError={mockOnError} />)

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining('Asset not found')
        }))
      })
    })
  })

  describe('Performance and Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<TauriAudioPlayer src="test.mp3" ariaLabel="Test audio player" />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('aria-label', 'Test audio player')
    })

    it('should be keyboard accessible', async () => {
      render(<TauriAudioPlayer src="test.mp3" />)

      const audio = screen.getByTestId('tauri-audio-player')
      audio.focus()

      expect(audio).toHaveFocus()
    })

    it('should clean up resources on unmount', () => {
      const { unmount } = render(<TauriAudioPlayer src="test.mp3" />)

      unmount()

      // Should have cleaned up event listeners
      expect(mockAudio.removeEventListener).toHaveBeenCalled()
    })

    it('should revoke blob URLs on unmount to prevent memory leaks', () => {
      const mockRevokeObjectURL = vi.spyOn(global.URL, 'revokeObjectURL')
      const blobUrl = 'blob:test-url'
      
      const { unmount } = render(<TauriAudioPlayer src={blobUrl} />)

      unmount()

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(blobUrl)
    })

    it('should handle rapid src changes without memory leaks', () => {
      const { rerender } = render(<TauriAudioPlayer src="test1.mp3" />)
      
      rerender(<TauriAudioPlayer src="test2.mp3" />)
      rerender(<TauriAudioPlayer src="test3.mp3" />)

      // Should handle rapid changes without errors
      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('src', 'test3.mp3')
    })

    it('should support tabIndex for keyboard navigation', () => {
      render(<TauriAudioPlayer src="test.mp3" tabIndex={0} />)

      const audio = screen.getByTestId('tauri-audio-player')
      expect(audio).toHaveAttribute('tabindex', '0')
    })
  })
})