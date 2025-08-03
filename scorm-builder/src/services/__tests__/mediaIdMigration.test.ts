import { describe, it, expect, vi } from 'vitest'
import {
  migrateMediaId,
  needsMigration,
  getBlockNumberFromOldId,
  getMediaIdVariants
} from '../mediaIdMigration'

// Mock idGenerator functions
vi.mock('../idGenerator', () => ({
  generateMediaId: vi.fn((type: string, pageIndex: number) => `${type}-${pageIndex}`),
  getPageIndex: vi.fn((page: string, topicIndex?: number) => {
    if (page === 'welcome') return 0
    if (page === 'objectives') return 1
    if (page === 'topic' && topicIndex !== undefined) return 2 + topicIndex
    return -1
  })
}))

describe('mediaIdMigration', () => {
  describe('migrateMediaId', () => {
    it('should migrate welcome page audio ID', () => {
      const result = migrateMediaId('audio-0001')
      expect(result).toBe('audio-0')
    })

    it('should migrate objectives page audio ID', () => {
      const result = migrateMediaId('audio-0002')
      expect(result).toBe('audio-1')
    })

    it('should migrate topic page audio IDs', () => {
      expect(migrateMediaId('audio-0003')).toBe('audio-2') // Topic 0
      expect(migrateMediaId('audio-0004')).toBe('audio-3') // Topic 1
      expect(migrateMediaId('audio-0005')).toBe('audio-4') // Topic 2
      expect(migrateMediaId('audio-0012')).toBe('audio-11') // Topic 9
    })

    it('should migrate caption IDs', () => {
      expect(migrateMediaId('caption-0001')).toBe('caption-0')
      expect(migrateMediaId('caption-0002')).toBe('caption-1')
      expect(migrateMediaId('caption-0003')).toBe('caption-2')
    })

    it('should migrate image IDs', () => {
      expect(migrateMediaId('image-0001')).toBe('image-0')
      expect(migrateMediaId('image-0005')).toBe('image-4')
    })

    it('should migrate video IDs', () => {
      expect(migrateMediaId('video-0001')).toBe('video-0')
      expect(migrateMediaId('video-0007')).toBe('video-6')
    })

    it('should return original ID if not in old format', () => {
      expect(migrateMediaId('audio-1')).toBe('audio-1')
      expect(migrateMediaId('new-format-id')).toBe('new-format-id')
      expect(migrateMediaId('audio-12345')).toBe('audio-12345') // 5 digits
      expect(migrateMediaId('other-0001')).toBe('other-0001') // Unknown type
    })

    it('should return original ID for unknown block numbers', () => {
      expect(migrateMediaId('audio-0013')).toBe('audio-0013') // Beyond mapped range
      expect(migrateMediaId('audio-9999')).toBe('audio-9999')
    })
  })

  describe('needsMigration', () => {
    it('should return true for old format IDs', () => {
      expect(needsMigration('audio-0001')).toBe(true)
      expect(needsMigration('caption-0002')).toBe(true)
      expect(needsMigration('image-0003')).toBe(true)
      expect(needsMigration('video-9999')).toBe(true)
    })

    it('should return false for new format IDs', () => {
      expect(needsMigration('audio-1')).toBe(false)
      expect(needsMigration('caption-12')).toBe(false)
      expect(needsMigration('image-123')).toBe(false)
      expect(needsMigration('new-format')).toBe(false)
    })

    it('should return false for invalid formats', () => {
      expect(needsMigration('audio-00001')).toBe(false) // 5 digits
      expect(needsMigration('audio-001')).toBe(false) // 3 digits
      expect(needsMigration('other-0001')).toBe(false) // Unknown type
      expect(needsMigration('audio_0001')).toBe(false) // Underscore instead of dash
    })
  })

  describe('getBlockNumberFromOldId', () => {
    it('should extract block number from old format IDs', () => {
      expect(getBlockNumberFromOldId('audio-0001')).toBe('0001')
      expect(getBlockNumberFromOldId('caption-0002')).toBe('0002')
      expect(getBlockNumberFromOldId('image-0123')).toBe('0123')
      expect(getBlockNumberFromOldId('video-9999')).toBe('9999')
    })

    it('should return null for invalid formats', () => {
      expect(getBlockNumberFromOldId('audio-1')).toBeNull()
      expect(getBlockNumberFromOldId('new-format')).toBeNull()
      expect(getBlockNumberFromOldId('audio-00001')).toBeNull()
      expect(getBlockNumberFromOldId('other-0001')).toBeNull()
    })
  })

  describe('getMediaIdVariants', () => {
    it('should generate variants for welcome page', () => {
      const variants = getMediaIdVariants('audio-0', 'welcome')
      expect(variants).toContain('audio-0')
      expect(variants).toContain('audio-0001')
      expect(variants).not.toContain('caption-0001') // Filtered by media type
    })

    it('should generate variants for objectives page', () => {
      const variants = getMediaIdVariants('caption-1', 'objectives')
      expect(variants).toContain('caption-1')
      expect(variants).toContain('caption-0002')
      expect(variants).not.toContain('audio-0002') // Filtered by media type
    })

    it('should generate variants for topic pages', () => {
      // Topic 0
      const variants1 = getMediaIdVariants('audio-2', 'topic', 0)
      expect(variants1).toContain('audio-2')
      expect(variants1).toContain('audio-0003')
      
      // Topic 5
      const variants2 = getMediaIdVariants('caption-7', 'topic', 5)
      expect(variants2).toContain('caption-7')
      expect(variants2).toContain('caption-0008')
    })

    it('should handle topic pages with high indices', () => {
      const variants = getMediaIdVariants('audio-15', 'topic', 12)
      expect(variants).toContain('audio-15')
      expect(variants).toContain('audio-0015') // 3 + 12 = 15
    })

    it('should handle unknown page types', () => {
      const variants = getMediaIdVariants('audio-99', 'unknown')
      expect(variants).toEqual(['audio-99']) // Only the base ID
    })

    it('should handle topic without index', () => {
      const variants = getMediaIdVariants('audio-2', 'topic')
      expect(variants).toEqual(['audio-2']) // Only the base ID
    })

    it('should remove duplicates', () => {
      // If baseId happens to match a generated variant
      const variants = getMediaIdVariants('audio-0001', 'welcome')
      expect(variants).toEqual(['audio-0001']) // No duplicates
    })

    it('should filter variants by media type', () => {
      const audioVariants = getMediaIdVariants('audio-0', 'welcome')
      expect(audioVariants.every(id => id.startsWith('audio'))).toBe(true)
      
      const captionVariants = getMediaIdVariants('caption-1', 'objectives')
      expect(captionVariants.every(id => id.startsWith('caption'))).toBe(true)
    })
  })
})