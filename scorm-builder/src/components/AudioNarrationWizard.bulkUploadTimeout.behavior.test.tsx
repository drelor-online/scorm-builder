/**
 * @file AudioNarrationWizard.bulkUploadTimeout.behavior.test.tsx
 *
 * TDD Test for fixing bulk upload timeout issue.
 *
 * ISSUE: When uploading 22 audio files + 22 caption files (44 total),
 * the loading timeout of 30 seconds triggers prematurely, causing
 * uploads to fail even though individual file operations are fast.
 *
 * EXPECTED BEHAVIOR:
 * - Bulk uploads of 44 files should complete successfully
 * - Timeout should not interfere with individual file uploads
 * - Progress should be tracked properly throughout the operation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/testProviders'
import { AudioNarrationWizard } from './AudioNarrationWizard'
import JSZip from 'jszip'
import type { CourseContentUnion, CourseSeedData } from '../types/aiPrompt'

// Mock the media context to simulate slow operations
const mockStoreMedia = vi.fn()
const mockUnifiedMediaContext = {
  storeMedia: mockStoreMedia,
  getMediaForPage: vi.fn(() => []),
  getAllMedia: vi.fn(() => []),
  getMediaById: vi.fn(),
  isLoading: false,
  error: null,
  clearError: vi.fn(),
  refreshMedia: vi.fn(),
}

vi.mock('../contexts/UnifiedMediaContext', async () => {
  const actual = await vi.importActual('../contexts/UnifiedMediaContext')
  return {
    ...actual,
    useUnifiedMedia: () => mockUnifiedMediaContext,
  }
})

// Mock JSZip for controlled file upload testing
vi.mock('jszip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      loadAsync: vi.fn(),
      files: {}
    }))
  }
})

// Mock file input handling
Object.defineProperty(HTMLInputElement.prototype, 'files', {
  set(files) {
    this._files = files
    // Trigger change event
    this.dispatchEvent(new Event('change', { bubbles: true }))
  },
  get() {
    return this._files || []
  }
})

// Mock course content creation
const createMockCourseContent = (): CourseContentUnion => ({
  title: 'Test Course',
  welcome: {
    pageId: 'welcome',
    content: 'Welcome to the test course',
    media: []
  },
  objectives: ['Objective 1', 'Objective 2'],
  objectivesPage: {
    pageId: 'objectives',
    content: 'Course objectives',
    media: []
  },
  topics: Array.from({ length: 20 }, (_, i) => ({
    id: `topic-${i + 1}`,
    title: `Topic ${i + 1}`,
    content: `Content for topic ${i + 1}`,
    media: []
  }))
})

const createMockCourseSeedData = (): CourseSeedData => ({
  title: 'Test Course',
  learnerDescription: 'Test learner description',
  learnerGoals: 'Test learner goals',
  topics: ['Topic 1', 'Topic 2', 'Topic 3'],
  courseTone: 'professional' as const,
  courseStructure: 'modular' as const,
  contentTypes: ['text', 'interactive'] as const,
  estimatedDuration: 60
})

describe('AudioNarrationWizard Bulk Upload Timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset loading state
    mockUnifiedMediaContext.isLoading = false
    mockUnifiedMediaContext.error = null

    // Configure storeMedia to simulate real upload timing
    mockStoreMedia.mockImplementation(async (file, pageId, type) => {
      // Simulate individual file upload time (500ms per file)
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: `${type}-${Date.now()}-${Math.random()}`,
        type,
        pageId,
        filename: file.name,
        size: file.size,
        metadata: {}
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle bulk upload of 22+22 files without timeout', async () => {
    // ARRANGE: Create test course content with narration blocks
    const courseContent = createMockCourseContent()
    const courseSeedData = createMockCourseSeedData()

    // Create 22 narration blocks (simulating a real course)
    const narrationBlocks = Array.from({ length: 22 }, (_, i) => ({
      id: `block-${i + 1}`,
      text: `Narration text for block ${i + 1}`,
      blockNumber: (i + 1).toString().padStart(4, '0'),
      pageId: i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`,
      pageTitle: i < 2 ? (i === 0 ? 'Welcome' : 'Objectives') : `Topic ${i - 1}`
    }))

    // Create mock ZIP files with 22 audio and 22 caption files
    const createMockZipFile = (type: 'audio' | 'caption') => {
      const zip = new JSZip()
      const mockFiles: { [key: string]: any } = {}

      narrationBlocks.forEach((block, index) => {
        const extension = type === 'audio' ? 'mp3' : 'vtt'
        const filename = `${block.blockNumber}-Block.${extension}`
        const content = type === 'audio'
          ? new Uint8Array(1024) // 1KB audio file
          : `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n${block.text}` // VTT content

        mockFiles[filename] = {
          dir: false,
          async: vi.fn().mockResolvedValue(content),
          name: filename
        }
      })

      // Mock the loadAsync method to return our mock files
      const mockZipInstance = {
        loadAsync: vi.fn().mockResolvedValue({
          files: mockFiles
        }),
        files: mockFiles
      }

      vi.mocked(JSZip).mockImplementation(() => mockZipInstance as any)

      return new File([new Uint8Array(1024 * 22)], `bulk-${type}.zip`, {
        type: 'application/zip'
      })
    }

    const onNext = vi.fn()
    const onBack = vi.fn()

    // ACT: Render the component
    render(
      <AudioNarrationWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // Open bulk upload modal
    const bulkUploadButton = screen.getByText('Bulk Upload')
    fireEvent.click(bulkUploadButton)

    await waitFor(() => {
      expect(screen.getByText('Bulk Audio Upload (Murf.ai)')).toBeInTheDocument()
    })

    // SIMULATE: Upload audio ZIP file (22 files)
    const audioUploadZone = screen.getByLabelText(/click to upload audio zip/i)
    const audioZipFile = createMockZipFile('audio')

    // Trigger file upload
    const audioInput = document.getElementById('audio-zip-input') as HTMLInputElement
    Object.defineProperty(audioInput, 'files', {
      value: [audioZipFile],
      writable: false,
    })
    fireEvent.change(audioInput)

    // Wait for audio upload to complete
    await waitFor(() => {
      expect(mockStoreMedia).toHaveBeenCalledTimes(22)
    }, { timeout: 15000 }) // Allow 15 seconds for 22 audio files

    // Verify no timeout error occurred during audio upload
    expect(mockUnifiedMediaContext.error).toBeNull()

    // SIMULATE: Upload caption ZIP file (22 files)
    const captionZipFile = createMockZipFile('caption')
    const captionInput = document.getElementById('captions-zip-input') as HTMLInputElement
    Object.defineProperty(captionInput, 'files', {
      value: [captionZipFile],
      writable: false,
    })
    fireEvent.change(captionInput)

    // Wait for caption upload to complete (total 44 files)
    await waitFor(() => {
      expect(mockStoreMedia).toHaveBeenCalledTimes(44) // 22 audio + 22 captions
    }, { timeout: 20000 }) // Allow 20 seconds for all 44 files

    // ASSERT: No timeout errors should occur
    expect(mockUnifiedMediaContext.error).toBeNull()

    // Verify all files were processed
    expect(mockStoreMedia).toHaveBeenCalledTimes(44)

    // Verify audio files were processed correctly
    const audioUploadCalls = mockStoreMedia.mock.calls.slice(0, 22)
    audioUploadCalls.forEach((call, index) => {
      expect(call[2]).toBe('audio') // type parameter
      expect(call[1]).toMatch(/welcome|objectives|topic/) // pageId parameter
    })

    // Verify caption files were processed correctly
    const captionUploadCalls = mockStoreMedia.mock.calls.slice(22, 44)
    captionUploadCalls.forEach((call, index) => {
      expect(call[2]).toBe('caption') // type parameter
      expect(call[1]).toMatch(/welcome|objectives|topic/) // pageId parameter
    })
  }, 30000) // Give the test 30 seconds to complete

  it('should show proper progress during bulk upload', async () => {
    // ARRANGE: Simplified test with fewer files for progress testing
    const courseContent = createMockCourseContent()
    const courseSeedData = createMockCourseSeedData()

    const narrationBlocks = Array.from({ length: 5 }, (_, i) => ({
      id: `block-${i + 1}`,
      text: `Narration text for block ${i + 1}`,
      blockNumber: (i + 1).toString().padStart(4, '0'),
      pageId: i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`,
      pageTitle: i < 2 ? (i === 0 ? 'Welcome' : 'Objectives') : `Topic ${i - 1}`
    }))

    // Make storeMedia slower to see progress
    mockStoreMedia.mockImplementation(async (file, pageId, type) => {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second per file
      return {
        id: `${type}-${Date.now()}-${Math.random()}`,
        type,
        pageId,
        filename: file.name,
        size: file.size,
        metadata: {}
      }
    })

    const onNext = vi.fn()
    const onBack = vi.fn()

    // ACT: Render component and start upload
    render(
      <AudioNarrationWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // Open bulk upload modal
    fireEvent.click(screen.getByText('Bulk Upload'))
    await waitFor(() => {
      expect(screen.getByText('Bulk Audio Upload (Murf.ai)')).toBeInTheDocument()
    })

    // Start audio upload
    const audioZipFile = new File([new Uint8Array(1024)], 'test-audio.zip', {
      type: 'application/zip'
    })

    const audioInput = document.getElementById('audio-zip-input') as HTMLInputElement
    Object.defineProperty(audioInput, 'files', {
      value: [audioZipFile],
      writable: false,
    })
    fireEvent.change(audioInput)

    // ASSERT: Progress should be visible during upload
    await waitFor(() => {
      const progressElements = screen.queryAllByText(/processing|uploading/i)
      expect(progressElements.length).toBeGreaterThan(0)
    }, { timeout: 2000 })

    // Wait for completion
    await waitFor(() => {
      expect(mockStoreMedia).toHaveBeenCalledTimes(5)
    }, { timeout: 8000 })

    // Verify no errors occurred
    expect(mockUnifiedMediaContext.error).toBeNull()
  }, 15000)

  it('should handle timeout gracefully if it occurs', async () => {
    // ARRANGE: Simulate a scenario where timeout might occur
    const courseContent = createMockCourseContent()
    const courseSeedData = createMockCourseSeedData()

    // Simulate very slow upload that would trigger timeout
    mockStoreMedia.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 35000)) // 35 seconds (longer than default timeout)
      return { id: 'test', type: 'audio', pageId: 'test' }
    })

    // Simulate timeout error
    mockUnifiedMediaContext.error = new Error('Loading timed out after 30 seconds')

    const onNext = vi.fn()
    const onBack = vi.fn()

    // ACT: Render component
    render(
      <AudioNarrationWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // ASSERT: Error should be displayed if timeout occurs
    await waitFor(() => {
      expect(screen.getByText(/loading timed out/i)).toBeInTheDocument()
    })
  })
})