import React, { useEffect, useState } from 'react'
import { CourseContent, Page, Topic } from '../types/aiPrompt'
import { Card } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import { Home, Target, Image as ImageIcon, Video } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import styles from './PageThumbnailGrid.module.css'
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
        } else if (firstMediaRef.url && firstMediaRef.url.startsWith('data:image/svg+xml')) {
          // SVG data URLs work directly, no conversion needed
          console.log('[PageThumbnailGrid] Using SVG data URL directly')
          setMediaUrl(firstMediaRef.url)
        } else if (firstMediaRef.url && (firstMediaRef.url.includes('asset://') || firstMediaRef.url.includes('asset.localhost'))) {
          // Handle asset:// URLs - need to convert to blob URLs for browser compatibility
          const mediaId = firstMediaRef.id
          console.log('[PageThumbnailGrid] Converting asset URL to blob URL for media ID:', mediaId)
          
          // Store the media ID for cleanup
          mediaIdRef.current = mediaId
          
          try {
            const url = await createBlobUrl(mediaId)
            console.log('[PageThumbnailGrid] Blob URL result for asset URL conversion:', {
              mediaId,
              originalUrl: firstMediaRef.url,
              newUrl: url,
              isValidBlobUrl: url ? url.startsWith('blob:') : false
            })
            
            if (!url) {
              console.error('[PageThumbnailGrid] createBlobUrl returned null/undefined for asset URL:', firstMediaRef.url)
              // Fallback to original URL if conversion fails
              setMediaUrl(firstMediaRef.url)
            } else {
              setMediaUrl(url)
            }
          } catch (error) {
            console.error('[PageThumbnailGrid] Error converting asset URL to blob:', error)
            // Fallback to original URL
            setMediaUrl(firstMediaRef.url)
          }
        } else if (firstMediaRef.url && firstMediaRef.url.startsWith('blob:')) {
          // Already a blob URL, use directly
          console.log('[PageThumbnailGrid] Using existing blob URL')
          setMediaUrl(firstMediaRef.url)
        } else {
          // For other cases, try to create a blob URL from the media ID
          const mediaId = firstMediaRef.id
          console.log('[PageThumbnailGrid] Creating blob URL for media ID:', mediaId)
          
          // Store the media ID for cleanup
          mediaIdRef.current = mediaId
          
          try {
            console.log('[PageThumbnailGrid v2.0.6] Creating blob URL for mediaId:', mediaId)
            const url = await createBlobUrl(mediaId)
            console.log('[PageThumbnailGrid v2.0.6] Blob URL result:', {
              mediaId,
              url,
              urlLength: url ? url.length : 0,
              isAssetUrl: url ? url.startsWith('asset://') : false,
              isBlobUrl: url ? url.startsWith('blob:') : false,
              urlType: url ? (url.startsWith('asset://') ? 'asset' : url.startsWith('blob:') ? 'blob' : 'other') : 'none'
            })
            
            if (!url) {
              console.error('[PageThumbnailGrid v2.0.6] createBlobUrl returned null/undefined for:', mediaId)
            } else if (url === '') {
              console.error('[PageThumbnailGrid v2.0.6] createBlobUrl returned empty string for:', mediaId)
            } else {
              console.log('[PageThumbnailGrid v2.0.6] Setting media URL:', url)
            }
            setMediaUrl(url)
          } catch (error) {
            console.error('[PageThumbnailGrid v2.0.6] Error creating blob URL:', error, 'for media:', mediaId)
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
      <div className={styles.thumbnailPlaceholder}>
        {hasVideo ? <Video size={24} /> : <ImageIcon size={24} />}
      </div>
    )
  }
  
  return (
    <div className={styles.thumbnailContent}>
      {/* Always use img element for thumbnails, including YouTube */}
      <img 
        src={mediaUrl || undefined}
        alt=""
        className={styles.thumbnailImage}
        loading="lazy"
      />
      {/* Show video overlay indicator for video content */}
      {hasVideo && (
        <div className={styles.videoOverlaySmall}>
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
      <div data-testid="loading-skeleton" className={styles.loadingContainer}>
        <div className={styles.loadingGrid}>
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className={styles.loadingSkeleton}>
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
      className={styles.thumbnailGrid}
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
            className={isCurrent ? styles.thumbnailCardSelected : styles.thumbnailCard}
            onClick={(e) => {
              console.log('[PageThumbnailGrid] Card clicked:', page.id, page.title)
              console.log('[PageThumbnailGrid] Event target:', e.target)
              console.log('[PageThumbnailGrid] Event currentTarget:', e.currentTarget)
              // Don't stop propagation - let it bubble
              onPageSelect(page.id)
            }}
          >
            {/* Page Type Icon */}
            <div className={styles.pageHeader}>
              {isWelcome ? (
                <div 
                  data-testid="page-icon-welcome"
                  data-icon="home"
                  className={`${styles.pageIcon} ${styles.pageIconWelcome}`}
                >
                  <Home size={16} />
                </div>
              ) : isObjectives ? (
                <div 
                  data-testid="page-icon-objectives"
                  data-icon="target"
                  className={`${styles.pageIcon} ${styles.pageIconObjectives}`}
                >
                  <Target size={16} />
                </div>
              ) : (
                <div className={`${styles.pageIcon} ${styles.pageIconDefault}`}>
                  {index - 1}
                </div>
              )}
              <h4 className={styles.pageTitle}>
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
                className={styles.contentPreview}
              >
                {getContentPreview(page.content)}
              </div>
            )}

            {/* Media Indicator */}
            {hasMedia(page) && (
              <div 
                data-testid="media-indicator"
                className={styles.mediaIndicator}
                title="Has media"
              >
                <span className={styles.srOnly}>✓ Has media</span>
                ✓
              </div>
            )}

            {/* Media Count Badge */}
            {mediaCount > 1 && (
              <div className={styles.mediaCount}>
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