import React, { useEffect, useState, useRef } from 'react'
import { logger } from '../utils/logger'
import { convertFileSrc } from '@tauri-apps/api/core'

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
 * Uses asset URLs directly with HTML5 audio element
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
  const [audioUrl, setAudioUrl] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  // Removed excessive logging - was logging on every render

  useEffect(() => {
    // Log when component receives a src prop
    logger.info('[TauriAudioPlayer] Component received src', { src, hasSrc: !!src })
    
    if (!src) {
      // Silently clear
      setAudioUrl(undefined)
      return
    }

    // If it's a data URL (for SVG or inline data), use it directly
    if (src.startsWith('data:')) {
      // Silently use data URL
      setAudioUrl(src)
      return
    }

    // If it's an asset URL, convert it for proper platform support
    // IMPORTANT: Only convert raw asset:// URLs, not already-converted URLs containing asset.localhost
    if (src.startsWith('asset://')) {
      logger.info('[TauriAudioPlayer] Converting asset URL for platform', { src })
      try {
        const convertedUrl = convertFileSrc(src)
        logger.info('[TauriAudioPlayer] Converted URL', { original: src, converted: convertedUrl })
        setAudioUrl(convertedUrl)
      } catch (error) {
        logger.error('[TauriAudioPlayer] Failed to convert asset URL:', error)
        onError?.(error as Error)
      }
      return
    }
    
    // If it's already a converted asset.localhost URL, use it directly (no conversion needed)
    if (src.includes('asset.localhost')) {
      logger.info('[TauriAudioPlayer] Using already-converted asset.localhost URL directly', { src })
      setAudioUrl(src)
      return
    }
    
    // If it's a blob URL, use it directly (for temporary recordings)
    if (src.startsWith('blob:')) {
      // Silently use blob URL
      setAudioUrl(src)
      return
    }

    // If it contains media path patterns, get the proper asset URL
    if (src.includes('\\media\\') || src.includes('/media/')) {
      setLoading(true)
      
      // Extract media ID from the URL
      let mediaId: string | null = null
      
      // Pattern 1: audio-XXXX or caption-XXXX
      const standardMatch = src.match(/(audio-\d+|caption-\d+)/)
      if (standardMatch) {
        mediaId = standardMatch[1]
      } else {
        // Pattern 2: Try to extract from path like /media/audio-cleanup.bin
        const pathMatch = src.match(/\/media\/([\w-]+)\./)
        if (pathMatch) {
          mediaId = pathMatch[1]
        }
      }
      
      if (!mediaId) {
        logger.error('[TauriAudioPlayer] Could not extract media ID from URL:', src)
        onError?.(new Error('Invalid media URL'))
        setLoading(false)
        return
      }

      // Get asset URL from MediaUrlService
      import('../services/mediaUrl').then(async (module) => {
        try {
          const projectId = window.localStorage.getItem('currentProjectId') || ''
          const assetUrl = await module.mediaUrlService.getMediaUrl(projectId, mediaId)
          
          if (assetUrl) {
            // Got asset URL successfully
            setAudioUrl(assetUrl)
          } else {
            throw new Error('Failed to get asset URL')
          }
        } catch (error) {
          logger.error('[TauriAudioPlayer] Failed to get asset URL:', error)
          onError?.(error as Error)
        } finally {
          setLoading(false)
        }
      })
    } else {
      // For regular URLs, use them directly
      setAudioUrl(src)
    }
  }, [src, onError])

  if (loading) {
    // Component is loading
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading audio...
      </div>
    )
  }

  if (!audioUrl) {
    // No URL available
    return null
  }

  // Rendering audio element
  
  return (
    <audio
      ref={audioRef}
      src={audioUrl}
      controls={controls}
      autoPlay={autoPlay}
      style={style}
      data-testid={testId}
      onLoadedData={() => {
        // Audio loaded successfully
      }}
      onPlay={() => {
        // Audio playing
      }}
      onPause={() => {
        // Audio paused
      }}
      onError={(e) => {
        const audio = e.currentTarget as HTMLAudioElement
        logger.error('[TauriAudioPlayer] Audio playback error:', {
          error: audio.error,
          errorCode: audio.error?.code,
          errorMessage: audio.error?.message,
          src: audio.src,
          readyState: audio.readyState,
          networkState: audio.networkState
        })
        onError?.(new Error(`Audio playback failed: ${audio.error?.message || 'Unknown error'}`))
      }}
      onEnded={() => {
        // Playback ended
        onEnded?.()
      }}
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