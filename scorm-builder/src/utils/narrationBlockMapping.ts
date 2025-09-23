/**
 * Centralized utility for narration block mapping
 * Single source of truth for ALL audio/caption block number calculations
 */

export const WELCOME_BLOCK = 1;                // audio-0, caption-0 → block 0001
export const LEARNING_OBJECTIVES_BLOCK = 2;    // audio-1, caption-1 → block 0002

/**
 * Maps media ID to block number (canonical implementation)
 * @param id Media ID like "audio-2" or "caption-3"
 * @returns Block number like "0003" or null if invalid
 */
export function blockFromMediaId(id: string): string | null {
  const match = id.match(/^(audio|caption)-(\d+)$/i);
  if (!match) return null;
  const n = parseInt(match[2], 10);
  if (!Number.isFinite(n)) return null;
  // 0 → 0001 (welcome), 1 → 0002 (objectives), 2 → 0003 (topic-0), etc.
  return String(n + 1).padStart(4, '0');
}

/**
 * Maps page ID to block number
 * @param pageId Page ID like "welcome", "objectives", "topic-0"
 * @returns Block number like "0001" or null if invalid
 */
export function blockFromPageId(pageId: string): string | null {
  if (pageId === 'welcome') return '0001';
  if (pageId === 'objectives' || pageId === 'learningObjectives' || pageId === 'learning-objectives') return '0002';

  const topicMatch = pageId.match(/^topic-(\d+)$/i);
  if (topicMatch) {
    const topicIndex = parseInt(topicMatch[1], 10);
    if (Number.isFinite(topicIndex)) {
      return String(topicIndex + 3).padStart(4, '0'); // topic-0 → 0003, topic-1 → 0004
    }
  }

  return null;
}

/**
 * Maps block number to topic index
 * @param block Block number like "0003" or "0004"
 * @returns Topic index like 0, 1 or null if not a topic block
 */
export function topicIndexFromBlock(block: string): number | null {
  const blockNum = parseInt(block, 10);
  if (!Number.isFinite(blockNum) || blockNum < 3) return null;
  return blockNum - 3; // 0003 → topic-0, 0004 → topic-1
}

/**
 * Maps media ID to expected media ID for a given block
 * @param mediaId Current media ID
 * @param targetBlock Target block number
 * @returns Expected media ID for that block or null
 */
export function expectedMediaIdForBlock(mediaId: string, targetBlock: string): string | null {
  const match = mediaId.match(/^(audio|caption)-(\d+)$/i);
  if (!match) return null;

  const mediaType = match[1].toLowerCase();
  const blockNum = parseInt(targetBlock, 10);
  if (!Number.isFinite(blockNum)) return null;

  // Block number to media suffix: 0001 → 0, 0002 → 1, 0003 → 2, etc.
  const expectedSuffix = blockNum - 1;
  return `${mediaType}-${expectedSuffix}`;
}

/**
 * Enhanced block mapping that prioritizes media ID calculation over potentially corrupted pageId metadata
 * @param media Media item with id and optional pageId
 * @returns Block number or null
 */
export function blockFromMedia(media: { id: string; pageId?: string; metadata?: { pageId?: string; page_id?: string } }): string | null {
  // ALWAYS try media ID calculation first (prevents corruption from wrong pageId metadata)
  const blockFromId = blockFromMediaId(media.id);
  if (blockFromId) return blockFromId;

  // Only use pageId as fallback if media ID calculation fails
  const pageId = media.pageId || media.metadata?.pageId || media.metadata?.page_id;
  if (pageId) {
    const blockFromPage = blockFromPageId(pageId);
    if (blockFromPage) return blockFromPage;
  }

  return null;
}

/**
 * Validates if media alignment is correct
 * @param media Array of media items with blockNumber assignments
 * @returns Array of mismatches found
 */
export function validateMediaAlignment(media: Array<{ id: string; blockNumber: string; mediaId?: string }>): Array<{
  mediaId: string;
  assignedBlock: string;
  expectedBlock: string;
  severity: 'warning' | 'error';
}> {
  const mismatches: Array<{
    mediaId: string;
    assignedBlock: string;
    expectedBlock: string;
    severity: 'warning' | 'error';
  }> = [];

  for (const item of media) {
    const mediaId = item.mediaId || item.id;
    if (!mediaId) continue;

    const expectedBlock = blockFromMediaId(mediaId);
    if (expectedBlock && expectedBlock !== item.blockNumber) {
      mismatches.push({
        mediaId,
        assignedBlock: item.blockNumber,
        expectedBlock,
        severity: 'error'
      });
    }
  }

  return mismatches;
}

/**
 * Detects systematic off-by-one misalignment pattern
 * @param mismatches Array of mismatches from validateMediaAlignment
 * @returns True if systematic +1 drift detected
 */
export function detectSystematicDrift(mismatches: Array<{ assignedBlock: string; expectedBlock: string }>): boolean {
  if (mismatches.length < 2) return false;

  // Check if all mismatches follow the +1 pattern
  return mismatches.every(({ assignedBlock, expectedBlock }) => {
    const assigned = parseInt(assignedBlock, 10);
    const expected = parseInt(expectedBlock, 10);
    return Number.isFinite(assigned) && Number.isFinite(expected) && assigned === expected + 1;
  });
}

/**
 * Repairs systematic media alignment issues by moving media to correct blocks
 * @param courseContent Course content to repair
 * @param allMedia All available media items mapped by ID
 * @returns Number of repairs made
 */
export function repairMediaAlignment(courseContent: any, allMedia: Map<string, any>): number {
  let repairsCount = 0;

  // Repair topics (most common case)
  if (courseContent.topics && Array.isArray(courseContent.topics)) {
    courseContent.topics.forEach((topic: any, topicIndex: number) => {
      const expectedBlock = String(topicIndex + 3).padStart(4, '0'); // topic-0 → 0003
      const expectedAudioId = `audio-${topicIndex + 2}`; // topic-0 → audio-2
      const expectedCaptionId = `caption-${topicIndex + 2}`; // topic-0 → caption-2

      // Check if topic has the correct audio
      const currentAudio = topic.media?.find((m: any) => m.type === 'audio');
      if (!currentAudio && allMedia.has(expectedAudioId)) {
        // Add missing audio
        if (!topic.media) topic.media = [];
        topic.media.push({
          id: expectedAudioId,
          type: 'audio',
          storageId: expectedAudioId
        });
        repairsCount++;
      } else if (currentAudio && currentAudio.id !== expectedAudioId && allMedia.has(expectedAudioId)) {
        // Replace wrong audio
        currentAudio.id = expectedAudioId;
        currentAudio.storageId = expectedAudioId;
        repairsCount++;
      }

      // Check if topic has the correct caption
      const currentCaption = topic.media?.find((m: any) => m.type === 'caption');
      if (!currentCaption && allMedia.has(expectedCaptionId)) {
        // Add missing caption
        if (!topic.media) topic.media = [];
        topic.media.push({
          id: expectedCaptionId,
          type: 'caption',
          storageId: expectedCaptionId
        });
        repairsCount++;
      } else if (currentCaption && currentCaption.id !== expectedCaptionId && allMedia.has(expectedCaptionId)) {
        // Replace wrong caption
        currentCaption.id = expectedCaptionId;
        currentCaption.storageId = expectedCaptionId;
        repairsCount++;
      }
    });
  }

  return repairsCount;
}

/**
 * Creates a mapping of media items organized by block number using correct calculations
 * @param media Array of media items
 * @param preferPageId Whether to prefer pageId over media ID calculation
 * @returns Map of block number to media item
 */
export function createBlockMediaMapping<T extends { id: string; pageId?: string; metadata?: any }>(
  media: T[],
  preferPageId: boolean = true
): Map<string, T> {
  const mapping = new Map<string, T>();

  for (const item of media) {
    const block = preferPageId ? blockFromMedia(item) : blockFromMediaId(item.id);
    if (block) {
      // Only add if block is not already occupied (first wins)
      if (!mapping.has(block)) {
        mapping.set(block, item);
      }
    }
  }

  return mapping;
}

/**
 * Merges fallback media into existing media, preventing overwrites
 * @param existing Map of existing media by block (from content)
 * @param fallback Array of fallback media items
 * @returns Number of fallback items added
 */
export function mergeFallbackMedia<T extends { id: string; pageId?: string; metadata?: any }>(
  existing: Map<string, T>,
  fallback: T[]
): number {
  let addedCount = 0;

  for (const item of fallback) {
    const block = blockFromMedia(item);
    if (block && !existing.has(block)) {
      existing.set(block, item);
      addedCount++;
    }
  }

  return addedCount;
}