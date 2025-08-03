import { invoke } from '@tauri-apps/api/core'
import type { CourseContent, EnhancedCourseContent } from '../types/scorm'
import { downloadIfExternal, isExternalUrl } from './externalImageDownloader'

interface MediaFile {
  filename: string
  content: Uint8Array
}


/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
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
  if (!fileId && !blob) return undefined
  
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
    try {
      const { createMediaService } = await import('./MediaService')
      const mediaService = createMediaService(projectId)
      const fileData = await mediaService.getMedia(cleanFileId)
      
      if (fileData && fileData.data) {
        const mimeType = fileData.metadata?.mimeType || ''
        const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(cleanFileId)
        const filename = `${cleanFileId}.${ext}`
        
        mediaFiles.push({
          filename,
          content: new Uint8Array(fileData.data),
        })
        
        return `media/${filename}`
      }
    } catch (error) {
      console.error(`[Rust SCORM] Failed to load audio/caption file:`, error)
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
  console.log(`[Rust SCORM] resolveImageUrl called with:`, imageUrl)
  
  if (!imageUrl) {
    return undefined;
  }
  
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
    try {
      const { createMediaService } = await import('./MediaService')
      const mediaService = createMediaService(projectId)
      const fileData = await mediaService.getMedia(imageUrl)
      
      if (fileData && fileData.data) {
        const mimeType = fileData.metadata?.mimeType || ''
        
        // Check if this is a video metadata JSON file
        if (imageUrl.startsWith('video-') && mimeType === 'application/json') {
          try {
            // Parse the JSON to get the YouTube URL
            const jsonText = new TextDecoder().decode(fileData.data)
            const metadata = JSON.parse(jsonText)
            if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
              console.log(`[Rust SCORM] Found YouTube URL in metadata:`, metadata.url)
              return metadata.url // Return the YouTube URL directly
            }
          } catch (error) {
            console.error(`[Rust SCORM] Failed to parse video metadata:`, error)
          }
        }
        
        const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(imageUrl)
        
        // Preserve original ID as filename
        const filename = `${imageUrl}.${ext}`
        
        mediaFiles.push({
          filename,
          content: new Uint8Array(fileData.data),
        })
        
        return `media/${filename}`
      }
    } catch (error) {
      console.error(`[Rust SCORM] Failed to load media from FileStorage:`, error)
    }
    return undefined
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
          try {
            const { createMediaService } = await import('./MediaService')
            const mediaService = createMediaService(projectId)
            const fileData = await mediaService.getMedia(mediaId)
            
            if (fileData && fileData.data && fileData.metadata?.mimeType === 'application/json') {
              const jsonText = new TextDecoder().decode(fileData.data)
              const metadata = JSON.parse(jsonText)
              if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
                console.log(`[Rust SCORM] Resolved asset.localhost to YouTube URL:`, metadata.url)
                media.url = metadata.url // Replace with actual YouTube URL
              }
            }
          } catch (error) {
            console.error(`[Rust SCORM] Failed to resolve asset.localhost URL:`, error)
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
      try {
        const { createMediaService } = await import('./MediaService')
        const mediaService = createMediaService(projectId)
        const fileData = await mediaService.getMedia(media.url)
        
        if (fileData && fileData.data) {
          const mimeType = fileData.metadata?.mimeType || ''
          
          // Check if this is a video metadata JSON file
          if (media.type === 'video' && mimeType === 'application/json') {
            try {
              // Parse the JSON to get the YouTube URL
              const jsonText = new TextDecoder().decode(fileData.data)
              const metadata = JSON.parse(jsonText)
              if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
                console.log(`[Rust SCORM] Found YouTube URL in video metadata:`, metadata.url)
                resolvedUrl = metadata.url // Use the YouTube URL directly
                // Continue to process as YouTube video below
              }
            } catch (error) {
              console.error(`[Rust SCORM] Failed to parse video metadata:`, error)
            }
          }
          
          // If not YouTube metadata, process as regular file
          if (!resolvedUrl) {
            const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(media.url)
            
            // Preserve original ID as filename
            const filename = `${media.url}.${ext}`
            
            mediaFiles.push({
              filename,
              content: new Uint8Array(fileData.data),
            })
            
            resolvedUrl = `media/${filename}`
          }
        }
      } catch (error) {
        console.error(`[Rust SCORM] Error loading media from MediaService:`, error)
      }
    }
    // If it has a storageId, use that instead
    else if ((media as any).storageId) {
      try {
        const { createMediaService } = await import('./MediaService')
        const mediaService = createMediaService(projectId)
        const storageId = (media as any).storageId
        const fileData = await mediaService.getMedia(storageId)
        
        if (fileData && fileData.data) {
          const mimeType = fileData.metadata?.mimeType || ''
          const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(storageId)
          
          // Preserve original ID as filename
          const filename = `${storageId}.${ext}`
          
          mediaFiles.push({
            filename,
            content: new Uint8Array(fileData.data),
          })
          
          resolvedUrl = `media/${filename}`
        }
      } catch (error) {
        console.error(`[Rust SCORM] Error loading media with storageId:`, error)
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
    } else {
      resolvedMedia.push({ ...media, url: resolvedUrl || '' })
    }
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
      media: await resolveMedia(
        Array.isArray(cc.welcome?.media) ? cc.welcome.media :
        Array.isArray(cc.welcomePage?.media) ? cc.welcomePage.media :
        cc.welcome?.media ? [cc.welcome.media] :
        cc.welcomePage?.media ? [cc.welcomePage.media] :
        cc.welcomeMedia ? [cc.welcomeMedia] : undefined, 
        projectId, 
        mediaFiles, 
        mediaCounter
      ),
    } : undefined,
    
    learning_objectives_page: cc.learningObjectivesPage ? {
      objectives: cc.learningObjectivesPage.objectives || [],
      audio_file: await resolveAudioCaptionFile(cc.learningObjectivesPage.audioFile, projectId, mediaFiles),
      caption_file: await resolveAudioCaptionFile(cc.learningObjectivesPage.captionFile, projectId, mediaFiles),
      media: await resolveMedia(
        Array.isArray(cc.learningObjectivesPage.media) ? cc.learningObjectivesPage.media :
        cc.learningObjectivesPage.media ? [cc.learningObjectivesPage.media] : undefined,
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
            correct_answer: typeof q.correctAnswer === 'number' && options ? 
              options[q.correctAnswer] : String(q.correctAnswer),
            explanation: q.explanation || q.feedback?.incorrect || q.feedback?.correct || '',
          }
        }) || []
      } : undefined,
        audio_file: await resolveAudioCaptionFile((topic as any).audioFile || (topic as any).audioId, projectId, mediaFiles),
        caption_file: await resolveAudioCaptionFile((topic as any).captionFile || (topic as any).captionId, projectId, mediaFiles),
        image_url: await resolveImageUrl((topic as any).imageUrl, projectId, mediaFiles, mediaCounter),
        media: await resolveMedia(
          Array.isArray((topic as any).media) ? (topic as any).media.map((m: any) => ({
            id: m.id,
            type: m.type,
            url: m.url || '',
            title: m.title || '',
          })) : (topic as any).media ? [{
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
        
        return {
          type: qAny.type || 'multiple-choice', // Default to multiple-choice for assessment
          text: qAny.question || qAny.text, // Fixed: Support both 'question' and 'text' fields
          options: qAny.options,
          correct_answer: qAny.correctAnswer,
          explanation: qAny.feedback?.incorrect || qAny.feedback?.correct || '',
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
      audio_file: await resolveAudioCaptionFile((courseContent.welcome as any).audioId || courseContent.welcome.audioFile, projectId, mediaFiles, (courseContent.welcome as any).audioBlob),
      caption_file: await resolveAudioCaptionFile((courseContent.welcome as any).captionId || courseContent.welcome.captionFile, projectId, mediaFiles, (courseContent.welcome as any).captionBlob),
      image_url: await resolveImageUrl(courseContent.welcome.imageUrl, projectId, mediaFiles, mediaCounter),
      media: await resolveMedia(courseContent.welcome.media, projectId, mediaFiles, mediaCounter),
    } : undefined,
    
    learning_objectives_page: courseContent.objectives ? {
      objectives: courseContent.objectives,
      audio_file: await resolveAudioCaptionFile((courseContent.objectivesPage as any)?.audioId || courseContent.objectivesPage?.audioFile, projectId, mediaFiles, (courseContent.objectivesPage as any)?.audioBlob),
      caption_file: await resolveAudioCaptionFile((courseContent.objectivesPage as any)?.captionId || courseContent.objectivesPage?.captionFile, projectId, mediaFiles, (courseContent.objectivesPage as any)?.captionBlob),
      image_url: await resolveImageUrl(courseContent.objectivesPage?.imageUrl, projectId, mediaFiles, mediaCounter),
      media: await resolveMedia(courseContent.objectivesPage?.media, projectId, mediaFiles, mediaCounter),
    } : undefined,
    
    topics: await Promise.all(courseContent.topics.map(async topic => {
      console.log(`[Rust SCORM] Processing topic ${topic.id}, has KC:`, !!topic.knowledgeCheck)
      
      const convertedTopic = {
        id: topic.id,
        title: topic.title,
        content: topic.content || '',
        knowledge_check: undefined as any,
        audio_file: await resolveAudioCaptionFile((topic as any).audioId || topic.audioFile, projectId, mediaFiles, (topic as any).audioBlob),
        caption_file: await resolveAudioCaptionFile((topic as any).captionId || topic.captionFile, projectId, mediaFiles, (topic as any).captionBlob),
        image_url: await resolveImageUrl(topic.imageUrl, projectId, mediaFiles, mediaCounter),
        media: await resolveMedia(topic.media?.map(m => ({
          id: m.id,
          type: m.type,
          url: m.url || '',
          title: m.title || '',
        })), projectId, mediaFiles, mediaCounter)
      }
      
      // Debug log to see audio/caption files
      console.log(`[Rust SCORM] Topic ${topic.id} audio_file:`, topic.audioFile)
      console.log(`[Rust SCORM] Topic ${topic.id} caption_file:`, topic.captionFile)
      console.log(`[Rust SCORM] Topic ${topic.id} media:`, topic.media)
      
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
            correctAnswer: kc.correctAnswer
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
              correct_answer: String(kc.correctAnswer).toLowerCase(),  // Keep lowercase for template
              explanation: kc.explanation || kc.feedback?.incorrect || kc.feedback?.correct || '',
            }]
          }
        } else {
          convertedTopic.knowledge_check = {
            enabled: true,
            questions: [{
              type: kc.type || 'multiple-choice',
              text: kc.question || kc.text || kc.blank || 'Fill in the blank',
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
              explanation: kc.explanation || kc.feedback?.incorrect || kc.feedback?.correct || '',
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
            if (!q.question && !(q as any).text) {
              console.error(`[Rust SCORM] Enhanced question missing question/text field in topic ${topic.id}:`, q)
              throw new Error(`Question missing question/text field in topic ${topic.id}`)
            }
            if (q.correctAnswer === undefined || q.correctAnswer === null) {
              console.error(`[Rust SCORM] Enhanced question missing correctAnswer in topic ${topic.id}:`, q)
              throw new Error(`Question missing correctAnswer in topic ${topic.id}`)
            }
            
            return {
              type: q.type || (q as any).questionType,
              text: q.question || (q as any).text, // Support both 'question' and 'text' fields
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
              explanation: q.explanation || '',
            }
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
  projectId: string
): Promise<Uint8Array> {
  try {
    console.log('[Rust SCORM] Converting course content to Rust format')
    const { courseData: rustCourseData, mediaFiles } = await convertToRustFormat(courseContent, projectId)
    
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
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('SCORM generation timed out after 60 seconds. The package may be too large or complex.'))
      }, 60000) // 60 second timeout
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
    
    return buffer
  } catch (error) {
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
    } else {
      throw new Error(`Failed to generate SCORM package: ${error instanceof Error ? error.message : String(error)}`)
    }
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