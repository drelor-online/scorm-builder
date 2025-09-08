import React, { useEffect, useState, memo, useCallback, useMemo } from 'react'
import { CourseContent, Page, Topic } from '../types/aiPrompt'
import { Card } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import { Home, Target, Image as ImageIcon, Video } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import { normalizeAssetUrl } from '../utils/assetUrlHelper'
import styles from './PageThumbnailGrid.module.css'
// Removed blobUrlManager - now using asset URLs

interface PageThumbnailGridProps {
  courseContent: CourseContent | null
  currentPageId: string
  onPageSelect: (pageId: string) => void
}

// Media Preview Component - Simplified approach using mediaItems[0]
const MediaPreview: React.FC<{ page: Page | Topic; mediaItems: any[] }> = memo(({ page, mediaItems }) => {
  const { createBlobUrl } = useUnifiedMedia()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  // Simplified - no retry logic needed
  
  useEffect(() => {
    const loadMedia = async () => {
      if (!page.id || !mediaItems.length) return
      
      // Clear previous media URL to avoid showing stale content
      setMediaUrl(null)
      
      // Use mediaItems[0] as specified - much simpler approach
      const firstMediaRef = mediaItems[0]
      
      console.log(`[PageThumbnailGrid] Processing first media item for page ${page.id}:`, {
        id: firstMediaRef.id,
        type: firstMediaRef.type,
        storageId: firstMediaRef.storageId,
        isYouTube: firstMediaRef.metadata?.isYouTube,
        url: firstMediaRef.metadata?.youtubeUrl || firstMediaRef.metadata?.embedUrl,
        hasAllProperties: !!(firstMediaRef.id && firstMediaRef.type)
      })
      
      if (firstMediaRef) {
        // Check if it's a YouTube video - simplified logic
        const isYouTubeVideo = (
          firstMediaRef.type === 'youtube' ||
          firstMediaRef.type === 'video' && (
            firstMediaRef.metadata?.isYouTube || 
            firstMediaRef.metadata?.source === 'youtube'
          )
        )
        
        if (isYouTubeVideo) {
          // YouTube → thumbnail via img.youtube.com/vi/ID/hqdefault.jpg
          const youtubeUrl = firstMediaRef.metadata?.youtubeUrl || firstMediaRef.metadata?.embedUrl
          if (youtubeUrl) {
            const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\n?#]+)/)
            if (videoIdMatch) {
              const videoId = videoIdMatch[1]
              const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
              console.log('[PageThumbnailGrid] Setting YouTube thumbnail:', thumbnailUrl)
              setMediaUrl(thumbnailUrl)
              return
            }
          }
        } else {
          // For all other media, call createBlobUrl(first.storageId || first.id)
          const mediaId = firstMediaRef.storageId || firstMediaRef.id
          console.log('[PageThumbnailGrid v2.0.8] Creating blob URL for media ID:', mediaId)
          
          try {
            const url = await createBlobUrl(mediaId)
            
            if (url) {
              console.log('[PageThumbnailGrid v2.0.8] Setting media URL:', url)
              setMediaUrl(url)
            } else {
              console.error('[PageThumbnailGrid v2.0.8] createBlobUrl returned null/undefined for:', mediaId)
            }
          } catch (error) {
            console.error('[PageThumbnailGrid v2.0.8] Error creating blob URL:', error, 'for media:', mediaId)
          }
        }
      }
    }
    
    loadMedia()
    
    // Cleanup function - simplified
    return () => {
      // No cleanup needed for simplified approach
    }
  }, [page.id, mediaItems, createBlobUrl])
  
  // Check for video in media items passed as props
  const hasVideo = mediaItems.some(m => m.type === 'video')
  
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
})

// Add display name for debugging
MediaPreview.displayName = 'MediaPreview'

export const PageThumbnailGrid: React.FC<PageThumbnailGridProps> = memo(({
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

  // Helper to extract text content and truncate - memoized
  const getContentPreview = useCallback((html: string, maxLength: number = 100): string => {
    const temp = document.createElement('div')
    temp.innerHTML = DOMPurify.sanitize(html)
    const text = temp.textContent || temp.innerText || ''
    
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }, [])

  // Get context to access media
  const { getValidMediaForPage } = useUnifiedMedia()
  
  // Create array of all pages first - memoized to prevent recreation
  const allPages: Array<Page | Topic> = useMemo(() => [
    courseContent.welcomePage,
    (courseContent as any).objectivesPage || courseContent.learningObjectivesPage, // Handle both naming conventions
    ...(Array.isArray(courseContent.topics) ? courseContent.topics : [])
  ].filter(Boolean), [courseContent]) // Remove any undefined entries
  
  // State to track media data for all pages (async loading)
  const [pageMediaMap, setPageMediaMap] = useState<Map<string, any[]>>(new Map())
  
  // Load media for all pages when allPages changes
  useEffect(() => {
    const loadMediaForAllPages = async () => {
      const newMap = new Map<string, any[]>()
      
      // Load media for each page using defensive filtering
      const mediaPromises = allPages.map(async (page) => {
        try {
          const mediaItems = await getValidMediaForPage(page.id) || []
          return { pageId: page.id, mediaItems }
        } catch (error) {
          console.warn(`[PageThumbnailGrid] Failed to load media for page ${page.id}:`, error)
          return { pageId: page.id, mediaItems: [] }
        }
      })
      
      const results = await Promise.all(mediaPromises)
      results.forEach(({ pageId, mediaItems }) => {
        newMap.set(pageId, mediaItems)
      })
      
      setPageMediaMap(newMap)
    }
    
    if (allPages.length > 0) {
      loadMediaForAllPages()
    }
  }, [allPages, getValidMediaForPage])
  
  // Helper to get media count (only image/video, not audio/captions) - memoized
  const getMediaCount = useCallback((page: Page | Topic): number => {
    // Get media from memoized map instead of calling getMediaForPage repeatedly
    const mediaItems = pageMediaMap.get(page.id) || []
    // Only count image and video media types for enhancement purposes
    return mediaItems.filter(m => m.type === 'image' || m.type === 'video').length
  }, [pageMediaMap])

  // Helper to check if page has media - memoized
  const hasMedia = useCallback((page: Page | Topic): boolean => {
    return getMediaCount(page) > 0
  }, [getMediaCount])

  return (
    <div 
      data-testid="page-thumbnail-grid"
      className={styles.thumbnailGrid}
    >
      {allPages.map((page, index) => {
        const isWelcome = page.id === 'welcome' || page.id === 'content-0'
        const isObjectives = page.id === 'objectives' || page.id === 'learning-objectives' || page.id === 'content-1'
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
              <MediaPreview page={page} mediaItems={pageMediaMap.get(page.id) || []} />
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
})

// Add display name for debugging
PageThumbnailGrid.displayName = 'PageThumbnailGrid'

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