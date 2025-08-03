import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { AudioNarrationWizard } from '../AudioNarrationWizard'
import { PersistentStorageContext } from '../../contexts/PersistentStorageContext'
import type { CourseContent } from '../../types/aiPrompt'

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  ondataavailable: null as ((event: any) => void) | null,
  onstop: null as (() => void) | null,
  state: 'inactive' as RecordingState
}

// Mock storage
const mockStorage = {
  saveMedia: vi.fn().mockResolvedValue({ success: true }),
  storeMedia: vi.fn().mockResolvedValue({ success: true }),
  getMedia: vi.fn().mockResolvedValue(null),
  deleteMedia: vi.fn().mockResolvedValue({ success: true }),
  updateMedia: vi.fn().mockResolvedValue({ success: true }),
  getMediaForPage: vi.fn().mockResolvedValue([]),
  getMediaForTopic: vi.fn().mockResolvedValue([]),
  isInitialized: true
}

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any
global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: () => [{
      stop: vi.fn()
    }]
  })
} as any

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error
beforeAll(() => {
  console.error = vi.fn()
})

afterAll(() => {
  console.error = originalConsoleError
})

describe('AudioNarrationWizard - Recording Functionality', () => {
  const mockCourseContent: CourseContent = {
    welcome: {
      title: 'Welcome',
      content: 'Welcome to the course',
      imageUrl: ''
    },
    objectives: ['Learn something'],
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'This is topic 1',
        knowledgeCheck: {
          question: 'Test question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0
        }
      }
    ],
    assessment: {
      totalQuestions: 5,
      passingScore: 80,
      questions: []
    }
  }

  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockMediaRecorder.state = 'inactive'
    mockStorage.storeMedia.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <PersistentStorageContext.Provider value={{
        storage: mockStorage,
        isInitialized: true,
        initError: null
      }}>
        <StepNavigationProvider>
          <AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />
        </StepNavigationProvider>
      </PersistentStorageContext.Provider>
    )
  }

  describe('Recording and Saving Audio', () => {
    it('should save recorded audio when stopping recording', async () => {
      renderComponent()
      
      // Navigate to a topic page
      const topicTab = screen.getByRole('tab', { name: /Topic 1/i })
      await userEvent.click(topicTab)
      
      // Start recording
      const recordButton = screen.getByRole('button', { name: /Start Recording/i })
      await userEvent.click(recordButton)
      
      expect(mockMediaRecorder.start).toHaveBeenCalled()
      
      // Simulate receiving audio data
      const audioBlob = new Blob(['audio data'], { type: 'audio/mp3' })
      const dataEvent = { data: audioBlob }
      
      // Trigger data available
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable(dataEvent)
      }
      
      // Change state to recording
      mockMediaRecorder.state = 'recording'
      
      // Stop recording
      const stopButton = await screen.findByRole('button', { name: /Stop Recording/i })
      await userEvent.click(stopButton)
      
      // Trigger the stop event
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop()
      }
      
      // Wait for async operations
      await waitFor(() => {
        expect(mockStorage.storeMedia).toHaveBeenCalledWith(
          expect.stringContaining('audio-'),
          expect.any(File),
          'audio',
          expect.objectContaining({
            blockNumber: expect.any(String),
            fileName: expect.stringContaining('.wav'),
            recordedAt: expect.any(String)
          })
        )
      })
    })

    it('should generate correct audio ID based on page index', async () => {
      renderComponent()
      
      // Test welcome page (index 0)
      const welcomeTab = screen.getByRole('tab', { name: /Welcome/i })
      await userEvent.click(welcomeTab)
      
      const recordButton = screen.getByRole('button', { name: /Start Recording/i })
      await userEvent.click(recordButton)
      
      // Simulate recording
      mockMediaRecorder.state = 'recording'
      const audioBlob = new Blob(['audio data'], { type: 'audio/mp3' })
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob })
      }
      
      // Stop recording
      const stopButton = await screen.findByRole('button', { name: /Stop Recording/i })
      await userEvent.click(stopButton)
      
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop()
      }
      
      await waitFor(() => {
        expect(mockStorage.storeMedia).toHaveBeenCalledWith(
          'audio-0', // Welcome page should be index 0
          expect.any(File),
          'audio',
          expect.any(Object)
        )
      })
    })

    it('should display success message after saving', async () => {
      renderComponent()
      
      const recordButton = screen.getByRole('button', { name: /Start Recording/i })
      await userEvent.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      const audioBlob = new Blob(['audio data'], { type: 'audio/mp3' })
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob })
      }
      
      const stopButton = await screen.findByRole('button', { name: /Stop Recording/i })
      await userEvent.click(stopButton)
      
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop()
      }
      
      // Check for success message
      await waitFor(() => {
        expect(screen.getByText(/Recording saved successfully/i)).toBeInTheDocument()
      })
    })

    it('should handle save errors gracefully', async () => {
      // Mock save failure
      mockStorage.storeMedia.mockRejectedValueOnce(new Error('Failed to save'))
      
      renderComponent()
      
      const recordButton = screen.getByRole('button', { name: /Start Recording/i })
      await userEvent.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      const audioBlob = new Blob(['audio data'], { type: 'audio/mp3' })
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob })
      }
      
      const stopButton = await screen.findByRole('button', { name: /Stop Recording/i })
      await userEvent.click(stopButton)
      
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop()
      }
      
      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/Failed to save recording/i)).toBeInTheDocument()
      })
    })

    it('should enable download button after successful recording', async () => {
      renderComponent()
      
      const recordButton = screen.getByRole('button', { name: /Start Recording/i })
      await userEvent.click(recordButton)
      
      mockMediaRecorder.state = 'recording'
      const audioBlob = new Blob(['audio data'], { type: 'audio/mp3' })
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob })
      }
      
      const stopButton = await screen.findByRole('button', { name: /Stop Recording/i })
      await userEvent.click(stopButton)
      
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop()
      }
      
      // Wait for save to complete
      await waitFor(() => {
        expect(mockStorage.storeMedia).toHaveBeenCalled()
      })
      
      // Check that download button is enabled
      const downloadButton = screen.getByRole('button', { name: /Download Audio/i })
      expect(downloadButton).not.toBeDisabled()
    })
  })
})