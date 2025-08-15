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

// Media Preview Component - Memoized for performance
const MediaPreview: React.FC<{ page: Page | Topic }> = memo(({ page }) => {
  const { getMediaForPage, createBlobUrl } = useUnifiedMedia()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const mediaIdRef = React.useRef<string | null>(null)
  const retryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  
  const MAX_RETRIES = 3
  const RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff: 1s, 2s, 4s
  
  useEffect(() => {
    const loadMedia = async () => {
      if (!page.id) return
      
      // Clear previous media URL to avoid showing stale content
      setMediaUrl(null)
      
      // Get media from context instead of expecting it on the page object
      // This ensures it works for both new pages and pages loaded from storage
      const pageMediaRefs = getMediaForPage(page.id) || []
      console.log(`[PageThumbnailGrid] Page ${page.id} has ${pageMediaRefs.length} media items (retry ${retryCount}/${MAX_RETRIES}):`, pageMediaRefs)
      
      // Log detailed info about each media item
      pageMediaRefs.forEach((media: any, index: number) => {
        console.log(`[PageThumbnailGrid] Media item ${index} for page ${page.id}:`, {
          id: media.id,
          type: media.type,
          isYouTube: media.metadata?.isYouTube,
          url: media.metadata?.youtubeUrl || media.metadata?.embedUrl,
          metadata: media.metadata,
          hasAllProperties: !!(media.id && media.type)
        })
      })
      
      const firstMediaRef = pageMediaRefs.find((m: any) => m.type === 'image' || m.type === 'video')
      
      if (firstMediaRef) {
        console.log('[PageThumbnailGrid] Selected first media ref:', {
          id: firstMediaRef.id,
          type: firstMediaRef.type,
          isYouTube: firstMediaRef.metadata?.isYouTube,
          youtubeUrl: firstMediaRef.metadata?.youtubeUrl,
          embedUrl: firstMediaRef.metadata?.embedUrl
        })
        
        // Handle YouTube videos specially
        if (firstMediaRef.metadata?.isYouTube) {
          const ytUrl = firstMediaRef.metadata?.youtubeUrl || firstMediaRef.metadata?.embedUrl
          console.log('[PageThumbnailGrid] Processing YouTube video:', ytUrl)
          if (ytUrl) {
            // Extract YouTube video ID and use thumbnail URL
            const videoIdMatch = ytUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
            if (videoIdMatch) {
              const videoId = videoIdMatch[1]
              const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
              console.log('[PageThumbnailGrid] Setting YouTube thumbnail:', thumbnailUrl)
              setMediaUrl(thumbnailUrl)
            } else {
              console.warn('[PageThumbnailGrid] Could not extract YouTube ID from:', ytUrl)
            }
          }
        } else if (typeof firstMediaRef.metadata?.url === 'string' && firstMediaRef.metadata.url.startsWith('data:image/svg+xml')) {
          // SVG data URLs work directly, no conversion needed
          console.log('[PageThumbnailGrid] Using SVG data URL directly')
          const safeUrl = typeof firstMediaRef.metadata?.url === 'string' ? firstMediaRef.metadata.url : null
          if (safeUrl) {
            setMediaUrl(safeUrl)
          }
        } else if (firstMediaRef.metadata?.url) {
          // Normalize the URL first to fix double-encoding issues
          const safeUrl = typeof firstMediaRef.metadata?.url === 'string' ? firstMediaRef.metadata.url : ''
          const normalizedUrl = normalizeAssetUrl(safeUrl)
          console.log('[PageThumbnailGrid] URL normalized:', {
            original: firstMediaRef.metadata.url,
            normalized: normalizedUrl,
            hasChanged: normalizedUrl !== firstMediaRef.metadata.url
          })
          
          // For asset:// URLs or blob URLs that need regeneration
          if (normalizedUrl.includes('asset://') || normalizedUrl.includes('asset.localhost') || normalizedUrl.startsWith('blob:')) {
            // Always regenerate blob URLs (don't reuse stale ones)
            const mediaId = firstMediaRef.id
            console.log('[PageThumbnailGrid] Creating fresh blob URL for media ID:', mediaId)
            
            // Store the media ID for cleanup
            mediaIdRef.current = mediaId
            
            try {
              const url = await createBlobUrl(mediaId)
              console.log('[PageThumbnailGrid] Blob URL result:', {
                mediaId,
                originalUrl: firstMediaRef.metadata.url,
                normalizedUrl,
                newUrl: url,
                isValidBlobUrl: url ? url.startsWith('blob:') : false
              })
              
              if (!url) {
                console.error('[PageThumbnailGrid] createBlobUrl returned null/undefined for:', mediaId)
                // Retry with exponential backoff if we haven't exceeded max retries
                if (retryCount < MAX_RETRIES) {
                  const delay = RETRY_DELAYS[retryCount]
                  console.log(`[PageThumbnailGrid] Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
                  retryTimeoutRef.current = setTimeout(() => {
                    setRetryCount(prev => prev + 1)
                  }, delay)
                } else {
                  // Fallback to normalized URL if all retries fail
                  console.warn(`[PageThumbnailGrid] All retries exhausted for media ${mediaId}`)
                  setMediaUrl(normalizedUrl)
                }
              } else {
                setMediaUrl(url)
                setRetryCount(0) // Reset retry count on success
              }
            } catch (error) {
              console.error('[PageThumbnailGrid] Error creating blob URL:', error)
              // Retry on error
              if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[retryCount]
                console.log(`[PageThumbnailGrid] Retrying after error in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
                retryTimeoutRef.current = setTimeout(() => {
                  setRetryCount(prev => prev + 1)
                }, delay)
              } else {
                // Fallback to normalized URL
                setMediaUrl(normalizedUrl)
              }
            }
          } else {
            // For regular URLs, use the normalized URL directly
            setMediaUrl(normalizedUrl)
          }
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
              console.error('[PageThumbnailGrid v2.0.7] createBlobUrl returned null/undefined for:', mediaId)
              // Retry with exponential backoff
              if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[retryCount]
                console.log(`[PageThumbnailGrid] Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
                retryTimeoutRef.current = setTimeout(() => {
                  setRetryCount(prev => prev + 1)
                }, delay)
              }
            } else if (url === '') {
              console.error('[PageThumbnailGrid v2.0.7] createBlobUrl returned empty string for:', mediaId)
              // Retry for empty string as well
              if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[retryCount]
                retryTimeoutRef.current = setTimeout(() => {
                  setRetryCount(prev => prev + 1)
                }, delay)
              }
            } else {
              console.log('[PageThumbnailGrid v2.0.7] Setting media URL:', url)
              setMediaUrl(url)
              setRetryCount(0) // Reset retry count on success
            }
          } catch (error) {
            console.error('[PageThumbnailGrid v2.0.7] Error creating blob URL:', error, 'for media:', mediaId)
            // Retry on error
            if (retryCount < MAX_RETRIES) {
              const delay = RETRY_DELAYS[retryCount]
              console.log(`[PageThumbnailGrid] Retrying after error in ${delay}ms`)
              retryTimeoutRef.current = setTimeout(() => {
                setRetryCount(prev => prev + 1)
              }, delay)
            }
          }
        }
      } else {
        console.log(`[PageThumbnailGrid] No image/video media found for page ${page.id}`)
      }
    }
    
    loadMedia()
    
    // Cleanup function
    return () => {
      // Clear any pending retry timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      // DO NOT revoke blob URLs here!
      // Blob URLs are cached and shared across multiple components
      // Revoking them here causes images to fail loading when components re-render
      // The UnifiedMediaContext manages the blob URL cache globally
    }
  }, [page.id, getMediaForPage, createBlobUrl, retryCount])
  
  // Check for video in media from context
  const mediaItems = getMediaForPage(page.id) || []
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
  const { getMediaForPage } = useUnifiedMedia()
  
  // Helper to get media count (only image/video, not audio/captions) - memoized
  const getMediaCount = useCallback((page: Page | Topic): number => {
    // Get media from context instead of page object
    const mediaItems = getMediaForPage(page.id) || []
    // Only count image and video media types for enhancement purposes
    return mediaItems.filter(m => m.type === 'image' || m.type === 'video').length
  }, [getMediaForPage])

  // Helper to check if page has media - memoized
  const hasMedia = useCallback((page: Page | Topic): boolean => {
    return getMediaCount(page) > 0
  }, [getMediaCount])

  // Create array of all pages - memoized to prevent recreation
  const allPages: Array<Page | Topic> = useMemo(() => [
    courseContent.welcomePage,
    (courseContent as any).objectivesPage || courseContent.learningObjectivesPage, // Handle both naming conventions
    ...courseContent.topics
  ].filter(Boolean), [courseContent]) // Remove any undefined entries

  return (
    <div 
      data-testid="page-thumbnail-grid"
      className={styles.thumbnailGrid}
    >
      {allPages.map((page, index) => {
        // Debug logging to verify page structure
        const mediaFromContext = getMediaForPage(page.id) || []
        console.log(`[PageThumbnailGrid] Rendering page ${page.id}:`, {
          hasMediaInContext: mediaFromContext.length > 0,
          mediaCountFromContext: mediaFromContext.length,
          mediaFromContext: mediaFromContext,
          pageKeys: Object.keys(page)
        })
        
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