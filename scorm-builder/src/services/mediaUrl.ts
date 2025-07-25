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
  
  async getMediaUrl(projectId: string, mediaId: string): Promise<string | null> {
    const cacheKey = `${projectId}/${mediaId}`
    
    // Check cache first
    if (this.urlCache.has(cacheKey)) {
      return this.urlCache.get(cacheKey)!
    }
    
    try {
      // Check if this is an SVG by reading metadata
      let isSvg = false
      try {
        const metadataJson = await invoke<string>('read_file', {
          projectId: projectId,
          relativePath: `media/${mediaId}.json`
        })
        const metadataBase64 = JSON.parse(atob(metadataJson))
        isSvg = metadataBase64.mime_type === 'image/svg+xml'
      } catch (e) {
        // Metadata not found or invalid
      }
      
      // For SVG files, use data URL instead of asset protocol
      if (isSvg) {
        try {
          const base64Content = await invoke<string>('read_file', {
            projectId: projectId,
            relativePath: `media/${mediaId}.bin`
          })
          
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
      
      // For non-SVG files, use the asset protocol
      const projectsDir = await invoke<string>('get_projects_dir')
      
      // Use Tauri's path join to handle platform-specific separators
      const mediaDir = await join(projectsDir, projectId, 'media')
      const filePath = await join(mediaDir, `${mediaId}.bin`)
      
      // First verify the file exists
      try {
        await invoke('read_file', {
          projectId: projectId,
          relativePath: `media/${mediaId}.bin`
        })
      } catch (error) {
        logger.error('[MediaUrlService] File does not exist:', filePath)
        return null
      }
      
      // Convert to a URL that Tauri can serve
      const url = convertFileSrc(filePath)
      
      // Cache the URL
      this.urlCache.set(cacheKey, url)
      
      logger.info('[MediaUrlService] Generated URL for', mediaId, ':', url)
      logger.info('[MediaUrlService] File path:', filePath)
      
      return url
    } catch (error) {
      logger.error('[MediaUrlService] Failed to generate URL:', error)
      return null
    }
  }
  
  clearCache() {
    this.urlCache.clear()
  }
}

export const mediaUrlService = MediaUrlService.getInstance()