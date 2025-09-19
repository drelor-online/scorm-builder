import React from 'react'
import { useMedia } from '../hooks/useMedia'
import { LoadingSpinner } from './DesignSystem'

interface MediaDisplayProps {
  mediaId: string | undefined
  alt?: string
  className?: string
  style?: React.CSSProperties
  fallback?: React.ReactNode
}

export function MediaDisplay({ mediaId, alt, className, style, fallback }: MediaDisplayProps) {
  const { createBlobUrl } = useMedia()
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [mediaType, setMediaType] = React.useState<string | null>(null)
  
  React.useEffect(() => {
    if (!mediaId) {
      return
    }
    
    async function loadMedia() {
      setIsLoading(true)
      try {
        // mediaId is guaranteed to be defined here due to the check above
        const url = await createBlobUrl(mediaId!)
        if (url) {
          setMediaUrl(url)
          // Determine media type from URL or mediaId
          // mediaId is guaranteed to be defined here
          const id = mediaId!
          if (id.includes('image')) {
            setMediaType('image')
          } else if (id.includes('video')) {
            setMediaType('video')
          } else if (id.includes('audio')) {
            setMediaType('audio')
          } else {
            // Default to image
            setMediaType('image')
          }
        }
      } catch (error) {
        console.warn('[MediaDisplay] Failed to load media:', mediaId, error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadMedia()
  }, [mediaId, createBlobUrl])
  
  if (!mediaId) {
    return <>{fallback || null}</>
  }
  
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', ...style }}>
        <LoadingSpinner text="Loading media..." />
      </div>
    )
  }
  
  if (!mediaUrl) {
    console.warn('[MediaDisplay] No URL found for media ID:', mediaId)
    return <>{fallback || <div>Media not found</div>}</>
  }
  
  // For videos (including YouTube)
  if (mediaType === 'video') {
    // Check if it's a YouTube URL
    if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
      // Extract video ID and create embed URL
      const videoId = mediaUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      if (videoId) {
        // Build standard YouTube embed URL
        const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
        
        return (
          <iframe
            src={embedUrl}
            className={className}
            style={style}
            title={alt || 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            data-testid="video-preview"
          />
        )
      }
    }
    
    // Regular video
    return (
      <video
        src={mediaUrl || undefined}
        className={className}
        style={style}
        controls
      />
    )
  }
  
  // For images
  if (mediaType === 'image') {
    return (
      <img
        src={mediaUrl || undefined}
        alt={alt || 'Image'}
        className={className}
        style={style}
      />
    )
  }
  
  // For audio
  if (mediaType === 'audio') {
    return (
      <audio
        src={mediaUrl || undefined}
        className={className}
        style={style}
        controls
      />
    )
  }
  
  // Fallback
  return <>{fallback || <div>Unsupported media type</div>}</>
}