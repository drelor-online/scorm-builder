import React, { useEffect, useState } from 'react'
import { CourseContent, Page, Topic } from '../types/aiPrompt'
import { Card } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import { Home, Target, Image as ImageIcon, Video } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
// Removed blobUrlManager - now using asset URLs

interface PageThumbnailGridProps {
  courseContent: CourseContent | null
  currentPageId: string
  onPageSelect: (pageId: string) => void
}

// Media Preview Component
const MediaPreview: React.FC<{ page: Page | Topic }> = ({ page }) => {
  const { getMediaForPage, createBlobUrl, revokeBlobUrl } = useUnifiedMedia()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const mediaIdRef = React.useRef<string | null>(null)
  
  useEffect(() => {
    const loadMedia = async () => {
      if (!page.id) return
      
      // Clear previous media URL to avoid showing stale content
      setMediaUrl(null)
      
      // First check if page has media in its own media array
      // This is where the media references are stored
      const pageMediaRefs = page.media || []
      console.log(`[PageThumbnailGrid] Page ${page.id} has ${pageMediaRefs.length} media items:`, pageMediaRefs)
      
      // Log detailed info about each media item
      pageMediaRefs.forEach((media: any, index: number) => {
        console.log(`[PageThumbnailGrid] Media item ${index} for page ${page.id}:`, {
          id: media.id,
          type: media.type,
          isYouTube: media.isYouTube,
          url: media.url,
          embedUrl: media.embedUrl,
          title: media.title,
          thumbnail: media.thumbnail,
          storageId: media.storageId,
          hasAllProperties: !!(media.id && media.type)
        })
      })
      
      const firstMediaRef = pageMediaRefs.find((m: any) => m.type === 'image' || m.type === 'video')
      
      if (firstMediaRef) {
        console.log('[PageThumbnailGrid] Selected first media ref:', {
          id: firstMediaRef.id,
          type: firstMediaRef.type,
          isYouTube: firstMediaRef.isYouTube,
          url: firstMediaRef.url
        })
        
        // Handle YouTube videos specially
        if ('isYouTube' in firstMediaRef && firstMediaRef.isYouTube && 'url' in firstMediaRef && firstMediaRef.url) {
          console.log('[PageThumbnailGrid] Processing YouTube video:', firstMediaRef.url)
          // Extract YouTube video ID and use thumbnail URL
          const videoIdMatch = firstMediaRef.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
          if (videoIdMatch) {
            const videoId = videoIdMatch[1]
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            console.log('[PageThumbnailGrid] Setting YouTube thumbnail:', thumbnailUrl)
            setMediaUrl(thumbnailUrl)
          } else {
            console.warn('[PageThumbnailGrid] Could not extract YouTube ID from:', firstMediaRef.url)
          }
        } else {
          // Use id directly - storageId was from old system
          const mediaId = firstMediaRef.id
          console.log('[PageThumbnailGrid] Creating blob URL for media ID:', mediaId)
          
          // Store the media ID for cleanup
          mediaIdRef.current = mediaId
          
          try {
            const url = await createBlobUrl(mediaId)
            console.log('[PageThumbnailGrid] Blob URL result:', {
              mediaId,
              url,
              urlLength: url ? url.length : 0,
              isValidBlobUrl: url ? url.startsWith('blob:') : false
            })
            
            if (!url) {
              console.error('[PageThumbnailGrid] createBlobUrl returned null/undefined for:', mediaId)
            } else if (url === '') {
              console.error('[PageThumbnailGrid] createBlobUrl returned empty string for:', mediaId)
            }
            setMediaUrl(url)
          } catch (error) {
            console.error('[PageThumbnailGrid] Error creating blob URL:', error, 'for media:', mediaId)
          }
        }
      } else {
        console.log(`[PageThumbnailGrid] No image/video media found for page ${page.id}`)
      }
    }
    
    loadMedia()
    
    // Cleanup function - asset URLs don't need cleanup
    return () => {
      // Asset URLs are persistent and don't need to be revoked
      // Only revoke if we somehow still have a blob URL (legacy)
      if (mediaUrl && mediaUrl.startsWith('blob:')) {
        console.log('[PageThumbnailGrid] Revoking legacy blob URL:', mediaUrl)
        revokeBlobUrl(mediaUrl)
      }
    }
  }, [page.id, page.media, getMediaForPage, createBlobUrl, revokeBlobUrl])
  
  const hasVideo = page.media?.some((m: any) => m.type === 'video')
  
  if (!mediaUrl) {
    return (
      <div style={{
        width: '100%',
        height: '80px',
        backgroundColor: tokens.colors.background.secondary,
        borderRadius: '0.25rem',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tokens.colors.text.tertiary
      }}>
        {hasVideo ? <Video size={24} /> : <ImageIcon size={24} />}
      </div>
    )
  }
  
  return (
    <div style={{
      width: '100%',
      height: '80px',
      borderRadius: '0.25rem',
      marginBottom: '0.5rem',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: tokens.colors.background.secondary
    }}>
      {/* Always use img element for thumbnails, including YouTube */}
      <img 
        src={mediaUrl || undefined}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        loading="lazy"
      />
      {/* Show video overlay indicator for video content */}
      {hasVideo && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: '50%',
          width: '2rem',
          height: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Video size={16} color="white" />
        </div>
      )}
    </div>
  )
}

export const PageThumbnailGrid: React.FC<PageThumbnailGridProps> = ({
  courseContent,
  currentPageId,
  onPageSelect
}) => {
  if (!courseContent) {
    return (
      <div data-testid="loading-skeleton" style={{ padding: '1rem' }}>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {[1, 2, 3, 4].map(i => (
            <Card key={i} style={{ 
              height: '200px',
              backgroundColor: tokens.colors.background.secondary,
              animation: 'pulse 1.5s infinite'
            }}>
              <div />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Helper to extract text content and truncate
  const getContentPreview = (html: string, maxLength: number = 100): string => {
    const temp = document.createElement('div')
    temp.innerHTML = DOMPurify.sanitize(html)
    const text = temp.textContent || temp.innerText || ''
    
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // Helper to get media count (only image/video, not audio/captions)
  const getMediaCount = (page: Page | Topic): number => {
    // Only count image and video media types for enhancement purposes
    return page.media?.filter(m => m.type === 'image' || m.type === 'video').length || 0
  }

  // Helper to check if page has media
  const hasMedia = (page: Page | Topic): boolean => {
    return getMediaCount(page) > 0
  }

  // Create array of all pages
  const allPages: Array<Page | Topic> = [
    courseContent.welcomePage,
    (courseContent as any).objectivesPage || courseContent.learningObjectivesPage, // Handle both naming conventions
    ...courseContent.topics
  ].filter(Boolean) // Remove any undefined entries

  return (
    <div 
      data-testid="page-thumbnail-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem',
        padding: '1rem'
      }}
    >
      {allPages.map((page, index) => {
        // Debug logging to verify page structure
        console.log(`[PageThumbnailGrid] Rendering page ${page.id}:`, {
          hasMedia: !!page.media,
          mediaCount: page.media?.length || 0,
          mediaArray: page.media,
          pageKeys: Object.keys(page)
        })
        
        const isWelcome = page.id === 'welcome'
        const isObjectives = page.id === 'objectives' || page.id === 'learning-objectives'
        const isCurrent = page.id === currentPageId
        const mediaCount = getMediaCount(page)
        
        return (
          <Card
            key={page.id}
            data-testid={`page-thumbnail-${page.id}`}
            className={isCurrent ? 'selected' : ''}
            onClick={(e) => {
              console.log('[PageThumbnailGrid] Card clicked:', page.id, page.title)
              console.log('[PageThumbnailGrid] Event target:', e.target)
              console.log('[PageThumbnailGrid] Event currentTarget:', e.currentTarget)
              // Don't stop propagation - let it bubble
              onPageSelect(page.id)
            }}
            style={{
              cursor: 'pointer',
              border: isCurrent ? `2px solid ${tokens.colors.primary[500]}` : 'none',  // Only show border when selected
              transition: 'all 0.2s',
              position: 'relative',
              overflow: 'hidden',
              ...(isCurrent && {
                boxShadow: `0 0 0 3px ${tokens.colors.primary[500]}33`
              })
            }}
          >
            {/* Page Type Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              {isWelcome ? (
                <div 
                  data-testid="page-icon-welcome"
                  data-icon="home"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: tokens.colors.primary[100],
                    color: tokens.colors.primary[600],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Home size={16} />
                </div>
              ) : isObjectives ? (
                <div 
                  data-testid="page-icon-objectives"
                  data-icon="target"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: tokens.colors.success[100],
                    color: tokens.colors.success[600],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Target size={16} />
                </div>
              ) : (
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: tokens.colors.background.secondary,
                  color: tokens.colors.text.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {index - 1}
                </div>
              )}
              <h4 style={{ 
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}>
                {page.title}
              </h4>
            </div>

            {/* Media Preview */}
            {hasMedia(page) && (
              <MediaPreview page={page} />
            )}

            {/* Content Preview - Only show if no media */}
            {!hasMedia(page) && (
              <div 
                data-testid={`content-preview-${page.id}`}
                style={{
                  fontSize: '0.75rem',
                  color: tokens.colors.text.secondary,
                  lineHeight: 1.4,
                  marginBottom: '0.5rem',
                  minHeight: '4rem',  // Reduced minimum height for flexibility
                  maxHeight: '12rem',  // Increased max height for more content
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                  // Make it flexible - will grow with content but won't exceed max
                  height: 'auto'
                }}
              >
                {getContentPreview(page.content)}
              </div>
            )}

            {/* Media Indicator */}
            {hasMedia(page) && (
              <div 
                data-testid="media-indicator"
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  backgroundColor: tokens.colors.success[500],
                  color: 'white',
                  borderRadius: '50%',
                  width: '1.5rem',
                  height: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem'
                  // Removed pointerEvents: 'none' to allow clicks to bubble
                }}
                title="Has media"
              >
                <span style={{ display: 'none' }}>✓ Has media</span>
                ✓
              </div>
            )}

            {/* Media Count Badge */}
            {mediaCount > 1 && (
              <div style={{
                position: 'absolute',
                bottom: '0.5rem',
                right: '0.5rem',
                backgroundColor: tokens.colors.background.secondary,
                color: tokens.colors.text.primary,
                borderRadius: '0.25rem',
                padding: '0.125rem 0.5rem',
                fontSize: '0.625rem',
                fontWeight: 500
                // Removed pointerEvents: 'none' to allow clicks to bubble
              }}>
                {mediaCount} media items
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// Add pulse animation
const style = document.createElement('style')
style.textContent = `
  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 0.8; }
    100% { opacity: 0.6; }
  }
  
  .selected {
    transform: scale(1.02);
  }
  
  .selected:hover {
    transform: scale(1.02) !important;
  }
  
  [data-testid^="page-thumbnail-"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`
document.head.appendChild(style)