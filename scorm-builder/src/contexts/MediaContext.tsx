import React, { createContext, useContext, useEffect, useState } from 'react'
import { mediaStore, MediaStore, CachedMedia } from '../services/MediaStore'

interface MediaContextValue {
  store: MediaStore
  isLoading: boolean
  error: string | null
  getMediaUrl: (id: string) => string | undefined
  getMediaByPage: (pageId: string) => CachedMedia[]
  storeMedia: (id: string, data: ArrayBuffer | Blob, metadata: import('../services/MediaStore').MediaMetadata) => Promise<void>
}

const MediaContext = createContext<MediaContextValue | null>(null)

export function useMedia() {
  const context = useContext(MediaContext)
  if (!context) {
    throw new Error('useMedia must be used within MediaProvider')
  }
  return context
}

interface MediaProviderProps {
  children: React.ReactNode
  projectId: string | null
}

export function MediaProvider({ children, projectId }: MediaProviderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      mediaStore.cleanup()
      return
    }

    let cancelled = false

    async function loadMedia() {
      setIsLoading(true)
      setError(null)
      
      try {
        await mediaStore.loadProject(projectId!)
        
        if (!cancelled) {
          console.log('[MediaProvider] Media loaded successfully for project:', projectId)
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load media'
          console.error('[MediaProvider] Failed to load media:', err)
          setError(errorMessage)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadMedia()

    return () => {
      cancelled = true
    }
  }, [projectId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaStore.cleanup()
    }
  }, [])

  const contextValue: MediaContextValue = {
    store: mediaStore,
    isLoading,
    error,
    getMediaUrl: (id: string) => mediaStore.getMediaUrl(id),
    getMediaByPage: (pageId: string) => mediaStore.getMediaByPage(pageId),
    storeMedia: async (id: string, data: ArrayBuffer | Blob, metadata: import('../services/MediaStore').MediaMetadata) => {
      await mediaStore.storeMedia(id, data, metadata)
    }
  }

  return (
    <MediaContext.Provider value={contextValue}>
      {children}
    </MediaContext.Provider>
  )
}