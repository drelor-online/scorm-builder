import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SCORMPackageBuilder } from '../SCORMPackageBuilder'
import type { CourseContent } from '../../types/aiPrompt'
import type { CourseSeedData } from '../../types/course'

// Mock the dependencies
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue('test.zip')
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

// Mock useStorage hook
vi.mock('../../contexts/PersistentStorageContext', async () => {
  const actual = await vi.importActual('../../contexts/PersistentStorageContext')
  return {
    ...actual,
    useStorage: () => null, // Return null so the component uses the prop instead
    PersistentStorageProvider: ({ children }: any) => children
  }
})

// Mock components that require providers
vi.mock('../PageLayout', () => ({
  PageLayout: ({ children, onGenerateSCORM }: any) => (
    <div>
      {children}
      <button onClick={onGenerateSCORM}>Generate SCORM Package</button>
    </div>
  )
}))

vi.mock('../CoursePreview', () => ({
  CoursePreview: () => <div>Course Preview</div>
}))

vi.mock('../AutoSaveIndicatorConnected', () => ({
  AutoSaveIndicatorConnected: () => <div>Auto Save</div>
}))

vi.mock('../../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn().mockImplementation((content, metadata) => ({
    title: metadata.title,
    duration: metadata.duration,
    passMark: metadata.passMark,
    navigationMode: 'linear',
    allowRetake: false,
    welcome: {
      ...content.welcomePage,
      audioFile: 'audio-0001.mp3', // This should be cleared after loading blob
      captionFile: 'caption-0001.vtt'
    },
    objectives: ['Test objective'],
    objectivesPage: {
      audioFile: 'audio-0002.mp3',
      captionFile: 'caption-0002.vtt'
    },
    topics: content.topics.map((topic: any, index: number) => ({
      ...topic,
      audioFile: `audio-${String(index + 3).padStart(4, '0')}.mp3`,
      captionFile: `caption-${String(index + 3).padStart(4, '0')}.vtt`
    })),
    assessment: { questions: [] }
  }))
}))

// Mock the SCORM generator
const mockGenerateSpaceEfficientSCORM12Buffer = vi.fn()
vi.mock('../../services/spaceEfficientScormGenerator', () => ({
  generateSpaceEfficientSCORM12Buffer: (...args: any[]) => mockGenerateSpaceEfficientSCORM12Buffer(...args)
}))

describe('SCORMPackageBuilder - Audio Fix', () => {
  const mockStorage = {
    getMedia: vi.fn().mockImplementation((id: string) => {
      if (id.startsWith('audio-')) {
        return Promise.resolve({
          id,
          blob: new Blob(['audio content'], { type: 'audio/mp3' }),
          mediaType: 'audio',
          url: `http://localhost/${id}`
        })
      }
      if (id.startsWith('caption-')) {
        return Promise.resolve({
          id,
          blob: new Blob(['WEBVTT\n\nCaption content'], { type: 'text/vtt' }),
          mediaType: 'caption',
          url: `http://localhost/${id}`
        })
      }
      return Promise.resolve(null)
    })
  }

  const courseContent: CourseContent = {
    welcomePage: {
      title: 'Welcome',
      content: 'Welcome content',
      media: [],
      audioFile: 'some-old-id.mp3' // This should be ignored
    },
    learningObjectivesPage: {
      title: 'Objectives',
      content: '• Test objective',
      media: [],
      audioFile: 'another-old-id.mp3'
    },
    topics: [{
      id: 'topic-1',
      title: 'Test Topic',
      content: 'Topic content',
      imageKeywords: [],
      imagePrompts: [],
      media: [],
      audioFile: 'topic-old-id.mp3'
    }],
    knowledgeChecks: {}
  }

  const courseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    audienceDescription: 'Test Audience',
    duration: 30
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateSpaceEfficientSCORM12Buffer.mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3])
    })
  })

  it('should clear audioFile properties after loading blobs to prevent double loading', async () => {
    render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={() => {}}
        onBack={() => {}}
        storage={mockStorage}
      />
    )

    // Find and click the generate button
    const generateButton = screen.getByText('Generate SCORM Package')
    await userEvent.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(mockGenerateSpaceEfficientSCORM12Buffer).toHaveBeenCalled()
    })

    // Get the enhanced content that was passed to the SCORM generator
    const [enhancedContent, storage] = mockGenerateSpaceEfficientSCORM12Buffer.mock.calls[0]

    // Verify audioFile properties were cleared (set to undefined)
    expect(enhancedContent.welcome.audioFile).toBeUndefined()
    expect(enhancedContent.welcome.audioBlob).toBeDefined()
    expect(enhancedContent.welcome.captionFile).toBeUndefined()
    expect(enhancedContent.welcome.captionBlob).toBeDefined()

    expect(enhancedContent.objectivesPage.audioFile).toBeUndefined()
    expect(enhancedContent.objectivesPage.audioBlob).toBeDefined()
    expect(enhancedContent.objectivesPage.captionFile).toBeUndefined()
    expect(enhancedContent.objectivesPage.captionBlob).toBeDefined()

    expect(enhancedContent.topics[0].audioFile).toBeUndefined()
    expect(enhancedContent.topics[0].audioBlob).toBeDefined()
    expect(enhancedContent.topics[0].captionFile).toBeUndefined()
    expect(enhancedContent.topics[0].captionBlob).toBeDefined()

    // Verify storage was passed correctly
    expect(storage).toBe(mockStorage)
  })

  it('should call storage.getMedia with correct numeric IDs', async () => {
    render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={() => {}}
        onBack={() => {}}
        storage={mockStorage}
      />
    )

    const generateButton = screen.getByText('Generate SCORM Package')
    await userEvent.click(generateButton)

    await waitFor(() => {
      expect(mockStorage.getMedia).toHaveBeenCalledWith('audio-0') // Welcome
      expect(mockStorage.getMedia).toHaveBeenCalledWith('caption-0') // Welcome
      expect(mockStorage.getMedia).toHaveBeenCalledWith('audio-1') // Objectives
      expect(mockStorage.getMedia).toHaveBeenCalledWith('caption-1') // Objectives
      expect(mockStorage.getMedia).toHaveBeenCalledWith('audio-2') // First topic
      expect(mockStorage.getMedia).toHaveBeenCalledWith('caption-2') // First topic
    })
  })
})