import React, { useEffect, useState, memo, useCallback, useMemo, useRef } from 'react'
import { CourseContent, Page, Topic } from '../types/aiPrompt'
import { Card } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import { Home, Target, Image as ImageIcon, Video } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useMedia } from '../hooks/useMedia'
import { normalizeAssetUrl } from '../utils/assetUrlHelper'
import styles from './PageThumbnailGrid.module.css'
// Removed blobUrlManager - now using asset URLs

interface PageThumbnailGridProps {
  courseContent: CourseContent | null
  currentPageId: string
  onPageSelect: (pageId: string) => void
}

// Media Preview Component - Enhanced with YouTube metadata fetching
const MediaPreview: React.FC<{ page: Page | Topic; mediaItems: any[] }> = memo(({ page, mediaItems }) => {
  const { actions, selectors } = useMedia()
  const { createBlobUrl } = actions
  const { getMedia } = selectors
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [enrichedMetadata, setEnrichedMetadata] = useState<Map<string, any>>(new Map())
  
  useEffect(() => {
    const loadMedia = async () => {
      if (!page.id || !mediaItems.length) return
      
      // Get first VISUAL media reference (filter for image, video, youtube only)
      const visualMediaItems = mediaItems.filter(m => m.type === 'image' || m.type === 'video' || m.type === 'youtube')
      const firstMediaRef = visualMediaItems[0]
      
      // Exit early if no visual media available
      if (!firstMediaRef) {
        console.log(`[PageThumbnailGrid] No visual media found for page ${page.id}, skipping thumbnail`)
        return
      }
      
      // Clear previous media URL to avoid showing stale content
      setMediaUrl(null)
      
      console.log(`[PageThumbnailGrid] Processing first media item for page ${page.id}:`, {
        id: firstMediaRef.id,
        type: firstMediaRef.type,
        storageId: firstMediaRef.storageId,
        isYouTube: firstMediaRef.metadata?.isYouTube,
        url: firstMediaRef.metadata?.youtubeUrl || firstMediaRef.metadata?.embedUrl,
        hasAllProperties: !!(firstMediaRef.id && firstMediaRef.type),
        fullMetadata: firstMediaRef.metadata
      })
      
      if (firstMediaRef) {
        // Check if it's a YouTube video
        const isYouTubeVideo = (
          firstMediaRef.type === 'youtube' ||
          firstMediaRef.type === 'video' && (
            firstMediaRef.metadata?.isYouTube || 
            firstMediaRef.metadata?.source === 'youtube'
          )
        )
        
        if (isYouTubeVideo) {
          // YouTube → thumbnail via img.youtube.com/vi/ID/hqdefault.jpg
          // Try multiple metadata locations for YouTube URL
          let youtubeUrl = firstMediaRef.metadata?.youtubeUrl || 
                          firstMediaRef.metadata?.embedUrl ||
                          firstMediaRef.metadata?.url ||
                          firstMediaRef.url
          
          console.log('[PageThumbnailGrid] YouTube URL extraction (initial):', {
            youtubeUrl: firstMediaRef.metadata?.youtubeUrl,
            embedUrl: firstMediaRef.metadata?.embedUrl,
            metadataUrl: firstMediaRef.metadata?.url,
            directUrl: firstMediaRef.url,
            selectedUrl: youtubeUrl
          })
          
          // If no YouTube URL found in basic metadata, fetch enriched metadata via context
          if (!youtubeUrl) {
            console.log('[PageThumbnailGrid] 🔄 Fetching enriched YouTube metadata for:', firstMediaRef.id)
            
            try {
              // Check if we already have enriched metadata cached
              const cachedMetadata = enrichedMetadata.get(firstMediaRef.id)
              let enrichedData = cachedMetadata
              
              if (!enrichedData) {
                console.log('[PageThumbnailGrid] 📡 Calling getMedia() from context for enrichment...')
                enrichedData = await getMedia(firstMediaRef.id)
                
                if (enrichedData) {
                  // Cache the enriched metadata
                  setEnrichedMetadata(prev => new Map(prev.set(firstMediaRef.id, enrichedData)))
                  console.log('[PageThumbnailGrid] ✅ Cached enriched metadata for:', firstMediaRef.id)
                }
              } else {
                console.log('[PageThumbnailGrid] 📦 Using cached enriched metadata for:', firstMediaRef.id)
              }
              
              if (enrichedData?.metadata) {
                // Extract YouTube URL from enriched metadata
                youtubeUrl = enrichedData.metadata.youtubeUrl || 
                            enrichedData.metadata.embedUrl ||
                            enrichedData.url
                
                console.log('[PageThumbnailGrid] 🎬 Enriched YouTube metadata extracted:', {
                  enrichedYoutubeUrl: enrichedData.metadata.youtubeUrl,
                  enrichedEmbedUrl: enrichedData.metadata.embedUrl,
                  enrichedDirectUrl: enrichedData.url,
                  finalUrl: youtubeUrl
                })
              }
            } catch (error) {
              console.error('[PageThumbnailGrid] ❌ Failed to fetch enriched YouTube metadata:', error)
            }
          }
          
          if (youtubeUrl) {
            const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\n?#]+)/)
            if (videoIdMatch) {
              const videoId = videoIdMatch[1]
              const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
              console.log('[PageThumbnailGrid] 🎯 Setting YouTube thumbnail:', thumbnailUrl)
              setMediaUrl(thumbnailUrl)
              return
            } else {
              console.warn('[PageThumbnailGrid] Could not extract video ID from YouTube URL:', youtubeUrl)
            }
          } else {
            console.warn('[PageThumbnailGrid] No YouTube URL found in metadata for video:', firstMediaRef.id)
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
  }, [page.id, mediaItems, createBlobUrl, getMedia, enrichedMetadata])
  
  // Check for video in media items passed as props - include YouTube videos
  const hasVideo = mediaItems.some(m => m.type === 'video' || m.type === 'youtube')
  
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

// Lazy Media Preview Component with Intersection Observer
const LazyMediaPreview: React.FC<{ page: Page | Topic; pageId: string }> = memo(({ page, pageId }) => {
  const { actions, selectors } = useMedia()
  const { getValidMediaForPage } = selectors
  const [isVisible, setIsVisible] = useState(false)
  const [mediaItems, setMediaItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  // Intersection Observer to detect when thumbnail comes into view
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          console.log(`[LazyMediaPreview] ${pageId} entered viewport, starting load`)
          setIsVisible(true)
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1 // Trigger when 10% visible
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [pageId, isVisible])

  // Load media only when visible
  useEffect(() => {
    if (!isVisible || !getValidMediaForPage) return

    const loadMedia = async () => {
      setIsLoading(true)
      try {
        console.log(`[LazyMediaPreview] Loading media for page ${pageId}`)
        const items = await getValidMediaForPage(pageId, {
          types: ['image', 'video', 'youtube'],
          verifyExistence: false
        }) || []

        setMediaItems(items)
        console.log(`[LazyMediaPreview] Loaded ${items.length} media items for page ${pageId}`)
      } catch (error) {
        console.warn(`[LazyMediaPreview] Failed to load media for page ${pageId}:`, error)
        setMediaItems([])
      } finally {
        setIsLoading(false)
      }
    }

    loadMedia()
  }, [isVisible, pageId, getValidMediaForPage])

  // Check for video in media items
  const hasVideo = mediaItems.some(m => m.type === 'video' || m.type === 'youtube')

  return (
    <div ref={elementRef} className={styles.thumbnailContent}>
      {isLoading ? (
        // Loading placeholder
        <div className={styles.thumbnailPlaceholder}>
          <div className={styles.loadingSpinner} />
        </div>
      ) : isVisible && mediaItems.length > 0 ? (
        // Render actual MediaPreview when loaded
        <MediaPreview page={page} mediaItems={mediaItems} />
      ) : isVisible ? (
        // No media placeholder when loaded but empty
        <div className={styles.thumbnailPlaceholder}>
          <ImageIcon size={24} />
        </div>
      ) : (
        // Initial placeholder before loading
        <div className={styles.thumbnailPlaceholder}>
          {hasVideo ? <Video size={24} /> : <ImageIcon size={24} />}
        </div>
      )}
    </div>
  )
})

LazyMediaPreview.displayName = 'LazyMediaPreview'

// 🚀 PHASE 4: Cache-Aware Media Preview Component
const CachedMediaPreview: React.FC<{
  page: Page | Topic;
  pageId: string;
  getCachedThumbnail: (pageId: string) => any;
  setCachedThumbnail: (pageId: string, data: any) => void;
}> = memo(({ page, pageId, getCachedThumbnail, setCachedThumbnail }) => {
  const { actions, selectors } = useMedia()
  const { getValidMediaForPage } = selectors
  const [isVisible, setIsVisible] = useState(false)
  const [mediaItems, setMediaItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  // Check cache first
  useEffect(() => {
    const cached = getCachedThumbnail(pageId)
    if (cached && !cached.isLoading) {
      console.log(`[CachedMediaPreview] 📦 CACHE HIT: Using cached thumbnail for ${pageId}`)
      setMediaItems(cached.mediaItems)
      setIsLoading(false)
      return
    }
  }, [pageId, getCachedThumbnail])

  // Intersection Observer to detect when thumbnail comes into view
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          console.log(`[CachedMediaPreview] ${pageId} entered viewport, checking cache then loading`)
          setIsVisible(true)
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1 // Trigger when 10% visible
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [pageId, isVisible])

  // Load media only when visible and not cached
  useEffect(() => {
    if (!isVisible || !getValidMediaForPage) return

    // Check cache again when visibility changes
    const cached = getCachedThumbnail(pageId)
    if (cached && !cached.isLoading) {
      console.log(`[CachedMediaPreview] 📦 CACHE HIT on visibility: Using cached data for ${pageId}`)
      setMediaItems(cached.mediaItems)
      setIsLoading(false)
      return
    }

    const loadMedia = async () => {
      setIsLoading(true)

      // Store loading state in cache to prevent duplicate requests
      setCachedThumbnail(pageId, {
        mediaItems: [],
        mediaUrl: null,
        isLoading: true
      })

      try {
        console.log(`[CachedMediaPreview] 📡 CACHE MISS: Loading media for page ${pageId}`)
        const items = await getValidMediaForPage(pageId, {
          types: ['image', 'video', 'youtube'],
          verifyExistence: false
        }) || []

        setMediaItems(items)

        // Cache the loaded media items
        setCachedThumbnail(pageId, {
          mediaItems: items,
          mediaUrl: null, // Will be set by MediaPreview
          isLoading: false
        })

        console.log(`[CachedMediaPreview] ✅ CACHED: ${items.length} media items for page ${pageId}`)
      } catch (error) {
        console.warn(`[CachedMediaPreview] ❌ LOAD FAILED for page ${pageId}:`, error)
        setMediaItems([])

        // Cache the failure to avoid repeated attempts
        setCachedThumbnail(pageId, {
          mediaItems: [],
          mediaUrl: null,
          isLoading: false
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadMedia()
  }, [isVisible, pageId, getValidMediaForPage, getCachedThumbnail, setCachedThumbnail])

  // Check for video in media items
  const hasVideo = mediaItems.some(m => m.type === 'video' || m.type === 'youtube')

  return (
    <div ref={elementRef} className={styles.thumbnailContent}>
      {isLoading ? (
        // Loading placeholder
        <div className={styles.thumbnailPlaceholder}>
          <div className={styles.loadingSpinner} />
        </div>
      ) : isVisible && mediaItems.length > 0 ? (
        // Render actual MediaPreview when loaded
        <MediaPreview page={page} mediaItems={mediaItems} />
      ) : isVisible ? (
        // No media placeholder when loaded but empty
        <div className={styles.thumbnailPlaceholder}>
          <ImageIcon size={24} />
        </div>
      ) : (
        // Initial placeholder before loading
        <div className={styles.thumbnailPlaceholder}>
          {hasVideo ? <Video size={24} /> : <ImageIcon size={24} />}
        </div>
      )}
    </div>
  )
})

CachedMediaPreview.displayName = 'CachedMediaPreview'

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

  // 🚀 PHASE 4: Dedicated Thumbnail Cache for PageThumbnailGrid
  const thumbnailCache = useRef<Map<string, {
    mediaItems: any[]
    mediaUrl: string | null
    timestamp: number
    isLoading: boolean
  }>>(new Map())

  const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  const MAX_CACHE_SIZE = 50 // Maximum number of cached thumbnails

  // Cache management functions
  const getCachedThumbnail = useCallback((pageId: string) => {
    const cached = thumbnailCache.current.get(pageId)
    if (!cached) return null

    // Check if cache is expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      thumbnailCache.current.delete(pageId)
      return null
    }

    return cached
  }, [])

  const setCachedThumbnail = useCallback((pageId: string, data: {
    mediaItems: any[]
    mediaUrl: string | null
    isLoading: boolean
  }) => {
    // Implement LRU cache by removing oldest entries when at capacity
    if (thumbnailCache.current.size >= MAX_CACHE_SIZE) {
      const oldestKey = thumbnailCache.current.keys().next().value
      if (oldestKey) {
        thumbnailCache.current.delete(oldestKey)
        console.log(`[PageThumbnailGrid] 🗑️ CACHE: Evicted oldest entry ${oldestKey}`)
      }
    }

    thumbnailCache.current.set(pageId, {
      ...data,
      timestamp: Date.now()
    })

    console.log(`[PageThumbnailGrid] 💾 CACHE: Stored thumbnail for ${pageId} (cache size: ${thumbnailCache.current.size})`)
  }, [])

  const clearThumbnailCache = useCallback(() => {
    const cacheSize = thumbnailCache.current.size
    thumbnailCache.current.clear()
    console.log(`[PageThumbnailGrid] 🧹 CACHE: Cleared ${cacheSize} cached thumbnails`)
  }, [])

  // Clear cache when course content changes (new project loaded)
  useEffect(() => {
    clearThumbnailCache()
  }, [courseContent?.topics?.length, courseContent?.welcomePage?.id, clearThumbnailCache])

  // Helper to extract text content and truncate - memoized
  const getContentPreview = useCallback((html: string, maxLength: number = 100): string => {
    const temp = document.createElement('div')
    temp.innerHTML = DOMPurify.sanitize(html)
    const text = temp.textContent || temp.innerText || ''
    
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }, [])

  // Get media context
  const media = useMedia()
  const { getValidMediaForPage } = media.selectors
  
  // Create array of all pages first - memoized to prevent recreation
  const allPages: Array<Page | Topic> = useMemo(() => [
    courseContent.welcomePage,
    (courseContent as any).objectivesPage || courseContent.learningObjectivesPage, // Handle both naming conventions
    ...(Array.isArray(courseContent.topics) ? courseContent.topics : [])
  ].filter(Boolean), [courseContent]) // Remove any undefined entries
  
  // Remove bulk loading - now using lazy loading per thumbnail
  
  // For lazy loading, we'll determine media presence optimistically
  // The LazyMediaPreview will handle the actual media loading
  const hasMedia = useCallback((page: Page | Topic): boolean => {
    // For now, assume pages have media - LazyMediaPreview will show appropriate placeholder
    // This prevents layout shift and provides better UX
    return true
  }, [])

  return (
    <div 
      data-testid="page-thumbnail-grid"
      className={styles.thumbnailGrid}
    >
      {allPages.map((page, index) => {
        const isWelcome = page.id === 'welcome' || page.id === 'content-0'
        const isObjectives = page.id === 'objectives' || page.id === 'learning-objectives' || page.id === 'content-1'
        const isCurrent = page.id === currentPageId
        
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

            {/* Cached Media Preview */}
            <CachedMediaPreview
              page={page}
              pageId={page.id}
              getCachedThumbnail={getCachedThumbnail}
              setCachedThumbnail={setCachedThumbnail}
            />

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