import { logger } from '../utils/logger'

export interface YouTubeVideoInfo {
  duration: number | null
  title: string
  thumbnail: string
  author: string
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null

  // Regular expressions for different YouTube URL formats
  const patterns = [
    // Standard watch URLs: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // Short URLs: youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URLs: youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Check if a URL is a valid YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  
  return /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/.test(url)
}

/**
 * Parse ISO 8601 duration format (PT3M32S) to seconds
 */
export function parseDuration(duration: string): number | null {
  if (!duration || typeof duration !== 'string') return null

  // ISO 8601 duration format: PT[hours]H[minutes]M[seconds]S
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  
  if (!match) return null

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Get YouTube video duration and metadata using oEmbed API
 * This API doesn't require authentication and is free to use
 */
export async function getYouTubeDuration(url: string): Promise<YouTubeVideoInfo | null> {
  if (!isYouTubeUrl(url)) {
    logger.warn('[YouTubeDurationService] Invalid YouTube URL:', url)
    return null
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    logger.warn('[YouTubeDurationService] Could not extract video ID from URL:', url)
    return null
  }

  try {
    logger.info('[YouTubeDurationService] Fetching video info for:', videoId)

    // Use YouTube's oEmbed API for basic metadata
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    
    const response = await fetch(oEmbedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SCORM-Builder/1.0'
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      logger.warn('[YouTubeDurationService] oEmbed API request failed:', response.status, response.statusText)
      return null
    }

    const data = await response.json()
    
    logger.info('[YouTubeDurationService] oEmbed response:', data)

    // Extract metadata from oEmbed response
    const result: YouTubeVideoInfo = {
      title: data.title || 'Unknown Title',
      author: data.author_name || 'Unknown Channel',
      thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: null // oEmbed doesn't typically include duration
    }

    // Some oEmbed implementations might include duration
    if (data.duration && typeof data.duration === 'number') {
      result.duration = data.duration
    }

    // Try additional methods to get duration if not available
    if (result.duration === null) {
      // Unfortunately, without API keys, we can't easily get duration
      // The oEmbed API doesn't include duration information
      // We could potentially scrape the page or use other methods here
      logger.warn('[YouTubeDurationService] Duration not available from oEmbed API')
    }

    return result

  } catch (error) {
    logger.error('[YouTubeDurationService] Failed to fetch video info:', error)
    return null
  }
}

/**
 * Get video duration with fallback methods
 * This function tries multiple approaches to get video duration
 */
export async function getYouTubeDurationWithFallback(url: string): Promise<YouTubeVideoInfo | null> {
  // First try the oEmbed API
  const oEmbedResult = await getYouTubeDuration(url)
  
  if (oEmbedResult && oEmbedResult.duration !== null) {
    logger.info('[YouTubeDurationService] Got duration from oEmbed API:', oEmbedResult.duration)
    return oEmbedResult
  }

  // If oEmbed didn't provide duration, try alternative methods
  const videoId = extractVideoId(url)
  if (!videoId) return oEmbedResult

  try {
    // Method 2: Try to extract duration from page metadata
    // This is a fallback that could work in some cases
    const alternativeDuration = await extractDurationFromPage(url)
    
    if (alternativeDuration && oEmbedResult) {
      logger.info('[YouTubeDurationService] Got duration from page scraping:', alternativeDuration)
      return {
        ...oEmbedResult,
        duration: alternativeDuration
      }
    }

    // Method 3: Use common video lengths as educated guess
    // This is not ideal but provides some functionality
    if (oEmbedResult) {
      logger.warn('[YouTubeDurationService] Could not determine duration, using fallback')
      return {
        ...oEmbedResult,
        duration: 180 // 3 minutes as a reasonable default
      }
    }

  } catch (error) {
    logger.error('[YouTubeDurationService] Fallback methods failed:', error)
  }

  return oEmbedResult
}

/**
 * Try to extract duration from YouTube page HTML
 * This is a fallback method that may work in some cases
 */
async function extractDurationFromPage(url: string): Promise<number | null> {
  try {
    logger.info('[YouTubeDurationService] Attempting page scraping for duration')
    
    // Note: This approach has limitations due to CORS and YouTube's dynamic loading
    // In a real implementation, you might need to use a proxy or server-side scraping
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SCORM-Builder/1.0)'
      },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    
    // Look for duration in various places in the HTML
    // YouTube includes duration in structured data
    const durationMatch = html.match(/"duration":"PT(\d+)M(\d+)S"/) ||
                         html.match(/&quot;duration&quot;:&quot;PT(\d+)M(\d+)S&quot;/) ||
                         html.match(/"contentDuration":"PT(\d+)M(\d+)S"/)
    
    if (durationMatch) {
      const minutes = parseInt(durationMatch[1], 10)
      const seconds = parseInt(durationMatch[2], 10)
      return minutes * 60 + seconds
    }

    return null

  } catch (error) {
    logger.warn('[YouTubeDurationService] Page scraping failed:', error)
    return null
  }
}

/**
 * Batch fetch durations for multiple YouTube URLs
 */
export async function getYouTubeDurationsBatch(urls: string[]): Promise<(YouTubeVideoInfo | null)[]> {
  logger.info('[YouTubeDurationService] Batch fetching durations for', urls.length, 'videos')
  
  // Process in parallel but with some concurrency limit to avoid overwhelming the API
  const BATCH_SIZE = 5
  const results: (YouTubeVideoInfo | null)[] = []
  
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    const batchPromises = batch.map(url => getYouTubeDurationWithFallback(url))
    
    try {
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // Small delay between batches to be respectful to the API
      if (i + BATCH_SIZE < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      logger.error('[YouTubeDurationService] Batch processing failed:', error)
      // Add null results for failed batch
      results.push(...new Array(batch.length).fill(null))
    }
  }
  
  return results
}