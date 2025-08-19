import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useFileStorage } from './contexts/FileStorageContext'

// Mock the logger config first
vi.mock('./config/loggerConfig', () => ({
  initializeLoggerConfig: vi.fn(),
  disableCategory: vi.fn(),
  enableCategory: vi.fn()
}))

// Mock all the dependencies
vi.mock('./utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('./utils/debugLog', () => ({
  debugLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock FileStorage context
vi.mock('./contexts/FileStorageContext', () => ({
  useFileStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    error: null,
    getContent: vi.fn().mockResolvedValue(null),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    saveContent: vi.fn(),
    saveCourseMetadata: vi.fn(),
    saveProject: vi.fn(),
    getAudioSettings: vi.fn().mockResolvedValue(null)
  }),
  FileStorageProvider: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('./services/MediaService', () => ({
  createMediaService: vi.fn(() => ({
    projectId: 'test-project',
    loadMediaFromDisk: vi.fn().mockResolvedValue(undefined),
    loadMediaFromProject: vi.fn().mockResolvedValue(undefined),
    loadMediaFromCourseContent: vi.fn().mockResolvedValue(undefined),
    listAllMedia: vi.fn().mockResolvedValue([]),
    getMedia: vi.fn()
  }))
}))

// Mock PerformanceMonitor
vi.mock('./utils/performanceMonitor', () => ({
  PerformanceMonitor: {
    getInstance: () => ({
      startMeasure: vi.fn(),
      endMeasure: vi.fn(),
      measureAsync: vi.fn((name, fn) => fn()),
      logMetrics: vi.fn()
    })
  }
}))

// Mock other contexts
vi.mock('./contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn()
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('./contexts/MediaServiceContext', () => ({
  useMediaService: () => ({
    mediaService: null
  }),
  MediaServiceProvider: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('./contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => ({
    getAllMedia: vi.fn().mockResolvedValue([]),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    createBlobUrl: vi.fn()
  }),
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('./contexts/PerformanceContext', () => ({
  usePerformance: () => ({
    measureAsync: vi.fn((name: string, fn: any) => fn())
  }),
  PerformanceProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Import App after all mocks
import App from './App'

describe('App Performance', () => {
  let getContentSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup storage mock
    const storage = {
      isInitialized: true,
      currentProjectId: 'test-project',
      error: null,
      getContent: vi.fn().mockResolvedValue(null),
      getCourseMetadata: vi.fn().mockResolvedValue(null),
      saveContent: vi.fn(),
      saveCourseMetadata: vi.fn(),
      saveProject: vi.fn(),
      getAudioSettings: vi.fn().mockResolvedValue(null)
    }
    
    getContentSpy = storage.getContent
    
    vi.mocked(useFileStorage).mockReturnValue(storage)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Project Loading', () => {
    it('should not load project multiple times for the same project ID', async () => {
      const { rerender } = render(<App />)
      
      // Wait for initial load
      await vi.waitFor(() => {
        expect(getContentSpy).toHaveBeenCalled()
      })
      
      const initialCallCount = getContentSpy.mock.calls.length
      
      // Force re-render
      rerender(<App />)
      
      // Wait a bit to see if it loads again
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should not have loaded again
      expect(getContentSpy).toHaveBeenCalledTimes(initialCallCount)
    })

    it('should use a loading flag to prevent concurrent loads', async () => {
      // Track when getContent is called with courseSeedData
      const loadStartTimes: number[] = []
      getContentSpy.mockImplementation((key: string) => {
        if (key === 'courseSeedData') {
          loadStartTimes.push(Date.now())
        }
        // Simulate slow load
        return new Promise(resolve => setTimeout(() => resolve(null), 100))
      })
      
      const { rerender } = render(<App />)
      
      // Rapidly trigger re-renders (simulating the real issue)
      for (let i = 0; i < 5; i++) {
        rerender(<App />)
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Should only have one load for courseSeedData
      const courseSeedDataCalls = getContentSpy.mock.calls.filter(
        (call: any[]) => call[0] === 'courseSeedData'
      ).length
      
      // FAILING TEST: Currently multiple loads happen
      expect(courseSeedDataCalls).toBe(1)
    })

    it('should load project when project ID changes', async () => {
      const storage = {
        isInitialized: true,
        currentProjectId: 'project-1',
        error: null,
        getContent: vi.fn().mockResolvedValue(null),
        getCourseMetadata: vi.fn().mockResolvedValue(null),
        saveContent: vi.fn(),
        getAudioSettings: vi.fn().mockResolvedValue(null)
      }
      
      vi.mocked(useFileStorage).mockReturnValue(storage)
      
      const { rerender } = render(<App />)
      
      // Wait for initial load
      await vi.waitFor(() => {
        expect(storage.getContent).toHaveBeenCalled()
      })
      
      const initialCallCount = storage.getContent.mock.calls.length
      
      // Change project ID
      storage.currentProjectId = 'project-2'
      
      // Force re-render
      rerender(<App />)
      
      // Wait for new load
      await vi.waitFor(() => {
        expect(storage.getContent.mock.calls.length).toBeGreaterThan(initialCallCount)
      })
      
      // Should have loaded the new project
      expect(storage.getContent.mock.calls.length).toBeGreaterThan(initialCallCount)
    })

    it('should not trigger multiple concurrent loads', async () => {
      let resolveGetContent: any
      const getContentPromise = new Promise(resolve => {
        resolveGetContent = resolve
      })
      
      const storage = {
        isInitialized: true,
        currentProjectId: 'test-project',
        error: null,
        getContent: vi.fn().mockReturnValue(getContentPromise),
        getCourseMetadata: vi.fn().mockResolvedValue(null),
        saveContent: vi.fn(),
        getAudioSettings: vi.fn().mockResolvedValue(null)
      }
      
      vi.mocked(useFileStorage).mockReturnValue(storage)
      
      const { rerender } = render(<App />)
      
      // Multiple re-renders while loading
      rerender(<App />)
      rerender(<App />)
      rerender(<App />)
      
      // Resolve the loading
      resolveGetContent(null)
      
      await vi.waitFor(() => {
        expect(storage.getContent).toHaveBeenCalled()
      })
      
      // Should only have started one load despite multiple re-renders
      // The exact count depends on how many different content types are loaded
      // but it should be a reasonable number, not multiplied by re-renders
      const callCount = storage.getContent.mock.calls.length
      expect(callCount).toBeLessThan(20) // Reasonable upper bound
    })
  })
})