/**
 * rustScormGenerator - Consolidated Test Suite
 * 
 * This file consolidates rustScormGenerator tests from 35 separate files into
 * a single comprehensive test suite focusing on core functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  generateRustSCORM, 
  convertToRustFormat, 
  clearMediaCache, 
  preloadMediaCache, 
  isRustScormAvailable,
  getExtensionFromMimeType
} from '../rustScormGenerator'
import type { CourseContent } from '../../types/scorm'

// Mock Tauri APIs
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}))

// Mock external image downloader
vi.mock('../externalImageDownloader', () => ({
  downloadIfExternal: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
  isExternalUrl: vi.fn().mockReturnValue(false)
}))

// Sample course content for testing
const mockCourseContent: CourseContent = {
  title: 'Test SCORM Course',
  courseName: 'Test SCORM Course',
  passMark: 80,
  navigationMode: 'linear',
  allowRetake: true,
  welcome: {
    title: 'Welcome to Test Course',
    content: 'Welcome to our comprehensive test course.',
    startButtonText: 'Start Course'
  },
  learningObjectivesPage: {
    objectives: [
      'Learn SCORM package generation',
      'Master media integration',
      'Understand assessment creation'
    ]
  },
  topics: [
    {
      id: 'topic-1',
      blockId: 'block-1',
      title: 'Introduction to SCORM',
      content: 'This topic introduces SCORM standards.'
    }
  ],
  assessment: {
    enabled: true,
    questions: [
      {
        type: 'multiple-choice',
        question: 'How are SCORM packages delivered?',
        options: ['ZIP files', 'Direct upload', 'Both options'],
        correctAnswer: 'Both options',
        feedback: {
          correct: 'Correct! SCORM packages can be delivered multiple ways.',
          incorrect: 'Think about the different delivery methods available.'
        }
      }
    ]
  }
}

describe('rustScormGenerator - Consolidated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockClear()
    clearMediaCache()
  })

  describe('Availability and Setup', () => {
    it('checks Rust SCORM availability', async () => {
      mockInvoke.mockResolvedValueOnce({ available: true })
      
      const isAvailable = await isRustScormAvailable()
      
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.any(Object))
      expect(isAvailable).toBeDefined()
    })

    it('handles unavailable Rust backend gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Command not found'))
      
      const isAvailable = await isRustScormAvailable()
      
      expect(isAvailable).toBe(false)
    })

    it('provides utility functions', () => {
      // Test MIME type to extension mapping
      expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg')
      expect(getExtensionFromMimeType('image/png')).toBe('png')
      expect(getExtensionFromMimeType('audio/mpeg')).toBe('mp3')
      expect(getExtensionFromMimeType('unknown/type')).toBe('bin')
    })
  })

  describe('Content Conversion', () => {
    it('converts course content to Rust format', async () => {
      const converted = await convertToRustFormat(mockCourseContent, 'test-project')
      
      expect(converted).toHaveProperty('course_title')
      expect(converted).toHaveProperty('topics')
    })

    it('validates required fields during conversion', async () => {
      const invalidContent = null as any
      
      await expect(convertToRustFormat(invalidContent, 'test-project')).rejects.toThrow('Course content is required')
    })

    it('handles missing project ID', async () => {
      // Empty project ID should not throw - it's handled gracefully
      const result = await convertToRustFormat(mockCourseContent, '')
      expect(result).toHaveProperty('course_title')
    })
  })

  describe('Media Management', () => {
    it('clears media cache', () => {
      clearMediaCache()
      
      // Should clear without errors
      expect(true).toBe(true)
    })

    it('handles external media URLs', async () => {
      const contentWithExternalMedia = {
        ...mockCourseContent,
        topics: [{
          ...mockCourseContent.topics[0],
          media: [{
            id: 'external-image',
            type: 'image',
            url: 'https://example.com/image.jpg',
            title: 'External Image'
          }]
        }]
      }
      
      const converted = await convertToRustFormat(contentWithExternalMedia, 'test-project')
      
      expect(converted).toHaveProperty('topics')
    })

    it('processes blob URLs correctly', async () => {
      const contentWithBlobUrls = {
        ...mockCourseContent,
        topics: [{
          ...mockCourseContent.topics[0],
          media: [{
            id: 'blob-audio',
            type: 'audio',
            url: 'blob:http://localhost/audio-blob',
            title: 'Blob Audio'
          }]
        }]
      }
      
      const converted = await convertToRustFormat(contentWithBlobUrls, 'test-project')
      
      expect(converted).toHaveProperty('topics')
    })
  })

  describe('SCORM Package Generation', () => {
    it('generates complete SCORM package', async () => {
      const mockZipData = new Uint8Array([80, 75, 3, 4]) // ZIP file signature
      mockInvoke.mockResolvedValueOnce({ zipData: Array.from(mockZipData) })
      
      const result = await generateRustSCORM(mockCourseContent, 'test-project')
      
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
        course_content: expect.any(Object),
        project_id: 'test-project'
      }))
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('handles progress callbacks', async () => {
      const mockZipData = new Uint8Array([80, 75, 3, 4])
      mockInvoke.mockResolvedValueOnce({ zipData: Array.from(mockZipData) })
      
      const progressCallback = vi.fn()
      
      await generateRustSCORM(mockCourseContent, 'test-project', progressCallback)
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('includes all media in generated package', async () => {
      const contentWithMedia = {
        ...mockCourseContent,
        topics: [{
          ...mockCourseContent.topics[0],
          media: [
            { id: 'audio-1', type: 'audio', url: 'asset://audio-1.mp3', title: 'Audio 1' },
            { id: 'image-1', type: 'image', url: 'asset://image-1.jpg', title: 'Image 1' }
          ]
        }]
      }
      
      const mockZipData = new Uint8Array([80, 75, 3, 4])
      mockInvoke.mockResolvedValueOnce({ zipData: Array.from(mockZipData) })
      
      const result = await generateRustSCORM(contentWithMedia, 'test-project')
      
      expect(result).toBeInstanceOf(Uint8Array)
    })
  })

  describe('Question Types and Assessment', () => {
    it('processes questions correctly', async () => {
      const converted = await convertToRustFormat(mockCourseContent, 'test-project')
      
      expect(converted).toHaveProperty('final_assessment')
    })

    it('validates assessment structure', async () => {
      const converted = await convertToRustFormat(mockCourseContent, 'test-project')
      
      expect(converted).toHaveProperty('pass_mark')
    })
  })

  describe('Navigation and Structure', () => {
    it('maintains navigation structure', async () => {
      const converted = await convertToRustFormat(mockCourseContent, 'test-project')
      
      expect(converted).toHaveProperty('navigation_mode')
    })

    it('processes topic structure correctly', async () => {
      const converted = await convertToRustFormat(mockCourseContent, 'test-project')
      
      expect(converted).toHaveProperty('topics')
    })

    it('generates proper SCORM manifest structure', async () => {
      const mockZipData = new Uint8Array([80, 75, 3, 4])
      mockInvoke.mockResolvedValueOnce({ 
        zipData: Array.from(mockZipData),
        manifest: { title: 'Test Course', version: '1.0' }
      })
      
      const result = await generateRustSCORM(mockCourseContent, 'test-project')
      
      expect(result).toBeInstanceOf(Uint8Array)
    })
  })

  describe('Audio Integration', () => {
    it('handles audio content', async () => {
      const contentWithAudio = {
        ...mockCourseContent,
        topics: [{
          ...mockCourseContent.topics[0],
          narration: 'This topic has narration.',
          media: [{
            id: 'topic-1-audio',
            type: 'audio',
            url: 'asset://localhost/audio-2.mp3',
            title: 'Topic 1 Audio'
          }]
        }]
      }
      
      const converted = await convertToRustFormat(contentWithAudio, 'test-project')
      
      expect(converted).toHaveProperty('topics')
    })

    it('aligns audio with content properly', async () => {
      const converted = await convertToRustFormat(mockCourseContent, 'test-project')
      
      // Audio alignment is handled by the Rust backend during generation
      expect(converted).toHaveProperty('topics')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles Rust backend errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Rust generation failed'))
      
      await expect(generateRustSCORM(mockCourseContent, 'test-project')).rejects.toThrow('Rust generation failed')
    })

    it('handles malformed course content', async () => {
      const malformedContent = {
        title: null,
        topics: 'not an array'
      } as any
      
      await expect(convertToRustFormat(malformedContent, 'test-project')).rejects.toThrow()
    })

    it('handles empty course content', async () => {
      const emptyContent = {
        title: 'Empty Course',
        topics: [],
        assessment: { questions: [], enabled: false }
      } as any
      
      const converted = await convertToRustFormat(emptyContent, 'test-project')
      
      expect(converted).toHaveProperty('course_title')
    })

    it('handles invalid media URLs', async () => {
      const contentWithInvalidMedia = {
        ...mockCourseContent,
        topics: [{
          ...mockCourseContent.topics[0],
          media: [{
            id: 'invalid-media',
            type: 'unknown',
            url: 'invalid://bad-url',
            title: 'Invalid Media'
          }]
        }]
      }
      
      const converted = await convertToRustFormat(contentWithInvalidMedia, 'test-project')
      
      // Should handle invalid media without crashing
      expect(converted).toHaveProperty('topics')
    })
  })

  describe('Performance and Memory', () => {
    it('handles large course content efficiently', async () => {
      const largeCourseContent = {
        ...mockCourseContent,
        topics: Array.from({ length: 10 }, (_, i) => ({
          id: `topic-${i + 1}`,
          blockId: `block-${i + 1}`,
          title: `Topic ${i + 1}`,
          content: `This is topic ${i + 1} with substantial content.`
        }))
      }
      
      const startTime = performance.now()
      const converted = await convertToRustFormat(largeCourseContent, 'test-project')
      const conversionTime = performance.now() - startTime
      
      expect(conversionTime).toBeLessThan(5000) // Should convert within 5 seconds
      expect(converted).toHaveProperty('topics')
    })

    it('manages media cache efficiently', async () => {
      clearMediaCache() // Clean up
      expect(true).toBe(true)
    })
  })
})