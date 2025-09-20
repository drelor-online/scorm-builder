/**
 * TDD Tests for Pre-Zip Validation Hard Fail Behavior
 * Based on external AI audit recommendation: "Convert pre-zip validation to blocking check"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tauri before importing any modules that use it
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn()
}))

// Mock MediaService before importing
vi.mock('./MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMediaBatchDirect: vi.fn(),
    listAllMedia: vi.fn()
  }))
}))

// Import the function we'll be testing
import { buildScormPackageEnhanced } from './rustScormGenerator'

describe('Pre-Zip Validation Hard Fail', () => {
  let mockMediaService: any
  let originalConsoleError: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Suppress console.error during tests
    originalConsoleError = console.error
    console.error = vi.fn()

    // Mock Tauri window object
    global.window = global.window || {}
    global.window.__TAURI__ = {
      invoke: vi.fn().mockResolvedValue(undefined)
    }

    // Get fresh mock instances
    const { createMediaService } = await import('./MediaService')
    mockMediaService = createMediaService('test-project')

    // Setup default mock responses
    mockMediaService.listAllMedia.mockResolvedValue([])
    mockMediaService.getMediaBatchDirect.mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    console.error = originalConsoleError
  })

  describe('Missing Media Detection', () => {
    it('should throw error when referenced media is missing from ZIP with strict validation', async () => {
      const courseContent = {
        title: 'Test Course',
        welcome: {
          title: 'Welcome',
          imageUrl: 'welcome-image'
        },
        objectivesPage: {
          title: 'Objectives',
          media: [{ id: 'objectives-image' }]
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            media: [
              { id: 'image-1', type: 'image' },
              { id: 'missing-image', type: 'image' }  // This will be missing
            ]
          }
        ]
      }

      const courseSeedData = {
        projectId: 'test-project',
        title: 'Test Course'
      }

      // Mock media cache that's missing some files
      const mockMediaCache = new Map([
        ['welcome-image', { data: new Uint8Array([1]), mimeType: 'image/jpeg' }],
        ['objectives-image', { data: new Uint8Array([2]), mimeType: 'image/png' }],
        ['image-1', { data: new Uint8Array([3]), mimeType: 'image/png' }]
        // 'missing-image' is intentionally not in cache
      ])

      const authoritativeExtensionMap = new Map([
        ['welcome-image', '.jpg'],
        ['objectives-image', '.png'],
        ['image-1', '.png'],
        ['missing-image', '.svg']  // Extension known but file missing
      ])

      // Test should fail when missing media detected with strict validation
      await expect(
        buildScormPackageEnhanced(
          courseContent,
          courseSeedData,
          mockMediaCache,
          authoritativeExtensionMap,
          { strictValidation: true }  // This option should trigger hard fail
        )
      ).rejects.toThrow('SCORM generation failed: 1 referenced media files are missing')
    })

    it('should provide detailed error message listing all missing media', async () => {
      const courseContent = {
        title: 'Test Course',
        welcome: {
          title: 'Welcome'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            content: 'Test content',
            media: [
              { id: 'missing-1', type: 'image' },
              { id: 'missing-2', type: 'video' },
              { id: 'present-file', type: 'image' }
            ]
          }
        ]
      }

      const courseSeedData = {
        projectId: 'test-project',
        title: 'Test Course'
      }

      const mockMediaCache = new Map([
        ['present-file', { data: new Uint8Array([1]), mimeType: 'image/png' }]
        // missing-1 and missing-2 are intentionally not in cache
      ])

      const authoritativeExtensionMap = new Map([
        ['missing-1', '.svg'],
        ['missing-2', '.mp4'],
        ['present-file', '.png']
      ])

      let thrownError: Error | null = null
      try {
        await buildScormPackageEnhanced(
          courseContent,
          courseSeedData,
          mockMediaCache,
          authoritativeExtensionMap,
          { strictValidation: true }
        )
      } catch (error) {
        thrownError = error as Error
      }

      expect(thrownError).toBeTruthy()
      expect(thrownError!.message).toContain('2 referenced media files are missing')
      expect(thrownError!.message).toContain('missing-1')
      expect(thrownError!.message).toContain('missing-2')
      expect(thrownError!.message).not.toContain('present-file')
    })

    it('should succeed when all referenced media is present', async () => {
      const courseContent = {
        title: 'Test Course',
        welcome: {
          title: 'Welcome'
        },
        objectivesPage: {
          title: 'Objectives'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            content: 'Test content',
            media: [
              { id: 'image-1', type: 'image' }
            ]
          }
        ]
      }

      const courseSeedData = {
        projectId: 'test-project',
        title: 'Test Course'
      }

      const mockMediaCache = new Map([
        ['image-1', { data: new Uint8Array([1]), mimeType: 'image/png' }]
      ])

      const authoritativeExtensionMap = new Map([
        ['image-1', '.png']
      ])

      // Should not throw when all media is present
      await expect(
        buildScormPackageEnhanced(
          courseContent,
          courseSeedData,
          mockMediaCache,
          authoritativeExtensionMap,
          { strictValidation: true }
        )
      ).resolves.toBeTruthy()
    })
  })

  describe('Validation Mode Configuration', () => {
    it('should use warning mode by default (backward compatibility)', async () => {
      const courseContent = {
        title: 'Test Course',
        welcome: {
          title: 'Welcome'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            content: 'Test content',
            media: [
              { id: 'missing-image', type: 'image' }
            ]
          }
        ]
      }

      const courseSeedData = {
        projectId: 'test-project',
        title: 'Test Course'
      }

      const mockMediaCache = new Map()  // Empty cache
      const authoritativeExtensionMap = new Map([
        ['missing-image', '.svg']
      ])

      // Should not throw with default (warning) mode
      await expect(
        buildScormPackageEnhanced(
          courseContent,
          courseSeedData,
          mockMediaCache,
          authoritativeExtensionMap
          // No options = default warning mode
        )
      ).resolves.toBeTruthy()
    })

    it('should respect explicit warning mode setting', async () => {
      const courseContent = {
        title: 'Test Course',
        welcome: {
          title: 'Welcome'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            content: 'Test content',
            media: [
              { id: 'missing-image', type: 'image' }
            ]
          }
        ]
      }

      const courseSeedData = {
        projectId: 'test-project',
        title: 'Test Course'
      }

      const mockMediaCache = new Map()
      const authoritativeExtensionMap = new Map([
        ['missing-image', '.svg']
      ])

      // Should not throw with explicit warning mode
      await expect(
        buildScormPackageEnhanced(
          courseContent,
          courseSeedData,
          mockMediaCache,
          authoritativeExtensionMap,
          { strictValidation: false }
        )
      ).resolves.toBeTruthy()
    })
  })

  describe('Extension Map Validation', () => {
    it('should throw when referenced ID lacks extension in authoritative map', async () => {
      const courseContent = {
        title: 'Test Course',
        welcome: {
          title: 'Welcome'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            content: 'Test content',
            media: [
              { id: 'image-without-ext', type: 'image' }
            ]
          }
        ]
      }

      const courseSeedData = {
        projectId: 'test-project',
        title: 'Test Course'
      }

      const mockMediaCache = new Map([
        ['image-without-ext', { data: new Uint8Array([1]), mimeType: 'image/png' }]
      ])

      const authoritativeExtensionMap = new Map()  // Empty map - no extensions

      await expect(
        buildScormPackageEnhanced(
          courseContent,
          courseSeedData,
          mockMediaCache,
          authoritativeExtensionMap,
          { strictValidation: true }
        )
      ).rejects.toThrow('Missing file extensions in authoritative map')
    })
  })
})