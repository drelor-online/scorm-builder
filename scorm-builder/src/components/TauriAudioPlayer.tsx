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
      return
    }

    // Simply use the URL as-is - it should be a blob:, data:, or web URL
    // No conversion needed since MediaService now provides blob URLs
    setAudioUrl(src)
    logger.info('[TauriAudioPlayer] Using URL directly', { url: src })
  }, [src])

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