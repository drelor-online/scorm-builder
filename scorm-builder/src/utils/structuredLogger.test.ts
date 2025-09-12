/**
 * Test structured logger functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { structuredLogger, logScormError, logProjectError, logMediaError, logApiError } from './structuredLogger'
import { debugLogger } from './ultraSimpleLogger'

// Mock debugLogger
vi.mock('./ultraSimpleLogger', () => ({
  debugLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('Structured Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log errors with consistent structure', () => {
    structuredLogger.error('SCORM', 'Test error message', {
      projectId: 'test-123',
      customField: 'custom-value'
    })

    expect(debugLogger.error).toHaveBeenCalledWith('SCORM', 'Test error message', expect.objectContaining({
      projectId: 'test-123',
      customField: 'custom-value',
      timestamp: expect.any(String),
      buildVersion: '1.0.4',
      userAgent: expect.any(String)
    }))
  })

  it('should use convenience functions for SCORM errors', () => {
    const mediaIds = ['image-001', 'video-002']
    logScormError.mediaLoadingFailed(mediaIds, 'project-456')

    expect(debugLogger.error).toHaveBeenCalledWith('SCORM_MEDIA', 'Critical media loading failures prevented SCORM generation', expect.objectContaining({
      failedMediaCount: 2,
      failedMediaIds: mediaIds,
      projectId: 'project-456',
      timestamp: expect.any(String)
    }))
  })

  it('should use convenience functions for generation failures', () => {
    const testError = new Error('Generation failed')
    logScormError.generationFailed(testError, 5)

    expect(debugLogger.error).toHaveBeenCalledWith('SCORM_GENERATION', 'SCORM package generation failed', expect.objectContaining({
      error: 'Generation failed',
      errorStack: expect.any(String),
      mediaFileCount: 5,
      timestamp: expect.any(String)
    }))
  })

  it('should use convenience functions for project errors', () => {
    logProjectError.loadingFailed('project-789', 'File not found')

    expect(debugLogger.error).toHaveBeenCalledWith('PROJECT', 'Project loading failed', expect.objectContaining({
      projectId: 'project-789',
      error: 'File not found',
      timestamp: expect.any(String)
    }))
  })

  it('should use convenience functions for media errors', () => {
    logMediaError.loadingFailed('image-001', new Error('Network error'))

    expect(debugLogger.error).toHaveBeenCalledWith('MEDIA', 'Media loading failed', expect.objectContaining({
      mediaId: 'image-001',
      error: 'Network error',
      errorStack: expect.any(String),
      timestamp: expect.any(String)
    }))
  })

  it('should use convenience functions for API errors', () => {
    logApiError.keyLoadingFailed('Decryption failed')

    expect(debugLogger.error).toHaveBeenCalledWith('API', 'API key loading failed', expect.objectContaining({
      error: 'Decryption failed',
      timestamp: expect.any(String)
    }))
  })

  it('should add common context automatically', () => {
    structuredLogger.info('STARTUP', 'App initialized', { customData: 'test' })

    expect(debugLogger.info).toHaveBeenCalledWith('STARTUP', 'App initialized', expect.objectContaining({
      customData: 'test',
      timestamp: expect.any(String),
      buildVersion: '1.0.4',
      userAgent: expect.any(String)
    }))
  })

  it('should handle debug logging only in development', () => {
    // Mock import.meta.env.DEV to false (production)
    const originalDev = import.meta.env.DEV
    Object.defineProperty(import.meta.env, 'DEV', { value: false, configurable: true })

    structuredLogger.debug('TEST', 'Debug message', { debugData: 'test' })

    // Should not call debugLogger.debug in production
    expect(debugLogger.debug).not.toHaveBeenCalled()

    // Restore original value
    Object.defineProperty(import.meta.env, 'DEV', { value: originalDev, configurable: true })
  })
})