import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ReactNode } from 'react'
import { MediaProvider, useMedia } from '../MediaContext'

// Mock the MediaStore
vi.mock('../../services/MediaStore', () => ({
  mediaStore: {
    cleanup: vi.fn(),
    loadProject: vi.fn(),
    getMediaUrl: vi.fn(),
    getMediaByPage: vi.fn(),
    storeMedia: vi.fn()
  },
  MediaStore: vi.fn(),
  CachedMedia: vi.fn()
}))

import { mediaStore } from '../../services/MediaStore'

describe('MediaContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Context Provider', () => {
    it('should provide media context to children', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project-123">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current).toBeDefined()
        expect(result.current.store).toBe(mediaStore)
      })
    })

    it('should throw error when used outside provider', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      expect(() => {
        renderHook(() => useMedia())
      }).toThrow('useMedia must be used within MediaProvider')
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Project Loading', () => {
    it('should load media when projectId is provided', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project-123">
          {children}
        </MediaProvider>
      )
      
      renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(mediaStore.loadProject).toHaveBeenCalledWith('test-project-123')
      })
    })

    it('should cleanup when projectId is null', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId={null}>
          {children}
        </MediaProvider>
      )
      
      renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(mediaStore.cleanup).toHaveBeenCalled()
        expect(mediaStore.loadProject).not.toHaveBeenCalled()
      })
    })

    it('should reload when projectId changes', async () => {
      let currentProjectId = 'project-1'
      
      const { result, rerender } = renderHook(
        () => useMedia(),
        {
          wrapper: ({ children }) => (
            <MediaProvider projectId={currentProjectId}>
              {children}
            </MediaProvider>
          )
        }
      )
      
      await waitFor(() => {
        expect(mediaStore.loadProject).toHaveBeenCalledWith('project-1')
      })
      
      // Clear previous calls
      vi.clearAllMocks()
      
      // Change project
      currentProjectId = 'project-2'
      rerender()
      
      await waitFor(() => {
        expect(mediaStore.loadProject).toHaveBeenCalledWith('project-2')
      })
    })

    it('should cleanup when projectId changes to null', async () => {
      let currentProjectId: string | null = 'project-1'
      
      const { result, rerender } = renderHook(
        () => useMedia(),
        {
          wrapper: ({ children }) => (
            <MediaProvider projectId={currentProjectId}>
              {children}
            </MediaProvider>
          )
        }
      )
      
      await waitFor(() => {
        expect(mediaStore.loadProject).toHaveBeenCalledWith('project-1')
      })
      
      // Clear previous calls
      vi.clearAllMocks()
      
      // Change to null
      currentProjectId = null
      rerender()
      
      await waitFor(() => {
        expect(mediaStore.cleanup).toHaveBeenCalled()
      })
    })
  })

  describe('Loading States', () => {
    it('should set loading state during media load', async () => {
      let resolveLoad: () => void
      const loadPromise = new Promise<void>(resolve => {
        resolveLoad = resolve
      })
      
      ;(mediaStore.loadProject as any).mockReturnValue(loadPromise)
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      // Should be loading initially
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBeNull()
      
      // Resolve loading
      await act(async () => {
        resolveLoad!()
        await loadPromise
      })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
      })
    })

    it('should handle loading errors', async () => {
      const error = new Error('Failed to load media')
      ;(mediaStore.loadProject as any).mockRejectedValue(error)
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBe('Failed to load media')
      })
    })

    it('should handle non-Error loading failures', async () => {
      ;(mediaStore.loadProject as any).mockRejectedValue('String error')
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBe('Failed to load media')
      })
    })
  })

  describe('Media Operations', () => {
    it('should get media URL', async () => {
      ;(mediaStore.getMediaUrl as any).mockReturnValue('blob://media-url')
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      const url = result.current.getMediaUrl('media-123')
      
      expect(mediaStore.getMediaUrl).toHaveBeenCalledWith('media-123')
      expect(url).toBe('blob://media-url')
    })

    it('should get media by page', async () => {
      const mockMedia = [
        { id: 'media-1', type: 'image' },
        { id: 'media-2', type: 'video' }
      ]
      ;(mediaStore.getMediaByPage as any).mockReturnValue(mockMedia)
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      const media = result.current.getMediaByPage('page-123')
      
      expect(mediaStore.getMediaByPage).toHaveBeenCalledWith('page-123')
      expect(media).toEqual(mockMedia)
    })

    it('should store media', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      const blob = new Blob(['test'], { type: 'image/png' })
      const metadata = { 
        type: 'image' as const,
        pageId: 'page-123',
        timestamp: Date.now()
      }
      
      await result.current.storeMedia('media-123', blob, metadata)
      
      expect(mediaStore.storeMedia).toHaveBeenCalledWith('media-123', blob, metadata)
    })

    it('should handle undefined media URL', async () => {
      ;(mediaStore.getMediaUrl as any).mockReturnValue(undefined)
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      const url = result.current.getMediaUrl('non-existent')
      
      expect(url).toBeUndefined()
    })
  })

  describe('Cleanup', () => {
    it('should cleanup on unmount', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { unmount } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(mediaStore.loadProject).toHaveBeenCalled()
      })
      
      // Clear previous calls
      vi.clearAllMocks()
      
      unmount()
      
      expect(mediaStore.cleanup).toHaveBeenCalled()
    })

    it('should cancel loading on unmount', async () => {
      let resolveLoad: () => void
      const loadPromise = new Promise<void>(resolve => {
        resolveLoad = resolve
      })
      
      ;(mediaStore.loadProject as any).mockReturnValue(loadPromise)
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result, unmount } = renderHook(() => useMedia(), { wrapper })
      
      // Should be loading
      expect(result.current.isLoading).toBe(true)
      
      // Unmount before loading completes
      unmount()
      
      // Complete loading after unmount
      await act(async () => {
        resolveLoad!()
        await loadPromise
      })
      
      // Loading state should not have been updated after unmount
      expect(result.current.isLoading).toBe(true)
    })

    it('should handle rapid project changes', async () => {
      let currentProjectId: string | null = 'project-1'
      
      const { result, rerender } = renderHook(
        () => useMedia(),
        {
          wrapper: ({ children }) => (
            <MediaProvider projectId={currentProjectId}>
              {children}
            </MediaProvider>
          )
        }
      )
      
      // Wait for initial load
      await waitFor(() => {
        expect(mediaStore.loadProject).toHaveBeenCalledWith('project-1')
      })
      
      // Rapid changes
      currentProjectId = 'project-2'
      rerender()
      currentProjectId = 'project-3'
      rerender()
      currentProjectId = null
      rerender()
      currentProjectId = 'project-4'
      rerender()
      
      await waitFor(() => {
        // Should have called cleanup for null
        expect(mediaStore.cleanup).toHaveBeenCalled()
        // Should have loaded final project
        expect(mediaStore.loadProject).toHaveBeenCalledWith('project-4')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle ArrayBuffer data', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      const arrayBuffer = new ArrayBuffer(8)
      const metadata = { 
        type: 'audio' as const,
        pageId: 'page-123',
        timestamp: Date.now()
      }
      
      await result.current.storeMedia('media-123', arrayBuffer, metadata)
      
      expect(mediaStore.storeMedia).toHaveBeenCalledWith('media-123', arrayBuffer, metadata)
    })

    it('should handle empty media list for page', async () => {
      ;(mediaStore.getMediaByPage as any).mockReturnValue([])
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MediaProvider projectId="test-project">
          {children}
        </MediaProvider>
      )
      
      const { result } = renderHook(() => useMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      const media = result.current.getMediaByPage('empty-page')
      
      expect(media).toEqual([])
    })
  })
})