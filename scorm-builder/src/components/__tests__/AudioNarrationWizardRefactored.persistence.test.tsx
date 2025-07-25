import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { AudioNarrationWizard } from '../AudioNarrationWizardRefactored'
import { CourseContent } from '../../types/aiPrompt'
import { useStorage } from '../../contexts/PersistentStorageContext'

// Mock the PersistentStorageContext
vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: vi.fn()
}))

// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadAsync: vi.fn().mockResolvedValue({
      files: {
        '0001-Block.mp3': {
          dir: false,
          async: vi.fn().mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }))
        }
      }
    })
  }))
}))

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

describe('AudioNarrationWizard Persistence', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSettingsClick = vi.fn()
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnHelp = vi.fn()

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome to this course on design systems.',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      narration: 'By the end of this course, you will understand design systems.',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5
    },
    topics: [
      {
        id: 'topic1',
        title: 'Introduction to Design Systems',
        content: 'Topic 1 content',
        narration: 'Design systems provide consistency across applications.',
        media: [],
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10
      },
      {
        id: 'topic2',
        title: 'Component Architecture',
        content: 'Topic 2 content',
        narration: 'Components should be reusable and maintainable.',
        media: [],
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10
      }
    ],
    assessment: {
      questions: [{
        id: 'q1',
        type: 'multiple-choice',
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Try again.'
        }
      }],
      passMark: 70,
      narration: null
    }
  }

  // Mock storage functions
  const mockStoreMedia = vi.fn()
  const mockGetMedia = vi.fn()
  const mockSaveContent = vi.fn()
  const mockGetContent = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock implementations
    mockGetContent.mockReset()
    mockGetMedia.mockReset()
    mockSaveContent.mockReset()
    mockStoreMedia.mockReset()
    
    // Setup mock useStorage hook
    ;(useStorage as Mock).mockReturnValue({
      isInitialized: true,
      currentProjectId: 'test-project-id',
      error: null,
      storeMedia: mockStoreMedia,
      getMedia: mockGetMedia,
      saveContent: mockSaveContent,
      getContent: mockGetContent
    })
  })

  describe('Loading persisted data on mount', () => {
    it('should load existing audio data from PersistentStorage when component mounts', async () => {
      // Mock existing audio data in storage
      const mockAudioData = {
        '0001': {
          id: 'audio-0001',
          blob: new Blob(['audio data'], { type: 'audio/mpeg' }),
          metadata: {
            blockNumber: '0001',
            fileName: '0001-welcome.mp3'
          }
        },
        '0002': {
          id: 'audio-0002',
          blob: new Blob(['audio data 2'], { type: 'audio/mpeg' }),
          metadata: {
            blockNumber: '0002',
            fileName: '0002-objectives.mp3'
          }
        }
      }

      // Mock getMedia to return blob data
      mockGetMedia.mockImplementation(async (id: string) => {
        const blockNumber = id.replace('audio-', '')
        const audioData = mockAudioData[blockNumber]
        if (audioData) {
          return {
            id: audioData.id,
            blob: audioData.blob,
            metadata: audioData.metadata
          }
        }
        return null
      })

      mockGetContent.mockResolvedValue({
        audioFiles: mockAudioData,
        narrationBlocks: [
          {
            id: 'welcome-narration',
            text: 'Modified welcome narration text',
            blockNumber: '0001',
            pageId: 'welcome',
            pageTitle: 'Welcome'
          }
        ]
      })

      const { container } = render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Wait for the component to call getContent
      await waitFor(() => {
        expect(mockGetContent).toHaveBeenCalledWith('audio-narration-data')
      })

      // Wait for the component to call getMedia for each audio file
      await waitFor(() => {
        expect(mockGetMedia).toHaveBeenCalledWith('audio-0001')
        expect(mockGetMedia).toHaveBeenCalledWith('audio-0002')
      })

      // Should display loaded narration text
      await waitFor(() => {
        expect(screen.getByText('Modified welcome narration text')).toBeInTheDocument()
      })

      // Look for audio indicators in narration blocks
      const narrationBlocks = screen.getAllByTestId('narration-block')
      expect(narrationBlocks.length).toBeGreaterThan(0)
      
      // Check if audio status is shown in the first block
      const firstBlock = narrationBlocks[0]
      expect(firstBlock).toHaveTextContent('✓ Audio')
    })

    it('should load existing caption data from PersistentStorage when component mounts', async () => {
      // Mock existing caption data in storage
      mockGetContent.mockResolvedValue({
        captionFiles: {
          '0001': {
            blockNumber: '0001',
            content: 'WEBVTT\n\n00:00.000 --> 00:05.000\nWelcome caption text'
          },
          '0002': {
            blockNumber: '0002',
            content: 'WEBVTT\n\n00:00.000 --> 00:03.000\nObjectives caption text'
          }
        }
      })

      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      await waitFor(() => {
        expect(mockGetContent).toHaveBeenCalledWith('audio-narration-data')
      })

      // Should show caption uploaded status
      await waitFor(() => {
        const captionStatuses = screen.getAllByText(/✓ Caption/i)
        expect(captionStatuses).toHaveLength(2)
      })
    })
  })

  describe('Saving audio data to PersistentStorage', () => {
    it('should save audio blob to PersistentStorage when audio is recorded', async () => {
      // Mock successful storage operations
      mockStoreMedia.mockResolvedValue(undefined)
      mockSaveContent.mockResolvedValue(undefined)
      
      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      })

      // Mock getUserMedia for recording
      const mockMediaRecorder = {
        start: vi.fn(),
        stop: vi.fn(),
        state: 'inactive'
      }

      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn() }])
      }

      global.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      } as any

      global.MediaRecorder = vi.fn().mockImplementation(() => {
        return mockMediaRecorder
      }) as any

      // Find the first narration block and click record
      const recordButtons = screen.getAllByText('🎙️ Record Audio')
      fireEvent.click(recordButtons[0])

      // Start recording in the modal
      await waitFor(() => {
        const startButton = screen.getByText('🎙️ Start Recording')
        fireEvent.click(startButton)
      })

      // Simulate recording
      mockMediaRecorder.state = 'recording'
      
      // Trigger ondataavailable
      const audioBlob = new Blob(['recorded audio'], { type: 'audio/wav' })
      mockMediaRecorder.ondataavailable?.({ data: audioBlob } as any)
      
      // Stop recording
      const stopButton = screen.getByText('⏹️ Stop Recording')
      fireEvent.click(stopButton)
      
      // Trigger onstop
      mockMediaRecorder.onstop?.()

      // Save the recording
      await waitFor(() => {
        const saveButton = screen.getByText('💾 Save Recording')
        fireEvent.click(saveButton)
      })

      // Should store the audio blob in PersistentStorage
      await waitFor(() => {
        expect(mockStoreMedia).toHaveBeenCalledWith(
          expect.stringContaining('audio-0001'),
          expect.any(Blob),
          'audio',
          expect.objectContaining({
            blockNumber: '0001',
            fileName: expect.stringContaining('.wav')
          })
        )
      })

      // Should save the updated narration data
      await waitFor(() => {
        expect(mockSaveContent).toHaveBeenCalledWith(
          'audio-narration-data',
          expect.objectContaining({
            audioFiles: expect.any(Object),
            narrationBlocks: expect.any(Array)
          })
        )
      })
    })

    it('should save audio blobs to PersistentStorage when files are uploaded individually', async () => {
      // Mock successful storage operations
      mockGetContent.mockResolvedValue(null) // No existing data
      mockStoreMedia.mockResolvedValue(undefined)
      mockSaveContent.mockResolvedValue(undefined)
      
      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      })

      const uploadButtons = screen.getAllByLabelText('Upload Audio File')
      expect(uploadButtons.length).toBeGreaterThan(0)
      
      // Create a mock audio file
      const audioFile = new File(['audio content'], 'test-audio.mp3', { type: 'audio/mpeg' })
      
      // Upload audio for the first block
      fireEvent.change(uploadButtons[0], { target: { files: [audioFile] } })
      
      // Small delay to let async operations start
      await new Promise(resolve => setTimeout(resolve, 100))

      await waitFor(() => {
        expect(mockStoreMedia).toHaveBeenCalledWith(
          expect.stringContaining('audio-0001'),
          audioFile,
          'audio',
          expect.objectContaining({
            blockNumber: '0001',
            fileName: 'test-audio.mp3'
          })
        )
      }, { timeout: 3000 })

      await waitFor(() => {
        expect(mockSaveContent).toHaveBeenCalledWith(
          'audio-narration-data',
          expect.objectContaining({
            audioFiles: expect.any(Object)
          })
        )
      })
    })

    it('should save audio blobs to PersistentStorage when bulk ZIP is uploaded', async () => {
      // Mock successful storage operations
      mockStoreMedia.mockResolvedValue(undefined)
      mockSaveContent.mockResolvedValue(undefined)
      
      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      })

      // Create a mock ZIP file
      const zipFile = new File(['zip content'], 'audio-files.zip', { type: 'application/zip' })
      
      // Find and click the upload button
      const uploadButton = screen.getByText('Upload Audio ZIP')
      fireEvent.click(uploadButton)
      
      // Upload the ZIP file
      const audioInput = screen.getByLabelText('Upload audio zip')
      fireEvent.change(audioInput, { target: { files: [zipFile] } })

      // Wait for processing
      await waitFor(() => {
        expect(screen.getByText(/1 audio files uploaded/)).toBeInTheDocument()
      })

      // Should store the extracted audio blob
      await waitFor(() => {
        expect(mockStoreMedia).toHaveBeenCalledWith(
          expect.stringContaining('audio-0001'),
          expect.any(Blob),
          'audio',
          expect.objectContaining({
            blockNumber: '0001',
            fileName: '0001-Block.mp3'
          })
        )
      })

      // Should save the audio data to storage
      await waitFor(() => {
        expect(mockSaveContent).toHaveBeenCalledWith(
          'audio-narration-data',
          expect.objectContaining({
            audioFiles: expect.any(Object)
          })
        )
      })
    })
  })

  describe('Saving narration text to PersistentStorage', () => {
    it('should save modified narration text to storage when edited', async () => {
      // Mock successful storage operations
      mockSaveContent.mockResolvedValue(undefined)
      
      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      })

      // Click edit on the first narration block
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])

      // Modify the text
      const textarea = screen.getByDisplayValue('Welcome to this course on design systems.')
      fireEvent.change(textarea, { target: { value: 'Updated welcome narration' } })

      // Save the edit
      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      // Should save the updated narration blocks to storage
      await waitFor(() => {
        expect(mockSaveContent).toHaveBeenCalledWith(
          'audio-narration-data',
          expect.objectContaining({
            narrationBlocks: expect.arrayContaining([
              expect.objectContaining({
                text: 'Updated welcome narration',
                blockNumber: '0001'
              })
            ])
          })
        )
      })
    })
  })

  describe('Navigation preserving audio selections', () => {
    it('should update topics with audio references when navigating next', async () => {
      // Mock existing audio data
      mockGetContent.mockResolvedValue({
        audioFiles: {
          '0001': {
            id: 'audio-0001',
            blob: new Blob(['audio data'], { type: 'audio/mpeg' }),
            metadata: {
              blockNumber: '0001',
              fileName: '0001-welcome.mp3'
            }
          },
          '0003': {
            id: 'audio-0003',
            blob: new Blob(['audio data'], { type: 'audio/mpeg' }),
            metadata: {
              blockNumber: '0003',
              fileName: '0003-topic.mp3'
            }
          }
        }
      })

      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Wait for audio to load
      await waitFor(() => {
        expect(mockGetContent).toHaveBeenCalled()
      })

      // Click Next
      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      // Should call onNext with audio file references (not blobs)
      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalledWith(
          expect.objectContaining({
            welcomePage: expect.objectContaining({
              audioFile: '0001-welcome.mp3',
              media: expect.arrayContaining([
                expect.objectContaining({
                  id: 'audio-0001',
                  type: 'audio',
                  url: expect.any(String),
                  blob: expect.any(Blob)
                })
              ])
            }),
            topics: expect.arrayContaining([
              expect.objectContaining({
                audioFile: '0003-introduction-to-design-systems.mp3',
                media: expect.arrayContaining([
                  expect.objectContaining({
                    id: 'audio-0003',
                    type: 'audio',
                    url: expect.any(String),
                    blob: expect.any(Blob)
                  })
                ])
              })
            ])
          })
        )
      })
    })

    it('should persist all data before navigation', async () => {
      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Add some audio
      const uploadButtons = screen.getAllByLabelText('Upload Audio File')
      const audioFile = new File(['audio content'], 'test-audio.mp3', { type: 'audio/mpeg' })
      fireEvent.change(uploadButtons[0], { target: { files: [audioFile] } })

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockStoreMedia).toHaveBeenCalled()
      })

      // Click Next
      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      // Should save all data before navigating
      await waitFor(() => {
        expect(mockSaveContent).toHaveBeenLastCalledWith(
          'audio-narration-data',
          expect.objectContaining({
            audioFiles: expect.any(Object),
            narrationBlocks: expect.any(Array),
            captionFiles: expect.any(Object)
          })
        )
      })
    })
  })

  describe('Caption data persistence', () => {
    it('should save caption files to storage when uploaded', async () => {
      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const uploadButtons = screen.getAllByLabelText('Upload Caption File')
      
      // Create a mock caption file
      const captionContent = 'WEBVTT\n\n00:00.000 --> 00:05.000\nTest caption'
      const captionFile = new File([captionContent], 'test-caption.vtt', { type: 'text/vtt' })
      
      // Upload caption for the first block
      fireEvent.change(uploadButtons[0], { target: { files: [captionFile] } })

      await waitFor(() => {
        expect(mockSaveContent).toHaveBeenCalledWith(
          'audio-narration-data',
          expect.objectContaining({
            captionFiles: expect.objectContaining({
              '0001': expect.objectContaining({
                blockNumber: '0001',
                content: captionContent
              })
            })
          })
        )
      })
    })

    it('should include caption blobs in media when navigating with captions', async () => {
      // Mock existing caption data
      mockGetContent.mockResolvedValue({
        audioFiles: {
          '0001': {
            id: 'audio-0001',
            blob: new Blob(['audio data'], { type: 'audio/mpeg' }),
            metadata: {
              blockNumber: '0001',
              fileName: '0001-welcome.mp3'
            }
          }
        },
        captionFiles: {
          '0001': {
            blockNumber: '0001',
            content: 'WEBVTT\n\n00:00.000 --> 00:05.000\nWelcome caption'
          }
        }
      })

      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Wait for data to load
      await waitFor(() => {
        expect(mockGetContent).toHaveBeenCalled()
      })

      // Click Next
      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      // Should include caption blob in the audio media
      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalledWith(
          expect.objectContaining({
            welcomePage: expect.objectContaining({
              captionFile: '0001-welcome.vtt',
              media: expect.arrayContaining([
                expect.objectContaining({
                  captionBlob: expect.any(Blob)
                })
              ])
            })
          })
        )
      })
    })
  })

  describe('Error handling', () => {
    it('should handle storage errors gracefully when loading data', async () => {
      mockGetContent.mockRejectedValue(new Error('Storage error'))

      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Should still render with default data
      await waitFor(() => {
        expect(screen.getByText('Welcome to this course on design systems.')).toBeInTheDocument()
      })
    })

    it('should handle storage errors when saving audio', async () => {
      mockStoreMedia.mockRejectedValue(new Error('Storage full'))

      render(
        <AudioNarrationWizard 
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const uploadButtons = screen.getAllByLabelText('Upload Audio File')
      const audioFile = new File(['audio content'], 'test-audio.mp3', { type: 'audio/mpeg' })
      
      fireEvent.change(uploadButtons[0], { target: { files: [audioFile] } })

      // Should show an error alert
      await waitFor(() => {
        expect(screen.getByText(/Error saving audio/i)).toBeInTheDocument()
      })
    })
  })
})