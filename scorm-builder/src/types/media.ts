// Core types for the new media system

// Media metadata structure that matches the Rust backend
export interface MediaMetadata {
  page_id: string
  type: 'image' | 'video' | 'audio' | 'caption'
  original_name: string
  mime_type?: string
  source?: 'upload' | 'search' | 'library'
  embed_url?: string
  title?: string
}

// Legacy metadata format with camelCase field names
export interface LegacyMediaMetadata {
  pageId?: string
  originalName?: string
  embedUrl?: string
  source?: string
  title?: string
}

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