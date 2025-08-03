/**
 * Migration utilities for updating old block-number based IDs to new numeric IDs
 */

import { generateMediaId, MediaType } from '../utils/idGenerator'

/**
 * Map old block number to new numeric ID
 */
export function migrateMediaId(oldId: string): string {
  // Extract the type and block number from old ID (e.g., "audio-0001" -> type: "audio", block: "0001")
  const match = oldId.match(/^(audio|caption|image|video)-(\d{4})$/)
  if (!match) return oldId // Not an old format ID
  
  const [, mediaType, blockNumber] = match
  
  // Map block numbers to page indices based on common patterns
  const blockToPageMap: Record<string, { page: string, topicIndex?: number }> = {
    '0001': { page: 'welcome' },
    '0002': { page: 'objectives' },
    // Topics start at 0003
    '0003': { page: 'topic', topicIndex: 0 },
    '0004': { page: 'topic', topicIndex: 1 },
    '0005': { page: 'topic', topicIndex: 2 },
    '0006': { page: 'topic', topicIndex: 3 },
    '0007': { page: 'topic', topicIndex: 4 },
    '0008': { page: 'topic', topicIndex: 5 },
    '0009': { page: 'topic', topicIndex: 6 },
    '0010': { page: 'topic', topicIndex: 7 },
    '0011': { page: 'topic', topicIndex: 8 },
    '0012': { page: 'topic', topicIndex: 9 },
  }
  
  const mapping = blockToPageMap[blockNumber]
  if (!mapping) return oldId // Unknown block number
  
  // Generate new ID based on mapping
  const pageId = mapping.page === 'topic' && mapping.topicIndex !== undefined 
    ? `topic-${mapping.topicIndex}` 
    : mapping.page
  return generateMediaId(mediaType as MediaType, pageId)
}

/**
 * Check if an ID needs migration
 */
export function needsMigration(id: string): boolean {
  return /^(audio|caption|image|video)-\d{4}$/.test(id)
}

/**
 * Get the block number from an old-format ID
 */
export function getBlockNumberFromOldId(oldId: string): string | null {
  const match = oldId.match(/^(?:audio|caption|image|video)-(\d{4})$/)
  return match ? match[1] : null
}

/**
 * Try multiple ID formats when loading media
 * Returns array of IDs to try in order
 */
export function getMediaIdVariants(baseId: string, pageType: string, topicIndex?: number): string[] {
  const variants: string[] = [baseId] // Always try the requested ID first
  
  // Map page types to expected block numbers
  if (pageType === 'welcome') {
    variants.push('audio-0001', 'caption-0001')
  } else if (pageType === 'objectives') {
    variants.push('audio-0002', 'caption-0002')
  } else if (pageType === 'topic' && topicIndex !== undefined) {
    // Topics start at block 0003
    const blockNumber = (3 + topicIndex).toString().padStart(4, '0')
    variants.push(`audio-${blockNumber}`, `caption-${blockNumber}`)
  }
  
  // Remove duplicates and filter to match the media type
  const mediaType = baseId.split('-')[0]
  return [...new Set(variants)].filter(id => id.startsWith(mediaType))
}