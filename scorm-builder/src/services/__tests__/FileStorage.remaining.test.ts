import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileStorage } from '../FileStorage'

// Mock Tauri's invoke and event functions
const mockInvoke = vi.fn()
const mockListen = vi.fn()
const mockEmit = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, handler: any) => mockListen(event, handler),
  emit: (event: string, payload?: any) => mockEmit(event, payload),
  TauriEvent: {
    WINDOW_CLOSE_REQUESTED: 'tauri://close-requested',
    FILE_DROP: 'tauri://file-drop'
  }
}))

describe('FileStorage - Remaining Features', () => {
  let fileStorage: FileStorage
  const projectId = '1234567890'
  const projectPath = `C:\\Projects\\TestProject_${projectId}.scormproj`
  
  beforeEach(() => {
    fileStorage = new FileStorage()
    fileStorage['_currentProjectPath'] = projectPath
    fileStorage['_currentProjectId'] = projectId
    mockInvoke.mockClear()
    mockListen.mockClear()
    mockEmit.mockClear()
    
    // Mock localStorage
    const localStorageMock: Record<string, string> = {}
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key]
        }),
        clear: vi.fn(() => {
          Object.keys(localStorageMock).forEach(key => delete localStorageMock[key])
        })
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('State Change Notifications', () => {
    it('should subscribe to Tauri events when adding listener', () => {
      const callback = vi.fn()
      
      // Mock listen to return an unsubscribe function
      const unsubscribe = vi.fn()
      mockListen.mockResolvedValue(unsubscribe)
      
      const cleanup = fileStorage.addStateChangeListener(callback)
      
      // Should subscribe to relevant Tauri events
      expect(mockListen).toHaveBeenCalled()
      
      // Cleanup should unsubscribe
      expect(cleanup).toBeInstanceOf(Function)
    })

    it('should notify listener when project is saved', async () => {
      const callback = vi.fn()
      let eventHandler: any = null
      
      // Capture the event handler when listen is called
      mockListen.mockImplementation((event, handler) => {
        if (event === 'project-saved') {
          eventHandler = handler
        }
        return Promise.resolve(vi.fn())
      })
      
      fileStorage.addStateChangeListener(callback)
      
      // Simulate a save event
      if (eventHandler) {
        await eventHandler({ 
          payload: { 
            projectId, 
            timestamp: new Date().toISOString() 
          } 
        })
      }
      
      // Callback should be called with state update
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'project-saved',
        projectId
      }))
    })

    it('should handle multiple listeners', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      mockListen.mockResolvedValue(vi.fn())
      
      const cleanup1 = fileStorage.addStateChangeListener(callback1)
      const cleanup2 = fileStorage.addStateChangeListener(callback2)
      
      // Both should return cleanup functions
      expect(cleanup1).toBeInstanceOf(Function)
      expect(cleanup2).toBeInstanceOf(Function)
      
      // Should have registered listeners
      expect(mockListen).toHaveBeenCalledTimes(2)
    })

    it('should cleanup listener when unsubscribe is called', async () => {
      const callback = vi.fn()
      const unsubscribe = vi.fn()
      
      mockListen.mockResolvedValue(unsubscribe)
      
      const cleanup = fileStorage.addStateChangeListener(callback)
      
      // Call cleanup
      await cleanup()
      
      // Should have called the unsubscribe function
      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe('LocalStorage Migration', () => {
    it('should migrate media data from localStorage to Tauri storage', async () => {
      // Setup localStorage with legacy data
      const legacyMedia = {
        'media-1': { id: 'media-1', type: 'image', url: 'blob:123' },
        'media-2': { id: 'media-2', type: 'audio', url: 'blob:456' }
      }
      
      localStorage.setItem('scorm_builder_media', JSON.stringify(legacyMedia))
      localStorage.setItem('scorm_builder_project', JSON.stringify({ id: 'old-project' }))
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'migrate_from_localstorage') {
          return Promise.resolve({
            migratedItems: 2,
            success: true
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.migrateFromLocalStorage()
      
      // Should return list of migrated items
      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
      
      // Should have called migration command
      expect(mockInvoke).toHaveBeenCalledWith('migrate_from_localstorage', expect.objectContaining({
        data: expect.any(Object)
      }))
      
      // Should clear localStorage after successful migration
      expect(localStorage.removeItem).toHaveBeenCalledWith('scorm_builder_media')
      expect(localStorage.removeItem).toHaveBeenCalledWith('scorm_builder_project')
    })

    it('should handle empty localStorage gracefully', async () => {
      // No data in localStorage
      mockInvoke.mockResolvedValue({ migratedItems: 0, success: true })
      
      const result = await fileStorage.migrateFromLocalStorage()
      
      expect(result).toEqual([])
      expect(mockInvoke).not.toHaveBeenCalled() // Should not call if nothing to migrate
    })

    it('should handle migration errors without data loss', async () => {
      // Setup localStorage with data
      localStorage.setItem('scorm_builder_media', JSON.stringify({ 'media-1': {} }))
      
      mockInvoke.mockRejectedValue(new Error('Migration failed'))
      
      const result = await fileStorage.migrateFromLocalStorage()
      
      // Should return empty array on error
      expect(result).toEqual([])
      
      // Should NOT clear localStorage on error
      expect(localStorage.removeItem).not.toHaveBeenCalled()
    })

    it('should detect and migrate course content from localStorage', async () => {
      const courseContent = {
        pages: [{ id: 'page1', title: 'Test Page' }],
        metadata: { version: '1.0' }
      }
      
      localStorage.setItem('scorm_builder_course_content', JSON.stringify(courseContent))
      
      mockInvoke.mockResolvedValue({ migratedItems: 1, success: true })
      
      const result = await fileStorage.migrateFromLocalStorage()
      
      expect(result).toContainEqual(expect.objectContaining({
        type: 'course_content',
        itemCount: 1
      }))
    })
  })

  describe('Recent Files Cache', () => {
    it('should clear recent files cache when requested', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'clear_recent_files') {
          return Promise.resolve({ cleared: 5 })
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.clearRecentFilesCache()
      
      // Should call the backend command
      expect(mockInvoke).toHaveBeenCalledWith('clear_recent_files', {})
    })

    it('should update internal cache after clearing', async () => {
      // Set up some recent files in internal cache
      fileStorage['recentFiles'] = [
        { id: '1', name: 'Project1' },
        { id: '2', name: 'Project2' }
      ]
      
      mockInvoke.mockResolvedValue({ cleared: 2 })
      
      await fileStorage.clearRecentFilesCache()
      
      // Internal cache should be cleared
      expect(fileStorage['recentFiles']).toEqual([])
    })

    it('should handle clear cache errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed to clear cache'))
      
      // Should not throw
      await expect(fileStorage.clearRecentFilesCache()).resolves.not.toThrow()
      
      // Should log the error (check debug logger was called)
      expect(mockInvoke).toHaveBeenCalledWith('clear_recent_files', {})
    })

    it('should emit cache-cleared event after successful clear', async () => {
      mockInvoke.mockResolvedValue({ cleared: 3 })
      
      await fileStorage.clearRecentFilesCache()
      
      // Should emit an event for UI updates
      expect(mockEmit).toHaveBeenCalledWith('cache-cleared', expect.objectContaining({
        type: 'recent-files'
      }))
    })
  })

  describe('Integration between features', () => {
    it('should trigger state change notification after migration', async () => {
      const callback = vi.fn()
      let eventHandler: any = null
      
      mockListen.mockImplementation((event, handler) => {
        if (event === 'migration-complete') {
          eventHandler = handler
        }
        return Promise.resolve(vi.fn())
      })
      
      fileStorage.addStateChangeListener(callback)
      
      // Setup migration data
      localStorage.setItem('scorm_builder_media', JSON.stringify({ 'media-1': {} }))
      mockInvoke.mockResolvedValue({ migratedItems: 1, success: true })
      
      await fileStorage.migrateFromLocalStorage()
      
      // Should trigger state change
      if (eventHandler) {
        await eventHandler({ 
          payload: { 
            type: 'migration-complete',
            itemCount: 1 
          } 
        })
      }
      
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'migration-complete'
      }))
    })
  })
})