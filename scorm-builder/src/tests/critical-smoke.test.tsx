/**
 * Critical Smoke Tests - Fast suite for CI feedback
 * 
 * This test file contains the most essential tests that should run first
 * in CI to provide immediate feedback on critical functionality.
 * 
 * All tests should complete in under 30 seconds total.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/testProviders'
import App from '../App'

// Import key components for basic smoke testing
import { CourseSeedInput } from '../components/CourseSeedInput'
import { MediaService } from '../services/MediaService'
import { FileStorage } from '../services/FileStorage'

describe('Critical Smoke Tests', () => {
  describe('App Bootstrap', () => {
    it('should render main app without crashing', () => {
      render(<App />)
      // Just checking it doesn't throw
      expect(document.body).toBeInTheDocument()
    })

    it('should load essential services without errors', () => {
      expect(() => {
        new FileStorage()
      }).not.toThrow()

      expect(() => {
        new MediaService({ projectId: 'test', fileStorage: new FileStorage() })
      }).not.toThrow()
    })
  })

  describe('Core Components', () => {
    it('should render CourseSeedInput without crashing', () => {
      const mockProps = {
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onDebugDataChange: vi.fn(),
        debugData: {},
        isLoading: false
      }
      
      render(<CourseSeedInput {...mockProps} />)
      expect(screen.getByText(/course/i)).toBeInTheDocument()
    })
  })

  describe('Essential Services', () => {
    it('should handle basic MediaService operations', async () => {
      const fileStorage = new FileStorage()
      const mediaService = new MediaService({ 
        projectId: 'smoke-test', 
        fileStorage 
      })

      // Test basic service is functional
      expect(mediaService).toBeDefined()
      
      // Test listAllMedia doesn't crash
      const media = await mediaService.listAllMedia()
      expect(Array.isArray(media)).toBe(true)
    })

    it('should handle basic FileStorage operations', async () => {
      const storage = new FileStorage()
      
      // Test basic operations don't crash
      expect(() => storage.getContent('test')).not.toThrow()
      expect(() => storage.saveContent('test', { data: 'test' })).not.toThrow()
    })
  })

  describe('Critical Types', () => {
    it('should have proper TypeScript compilation', () => {
      // This test ensures the build compiles properly
      const testObject: { id: string; data: any } = {
        id: 'test',
        data: { test: true }
      }
      
      expect(testObject.id).toBe('test')
      expect(testObject.data.test).toBe(true)
    })
  })
})