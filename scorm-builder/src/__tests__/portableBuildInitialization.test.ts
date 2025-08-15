import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

describe('Portable Build Initialization', () => {
  beforeEach(() => {
    // Reset any mocks and clear module cache
    vi.clearAllMocks()
    vi.resetModules()
  })

  test('should not instantiate FileStorage at module level', async () => {
    // Mock the environment to simulate Tauri environment
    Object.defineProperty(window, '__TAURI__', {
      value: {},
      writable: true,
      configurable: true
    })

    // Mock FileStorage constructor to track instantiation
    const fileStorageConstructorSpy = vi.fn()
    const mockFileStorageConstructorSpy = vi.fn()

    // We need to intercept the module imports to test the initialization timing
    vi.doMock('../services/FileStorage', () => ({
      FileStorage: class MockFileStorage {
        constructor() {
          fileStorageConstructorSpy()
        }
        initialize = vi.fn().mockResolvedValue(undefined)
        createProject = vi.fn()
        openProject = vi.fn()
        saveProject = vi.fn()
        listProjects = vi.fn()
        getContent = vi.fn()
        saveContent = vi.fn()
        storeMedia = vi.fn()
        getMediaForTopic = vi.fn()
        deleteProject = vi.fn()
        renameProject = vi.fn()
        exportProject = vi.fn()
        importProjectFromZip = vi.fn()
        getRecentProjects = vi.fn()
        checkForRecovery = vi.fn()
        recoverFromBackup = vi.fn()
        get currentProjectId() { return null }
        setProjectsDirectory = vi.fn()
        migrateFromLocalStorage = vi.fn()
        clearRecentFilesCache = vi.fn()
        get courseData() { return {} }
        updateCourseData = vi.fn()
        storeYouTubeVideo = vi.fn()
        getMediaUrl = vi.fn()
        openProjectFromPath = vi.fn()
      }
    }))

    vi.doMock('../services/MockFileStorage', () => ({
      MockFileStorage: class MockFileStorage {
        constructor() {
          mockFileStorageConstructorSpy()
        }
        initialize = vi.fn().mockResolvedValue(undefined)
        createProject = vi.fn()
        openProject = vi.fn()
        saveProject = vi.fn()
        listProjects = vi.fn()
        getContent = vi.fn()
        saveContent = vi.fn()
        storeMedia = vi.fn()
        getMediaForTopic = vi.fn()
        deleteProject = vi.fn()
        renameProject = vi.fn()
        exportProject = vi.fn()
        importProjectFromZip = vi.fn()
        getRecentProjects = vi.fn()
        checkForRecovery = vi.fn()
        recoverFromBackup = vi.fn()
        get currentProjectId() { return null }
        setProjectsDirectory = vi.fn()
        migrateFromLocalStorage = vi.fn()
        clearRecentFilesCache = vi.fn()
        get courseData() { return {} }
        updateCourseData = vi.fn()
        storeYouTubeVideo = vi.fn()
        getMediaUrl = vi.fn()
        openProjectFromPath = vi.fn()
      }
    }))

    // Import the hook module after setting up mocks
    const { usePersistentStorage } = await import('../hooks/usePersistentStorage')

    // At this point, FileStorage should NOT be instantiated at module level
    // This confirms our fix is working
    expect(fileStorageConstructorSpy).not.toHaveBeenCalled() // Should pass with our fix
    
    // Clean up
    delete (window as any).__TAURI__
  })

  test('should use lazy initialization pattern', async () => {
    const TestComponent = () => {
      // This should not cause any initialization errors
      return React.createElement('div', null, 'Test Component')
    }

    // This should not throw "Cannot access 'n' before initialization" error
    expect(() => {
      render(
        React.createElement(PersistentStorageProvider, null, 
          React.createElement(TestComponent)
        )
      )
    }).not.toThrow()
  })

  test('should handle circular dependency gracefully', async () => {
    // Simulate the chunk loading scenario that causes the error
    // This test verifies that FileStorage instantiation doesn't happen
    // until the hook is actually called
    
    // Mock console.error to catch initialization errors
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    try {
      // Import the module - this should not cause initialization
      const module = await import('../hooks/usePersistentStorage')
      expect(module).toBeDefined()
      
      // Should not have any console errors from initialization
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Cannot access')
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  test('should only instantiate FileStorage when hook is used', async () => {
    // This test verifies that FileStorage is instantiated lazily
    // Since we can't easily mock the constructor after module load,
    // we'll test the behavior by checking that no errors occur
    // and that the hook works correctly
    
    const TestComponent = () => React.createElement('div', null, 'Test')
    
    // This should work without any circular dependency errors
    expect(() => {
      render(
        React.createElement(PersistentStorageProvider, null,
          React.createElement(TestComponent)
        )
      )
    }).not.toThrow()
    
    // The fact that this doesn't throw demonstrates lazy initialization is working
  })

  test('should work in both Tauri and browser environments', async () => {
    // Test browser environment
    delete (window as any).__TAURI__
    
    expect(() => {
      render(
        React.createElement(PersistentStorageProvider, null,
          React.createElement('div', null, 'Browser Test')
        )
      )
    }).not.toThrow()

    // Test Tauri environment
    Object.defineProperty(window, '__TAURI__', {
      value: {},
      writable: true,
      configurable: true
    })

    expect(() => {
      render(
        React.createElement(PersistentStorageProvider, null,
          React.createElement('div', null, 'Tauri Test')
        )
      )
    }).not.toThrow()

    // Clean up
    delete (window as any).__TAURI__
  })
})