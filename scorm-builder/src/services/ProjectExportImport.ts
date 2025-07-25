import JSZip from 'jszip'

export interface MediaFile {
  filename: string
  data: string
  mimeType: string
}

export interface MediaItem {
  id: string
  type: 'image' | 'audio' | 'youtube'
  url: string
  name: string
  filename?: string
  captionFile?: string
}

export interface ProjectMetadata {
  version: string
  exportDate: string
  projectName: string
}

export interface ProjectExportData {
  metadata: ProjectMetadata
  courseData: {
    title?: string
    language?: string
    keywords?: string[]
    topics: Array<{
      title: string
      content?: string
      media?: MediaItem[]
    }>
  }
  media: {
    images: MediaFile[]
    audio: MediaFile[]
    captions: MediaFile[]
  }
}

export interface ExportResult {
  success: boolean
  filename?: string
  blob?: Blob
  error?: string
}

export interface ImportResult {
  success: boolean
  data?: {
    metadata: ProjectMetadata
    courseData: any
    mediaMap: Record<string, string> // filename to blob URL mapping
    captionsMap: Record<string, string> // caption filename to content mapping
  }
  error?: string
}

const SUPPORTED_VERSION = '1.0.0'

async function base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export async function exportProject(
  projectData: ProjectExportData
): Promise<ExportResult> {
  try {
    const zip = new JSZip()
    
    // Add manifest
    zip.file('manifest.json', JSON.stringify(projectData.metadata, null, 2))
    
    // Add course data
    zip.file('course-data.json', JSON.stringify(projectData.courseData, null, 2))
    
    // Create media folders
    const mediaFolder = zip.folder('media')
    if (!mediaFolder) throw new Error('Failed to create media folder')
    
    const imagesFolder = mediaFolder.folder('images')
    const audioFolder = mediaFolder.folder('audio')
    const captionsFolder = mediaFolder.folder('captions')
    
    // Add images
    for (const image of projectData.media.images) {
      if (imagesFolder) {
        imagesFolder.file(image.filename, image.data, { base64: true })
      }
    }
    
    // Add audio files
    for (const audio of projectData.media.audio) {
      if (audioFolder) {
        audioFolder.file(audio.filename, audio.data, { base64: true })
      }
    }
    
    // Add caption files
    for (const caption of projectData.media.captions) {
      if (captionsFolder) {
        captionsFolder.file(caption.filename, caption.data)
      }
    }
    
    // Generate zip file
    const blob = await zip.generateAsync({ type: 'blob' })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `scorm-project-${timestamp}.zip`
    
    return {
      success: true,
      filename,
      blob
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

export async function importProject(file: File): Promise<ImportResult> {
  try {
    const zip = new JSZip()
    await zip.loadAsync(file)
    
    // Check for required files
    if (!zip.files['manifest.json'] || !zip.files['course-data.json']) {
      return {
        success: false,
        error: 'Missing required files in project archive'
      }
    }
    
    // Read and parse manifest
    const manifestContent = await zip.files['manifest.json'].async('string')
    const manifest = JSON.parse(manifestContent) as ProjectMetadata
    
    // Check version compatibility
    if (manifest.version !== SUPPORTED_VERSION) {
      return {
        success: false,
        error: `Unsupported project version: ${manifest.version}. This version supports ${SUPPORTED_VERSION}`
      }
    }
    
    // Read and parse course data
    let courseData
    try {
      const courseDataContent = await zip.files['course-data.json'].async('string')
      courseData = JSON.parse(courseDataContent)
    } catch (error) {
      return {
        success: false,
        error: 'Invalid course data in project file'
      }
    }
    
    // Process media files
    const mediaMap: Record<string, string> = {}
    const captionsMap: Record<string, string> = {}
    
    // Process all files in the zip
    if (zip.files) {
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (path.startsWith('media/images/')) {
          const filename = path.replace('media/images/', '')
          const base64Data = await zipEntry.async('base64')
          const blob = await base64ToBlob(base64Data, getMimeType(filename))
          mediaMap[filename] = URL.createObjectURL(blob)
        } else if (path.startsWith('media/audio/')) {
          const filename = path.replace('media/audio/', '')
          const base64Data = await zipEntry.async('base64')
          const blob = await base64ToBlob(base64Data, 'audio/mpeg')
          mediaMap[filename] = URL.createObjectURL(blob)
        } else if (path.startsWith('media/captions/')) {
          const filename = path.replace('media/captions/', '')
          const content = await zipEntry.async('string')
          captionsMap[filename] = content
        }
      }
    }
    
    // Update media URLs in course data
    if (courseData.topics) {
      for (const topic of courseData.topics) {
        if (topic.media) {
          for (const mediaItem of topic.media) {
            // Skip YouTube videos - they already have their URLs
            if (mediaItem.type === 'youtube') continue
            
            // Update local media URLs with new blob URLs
            if (mediaItem.filename && mediaMap[mediaItem.filename]) {
              mediaItem.url = mediaMap[mediaItem.filename]
            }
          }
        }
      }
    }
    
    return {
      success: true,
      data: {
        metadata: manifest,
        courseData,
        mediaMap,
        captionsMap
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}