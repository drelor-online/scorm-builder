import React from 'react'
import { useMedia } from '../contexts/MediaContext'
import { LoadingSpinner } from './DesignSystem'

interface MediaDisplayProps {
  mediaId: string | undefined
  alt?: string
  className?: string
  style?: React.CSSProperties
  fallback?: React.ReactNode
}

export function MediaDisplay({ mediaId, alt, className, style, fallback }: MediaDisplayProps) {
  const { getMediaUrl, isLoading } = useMedia()
  
  if (!mediaId) {
    return <>{fallback || null}</>
  }
  
  const url = getMediaUrl(mediaId)
  
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', ...style }}>
        <LoadingSpinner text="Loading media..." />
      </div>
    )
  }
  
  if (!url) {
    console.warn('[MediaDisplay] No URL found for media ID:', mediaId)
    return <>{fallback || <div>Media not found</div>}</>
  }
  
  // Get media info from store to determine type
  const { store } = useMedia()
  const media = store.getMedia(mediaId)
  
  if (!media) {
    return <>{fallback || <div>Media not found</div>}</>
  }
  
  // For YouTube videos, use iframe
  if (media.metadata.type === 'video' && media.metadata.embed_url) {
    return (
      <iframe
        src={media.metadata.embed_url}
        className={className}
        style={style}
        title={media.metadata.title || alt || 'Video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }
  
  // For images
  if (media.metadata.type === 'image') {
    return (
      <img
        src={url}
        alt={alt || media.metadata.title || 'Image'}
        className={className}
        style={style}
      />
    )
  }
  
  // For audio
  if (media.metadata.type === 'audio') {
    return (
      <audio
        src={url}
        controls
        className={className}
        style={style}
        title={media.metadata.title || alt || 'Audio'}
      />
    )
  }
  
  // For regular videos
  if (media.metadata.type === 'video') {
    return (
      <video
        src={url}
        controls
        className={className}
        style={style}
        title={media.metadata.title || alt || 'Video'}
      />
    )
  }
  
  // Unknown type
  return <>{fallback || <div>Unknown media type</div>}</>
}