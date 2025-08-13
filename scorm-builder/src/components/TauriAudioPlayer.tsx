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
 * Simple audio player that uses blob URLs directly
 * No URL conversion needed - browsers handle blob: URLs natively
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
  const audioRef = useRef<HTMLAudioElement>(null)
  
  // Removed excessive logging - was logging on every render

  useEffect(() => {
    logger.info('[TauriAudioPlayer] Component received src', { src, hasSrc: !!src })
    
    if (!src) {
      setAudioUrl(undefined)
      // Clear audio element when no source
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current.load()
      }
      return
    }

    // Use the URL as-is - blob URLs cannot have query params
    // The component key prop handles cache busting
    setAudioUrl(src)
    logger.info('[TauriAudioPlayer] Using URL directly', { url: src })
    
    // Force the audio element to reload when src changes
    // This ensures cached audio is discarded
    if (audioRef.current && src) {
      // Stop any playing audio
      audioRef.current.pause()
      // Clear the current source first to force a complete reload
      audioRef.current.src = ''
      audioRef.current.load()
      // Set the new source after a small delay to ensure clean state
      setTimeout(() => {
        if (audioRef.current && src) {
          audioRef.current.src = src
          audioRef.current.load()
          // If autoPlay is enabled, try to play
          if (autoPlay) {
            audioRef.current.play().catch(e => {
              logger.warn('[TauriAudioPlayer] Autoplay failed:', e)
            })
          }
          logger.info('[TauriAudioPlayer] Forced complete audio element reload')
        }
      }, 50)
    }
  }, [src, autoPlay])

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