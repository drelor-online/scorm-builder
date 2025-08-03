import { invoke } from '@tauri-apps/api/core'
import type { CourseContent } from '../types/aiPrompt'
import { logger } from '../utils/logger'

interface MediaMetadata {
  page_id: string
  type: 'image' | 'video' | 'audio'
  original_name: string
}

interface MediaData {
  id: string
  metadata: MediaMetadata
}

/**
 * Maps audioIds from backend media storage to courseContent pages
 * This is needed because courseContent loaded from storage doesn't have audioId properties
 */
export async function mapAudioIds(
  courseContent: CourseContent,
  projectId: string
): Promise<CourseContent> {
  try {
    logger.debug('[mapAudioIds] Mapping audio IDs for project:', projectId)
    
    // Get all media from backend
    const mediaList = await invoke<MediaData[]>('get_all_project_media', { projectId })
    
    logger.debug('[mapAudioIds] Found', mediaList.length, 'media items')
    
    // Create a map of pageId to audioId
    const audioMap = new Map<string, string>()
    for (const media of mediaList) {
      if (media.metadata.type === 'audio') {
        audioMap.set(media.metadata.page_id, media.id)
        logger.debug('[mapAudioIds] Mapped', media.metadata.page_id, 'to', media.id)
      }
    }
    
    // Deep clone the content to avoid mutations
    const mappedContent = JSON.parse(JSON.stringify(courseContent))
    
    // Map audioIds to courseContent
    if (audioMap.has('welcome') && mappedContent.welcomePage) {
      mappedContent.welcomePage.audioId = audioMap.get('welcome')
    }
    
    if (audioMap.has('objectives') && mappedContent.learningObjectivesPage) {
      mappedContent.learningObjectivesPage.audioId = audioMap.get('objectives')
    }
    
    if (mappedContent.topics) {
      mappedContent.topics = mappedContent.topics.map((topic: any) => {
        if (audioMap.has(topic.id)) {
          return { ...topic, audioId: audioMap.get(topic.id) }
        }
        return topic
      })
    }
    
    logger.debug('[mapAudioIds] Mapping complete')
    return mappedContent
  } catch (error) {
    logger.error('[mapAudioIds] Error mapping audio IDs:', error)
    // Return original content if mapping fails
    return courseContent
  }
}