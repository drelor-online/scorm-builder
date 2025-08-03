import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import { MediaStore } from '../MediaStore'
import type { EnhancedCourseContent } from '../../types/scorm'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock MediaStore
vi.mock('../MediaStore', () => ({
  MediaStore: {
    getMedia: vi.fn()
  }
}))

describe('rustScormGenerator - Production Regression Test', () => {
  const mockProjectId = 'Natural_Gas_Safety_SCORM'
  let mockInvoke: any
  
  beforeEach(async () => {
    mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke)
    vi.clearAllMocks()
    console.log = vi.fn() // Capture console logs
    console.error = vi.fn()
    console.warn = vi.fn()
  })

  it('should reproduce the production regression with no media and empty knowledge checks', async () => {
    // This test reproduces the exact issue from production
    const courseContent: EnhancedCourseContent = {
      title: 'Natural Gas Safety',
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome to Natural Gas Safety',
        content: 'Welcome content',
        startButtonText: 'Start Course',
        audioFile: 'audio-0.bin',
        captionFile: 'caption-0.bin',
        media: [{
          id: 'welcome-img',
          type: 'image',
          url: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Gas-natural.jpg',
          title: 'Natural gas - Wikipedia'
        }]
      },
      objectives: ['Objective 1', 'Objective 2'],
      objectivesPage: {
        audioFile: 'audio-1.bin',
        captionFile: 'caption-1.bin',
        media: [{
          id: 'obj-img',
          type: 'image',
          url: 'blob:http://localhost/obj-image',
          title: 'entrust solutions group logo.png'
        }]
      },
      topics: [{
        id: 'safety-fundamentals',
        title: 'Core Principles of Natural Gas Safety',
        content: '<h2>Understanding Natural Gas</h2><p>Natural gas is primarily...',
        audioFile: 'audio-2.bin',
        captionFile: 'caption-2.bin',
        media: [{
          id: 'yt-video',
          type: 'video',
          url: 'https://www.youtube.com/watch?v=-njmj0diWu8',
          title: 'Natural Gas Safety Video'
        }],
        knowledgeCheck: {
          type: 'multiple-choice',
          question: 'Why is mercaptan added to natural gas?',
          options: [
            'To make it burn hotter',
            'To aid in leak detection by giving it a distinct odor',
            'To make it lighter than air',
            'To prevent pipes from corroding'
          ],
          correctAnswer: 1,
          feedback: {
            correct: "Correct! Mercaptan provides the recognizable 'rotten egg' smell to help detect leaks, as natural gas is naturally odorless."
          }
        }
      }, {
        id: 'hazard-identification',
        title: 'Recognizing and Identifying Gas Hazards',
        content: '<h2>Sensing Danger: How to Identify Hazards</h2><p>Hazard identification...',
        audioFile: 'audio-3.bin',
        captionFile: 'caption-3.bin',
        media: [{
          id: 'hazard-img',
          type: 'image',
          url: 'blob:http://localhost/hazard-image',
          title: 'entrust solutions group logo.png'
        }],
        knowledgeCheck: undefined // No knowledge check on this topic
      }],
      assessment: {
        questions: [{
          question: 'What is the primary component of natural gas?',
          options: ['Propane', 'Methane', 'Butane', 'Ethane'],
          correctAnswer: 1
        }]
      }
    }

    // Mock MediaStore to NOT find blob URLs (simulating production issue)
    vi.mocked(MediaStore.getMedia).mockResolvedValue(null)

    // Mock Rust invocation with empty result
    const emptyScormPackage = new Array(1000).fill(0)
    mockInvoke.mockResolvedValue(emptyScormPackage)

    // Call the function
    await generateRustSCORM(courseContent, mockProjectId)

    // Verify the media files count is 0 (as shown in production logs)
    expect(console.log).toHaveBeenCalledWith('[Rust SCORM] Media files count:', 0)
    
    // Verify the blob URLs resulted in warnings
    expect(console.warn).toHaveBeenCalledWith(
      '[Rust SCORM] Blob URL not supported: blob:http://localhost/obj-image'
    )
    expect(console.warn).toHaveBeenCalledWith(
      '[Rust SCORM] Blob URL not supported: blob:http://localhost/hazard-image'
    )

    // Verify the data sent to Rust has empty URLs for blob media
    const [, invokeArgs] = mockInvoke.mock.calls[0]
    const { courseData, mediaFiles } = invokeArgs as any

    // Check objectives page media has empty URL
    expect(courseData.learning_objectives_page.media[0].url).toBe('')
    
    // Check topic media has empty URL for blob
    expect(courseData.topics[1].media[0].url).toBe('')
    
    // External URLs should be preserved
    expect(courseData.welcome_page.media[0].url).toBe('https://upload.wikimedia.org/wikipedia/commons/0/06/Gas-natural.jpg')
    expect(courseData.topics[0].media[0].url).toBe('https://www.youtube.com/watch?v=-njmj0diWu8')

    // mediaFiles should be undefined since no blobs were resolved
    expect(mediaFiles).toBeUndefined()

    // Knowledge checks should be present in the data
    expect(courseData.topics[0].knowledge_check).toBeDefined()
    expect(courseData.topics[0].knowledge_check.questions).toHaveLength(1)
    expect(courseData.topics[0].knowledge_check.questions[0].text).toBe('Why is mercaptan added to natural gas?')
  })

  it('should demonstrate the media loading issue when MediaStore has stale data', async () => {
    // This simulates another production scenario where MediaStore might have different project data
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        media: [{
          id: 'test-img',
          type: 'image',
          url: 'blob:http://localhost/test-image',
          title: 'Test Image'
        }]
      }]
    }

    // Mock MediaStore returning null (media not found for this project)
    vi.mocked(MediaStore.getMedia).mockImplementation(async (id, projectId) => {
      // Simulate the media existing but for a different project
      console.log(`[MediaStore Mock] Looking for ${id} in project ${projectId}`)
      return null // Media not found
    })

    mockInvoke.mockResolvedValue(new Array(100).fill(0))

    await generateRustSCORM(courseContent, mockProjectId)

    // Verify warning was logged about blob URL
    expect(console.warn).toHaveBeenCalledWith(
      '[Rust SCORM] Blob URL not supported: blob:http://localhost/test-image'
    )

    // Verify empty media files were sent to Rust
    const [, invokeArgs] = mockInvoke.mock.calls[0]
    expect(invokeArgs.mediaFiles).toBeUndefined()
  })

  it('should trace why knowledge check content is empty in generated HTML', async () => {
    // This test verifies the data structure matches what Rust expects
    const courseContent: EnhancedCourseContent = {
      title: 'Debug Test',
      topics: [{
        id: 'topic-1',
        title: 'Topic with KC',
        content: 'Test content',
        knowledgeCheck: {
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C'],
          correctAnswer: 0,
          explanation: 'Try again'
        }
      }]
    }

    mockInvoke.mockResolvedValue(new Array(100).fill(0))

    await generateRustSCORM(courseContent, mockProjectId)

    const [, invokeArgs] = mockInvoke.mock.calls[0]
    const { courseData } = invokeArgs as any

    // Verify the exact structure being sent to Rust
    const topic = courseData.topics[0]
    expect(topic).toMatchObject({
      id: 'topic-1',
      title: 'Topic with KC',
      content: 'Test content',
      knowledge_check: {
        enabled: true,
        questions: [{
          type: 'multiple-choice',
          text: 'Test question?', // This should be 'text', not 'question'
          options: ['A', 'B', 'C'],
          correct_answer: 'A', // Converted to actual option text
          explanation: 'Try again' // Using incorrect feedback as explanation
        }]
      }
    })

    // Verify data was logged showing knowledge check is present
    expect(console.log).toHaveBeenCalledWith(
      '[Rust SCORM] Converted data:',
      expect.stringContaining('"knowledge_check"')
    )
  })
})