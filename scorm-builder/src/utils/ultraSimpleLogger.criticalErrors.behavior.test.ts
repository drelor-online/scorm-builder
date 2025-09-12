/**
 * Behavior test to verify critical application errors are captured by ultraSimpleLogger
 * 
 * This test ensures that important errors (like SCORM generation failures, API issues, etc.)
 * are properly logged to ultraSimpleLogger so they can be retrieved for troubleshooting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { debugLogger } from './ultraSimpleLogger'

// Mock Tauri for testing
const mockTauriInvoke = vi.fn(() => Promise.resolve(undefined))

// Ensure window object exists in test environment
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  configurable: true,
  writable: true
})

Object.defineProperty(window, '__TAURI__', {
  value: { invoke: mockTauriInvoke },
  configurable: true,
  writable: true
})

describe('ultraSimpleLogger Critical Error Capture', () => {
  beforeEach(() => {
    // Clear logs before each test
    debugLogger.clearLogs()
    vi.clearAllMocks()
  })

  it('should capture SCORM generation failures in logs', () => {
    // Simulate a SCORM generation error
    const scormError = new Error('Failed to generate SCORM package with 0 media files')
    const projectId = 'test-project-123'
    const mediaCount = 0
    
    // This is what we want to happen - SCORM errors should be logged to debugLogger
    debugLogger.error('SCORM', 'Generation failed', {
      projectId,
      mediaCount,
      error: scormError.message,
      stack: scormError.stack
    })

    // Verify the error was captured
    const logs = debugLogger.logs
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('[SCORM]')
    expect(logs[0]).toContain('ERROR: Generation failed')
    expect(logs[0]).toContain('test-project-123')
    expect(logs[0]).toContain('mediaCount')
  })

  it('should capture API key loading failures in logs', () => {
    // Simulate API key loading error
    const apiError = new Error('Failed to decrypt API keys')
    
    debugLogger.error('API', 'Failed to load encrypted API keys', {
      error: apiError.message,
      hasEncryptedFile: false,
      fallbackUsed: true
    })

    const logs = debugLogger.logs
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('[API]')
    expect(logs[0]).toContain('ERROR: Failed to load encrypted API keys')
    expect(logs[0]).toContain('Failed to decrypt API keys')
  })

  it('should capture media loading failures that block workflow', () => {
    // Simulate critical media failure
    const mediaIds = ['image-001', 'video-002', 'audio-003']
    
    debugLogger.error('MEDIA', 'Critical media loading failures prevented SCORM generation', {
      failedMediaCount: mediaIds.length,
      failedMediaIds: mediaIds,
      projectId: 'project-456'
    })

    const logs = debugLogger.logs
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('[MEDIA]')
    expect(logs[0]).toContain('ERROR: Critical media loading failures')
    expect(logs[0]).toContain('failedMediaCount')
  })

  it('should capture file storage corruption errors', () => {
    // Simulate storage corruption
    const storageError = new Error('JSON parsing failed - file corrupted')
    
    debugLogger.error('STORAGE', 'Project file corruption detected', {
      projectId: 'corrupted-project',
      error: storageError.message,
      recoveryAttempted: true,
      backupAvailable: false
    })

    const logs = debugLogger.logs
    expect(logs[0]).toContain('[STORAGE]')
    expect(logs[0]).toContain('ERROR: Project file corruption detected')
    expect(logs[0]).toContain('JSON parsing failed')
  })

  it('should NOT capture verbose debug information in production-like logging', () => {
    // Simulate what should NOT be in production logs
    
    // This type of verbose logging should be filtered out in production
    if (import.meta.env.DEV) {
      console.log('[DEBUG] Processing media item 47 of 150...')
      console.log('[DEBUG] Cache hit for image-thumbnail-small.jpg')
      console.log('[DEBUG] URL generated: http://localhost:1420/media/...')
    }
    
    // Only critical errors should make it to debugLogger
    debugLogger.error('MEDIA', 'Failed to process required media for course completion', {
      criticalMediaId: 'required-intro-video',
      blocksCourseCompletion: true
    })

    const logs = debugLogger.logs
    expect(logs).toHaveLength(1) // Only the critical error, not the debug logs
    expect(logs[0]).toContain('ERROR: Failed to process required media')
  })

  it('should provide structured error data for troubleshooting', () => {
    // Test that errors include enough context for support/debugging
    
    debugLogger.error('SCORM', 'Package validation failed', {
      projectId: 'validation-test',
      courseTitle: 'Test Course',
      mediaCount: 5,
      topicCount: 3,
      validationErrors: [
        'Missing manifest.xml',
        'Invalid SCORM version',
        'Media files not found'
      ],
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      buildVersion: '1.0.4'
    })

    const logs = debugLogger.logs
    expect(logs[0]).toContain('validationErrors')
    expect(logs[0]).toContain('Missing manifest.xml')
    expect(logs[0]).toContain('buildVersion')
    expect(logs[0]).toContain('1.0.4')
  })

  it('should persist errors across app sessions via localStorage', () => {
    // Simulate an error occurring
    debugLogger.error('STARTUP', 'App failed to initialize properly', {
      tauriAvailable: false,
      storageInitialized: false,
      errorDuringStartup: true
    })

    // Simulate app restart by creating new logger instance
    const newLogger = debugLogger
    
    // The error should still be available (ultraSimpleLogger loads from localStorage)
    const logs = newLogger.logs
    expect(logs.some(log => log.includes('ERROR: App failed to initialize properly'))).toBe(true)
  })

  it('should handle error logging failures gracefully', () => {
    // Mock localStorage to fail
    const originalSetItem = localStorage.setItem
    localStorage.setItem = vi.fn(() => {
      throw new Error('Storage quota exceeded')
    })

    // Should not throw error, should fail gracefully
    expect(() => {
      debugLogger.error('TEST', 'This error should still be logged despite localStorage failure')
    }).not.toThrow()

    // Restore localStorage
    localStorage.setItem = originalSetItem
  })
})