import React, { useEffect, useState, useRef } from 'react'
import { logger } from '../utils/logger'
import { convertFileSrc } from '@tauri-apps/api/core'
import { normalizeAssetUrl } from '../utils/assetUrlHelper'

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

    // CRITICAL: Normalize the URL first to fix double-encoding issues
    const normalizedSrc = normalizeAssetUrl(src)
    if (normalizedSrc !== src) {
      logger.info('[TauriAudioPlayer] URL normalized', { original: src, normalized: normalizedSrc })
    }

    // If it's a data URL (for SVG or inline data), use it directly
    if (normalizedSrc.startsWith('data:')) {
      // Silently use data URL
      setAudioUrl(normalizedSrc)
      return
    }

    // If it's a blob URL, use it directly
    if (normalizedSrc.startsWith('blob:')) {
      // Silently use blob URL
      setAudioUrl(normalizedSrc)
      return
    }

    // If it's an asset URL, use it directly - asset:// URLs work natively in Tauri
    if (normalizedSrc.startsWith('asset://')) {
      logger.info('[TauriAudioPlayer] Using asset URL directly (no conversion needed)', { normalizedSrc })
      setAudioUrl(normalizedSrc)
      return
    }
    
    // Only convert file:// URLs if needed
    if (normalizedSrc.startsWith('file://')) {
      logger.info('[TauriAudioPlayer] Converting file URL for platform', { normalizedSrc })
      try {
        const convertedUrl = convertFileSrc(normalizedSrc)
        logger.info('[TauriAudioPlayer] Converted file URL', { original: normalizedSrc, converted: convertedUrl })
        setAudioUrl(convertedUrl)
      } catch (error) {
        logger.error('[TauriAudioPlayer] Failed to convert file URL:', error)
        onError?.(error as Error)
      }
      return
    }
    
    // If it's already a properly formatted http(s)://asset.localhost URL after normalization
    if (normalizedSrc.includes('asset.localhost')) {
      logger.info('[TauriAudioPlayer] Using asset.localhost URL directly', { normalizedSrc })
      setAudioUrl(normalizedSrc)
      return
    }

    // If it contains media path patterns, get the proper asset URL
    if (normalizedSrc.includes('\\media\\') || normalizedSrc.includes('/media/')) {
      setLoading(true)
      
      // Extract media ID from the URL
      let mediaId: string | null = null
      
      // Pattern 1: audio-XXXX or caption-XXXX
      const standardMatch = normalizedSrc.match(/(audio-\d+|caption-\d+)/)
      if (standardMatch) {
        mediaId = standardMatch[1]
      } else {
        // Pattern 2: Try to extract from path like /media/audio-cleanup.bin
        const pathMatch = normalizedSrc.match(/\/media\/([\w-]+)\./)
        if (pathMatch) {
          mediaId = pathMatch[1]
        }
      }
      
      if (!mediaId) {
        logger.error('[TauriAudioPlayer] Could not extract media ID from URL:', normalizedSrc)
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
      // For regular URLs, use them directly (after normalization)
      setAudioUrl(normalizedSrc)
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