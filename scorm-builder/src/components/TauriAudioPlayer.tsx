import React, { useEffect, useState, useRef } from 'react'
import { logger } from '../utils/logger'

interface TauriAudioPlayerProps {
  src?: string
  controls?: boolean
  style?: React.CSSProperties
  onError?: (error: Error) => void
  onEnded?: () => void
  autoPlay?: boolean
  'data-testid'?: string
}

/**
 * Custom audio player that handles Tauri asset:// URLs
 * Converts asset URLs to blob URLs for HTML5 audio compatibility
 */
export const TauriAudioPlayer: React.FC<TauriAudioPlayerProps> = ({
  src,
  controls = true,
  style,
  onError,
  onEnded,
  autoPlay = false,
  'data-testid': testId
}) => {
  const [blobUrl, setBlobUrl] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const blobUrlRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!src) {
      setBlobUrl(undefined)
      return
    }

    // If it's already a blob URL or data URL, use it directly
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      setBlobUrl(src)
      return
    }

    // If it's an asset URL or http://asset.localhost URL, fetch and convert to blob
    if (src.includes('asset.localhost') || src.startsWith('asset://') || src.includes('\\media\\') || src.includes('/media/')) {
      setLoading(true)
      
      // Extract media ID from the URL
      const mediaIdMatch = src.match(/(audio-\d+|caption-\d+)/)
      const mediaId = mediaIdMatch ? mediaIdMatch[1] : null
      
      if (!mediaId) {
        logger.error('[TauriAudioPlayer] Could not extract media ID from URL:', src)
        onError?.(new Error('Invalid media URL'))
        setLoading(false)
        return
      }

      // Get media data from MediaService
      import('../contexts/UnifiedMediaContext').then(async (module) => {
        try {
          const mediaContext = module.getMediaFromContext()
          if (!mediaContext) {
            throw new Error('Media context not available')
          }

          const { getMedia } = mediaContext
          const mediaData = await getMedia(mediaId)
          
          if (mediaData?.data) {
            // Create blob URL from data
            const blob = new Blob([mediaData.data], { type: 'audio/mp3' })
            const newBlobUrl = URL.createObjectURL(blob)
            
            // Clean up old blob URL
            if (blobUrlRef.current && blobUrlRef.current !== newBlobUrl) {
              URL.revokeObjectURL(blobUrlRef.current)
            }
            
            blobUrlRef.current = newBlobUrl
            setBlobUrl(newBlobUrl)
            logger.info('[TauriAudioPlayer] Created blob URL for media:', mediaId)
          } else if (mediaData?.url) {
            // Use the URL from media data
            setBlobUrl(mediaData.url)
          } else {
            throw new Error('No media data available')
          }
        } catch (error) {
          logger.error('[TauriAudioPlayer] Failed to load media:', error)
          onError?.(error as Error)
        } finally {
          setLoading(false)
        }
      })
    } else {
      // For regular URLs, use them directly
      setBlobUrl(src)
    }

    return () => {
      // Cleanup blob URL on unmount
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = undefined
      }
    }
  }, [src, onError])

  if (loading) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading audio...
      </div>
    )
  }

  if (!blobUrl) {
    return null
  }

  return (
    <audio
      ref={audioRef}
      src={blobUrl}
      controls={controls}
      autoPlay={autoPlay}
      style={style}
      data-testid={testId}
      onError={(e) => {
        logger.error('[TauriAudioPlayer] Audio playback error:', e)
        onError?.(new Error('Audio playback failed'))
      }}
      onEnded={onEnded}
    />
  )
}

// Helper function to get media context (will be added to UnifiedMediaContext)
let mediaContextInstance: any = null

export function setMediaContext(context: any) {
  mediaContextInstance = context
}

export function getMediaFromContext() {
  return mediaContextInstance
}