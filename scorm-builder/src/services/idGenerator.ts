/**
 * Simple numeric ID generation for content and media
 * Uses consistent numeric indices throughout the system
 */

// Fixed page indices
const PAGE_INDICES = {
  welcome: 0,
  objectives: 1,
  // Topics start at index 2
} as const

// Special content IDs
const SPECIAL_CONTENT = {
  knowledgeCheck: 'kc',
  summary: 'summary',
} as const

/**
 * Generate a content ID based on page type and index
 */
export function generateContentId(pageType: string, topicIndex?: number): string {
  if (pageType === 'knowledgeCheck') return `content-${SPECIAL_CONTENT.knowledgeCheck}`
  if (pageType === 'summary') return `content-${SPECIAL_CONTENT.summary}`
  
  if (pageType in PAGE_INDICES) {
    return `content-${PAGE_INDICES[pageType as keyof typeof PAGE_INDICES]}`
  }
  
  if (pageType === 'topic' && topicIndex !== undefined) {
    // Topics start at index 2
    return `content-${2 + topicIndex}`
  }
  
  throw new Error(`Unknown page type: ${pageType}`)
}

/**
 * Generate a media ID based on type and numeric index
 */
export function generateMediaId(mediaType: 'audio' | 'caption' | 'image', index: number): string {
  return `${mediaType}-${index}`
}

/**
 * Parse a content ID to get type and index
 */
export function parseContentId(contentId: string): { type: 'page' | 'topic' | 'special', index?: number } {
  // Handle legacy IDs
  if (contentId === 'welcome') {
    return { type: 'page', index: 0 }
  }
  if (contentId === 'objectives' || contentId === 'learning-objectives') {
    return { type: 'page', index: 1 }
  }
  
  // Handle content-N format
  const contentMatch = contentId.match(/^content-(.+)$/)
  if (contentMatch) {
    const value = contentMatch[1]
    
    if (value === SPECIAL_CONTENT.knowledgeCheck || value === SPECIAL_CONTENT.summary) {
      return { type: 'special' }
    }
    
    const index = parseInt(value)
    if (!isNaN(index)) {
      if (index <= 1) {
        return { type: 'page', index }
      }
      return { type: 'topic', index: index - 2 }
    }
  }
  
  // Handle topic-N format
  const topicMatch = contentId.match(/^topic-(\d+)$/)
  if (topicMatch) {
    return { type: 'topic', index: parseInt(topicMatch[1]) }
  }
  
  // For any other format (legacy topic IDs), assume it's a topic with index 0
  // This handles cases like "safety-fundamentals", "electrical-hazards", etc.
  console.warn(`Unrecognized content ID format: "${contentId}". Treating as topic-0`)
  return { type: 'topic', index: 0 }
}

/**
 * Parse a media ID to get type and index
 */
export function parseMediaId(mediaId: string): { type: string, index: number } {
  const match = mediaId.match(/^(audio|caption|image)-(\d+)$/)
  if (!match) throw new Error(`Invalid media ID: ${mediaId}`)
  
  return {
    type: match[1],
    index: parseInt(match[2])
  }
}

/**
 * Get the page index for any content type
 */
export function getPageIndex(pageType: string, topicIndex?: number): number {
  if (pageType in PAGE_INDICES) {
    return PAGE_INDICES[pageType as keyof typeof PAGE_INDICES]
  }
  
  if (pageType === 'topic' && topicIndex !== undefined) {
    return 2 + topicIndex
  }
  
  throw new Error(`Cannot get index for page type: ${pageType}`)
}