import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { CourseContent, EnhancedCourseContent } from '../types/scorm'
import { downloadIfExternal, isExternalUrl } from './externalImageDownloader'

interface MediaFile {
  filename: string
  content: Uint8Array
}

// Media cache to prevent duplicate loads during SCORM generation
const mediaCache = new Map<string, { data: Uint8Array, mimeType: string }>()

/**
 * Clear the media cache (should be called after SCORM generation)
 */
export function clearMediaCache(): void {
  mediaCache.clear()
  console.log('[Rust SCORM] Media cache cleared')
}

/**
 * Extract objectives from HTML content (for CourseContent format)
 */
function extractObjectivesFromContent(content: string): string[] {
  // Simple extraction - look for list items in the content
  const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi
  const objectives: string[] = []
  let match
  
  while ((match = listItemRegex.exec(content)) !== null) {
    // Remove HTML tags and trim
    const objective = match[1].replace(/<[^>]*>/g, '').trim()
    if (objective) {
      objectives.push(objective)
    }
  }
  
  // If no list items found, split by line breaks and filter
  if (objectives.length === 0) {
    const lines = content.split(/\n|<br\s*\/?>/).map(line => 
      line.replace(/<[^>]*>/g, '').trim()
    ).filter(line => line.length > 0)
    objectives.push(...lines)
  }
  
  return objectives
}

/**
 * Pre-load media into the cache from a Map of blobs
 * This allows SCORMPackageBuilder to pass already-loaded media
 */
export async function preloadMediaCache(mediaMap: Map<string, Blob>): Promise<void> {
  console.log(`[Rust SCORM] Pre-loading ${mediaMap.size} media files into cache`)
  
  for (const [filename, blob] of mediaMap) {
    try {
      // Extract the media ID from the filename (e.g., 'image-0.jpg' -> 'image-0')
      const mediaId = filename.replace(/\.(jpg|jpeg|png|gif|mp3|mp4|vtt|bin)$/i, '')
      
      // Convert blob to Uint8Array
      const arrayBuffer = await blob.arrayBuffer()
      const data = new Uint8Array(arrayBuffer)
      const mimeType = blob.type || 'application/octet-stream'
      
      // Store in cache
      mediaCache.set(mediaId, { data, mimeType })
      console.log(`[Rust SCORM] Cached ${mediaId} (${mimeType}, ${data.length} bytes)`)
    } catch (error) {
      console.error(`[Rust SCORM] Failed to pre-load ${filename}:`, error)
    }
  }
  
  console.log(`[Rust SCORM] Pre-loading complete. Cache size: ${mediaCache.size}`)
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'text/vtt': 'vtt'
  }
  return mimeToExt[mimeType] || 'bin'
}

/**
 * Get extension from media ID (fallback when no MIME type)
 */
function getExtensionFromMediaId(mediaId: string): string {
  if (mediaId.startsWith('audio-')) return 'mp3'
  if (mediaId.startsWith('caption-')) return 'vtt'
  if (mediaId.startsWith('image-')) return 'jpg'
  if (mediaId.startsWith('video-')) return 'mp4'
  return 'bin'
}

/**
 * Resolve audio/caption file and add to media files
 */
async function resolveAudioCaptionFile(
  fileId: string | undefined,
  projectId: string,
  mediaFiles: MediaFile[],
  blob?: Blob
): Promise<string | undefined> {
  console.log(`[Rust SCORM] resolveAudioCaptionFile called with fileId: ${fileId}`)
  if (!fileId && !blob) return undefined
  
  // Defensive check: Don't try to fetch media with invalid high indices
  // We have 11 topics (0-10), so valid audio/caption IDs are 0-12 (welcome=0, objectives=1, topics=2-12)
  // But if topic-10 has no audio, we shouldn't have audio-12 or caption-12
  if (fileId && fileId.match(/^(audio|caption)-(\d+)$/)) {
    const match = fileId.match(/^(audio|caption)-(\d+)$/)
    if (match) {
      const index = parseInt(match[2])
      // If index is suspiciously high (> 20), it's likely an error
      if (index > 20) {
        console.warn(`[Rust SCORM] Skipping suspicious media ID with high index: ${fileId}`)
        return undefined
      }
    }
  }
  
  // If we have a blob, use it directly
  if (blob && fileId) {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const mimeType = blob.type || 'application/octet-stream'
      const cleanFileId = fileId.endsWith('.bin') ? fileId.replace('.bin', '') : fileId
      const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(cleanFileId)
      const filename = `${cleanFileId}.${ext}`
      
      mediaFiles.push({
        filename,
        content: uint8Array,
      })
      
      return `media/${filename}`
    } catch (error) {
      console.error(`[Rust SCORM] Failed to process blob:`, error)
    }
  }
  
  if (!fileId) return undefined
  
  // Strip .bin extension if present
  const cleanFileId = fileId.endsWith('.bin') ? fileId.replace('.bin', '') : fileId
  
  // If it's already a path (media/...), return as-is
  if (cleanFileId.startsWith('media/')) {
    return cleanFileId
  }
  
  // Check if this file was already processed
  const existingFile = mediaFiles.find(f => f.filename === cleanFileId || f.filename.startsWith(cleanFileId + '.'))
  if (existingFile) {
    return `media/${existingFile.filename}`
  }
  
  // If it's a media ID, load from MediaService
  if (cleanFileId.match(/^(audio|caption)-[\w-]+$/)) {
    // Check cache first
    const cached = mediaCache.get(cleanFileId)
    if (cached) {
      console.log(`[Rust SCORM] Using cached media:`, cleanFileId)
      const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(cleanFileId)
      const filename = `${cleanFileId}.${ext}`
      
      // Add to mediaFiles if not already there
      if (!mediaFiles.find(f => f.filename === filename)) {
        mediaFiles.push({
          filename,
          content: cached.data,
        })
      }
      
      return `media/${filename}`
    }
    
    try {
      const { createMediaService } = await import('./MediaService')
      const mediaService = createMediaService(projectId)
      const fileData = await mediaService.getMedia(cleanFileId)
      
      if (fileData && fileData.data) {
        const mimeType = fileData.metadata?.mimeType || ''
        const uint8Data = new Uint8Array(fileData.data)
        
        // Cache the data
        mediaCache.set(cleanFileId, { data: uint8Data, mimeType })
        
        const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(cleanFileId)
        const filename = `${cleanFileId}.${ext}`
        
        mediaFiles.push({
          filename,
          content: uint8Data,
        })
        
        return `media/${filename}`
      } else {
        console.warn(`[Rust SCORM] Media not found: ${cleanFileId}, skipping`)
        return undefined
      }
    } catch (error) {
      console.warn(`[Rust SCORM] Failed to load audio/caption file ${cleanFileId}, skipping:`, error)
    }
  }
  
  // Otherwise, return as-is (might be a direct filename)
  return fileId
}

/**
 * Resolve a single image URL/ID and add to media files
 */
async function resolveImageUrl(
  imageUrl: string | undefined,
  projectId: string,
  mediaFiles: MediaFile[],
  mediaCounter: { [type: string]: number }
): Promise<string | undefined> {
  // Only log when we have a valid imageUrl to avoid cluttering logs with undefined values
  if (!imageUrl) {
    return undefined;
  }
  
  console.log(`[Rust SCORM] resolveImageUrl called with:`, imageUrl)
  
  // If it's an external URL, try to download it
  if (isExternalUrl(imageUrl)) {
    console.log(`[Rust SCORM] Processing external image:`, imageUrl)
    try {
      const blob = await downloadIfExternal(imageUrl)
      if (blob) {
        // Convert to media file
        const arrayBuffer = await blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const mimeType = blob.type || 'image/jpeg'
        const ext = getExtensionFromMimeType(mimeType) || 'jpg'
        
        if (!mediaCounter.image) mediaCounter.image = 0
        mediaCounter.image++
        const filename = `image-${mediaCounter.image}.${ext}`
        
        mediaFiles.push({
          filename,
          content: uint8Array,
        })
        
        return `media/${filename}`
      }
    } catch (error) {
      console.error(`[Rust SCORM] Failed to download external image:`, error)
    }
    // If download fails, keep the original external URL
    return imageUrl
  }
  
  // If it's a media ID (like "image-abc123"), load it from MediaService
  if (imageUrl.match(/^(image|video|audio)-[\w-]+$/)) {
    console.log(`[Rust SCORM] Loading media from MediaService:`, imageUrl)
    
    // Check cache first
    const cached = mediaCache.get(imageUrl)
    if (cached) {
      console.log(`[Rust SCORM] Using cached media:`, imageUrl)
      
      // Check if this is a video metadata JSON file
      if (imageUrl.startsWith('video-') && (cached.mimeType === 'application/json' || cached.mimeType === 'text/plain')) {
        try {
          const jsonText = new TextDecoder().decode(cached.data)
          const metadata = JSON.parse(jsonText)
          if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
            console.log(`[Rust SCORM] Found YouTube URL in cached metadata:`, metadata.url)
            return metadata.url
          }
          if (metadata.embed_url && (metadata.embed_url.includes('youtube.com') || metadata.embed_url.includes('youtu.be'))) {
            console.log(`[Rust SCORM] Found YouTube embed URL in cached metadata:`, metadata.embed_url)
            return metadata.embed_url
          }
        } catch (error) {
          console.error(`[Rust SCORM] Failed to parse cached video metadata:`, error)
        }
      }
      
      // Use proper extension based on MIME type
      const ext = getExtensionFromMimeType(cached.mimeType) || 'bin'
      const filename = `${imageUrl}.${ext}`
      
      // Add to mediaFiles if not already there
      if (!mediaFiles.find(f => f.filename === filename)) {
        console.log(`[Rust SCORM] Adding cached image to mediaFiles:`, {
          imageUrl,
          filename,
          mimeType: cached.mimeType,
          dataSize: cached.data.length
        })
        
        mediaFiles.push({
          filename,
          content: cached.data,
        })
      }
      
      return `media/${filename}`
    }
    
    try {
      console.log(`[Rust SCORM] Attempting to load media from MediaService:`, imageUrl)
      const { createMediaService } = await import('./MediaService')
      const mediaService = createMediaService(projectId)
      const fileData = await mediaService.getMedia(imageUrl)
      
      console.log(`[Rust SCORM] MediaService returned:`, {
        hasFileData: !!fileData,
        hasData: !!(fileData?.data),
        dataLength: fileData?.data ? fileData.data.length : 0,
        metadata: fileData?.metadata
      })
      
      if (fileData && fileData.data) {
        const mimeType = fileData.metadata?.mimeType || fileData.metadata?.mime_type || ''
        const uint8Data = new Uint8Array(fileData.data)
        
        // Cache the data
        mediaCache.set(imageUrl, { data: uint8Data, mimeType })
        
        // Check if this is a video metadata JSON file
        if (imageUrl.startsWith('video-') && (mimeType === 'application/json' || mimeType === 'text/plain')) {
          try {
            // Parse the JSON to get the YouTube URL
            const jsonText = new TextDecoder().decode(fileData.data)
            const metadata = JSON.parse(jsonText)
            if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
              console.log(`[Rust SCORM] Found YouTube URL in metadata:`, metadata.url)
              return metadata.url // Return the YouTube URL directly
            }
            if (metadata.embed_url && (metadata.embed_url.includes('youtube.com') || metadata.embed_url.includes('youtu.be'))) {
              console.log(`[Rust SCORM] Found YouTube embed URL in metadata:`, metadata.embed_url)
              return metadata.embed_url // Return the YouTube embed URL directly
            }
          } catch (error) {
            console.error(`[Rust SCORM] Failed to parse video metadata:`, error)
          }
        }
        
        const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(imageUrl)
        
        // Use proper extension based on MIME type (especially important for SVG)
        const filename = `${imageUrl}.${ext}`
        
        console.log(`[Rust SCORM] Adding image to mediaFiles:`, {
          imageUrl,
          filename,
          mimeType,
          dataSize: uint8Data.length
        })
        
        mediaFiles.push({
          filename,
          content: uint8Data,
        })
        
        return `media/${filename}`
      } else {
        console.warn(`[Rust SCORM] MediaService returned no data for: ${imageUrl}, skipping`)
        return undefined
      }
    } catch (error) {
      console.warn(`[Rust SCORM] Failed to load media from MediaService for ${imageUrl}, skipping:`, error)
      return undefined
    }
  }
  
  // Otherwise, assume it's already a package-relative path
  console.log(`[Rust SCORM] Using URL as-is:`, imageUrl)
  return imageUrl
}

/**
 * Resolve media items and collect media files
 */
async function resolveMedia(
  mediaItems: any[] | undefined, 
  projectId: string,
  mediaFiles: MediaFile[],
  mediaCounter: { [type: string]: number }
): Promise<any[] | undefined> {
  if (!mediaItems || mediaItems.length === 0) return mediaItems
  
  const resolvedMedia = []
  
  for (const media of mediaItems) {
    if (!media.url) {
      // If no URL but we have an ID, try to load from MediaService
      if (media.id && media.id.match(/^(image|video|audio|caption)-[\w-]+$/)) {
        console.log(`[Rust SCORM] No URL provided, loading from MediaService using ID: ${media.id}`)
        
        try {
          // Check cache first
          const cached = mediaCache.get(media.id)
          if (cached) {
            console.log(`[Rust SCORM] Using cached media:`, media.id)
            const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(media.id)
            const filename = `${media.id}.${ext}`
            
            // Add to mediaFiles if not already there
            if (!mediaFiles.find(f => f.filename === filename)) {
              mediaFiles.push({
                filename,
                content: cached.data,
              })
            }
            
            resolvedMedia.push({
              ...media,
              url: `media/${filename}`,
              resolved_path: `media/${filename}`
            })
            continue
          }
          
          // Load from MediaService
          const { createMediaService } = await import('./MediaService')
          const mediaService = createMediaService(projectId)
          const fileData = await mediaService.getMedia(media.id)
          
          if (fileData && fileData.data) {
            const uint8Data = new Uint8Array(fileData.data)
            const mimeType = fileData.metadata?.mimeType || 'application/octet-stream'
            
            // Cache the data
            mediaCache.set(media.id, { data: uint8Data, mimeType })
            
            const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(media.id)
            const filename = `${media.id}.${ext}`
            
            mediaFiles.push({
              filename,
              content: uint8Data,
            })
            
            resolvedMedia.push({
              ...media,
              url: `media/${filename}`,
              resolved_path: `media/${filename}`
            })
            console.log(`[Rust SCORM] Successfully loaded media from MediaService: ${media.id}`)
            continue
          } else {
            console.warn(`[Rust SCORM] Media not found: ${media.id}, skipping`)
            // Don't add to resolvedMedia - skip this item
            continue
          }
        } catch (error) {
          console.warn(`[Rust SCORM] Failed to load media ${media.id}, skipping:`, error)
          // Don't add to resolvedMedia - skip this item
          continue
        }
      }
      
      // If we couldn't load it, push as-is
      resolvedMedia.push(media)
      continue
    }
    
    // Handle different types of media URLs
    let resolvedUrl: string | undefined = undefined
    
    // Check if URL is an asset.localhost URL that needs to be resolved
    if (media.url && media.url.includes('asset.localhost')) {
      // Extract the media ID from the URL
      // Format: http://asset.localhost/...%5Cmedia%5Cvideo-0.bin
      const match = media.url.match(/media%5C([\w-]+)\.bin/)
      if (match) {
        const mediaId = match[1]
        console.log(`[Rust SCORM] Detected asset.localhost URL for media ID:`, mediaId)
        
        // Try to load and check if it's YouTube metadata
        if (mediaId.startsWith('video-')) {
          // Check cache first
          const cached = mediaCache.get(mediaId)
          if (cached && cached.mimeType === 'application/json') {
            try {
              const jsonText = new TextDecoder().decode(cached.data)
              const metadata = JSON.parse(jsonText)
              if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
                console.log(`[Rust SCORM] Resolved asset.localhost to YouTube URL from cache:`, metadata.url)
                media.url = metadata.url
              }
            } catch (error) {
              console.error(`[Rust SCORM] Failed to parse cached asset.localhost metadata:`, error)
            }
          } else {
            try {
              const { createMediaService } = await import('./MediaService')
              const mediaService = createMediaService(projectId)
              const fileData = await mediaService.getMedia(mediaId)
              
              if (fileData && fileData.data && fileData.metadata?.mimeType === 'application/json') {
                const uint8Data = new Uint8Array(fileData.data)
                
                // Cache the data
                mediaCache.set(mediaId, { data: uint8Data, mimeType: 'application/json' })
                
                const jsonText = new TextDecoder().decode(uint8Data)
                const metadata = JSON.parse(jsonText)
                if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
                  console.log(`[Rust SCORM] Resolved asset.localhost to YouTube URL:`, metadata.url)
                  media.url = metadata.url
                }
              }
            } catch (error) {
              console.error(`[Rust SCORM] Failed to resolve asset.localhost URL:`, error)
            }
          }
        }
      }
    }
    
    // Check if it's a YouTube video - extract the video ID
    if (media.type === 'video' && media.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be'))) {
      let videoId = ''
      
      // Extract YouTube video ID
      if (media.url.includes('youtube.com/watch?v=')) {
        const match = media.url.match(/[?&]v=([^&]+)/)
        if (match) videoId = match[1]
      } else if (media.url.includes('youtu.be/')) {
        const match = media.url.match(/youtu\.be\/([^?]+)/)
        if (match) videoId = match[1]
      }
      
      resolvedMedia.push({
        ...media,
        url: media.url,
        is_youtube: true,
        youtube_id: videoId,
        embed_url: `https://www.youtube.com/embed/${videoId}`
      })
      continue
    }
    // If it's an external URL (non-YouTube), download it
    else if (isExternalUrl(media.url)) {
      try {
        console.log(`[Rust SCORM] Downloading external media: ${media.url}`)
        const blob = await downloadIfExternal(media.url)
        
        if (blob) {
          const arrayBuffer = await blob.arrayBuffer()
          const uint8Array = new Uint8Array(arrayBuffer)
          const mimeType = blob.type || 'image/jpeg'
          const ext = getExtensionFromMimeType(mimeType) || 'jpg'
          
          const type = media.type || 'image'
          if (!mediaCounter[type]) mediaCounter[type] = 0
          mediaCounter[type]++
          const filename = `${type}-${mediaCounter[type]}.${ext}`
          
          mediaFiles.push({
            filename,
            content: uint8Array,
          })
          
          resolvedUrl = `media/${filename}`
        }
      } catch (error) {
        console.error(`[Rust SCORM] Error downloading external media:`, error)
      }
    }
    // If it's a media ID, load from MediaService
    else if (media.url.match(/^(image|video|audio)-[\w-]+$/)) {
      // Check cache first
      const cached = mediaCache.get(media.url)
      if (cached) {
        console.log(`[Rust SCORM] Using cached media in resolveMedia:`, media.url)
        
        // Check if this is a video metadata JSON file
        if (media.type === 'video' && cached.mimeType === 'application/json') {
          try {
            const jsonText = new TextDecoder().decode(cached.data)
            const metadata = JSON.parse(jsonText)
            if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
              console.log(`[Rust SCORM] Found YouTube URL in cached video metadata:`, metadata.url)
              resolvedUrl = metadata.url
            }
          } catch (error) {
            console.error(`[Rust SCORM] Failed to parse cached video metadata:`, error)
          }
        }
        
        // If not YouTube metadata, process as regular file
        if (!resolvedUrl) {
          const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(media.url)
          const filename = `${media.url}.${ext}`
          
          // Add to mediaFiles if not already there
          if (!mediaFiles.find(f => f.filename === filename)) {
            mediaFiles.push({
              filename,
              content: cached.data,
            })
          }
          
          resolvedUrl = `media/${filename}`
        }
      } else {
        try {
          const { createMediaService } = await import('./MediaService')
          const mediaService = createMediaService(projectId)
          const fileData = await mediaService.getMedia(media.url)
          
          if (fileData && fileData.data) {
            const mimeType = fileData.metadata?.mimeType || ''
            const uint8Data = new Uint8Array(fileData.data)
            
            // Cache the data
            mediaCache.set(media.url, { data: uint8Data, mimeType })
            
            // Check if this is a video metadata JSON file
            if (media.type === 'video' && mimeType === 'application/json') {
              try {
                const jsonText = new TextDecoder().decode(uint8Data)
                const metadata = JSON.parse(jsonText)
                if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
                  console.log(`[Rust SCORM] Found YouTube URL in video metadata:`, metadata.url)
                  resolvedUrl = metadata.url
                }
              } catch (error) {
                console.error(`[Rust SCORM] Failed to parse video metadata:`, error)
              }
            }
            
            // If not YouTube metadata, process as regular file
            if (!resolvedUrl) {
              const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(media.url)
              const filename = `${media.url}.${ext}`
              
              mediaFiles.push({
                filename,
                content: uint8Data,
              })
              
              resolvedUrl = `media/${filename}`
            } else {
              console.warn(`[Rust SCORM] MediaService returned no data for: ${media.url}, skipping`)
              resolvedUrl = undefined
            }
          }
        } catch (error) {
          console.warn(`[Rust SCORM] Error loading media from MediaService for ${media.url}, skipping:`, error)
          resolvedUrl = undefined
        }
      }
    }
    // If it has a storageId, use that instead
    else if ((media as any).storageId) {
      const storageId = (media as any).storageId
      
      // Check cache first
      const cached = mediaCache.get(storageId)
      if (cached) {
        console.log(`[Rust SCORM] Using cached media for storageId:`, storageId)
        const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(storageId)
        const filename = `${storageId}.${ext}`
        
        // Add to mediaFiles if not already there
        if (!mediaFiles.find(f => f.filename === filename)) {
          mediaFiles.push({
            filename,
            content: cached.data,
          })
        }
        
        resolvedUrl = `media/${filename}`
      } else {
        try {
          const { createMediaService } = await import('./MediaService')
          const mediaService = createMediaService(projectId)
          const fileData = await mediaService.getMedia(storageId)
          
          if (fileData && fileData.data) {
            const mimeType = fileData.metadata?.mimeType || ''
            const uint8Data = new Uint8Array(fileData.data)
            
            // Cache the data
            mediaCache.set(storageId, { data: uint8Data, mimeType })
            
            const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(storageId)
            const filename = `${storageId}.${ext}`
            
            mediaFiles.push({
              filename,
              content: uint8Data,
            })
            
            resolvedUrl = `media/${filename}`
          } else {
            console.warn(`[Rust SCORM] MediaService returned no data for storageId: ${storageId}, skipping`)
            resolvedUrl = undefined
          }
        } catch (error) {
          console.warn(`[Rust SCORM] Error loading media with storageId ${storageId}, skipping:`, error)
          resolvedUrl = undefined
        }
      }
    }
    // Handle blob URLs by immediately falling back to MediaService
    else if (media.url && media.url.startsWith('blob:')) {
      // Skip blob URL fetch attempt - logs show they consistently fail with ERR_FILE_NOT_FOUND
      // Go directly to MediaService using media.id if available
      if (media.id && media.id.match(/^(image|video|audio)-[\w-]+$/)) {
        console.log(`[Rust SCORM] Skipping blob URL, loading directly from MediaService: ${media.id}`)
        
        // Check cache first
        const cached = mediaCache.get(media.id)
        if (cached) {
          console.log(`[Rust SCORM] Using cached media for blob URL fallback:`, media.id)
          const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(media.id)
          const filename = `${media.id}.${ext}`
          
          // Add to mediaFiles if not already there
          if (!mediaFiles.find(f => f.filename === filename)) {
            mediaFiles.push({
              filename,
              content: cached.data,
            })
          }
          
          resolvedUrl = `media/${filename}`
        } else {
          try {
            const { createMediaService } = await import('./MediaService')
            const mediaService = createMediaService(projectId)
            const fileData = await mediaService.getMedia(media.id)
            
            if (fileData && fileData.data) {
              const mimeType = fileData.metadata?.mimeType || ''
              const uint8Data = new Uint8Array(fileData.data)
              
              // Cache the data
              mediaCache.set(media.id, { data: uint8Data, mimeType })
              
              const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(media.id)
              const filename = `${media.id}.${ext}`
              
              mediaFiles.push({
                filename,
                content: uint8Data,
              })
              
              resolvedUrl = `media/${filename}`
              console.log(`[Rust SCORM] Successfully recovered media from MediaService: ${media.id}`)
            } else {
              console.warn(`[Rust SCORM] MediaService returned no data for blob URL fallback: ${media.id}, skipping`)
              resolvedUrl = undefined
            }
          } catch (msError) {
            console.warn(`[Rust SCORM] MediaService fallback also failed for ${media.id}, skipping:`, msError)
            // Skip this media item rather than using broken blob URL
            resolvedUrl = undefined
          }
        }
      } else {
        // Skip this media item if we can't recover it
        resolvedUrl = undefined
      }
    }
    // Otherwise, assume it's already a package-relative path
    else {
      resolvedUrl = media.url
    }
    
    // Check if this is a YouTube video
    if (media.type === 'video' && media.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be'))) {
      let videoId = ''
      
      // Extract YouTube video ID
      if (media.url.includes('youtube.com/watch?v=')) {
        const match = media.url.match(/[?&]v=([^&]+)/)
        if (match) videoId = match[1]
      } else if (media.url.includes('youtu.be/')) {
        const match = media.url.match(/youtu\.be\/([^?]+)/)
        if (match) videoId = match[1]
      } else if (media.url.includes('youtube.com/embed/')) {
        const match = media.url.match(/embed\/([^?]+)/)
        if (match) videoId = match[1]
      }
      
      resolvedMedia.push({
        ...media,
        url: media.url, // Keep original URL
        is_youtube: true,
        youtube_id: videoId,
        embed_url: videoId ? `https://www.youtube.com/embed/${videoId}` : ''
      })
    } else if (resolvedUrl) {
      // For non-YouTube media, only add if we have a valid resolved URL
      resolvedMedia.push({ ...media, url: resolvedUrl })
    }
    // If resolvedUrl is undefined, skip this media item entirely
  }
  
  // Filter out media items with empty URLs
  const filteredMedia = resolvedMedia.filter(item => item.url && item.url.trim() !== '')
  
  // Return undefined if no valid media items remain (so the template's {{or}} helper works correctly)
  return filteredMedia.length > 0 ? filteredMedia : undefined
}

/**
 * Convert TypeScript course content to Rust-compatible format
 */
export async function convertToRustFormat(courseContent: CourseContent | EnhancedCourseContent, projectId: string) {
  // Validate required fields
  if (!courseContent) {
    throw new Error('Course content is required')
  }
  
  // Check if this is enhanced format
  const isEnhanced = 'objectives' in courseContent && Array.isArray(courseContent.objectives)
  
  if (isEnhanced) {
    return convertEnhancedToRustFormat(courseContent as EnhancedCourseContent, projectId)
  }
  
  const cc = courseContent as any
  
  // Media resolution tracking
  const mediaFiles: MediaFile[] = []
  const mediaCounter: { [type: string]: number } = {}
  
  const result = {
    course_title: cc.courseTitle || cc.title || cc.courseName || 'Untitled Course',
    course_description: cc.courseDescription || cc.description,
    pass_mark: cc.passMark || 80,
    navigation_mode: cc.navigationMode || 'linear',
    allow_retake: cc.allowRetake !== false,
    
    welcome_page: cc.welcome || cc.welcomePage || cc.welcomeMedia ? {
      title: cc.welcome?.title || cc.welcomePage?.title || 'Welcome',
      content: cc.welcome?.content || cc.welcomePage?.content || '',
      start_button_text: cc.welcome?.startButtonText || cc.welcomePage?.startButtonText || 'Start Course',
      audio_file: await resolveAudioCaptionFile(cc.welcome?.audioId || cc.welcome?.audioFile || cc.welcomePage?.audioId || cc.welcomePage?.audioFile, projectId, mediaFiles),
      caption_file: await resolveAudioCaptionFile(cc.welcome?.captionId || cc.welcome?.captionFile || cc.welcomePage?.captionId || cc.welcomePage?.captionFile, projectId, mediaFiles),
      image_url: await resolveImageUrl(cc.welcome?.imageUrl || cc.welcomePage?.imageUrl, projectId, mediaFiles, mediaCounter),
      // Filter out images since they're handled by image_url
      media: await resolveMedia(
        Array.isArray(cc.welcome?.media) ? cc.welcome.media.filter((m: any) => m.type !== 'image') :
        Array.isArray(cc.welcomePage?.media) ? cc.welcomePage.media.filter((m: any) => m.type !== 'image') :
        cc.welcome?.media && cc.welcome.media.type !== 'image' ? [cc.welcome.media] :
        cc.welcomePage?.media && cc.welcomePage.media.type !== 'image' ? [cc.welcomePage.media] :
        cc.welcomeMedia && cc.welcomeMedia.type !== 'image' ? [cc.welcomeMedia] : undefined, 
        projectId, 
        mediaFiles, 
        mediaCounter
      ),
    } : undefined,
    
    learning_objectives_page: cc.learningObjectivesPage ? {
      // For CourseContent format, extract objectives from content; for other formats, use objectives property
      objectives: cc.learningObjectivesPage.objectives || 
                  (cc.learningObjectivesPage.content ? extractObjectivesFromContent(cc.learningObjectivesPage.content) : []),
      audio_file: await resolveAudioCaptionFile(cc.learningObjectivesPage.audioFile, projectId, mediaFiles),
      caption_file: await resolveAudioCaptionFile(cc.learningObjectivesPage.captionFile, projectId, mediaFiles),
      // Extract image from media array to set as image_url (same as topics)
      image_url: await resolveImageUrl(
        cc.learningObjectivesPage.media?.find((m: any) => m.type === 'image')?.url || 
        cc.learningObjectivesPage.media?.find((m: any) => m.type === 'image')?.id,
        projectId, 
        mediaFiles, 
        mediaCounter
      ),
      // Filter out images from media array since they're handled by image_url
      media: await resolveMedia(
        Array.isArray(cc.learningObjectivesPage.media) ? 
          cc.learningObjectivesPage.media.filter((m: any) => m.type !== 'image') :
          cc.learningObjectivesPage.media && cc.learningObjectivesPage.media.type !== 'image' ? 
            [cc.learningObjectivesPage.media] : 
            undefined,
        projectId, 
        mediaFiles, 
        mediaCounter
      ),
    } : undefined,
    
    topics: await Promise.all(cc.topics.map(async (topic: any) => {
      // Handle both knowledgeCheck (singular) and knowledgeChecks (plural array)
      const kcData = topic.knowledgeCheck || (topic.knowledgeChecks && topic.knowledgeChecks.length > 0 ? { questions: topic.knowledgeChecks } : null)
      
      return {
        id: topic.id,
        title: topic.title,
        content: topic.content || '',
        knowledge_check: kcData ? {
          enabled: kcData.enabled !== false,
          questions: (kcData.questions || (kcData.question ? [{
            type: kcData.type || kcData.questionType,
            question: kcData.question,
            options: kcData.options,
            correctAnswer: kcData.correctAnswer,
            feedback: kcData.feedback,
            explanation: kcData.explanation
        }] : []))?.map((q: any) => {
          // Validate question has required fields
          if (!q.type && !q.questionType) {
            console.error(`[Rust SCORM] Question missing type in topic ${topic.id}:`, q)
            throw new Error(`Question missing type in topic ${topic.id}`)
          }
          if (!q.question && !q.text) {
            console.error(`[Rust SCORM] Question missing text/question field in topic ${topic.id}:`, q)
            throw new Error(`Question missing text field in topic ${topic.id}`)
          }
          if (q.correctAnswer === undefined || q.correctAnswer === null) {
            console.error(`[Rust SCORM] Question missing correctAnswer in topic ${topic.id}:`, q)
            throw new Error(`Question missing correctAnswer in topic ${topic.id}`)
          }
          
          // For true-false questions, ensure options array exists
          const questionType = q.type || q.questionType
          let options = q.options
          
          if (questionType === 'true-false' && !options) {
            options = ['True', 'False']
          }
          
          return {
            type: questionType,
            text: q.question || q.text, // Fixed: Support both 'question' and 'text' fields
            options: options,
            correct_answer: questionType === 'true-false' ? 
              (q.correctAnswer === 0 || q.correctAnswer === 'true' || q.correctAnswer === true ? 'true' : 'false') :
              (typeof q.correctAnswer === 'number' && options ? options[q.correctAnswer] : String(q.correctAnswer)),
            explanation: q.explanation || q.feedback?.incorrect || q.feedback?.correct || '',
            correct_feedback: q.feedback?.correct || 'Correct!',
            incorrect_feedback: q.feedback?.incorrect || 'Not quite. Try again!',
          }
        }) || []
      } : undefined,
        audio_file: await resolveAudioCaptionFile((topic as any).audioFile || (topic as any).audioId, projectId, mediaFiles),
        caption_file: await resolveAudioCaptionFile((topic as any).captionFile || (topic as any).captionId, projectId, mediaFiles),
        // Extract image from media array or use imageUrl field
        image_url: await resolveImageUrl(
          (topic as any).imageUrl || 
          (topic as any).media?.find((m: any) => m.type === 'image')?.url ||
          (topic as any).media?.find((m: any) => m.type === 'image')?.id,
          projectId, 
          mediaFiles, 
          mediaCounter
        ),
        // Filter out images since they're handled by image_url
        media: await resolveMedia(
          Array.isArray((topic as any).media) ? (topic as any).media.filter((m: any) => m.type !== 'image').map((m: any) => ({
            id: m.id,
            type: m.type,
            url: m.url || '',
            title: m.title || '',
          })) : (topic as any).media && (topic as any).media.type !== 'image' ? [{
            id: (topic as any).media.id,
            type: (topic as any).media.type,
            url: (topic as any).media.url || '',
            title: (topic as any).media.title || '',
          }] : undefined, 
          projectId, 
          mediaFiles, 
          mediaCounter
        )
      }
    })),
    
    assessment: cc.assessment ? {
      questions: cc.assessment.questions.map((q: any) => {
        // Validate assessment question has required fields
        const qAny = q as any
        if (!qAny.type && !qAny.options) {
          console.error('[Rust SCORM] Assessment question missing type:', q)
          throw new Error('Assessment question missing type')
        }
        if (!qAny.question && !qAny.text) {
          console.error('[Rust SCORM] Assessment question missing text/question field:', q)
          throw new Error('Assessment question missing text field')
        }
        if (qAny.correctAnswer === undefined || qAny.correctAnswer === null) {
          console.error('[Rust SCORM] Assessment question missing correctAnswer:', q)
          throw new Error('Assessment question missing correctAnswer')
        }
        
        // Handle different feedback formats
        let explanation = ''
        let correct_feedback = ''
        let incorrect_feedback = ''
        
        if (typeof qAny.feedback === 'string') {
          // String format: use as explanation
          explanation = qAny.feedback
        } else if (qAny.feedback && typeof qAny.feedback === 'object') {
          // Object format: {correct: '...', incorrect: '...'}
          correct_feedback = qAny.feedback.correct || ''
          incorrect_feedback = qAny.feedback.incorrect || ''
          explanation = qAny.feedback.incorrect || qAny.feedback.correct || ''
        }
        
        // Direct fields override feedback object
        if (qAny.correctFeedback) {
          correct_feedback = qAny.correctFeedback
        }
        if (qAny.incorrectFeedback) {
          incorrect_feedback = qAny.incorrectFeedback
        }
        if (qAny.explanation) {
          explanation = qAny.explanation
        }
        
        return {
          type: qAny.type || 'multiple-choice', // Default to multiple-choice for assessment
          text: qAny.question || qAny.text, // Fixed: Support both 'question' and 'text' fields
          options: qAny.options,
          correct_answer: qAny.correctAnswer,
          explanation,
          correct_feedback,
          incorrect_feedback
        }
      })
    } : undefined,
  }
  
  return { courseData: result, mediaFiles }
}

/**
 * Convert enhanced format to Rust-compatible format
 */
async function convertEnhancedToRustFormat(courseContent: EnhancedCourseContent, projectId: string) {
  console.log('[Rust SCORM] Converting enhanced format, topics:', courseContent.topics.length)
  
  // Debug: Log audio IDs being extracted
  console.log('[Rust SCORM] Welcome audio:', 
    (courseContent.welcome as any)?.audioId || 
    courseContent.welcome?.audioFile || 
    courseContent.welcome?.media?.find((m: any) => m.type === 'audio')?.id
  )
  console.log('[Rust SCORM] Objectives audio:', 
    (courseContent.objectivesPage as any)?.audioId || 
    courseContent.objectivesPage?.audioFile || 
    courseContent.objectivesPage?.media?.find((m: any) => m.type === 'audio')?.id
  )
  courseContent.topics.forEach((topic, i) => {
    console.log(`[Rust SCORM] Topic ${i+1} (${topic.id}) audio:`, 
      (topic as any).audioId || 
      topic.audioFile || 
      topic.media?.find((m: any) => m.type === 'audio')?.id
    )
  })
  
  // Check if we have knowledge checks
  const topicsWithKC = courseContent.topics.filter(t => t.knowledgeCheck).length
  console.log('[Rust SCORM] Topics with knowledge checks:', topicsWithKC)
  
  // Media resolution tracking
  const mediaFiles: MediaFile[] = []
  const mediaCounter: { [type: string]: number } = {}
  
  const result = {
    course_title: courseContent.title || 'Untitled Course',
    course_description: undefined, // Enhanced format doesn't have description
    pass_mark: courseContent.passMark || 80,
    navigation_mode: courseContent.navigationMode || 'linear',
    allow_retake: courseContent.allowRetake !== false,
    
    welcome_page: courseContent.welcome ? {
      title: courseContent.welcome.title || 'Welcome',
      content: courseContent.welcome.content || '',
      start_button_text: courseContent.welcome.startButtonText || 'Start Course',
      audio_file: await resolveAudioCaptionFile(
        (courseContent.welcome as any).audioId || 
        courseContent.welcome.audioFile || 
        courseContent.welcome.media?.find((m: any) => m.type === 'audio')?.id, 
        projectId, 
        mediaFiles, 
        (courseContent.welcome as any).audioBlob
      ),
      caption_file: await resolveAudioCaptionFile(
        (courseContent.welcome as any).captionId || 
        courseContent.welcome.captionFile || 
        courseContent.welcome.media?.find((m: any) => m.type === 'caption')?.id, 
        projectId, 
        mediaFiles, 
        (courseContent.welcome as any).captionBlob
      ),
      image_url: await resolveImageUrl(courseContent.welcome.imageUrl, projectId, mediaFiles, mediaCounter),
      // Filter out audio/caption from media array since they're handled separately
      media: await resolveMedia(courseContent.welcome.media?.filter((m: any) => m.type !== 'audio' && m.type !== 'caption'), projectId, mediaFiles, mediaCounter),
    } : undefined,
    
    learning_objectives_page: courseContent.objectives ? {
      objectives: courseContent.objectives,
      audio_file: await resolveAudioCaptionFile(
        (courseContent.objectivesPage as any)?.audioId || 
        courseContent.objectivesPage?.audioFile || 
        courseContent.objectivesPage?.media?.find((m: any) => m.type === 'audio')?.id ||
        // Fallback to learningObjectivesPage for backward compatibility
        (courseContent as any).learningObjectivesPage?.audioFile ||
        (courseContent as any).learningObjectivesPage?.media?.find((m: any) => m.type === 'audio')?.id, 
        projectId, 
        mediaFiles, 
        (courseContent.objectivesPage as any)?.audioBlob || (courseContent as any).learningObjectivesPage?.audioBlob
      ),
      caption_file: await resolveAudioCaptionFile(
        (courseContent.objectivesPage as any)?.captionId || 
        courseContent.objectivesPage?.captionFile || 
        courseContent.objectivesPage?.media?.find((m: any) => m.type === 'caption')?.id ||
        // Fallback to learningObjectivesPage for backward compatibility
        (courseContent as any).learningObjectivesPage?.captionFile ||
        (courseContent as any).learningObjectivesPage?.media?.find((m: any) => m.type === 'caption')?.id, 
        projectId, 
        mediaFiles, 
        (courseContent.objectivesPage as any)?.captionBlob || (courseContent as any).learningObjectivesPage?.captionBlob
      ),
      image_url: await resolveImageUrl(
        courseContent.objectivesPage?.imageUrl || (courseContent as any).learningObjectivesPage?.imageUrl, 
        projectId, 
        mediaFiles, 
        mediaCounter
      ),
      // Filter out audio/caption from media array since they're handled separately
      // Support both objectivesPage and learningObjectivesPage for backward compatibility
      media: await resolveMedia(
        (courseContent.objectivesPage?.media || (courseContent as any).learningObjectivesPage?.media)?.filter((m: any) => m.type !== 'audio' && m.type !== 'caption'), 
        projectId, 
        mediaFiles, 
        mediaCounter
      ),
    } : undefined,
    
    topics: await Promise.all(courseContent.topics.map(async topic => {
      console.log(`[Rust SCORM] Processing topic ${topic.id}, has KC:`, !!topic.knowledgeCheck)
      
      const convertedTopic = {
        id: topic.id,
        title: topic.title,
        content: topic.content || '',
        knowledge_check: undefined as any,
        audio_file: await resolveAudioCaptionFile(
          (topic as any).audioId || 
          topic.audioFile || 
          topic.media?.find((m: any) => m.type === 'audio')?.id, 
          projectId, 
          mediaFiles, 
          (topic as any).audioBlob
        ),
        caption_file: await resolveAudioCaptionFile(
          (topic as any).captionId || 
          topic.captionFile || 
          topic.media?.find((m: any) => m.type === 'caption')?.id, 
          projectId, 
          mediaFiles, 
          (topic as any).captionBlob
        ),
        image_url: await resolveImageUrl(topic.imageUrl, projectId, mediaFiles, mediaCounter),
        // Filter out audio/caption from media array since they're handled separately
        media: await resolveMedia(topic.media?.filter((m: any) => m.type !== 'audio' && m.type !== 'caption').map(m => ({
          id: m.id,
          type: m.type,
          url: m.url || '',
          title: m.title || '',
        })), projectId, mediaFiles, mediaCounter)
      }
      
      // Debug log to see audio/caption files
      console.log(`[Rust SCORM] Topic ${topic.id} resolved audio_file:`, convertedTopic.audio_file)
      console.log(`[Rust SCORM] Topic ${topic.id} resolved caption_file:`, convertedTopic.caption_file)
      console.log(`[Rust SCORM] Topic ${topic.id} original media:`, topic.media)
      console.log(`[Rust SCORM] Topic ${topic.id} filtered media:`, convertedTopic.media)
      
      // Handle single knowledge check question (not array)
      if (topic.knowledgeCheck && !topic.knowledgeCheck.questions) {
        console.log(`[Rust SCORM] Topic ${topic.id} has single KC question`)
        const kc = topic.knowledgeCheck as any
        
        // Debug logging for fill-in-blank
        if (kc.type === 'fill-in-the-blank') {
          console.log(`[Rust SCORM] Fill-in-blank question data:`, {
            type: kc.type,
            question: kc.question,
            text: kc.text,
            blank: kc.blank,
            correctAnswer: kc.correctAnswer,
            correctFeedback: kc.correctFeedback,
            incorrectFeedback: kc.incorrectFeedback,
            feedback: kc.feedback
          })
        }
        
        // Handle true-false questions specially
        if (kc.type === 'true-false') {
          convertedTopic.knowledge_check = {
            enabled: true,
            questions: [{
              type: kc.type,
              text: kc.question || kc.text || 'True or False?',
              options: ['True', 'False'],
              correct_answer: (kc.correctAnswer === 0 || kc.correctAnswer === 'true' || kc.correctAnswer === true ? 'true' : 'false'),
              explanation: kc.explanation || (kc.feedback && kc.feedback.incorrect) || (kc.feedback && kc.feedback.correct) || '',
            correct_feedback: kc.correctFeedback || (kc.feedback && kc.feedback.correct) || 'Correct!',
            incorrect_feedback: kc.incorrectFeedback || (kc.feedback && kc.feedback.incorrect) || 'Not quite. Try again!',
            }]
          }
        } else {
          convertedTopic.knowledge_check = {
            enabled: true,
            questions: [{
              type: kc.type || 'multiple-choice',
              text: (() => {
                // Use the appropriate property based on question type
                if (kc.type === 'fill-in-the-blank') {
                  // For fill-in-the-blank, use blank property
                  return kc.blank || kc.question || kc.text || 'The answer is _____';
                } else {
                  // For other types, use question property
                  return kc.question || kc.text || 'Question text missing';
                }
              })(),
              options: kc.options,
              correct_answer: (() => {
                // Handle multiple choice questions with options
                if (kc.options && kc.options.length > 0) {
                  // If correctAnswer is a number, use it as an index
                  if (typeof kc.correctAnswer === 'number') {
                    return kc.options[kc.correctAnswer] || kc.options[0]
                  }
                  // If correctAnswer is a string that's a number, parse and use as index
                  if (typeof kc.correctAnswer === 'string' && !isNaN(parseInt(kc.correctAnswer))) {
                    const index = parseInt(kc.correctAnswer)
                    if (index >= 0 && index < kc.options.length) {
                      return kc.options[index]
                    }
                  }
                  // If correctAnswer is already the actual answer text
                  if (typeof kc.correctAnswer === 'string' && kc.options.includes(kc.correctAnswer)) {
                    return kc.correctAnswer
                  }
                  // Fallback to first option
                  return kc.options[0]
                }
                // For non-multiple choice, return as string
                return String(kc.correctAnswer || '')
              })(),
              explanation: kc.explanation || (kc.feedback && kc.feedback.incorrect) || (kc.feedback && kc.feedback.correct) || '',
            correct_feedback: kc.correctFeedback || (kc.feedback && kc.feedback.correct) || 'Correct!',
            incorrect_feedback: kc.incorrectFeedback || (kc.feedback && kc.feedback.incorrect) || 'Not quite. Try again!',
            }]
          }
        }
      } else if (topic.knowledgeCheck?.questions) {
        console.log(`[Rust SCORM] Topic ${topic.id} has ${topic.knowledgeCheck.questions.length} KC questions`)
        convertedTopic.knowledge_check = {
          enabled: true,
          questions: topic.knowledgeCheck.questions.map(q => {
            // Validate question has required fields
            if (!q.type && !(q as any).questionType) {
              console.error(`[Rust SCORM] Enhanced question missing type in topic ${topic.id}:`, q)
              throw new Error(`Question missing type in topic ${topic.id}`)
            }
            if (!q.question && !(q as any).text && !(q as any).blank) {
              console.error(`[Rust SCORM] Enhanced question missing question/text/blank field in topic ${topic.id}:`, q)
              throw new Error(`Question missing question/text/blank field in topic ${topic.id}`)
            }
            if (q.correctAnswer === undefined || q.correctAnswer === null) {
              console.error(`[Rust SCORM] Enhanced question missing correctAnswer in topic ${topic.id}:`, q)
              throw new Error(`Question missing correctAnswer in topic ${topic.id}`)
            }
            
            // Debug logging for fill-in-the-blank questions
            if (q.type === 'fill-in-the-blank') {
              console.log(`[Rust SCORM] Fill-in-blank question in array:`, {
                type: q.type,
                question: q.question,
                text: (q as any).text,
                blank: (q as any).blank,
                correctAnswer: q.correctAnswer,
                feedback: (q as any).feedback,
                correctFeedback: (q as any).correctFeedback,
                incorrectFeedback: (q as any).incorrectFeedback,
                hasFeedback: !!(q as any).feedback,
                hasFeedbackCorrect: !!((q as any).feedback && (q as any).feedback.correct),
                hasFeedbackIncorrect: !!((q as any).feedback && (q as any).feedback.incorrect),
                feedbackCorrectValue: (q as any).feedback?.correct,
                feedbackIncorrectValue: (q as any).feedback?.incorrect
              })
            }
            
            const result = {
              type: q.type || (q as any).questionType,
              text: (() => {
                // Use the appropriate property based on question type
                if (q.type === 'fill-in-the-blank') {
                  return (q as any).blank || q.question || (q as any).text || 'The answer is _____';
                } else {
                  return q.question || (q as any).text || 'Question text missing';
                }
              })(),
              options: q.options,
              correct_answer: (() => {
                // Handle multiple choice questions with options
                if (q.options && q.options.length > 0) {
                  // If correctAnswer is a number, use it as an index
                  if (typeof q.correctAnswer === 'number') {
                    return q.options[q.correctAnswer] || q.options[0]
                  }
                  // If correctAnswer is a string that's a number, parse and use as index
                  if (typeof q.correctAnswer === 'string' && !isNaN(parseInt(q.correctAnswer))) {
                    const index = parseInt(q.correctAnswer)
                    if (index >= 0 && index < q.options.length) {
                      return q.options[index]
                    }
                  }
                  // If correctAnswer is already the actual answer text
                  if (typeof q.correctAnswer === 'string' && q.options.includes(q.correctAnswer)) {
                    return q.correctAnswer
                  }
                  // Fallback to first option
                  return q.options[0]
                }
                // For non-multiple choice, return as string
                return String(q.correctAnswer || '')
              })(),
              explanation: q.explanation || ((q as any).feedback && (q as any).feedback.incorrect) || ((q as any).feedback && (q as any).feedback.correct) || '',
              correct_feedback: (q as any).correctFeedback || ((q as any).feedback && (q as any).feedback.correct) || 'Correct!',
              incorrect_feedback: (q as any).incorrectFeedback || ((q as any).feedback && (q as any).feedback.incorrect) || 'Not quite. Try again!',
            }
            
            if (q.type === 'fill-in-the-blank') {
              console.log(`[Rust SCORM] Returning question object:`, {
                type: result.type,
                correct_feedback: result.correct_feedback,
                incorrect_feedback: result.incorrect_feedback,
                explanation: result.explanation
              })
            }
            
            return result
          })
        }
      }
      
      return convertedTopic
    })),
    
    assessment: courseContent.assessment ? {
      questions: courseContent.assessment.questions.map(q => {
        // Validate assessment question has required fields
        if (!q.question) {
          console.error('[Rust SCORM] Enhanced assessment question missing question field:', q)
          throw new Error('Assessment question missing question field')
        }
        if (!q.options) {
          console.error('[Rust SCORM] Enhanced assessment question missing options:', q)
          throw new Error('Assessment question missing options')
        }
        if (q.correctAnswer === undefined || q.correctAnswer === null) {
          console.error('[Rust SCORM] Enhanced assessment question missing correctAnswer:', q)
          throw new Error('Assessment question missing correctAnswer')
        }
        
        return {
          type: 'multiple-choice', // Enhanced assessment is always multiple choice
          text: q.question, // Enhanced format uses 'question'
          options: q.options,
          correct_answer: q.options[q.correctAnswer] || String(q.correctAnswer),
          explanation: '', // Enhanced format doesn't have explanations for assessment
          correct_feedback: (q as any).correct_feedback || (q as any).correctFeedback || 'Correct!',
          incorrect_feedback: (q as any).incorrect_feedback || (q as any).incorrectFeedback || 'Not quite. Try again!',
        }
      })
    } : undefined,
  }
  
  return { courseData: result, mediaFiles }
}

/**
 * Generate SCORM package using Rust backend with templates
 */
export async function generateRustSCORM(
  courseContent: CourseContent | EnhancedCourseContent,
  projectId: string,
  onProgress?: (message: string, progress: number) => void,
  preloadedMedia?: Map<string, Blob>
): Promise<Uint8Array> {
  // Pre-load media cache if provided
  if (preloadedMedia && preloadedMedia.size > 0) {
    await preloadMediaCache(preloadedMedia)
  }
  
  // Lock all blob URLs during SCORM generation to prevent cleanup
  const { blobUrlManager } = await import('../utils/blobUrlManager')
  blobUrlManager.lockAll()
  
  // Set up progress event listener
  let unlisten: (() => void) | undefined
  if (onProgress && typeof onProgress === 'function') {
    listen<{ message: string; progress: number }>('scorm-generation-progress', (event) => {
      console.log('[Rust SCORM] Progress event:', event.payload)
      onProgress(event.payload.message, event.payload.progress)
    }).then(unlistenFn => {
      unlisten = unlistenFn
    })
  }
  
  // Declare mediaFiles outside try block so it's accessible in catch block
  let mediaFiles: MediaFile[] = []
  
  try {
    console.log('[Rust SCORM] Converting course content to Rust format')
    if (onProgress && typeof onProgress === 'function') {
      onProgress('Converting course content...', 10)
    }
    const { courseData: rustCourseData, mediaFiles: convertedMediaFiles } = await convertToRustFormat(courseContent, projectId)
    mediaFiles = convertedMediaFiles
    
    // Debug: Log the converted data to see what's being sent
    console.log('[Rust SCORM] Converted data:', JSON.stringify(rustCourseData, null, 2))
    console.log('[Rust SCORM] Media files count:', mediaFiles.length)
    
    // Debug: Check welcome and objectives pages media
    if (rustCourseData.welcome_page) {
      console.log('[Rust SCORM] Welcome page media:', {
        image_url: rustCourseData.welcome_page.image_url,
        media: rustCourseData.welcome_page.media,
        hasMedia: !!rustCourseData.welcome_page.media,
        mediaLength: rustCourseData.welcome_page.media?.length
      })
    }
    if (rustCourseData.learning_objectives_page) {
      console.log('[Rust SCORM] Objectives page media:', {
        image_url: (rustCourseData.learning_objectives_page as any).image_url,
        media: rustCourseData.learning_objectives_page.media,
        hasMedia: !!rustCourseData.learning_objectives_page.media,
        mediaLength: rustCourseData.learning_objectives_page.media?.length
      })
    }
    
    // Check if any questions are missing the text field
    if (rustCourseData.topics) {
      rustCourseData.topics.forEach((topic: any, i: number) => {
        if (topic.knowledge_check?.questions) {
          topic.knowledge_check.questions.forEach((q: any, j: number) => {
            if (!q.text) {
              console.error(`[Rust SCORM] Topic ${i} question ${j} missing 'text' field:`, q)
            }
          })
        }
      })
    }
    
    console.log('[Rust SCORM] Invoking Rust generator')
    console.log('[Rust SCORM] Sample topic data being sent:', JSON.stringify(rustCourseData.topics[0], null, 2))
    
    if (onProgress && typeof onProgress === 'function') {
      onProgress('Processing media files...', 30)
    }
    
    // Calculate dynamic timeout based on media files
    const baseTimeout = 120000 // 2 minutes base
    const perFileTimeout = 4000 // 4 seconds per media file
    const maxTimeout = 600000 // 10 minutes max
    const calculatedTimeout = Math.min(baseTimeout + (mediaFiles.length * perFileTimeout), maxTimeout)
    
    console.log(`[Rust SCORM] Dynamic timeout calculated: ${calculatedTimeout}ms (${Math.round(calculatedTimeout / 1000)}s) for ${mediaFiles.length} media files`)
    
    if (onProgress && typeof onProgress === 'function') {
      onProgress(`Generating SCORM package (${mediaFiles.length} media files)...`, 50)
    }
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutSeconds = Math.round(calculatedTimeout / 1000)
        reject(new Error(
          `SCORM generation timed out after ${timeoutSeconds} seconds. ` +
          `The package contains ${mediaFiles.length} media files which may require more processing time. ` +
          `Consider optimizing images or reducing the number of media files if generation continues to fail.`
        ))
      }, calculatedTimeout)
    })
    
    // Race between the actual invoke and the timeout
    const result = await Promise.race([
      invoke<number[]>('generate_scorm_enhanced', {
        courseData: rustCourseData,
        projectId: projectId,
        mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
      }),
      timeoutPromise
    ])
    
    // Convert number array to Uint8Array
    const buffer = new Uint8Array(result)
    console.log('[Rust SCORM] Generated package size:', buffer.length)
    
    // Unlock blob URLs after successful generation
    blobUrlManager.unlockAll()
    
    if (onProgress && typeof onProgress === 'function') {
      onProgress('SCORM package generated successfully!', 100)
    }
    
    return buffer
  } catch (error) {
    // Always unlock blob URLs, even on error
    blobUrlManager.unlockAll()
    
    console.error('[Rust SCORM] Generation failed:', error)
    console.error('[Rust SCORM] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name || typeof error
    })
    
    // Add more context to error message
    if (error instanceof Error && error.message.includes('timeout')) {
      throw error // Re-throw timeout errors as-is
    } else if (error instanceof Error && error.message.includes('template')) {
      throw new Error(`SCORM template error: ${error.message}. This may be due to incompatible Handlebars syntax.`)
    } else if (error instanceof Error && error.message.includes('memory')) {
      throw new Error(
        `Out of memory while processing ${mediaFiles.length} media files. ` +
        `Try reducing image sizes or processing fewer files at once. ` +
        `Original error: ${error.message}`
      )
    } else {
      throw new Error(
        `Failed to generate SCORM package with ${mediaFiles.length} media files. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}. ` +
        `If this persists, try optimizing your media files.`
      )
    }
  } finally {
    // Clean up event listener
    if (unlisten) {
      unlisten()
    }
    
    // Clear media cache after generation
    clearMediaCache()
  }
}

/**
 * Test if Rust SCORM generation is available
 */
export async function isRustScormAvailable(): Promise<boolean> {
  try {
    // Try to invoke with empty data to check if command exists
    await invoke('generate_scorm_enhanced', {
      courseData: {},
      projectId: 'test',
    })
    return true
  } catch (error) {
    // Check if error is because of invalid data (command exists) or missing command
    const errorMessage = String(error)
    return !errorMessage.includes('not found') && !errorMessage.includes('unknown')
  }
}