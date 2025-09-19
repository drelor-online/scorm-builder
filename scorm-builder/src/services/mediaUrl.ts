import { convertFileSrc } from '@tauri-apps/api/core'
import { logger } from '../utils/logger'
import { invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'

export class MediaUrlService {
  private static instance: MediaUrlService
  private urlCache = new Map<string, string>()
  
  static getInstance(): MediaUrlService {
    if (!MediaUrlService.instance) {
      MediaUrlService.instance = new MediaUrlService()
    }
    return MediaUrlService.instance
  }
  
  private extractNumericProjectId(projectIdOrPath: string): string {
    if (!projectIdOrPath) return ''
    
    // If it's a file path like "...\ProjectName_1234567890.scormproj"
    if (projectIdOrPath.includes('.scormproj')) {
      const match = projectIdOrPath.match(/_(\d+)\.scormproj$/)
      if (match) {
        return match[1]
      }
    }
    
    // If it's a folder path like "C:\...\SCORM Projects\1754510569416"
    if (projectIdOrPath.includes('\\') || projectIdOrPath.includes('/')) {
      const parts = projectIdOrPath.split(/[\\/]/)
      const lastPart = parts[parts.length - 1]
      // If the last part is all digits, use it
      if (/^\d+$/.test(lastPart)) {
        return lastPart
      }
    }
    
    // If it's already just a numeric ID
    if (/^\d+$/.test(projectIdOrPath)) {
      return projectIdOrPath
    }
    
    // Fallback: return as is
    logger.warn('[MediaUrlService] Could not extract numeric ID from:', projectIdOrPath)
    return projectIdOrPath
  }
  
  async getMediaUrl(projectId: string, mediaId: string): Promise<string | null> {
    // VERSION MARKER: v2.0.3 - Added detailed logging
    logger.info('[MediaUrlService v2.0.3] Getting media URL', { mediaId, projectId })
    
    // Extract numeric project ID from any format
    const numericProjectId = this.extractNumericProjectId(projectId)
    logger.info('[MediaUrlService v2.0.3] Extracted numeric project ID:', { numericProjectId, originalProjectId: projectId })
    
    const cacheKey = `${numericProjectId}/${mediaId}`
    
    // Check cache first
    if (this.urlCache.has(cacheKey)) {
      const cachedUrl = this.urlCache.get(cacheKey)!
      logger.info('[MediaUrlService v2.0.3] Using cached URL', { mediaId, url: cachedUrl })
      return cachedUrl
    }
    
    try {
      // Check if this is an SVG by getting the media with metadata
      let isSvg = false
      let mediaData: any = null
      try {
        // Use get_media to retrieve both data and metadata - use numeric project ID
        mediaData = await invoke<any>('get_media', {
          projectId: numericProjectId,
          mediaId: mediaId
        })
        isSvg = mediaData?.metadata?.mime_type === 'image/svg+xml'
      } catch (e) {
        // Media not found - this is the critical issue!
        logger.error('[MediaUrlService v2.0.3] Failed to get media from backend!', {
          error: e,
          errorMessage: (e as any)?.message || 'Unknown error',
          projectId: numericProjectId,
          mediaId: mediaId,
          originalProjectId: projectId,
          details: 'This means the media file does not exist in the backend storage yet!'
        })
        
        // Even if get_media fails, we should still generate the URL
        // The file might exist but get_media might be failing for other reasons
        logger.warn('[MediaUrlService v2.0.3] Attempting to generate URL anyway despite get_media failure')
        // Don't return null here - continue to generate the URL
        // return null
      }
      
      // For SVG files, use data URL instead of asset protocol
      if (isSvg && mediaData) {
        try {
          // Convert byte array to base64
          const uint8Array = new Uint8Array(mediaData.data)
          const base64Content = btoa(String.fromCharCode(...uint8Array))
          
          // Create a data URL for SVG
          const url = `data:image/svg+xml;base64,${base64Content}`
          
          // Cache the URL
          this.urlCache.set(cacheKey, url)
          
          logger.info('[MediaUrlService] Generated data URL for SVG', mediaId)
          
          return url
        } catch (error) {
          logger.error('[MediaUrlService] Failed to read SVG file:', error)
          return null
        }
      }
      
      // FIX: Manually construct the asset URL to avoid issues with convertFileSrc on Windows.
      // The asset protocol should be rooted at the main projects directory.
      
      // 1. Construct the relative path to the media file using the numeric project ID.
      const relativePath = await join(numericProjectId, 'media', `${mediaId}.bin`);
      
      // 2. Normalize the path for URL usage (replace backslashes with forward slashes).
      const urlPath = relativePath.replace(/\\/g, '/');
      
      // 3. Create the final URL using the asset:// protocol.
      const url = `asset://localhost/${urlPath}`;

      // Cache the URL
      this.urlCache.set(cacheKey, url)
      
      logger.info('[MediaUrlService v2.0.3] Generated asset URL', { 
        mediaId, 
        numericProjectId,
        relativePath,
        urlPath,
        finalUrl: url 
      })
      
      return url
    } catch (error) {
      logger.error('[MediaUrlService v2.0.2] Failed to generate URL:', error)
      return null
    }
  }
  
  clearCache() {
    this.urlCache.clear()
  }
}

export const mediaUrlService = MediaUrlService.getInstance()

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null
  
  // Match various YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/
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
 * Build YouTube embed URL with optional clip timing parameters
 */
export function buildYouTubeEmbed(rawUrl: string, start?: number, end?: number): string {
  // Handle null, undefined, or empty URLs
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    console.error('[mediaUrl] buildYouTubeEmbed: Invalid URL provided:', rawUrl)
    return 'about:blank' // Safe fallback that won't cause iframe errors
  }

  const id = extractYouTubeId(rawUrl)
  if (!id) {
    // If we can't extract ID, don't return the original URL as it might not be an embed URL
    // This prevents iframe errors like "Refused to display 'https://www.youtube.com/' in a frame"
    console.error('[mediaUrl] buildYouTubeEmbed: Failed to extract YouTube ID from URL:', rawUrl)
    return 'about:blank' // Safe fallback instead of potentially invalid iframe src
  }

  const params = new URLSearchParams()
  if (typeof start === 'number') {
    // Convert negative values to 0
    const safeStart = Math.max(0, Math.floor(start))
    if (safeStart >= 0) {
      params.set('start', String(safeStart))
    }
  }
  if (typeof end === 'number' && (!start || end > start)) {
    params.set('end', String(Math.floor(end)))
  }

  const qs = params.toString() ? `?${params.toString()}` : ''
  const embedUrl = `https://www.youtube.com/embed/${id}${qs}`

  console.log('[mediaUrl] buildYouTubeEmbed: Generated embed URL:', { rawUrl, embedUrl, start, end })
  return embedUrl
}

/**
 * Parse existing YouTube embed URL to extract clip timing
 */
export function parseYouTubeClipTiming(embedUrl: string): { start?: number, end?: number } {
  if (!embedUrl) return {}

  try {
    const url = new URL(embedUrl)
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')

    return {
      start: start ? parseInt(start, 10) : undefined,
      end: end ? parseInt(end, 10) : undefined
    }
  } catch {
    return {}
  }
}

/**
 * Extract clip timing from YouTube embed URL in the format expected by the MediaService
 *
 * This function addresses the bug where clip timing is lost after project reload
 * because it's only preserved in the embed URL as query parameters.
 *
 * @param url - YouTube embed URL that may contain start/end parameters
 * @returns Object with clipStart and clipEnd properties (matching MediaService format)
 */
export function extractClipTimingFromUrl(url: string): { clipStart?: number, clipEnd?: number } {
  // Handle null, undefined, or empty URLs
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return {
      clipStart: undefined,
      clipEnd: undefined
    }
  }

  try {
    const urlObj = new URL(url)
    const startParam = urlObj.searchParams.get('start')
    const endParam = urlObj.searchParams.get('end')

    // Parse and validate start parameter
    let clipStart: number | undefined = undefined
    if (startParam) {
      const parsed = parseInt(startParam, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        clipStart = Math.floor(parsed) // Round down decimal values
      }
    }

    // Parse and validate end parameter
    let clipEnd: number | undefined = undefined
    if (endParam) {
      const parsed = parseInt(endParam, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        clipEnd = Math.floor(parsed) // Round down decimal values
      }
    }

    return {
      clipStart,
      clipEnd
    }
  } catch (error) {
    // Handle malformed URLs gracefully
    console.warn('[mediaUrl] extractClipTimingFromUrl: Failed to parse URL:', url, error)
    return {
      clipStart: undefined,
      clipEnd: undefined
    }
  }
}