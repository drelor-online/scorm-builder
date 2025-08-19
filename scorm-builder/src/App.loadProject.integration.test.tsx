import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'

// Track console.log calls
let loadProjectCalls: string[] = []
const originalLog = console.log

beforeEach(() => {
  loadProjectCalls = []
  console.log = (...args: any[]) => {
    const msg = args[0]
    if (typeof msg === 'string' && msg.includes('[App.loadProject]')) {
      loadProjectCalls.push(msg)
    }
    originalLog(...args)
  }
})

afterEach(() => {
  console.log = originalLog
})

// Mock all the required modules
vi.mock('./config/loggerConfig', () => ({
  initializeLoggerConfig: vi.fn(),
  disableCategory: vi.fn(),
  enableCategory: vi.fn()
}))

vi.mock('./utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('./contexts/FileStorageContext', () => ({
  useFileStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    error: null,
    getContent: vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(null), 50))
    ),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    saveContent: vi.fn(),
    saveCourseMetadata: vi.fn(),
    saveProject: vi.fn(),
    createProject: vi.fn()
  }),
  FileStorageProvider: ({ children }: { children: React.ReactNode }) => children
}))

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

vi.mock('./services/MediaService', () => ({
  MediaService: class {
    static getInstance() {
      return {
        listAllMedia: vi.fn().mockResolvedValue([]),
        loadMediaFromDisk: vi.fn().mockResolvedValue(undefined),
        loadMediaFromProject: vi.fn().mockResolvedValue(undefined),
        loadMediaFromCourseContent: vi.fn().mockResolvedValue(undefined),
        getMedia: vi.fn().mockResolvedValue(null),
      }
    }
  }
}))

vi.mock('./services/BlobURLCache', () => ({
  BlobURLCache: class {
    private static instance: any = null
    
    static getInstance() {
      if (!this.instance) {
        this.instance = {
          getOrCreate: vi.fn().mockResolvedValue('blob:test-url'),
          revoke: vi.fn(),
          clearProject: vi.fn(),
          preload: vi.fn().mockResolvedValue({ successful: 0, failed: 0 }),
        }
      }
      return this.instance
    }
  }
}))

describe('App Integration - Load Project Performance', () => {
  it('should NOT load project multiple times with rapid re-renders', async () => {
    const { rerender } = render(<App />)
    
    // Wait for initial load to start
    await waitFor(() => {
      const startCalls = loadProjectCalls.filter(msg => 
        msg.includes('Starting to load project data')
      )
      expect(startCalls.length).toBeGreaterThan(0)
    }, { timeout: 1000 })
    
    // Clear calls to track only new ones
    const initialStartCalls = loadProjectCalls.filter(msg => 
      msg.includes('Starting to load project data')
    ).length
    
    // Rapid re-renders (simulating the real issue)
    for (let i = 0; i < 5; i++) {
      rerender(<App />)
      // Small delay between renders
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    
    // Wait for any pending operations
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Check if we prevented duplicate loads
    const duplicateLoadCalls = loadProjectCalls.filter(msg => 
      msg.includes('Already loading project, skipping duplicate load')
    )
    
    const additionalStartCalls = loadProjectCalls.filter(msg => 
      msg.includes('Starting to load project data')
    ).length - initialStartCalls
    
    // Should have prevented some duplicate loads
    expect(duplicateLoadCalls.length).toBeGreaterThan(0)
    // Should not have started multiple loads
    expect(additionalStartCalls).toBe(0)
  })
})