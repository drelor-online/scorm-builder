// Core types for the new media system

export interface PageContent {
  id: string
  title: string
  content: string
  narration?: string
  mediaIds: string[] // Just store IDs, not full media objects
  duration?: number
}

export interface TopicContent extends PageContent {
  knowledgeCheck?: {
    questions: any[] // Keep existing question structure
  }
}

// Helper to convert old format to new
export function extractMediaIds(oldMedia?: any[]): string[] {
  if (!oldMedia || !Array.isArray(oldMedia)) return []
  
  return oldMedia
    .map(m => m.id || m.storageId)
    .filter(Boolean)
}

// Helper to check if content has media
export function hasMedia(content: PageContent): boolean {
  return content.mediaIds.length > 0
}