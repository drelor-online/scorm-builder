import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { AudioNarrationWizard } from '../AudioNarrationWizard'
import type { CourseContent } from '../../types/aiPrompt'

// Mock storage
const mockStoreMedia = vi.fn().mockResolvedValue({ success: true })

// Mock the PersistentStorageContext module
vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    storeMedia: mockStoreMedia,
    getMedia: vi.fn().mockResolvedValue(null),
    deleteMedia: vi.fn().mockResolvedValue({ success: true }),
    updateMedia: vi.fn().mockResolvedValue({ success: true }),
    getMediaForPage: vi.fn().mockResolvedValue([]),
    getMediaForTopic: vi.fn().mockResolvedValue([])
  })
}))

// Mock useAudioRecorder hook
const mockStartRecording = vi.fn()
const mockStopRecording = vi.fn()
const mockResetRecording = vi.fn()

let mockIsRecording = false
let mockPreviewUrl: string | null = null

vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: mockIsRecording,
    recordingTime: 0,
    recordingError: null,
    previewUrl: mockPreviewUrl,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    resetRecording: mockResetRecording
  })
}))

describe('AudioNarrationWizard - Audio Save Functionality', () => {
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
    mockIsRecording = false
    mockPreviewUrl = null
    mockStoreMedia.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    return render(<AudioNarrationWizard
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />)
  }

  it('should call storeMedia when saving a recording', async () => {
    // Mock successful recording
    const audioBlob = new Blob(['audio data'], { type: 'audio/wav' })
    mockStopRecording.mockResolvedValue(audioBlob)

    const { getByRole } = renderComponent()
    
    // Find and click record button
    const recordButton = getByRole('button', { name: /Start Recording/i })
    await userEvent.click(recordButton)
    
    expect(mockStartRecording).toHaveBeenCalled()
    
    // Update recording state
    mockIsRecording = true
    mockPreviewUrl = 'blob:test-url'
    
    // Wait for UI to update
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeInTheDocument()
    })
    
    // Click stop button
    const stopButton = screen.getByRole('button', { name: /Stop Recording/i })
    await userEvent.click(stopButton)
    
    // Verify stopRecording was called
    expect(mockStopRecording).toHaveBeenCalled()
    
    // Wait for storeMedia to be called
    await waitFor(() => {
      expect(mockStoreMedia).toHaveBeenCalledWith(
        expect.stringContaining('audio-'),
        expect.any(File),
        'audio',
        expect.objectContaining({
          blockNumber: expect.any(String),
          fileName: expect.stringContaining('.wav')
        })
      )
    })
  })
})