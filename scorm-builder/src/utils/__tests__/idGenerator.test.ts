import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('idGenerator', () => {
  let idGenerator: any

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Mock crypto.randomUUID
    const originalCrypto = global.crypto
    Object.defineProperty(global, 'crypto', {
      value: {
        ...originalCrypto,
        randomUUID: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000')
      },
      writable: true,
      configurable: true
    })
    
    // Clear module cache and re-import to reset counters
    vi.resetModules()
    idGenerator = await import('../idGenerator')
  })

  afterEach(() => {
    // Reset system time
    vi.useRealTimers()
    
    // Reset counters if available
    if (idGenerator.__resetCounters) {
      idGenerator.__resetCounters()
    }
  })

  describe('generateProjectId', () => {
    it('should generate a UUID-based project ID', () => {
      const id = idGenerator.generateProjectId()
      expect(id).toBe('project_550e8400-e29b-41d4-a716-446655440000')
      expect(id).toMatch(/^project_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('should return ProjectId branded type', () => {
      const id = idGenerator.generateProjectId()
      // TypeScript will enforce this at compile time
      const _projectId: idGenerator.ProjectId = id
      expect(_projectId).toBeDefined()
    })
  })

  describe('generateMediaId', () => {
    it('should generate audio ID with correct page index for welcome', () => {
      const id = idGenerator.generateMediaId('audio', 'welcome')
      expect(id).toBe('audio-0')
    })

    it('should generate audio ID with correct page index for objectives', () => {
      const id = idGenerator.generateMediaId('audio', 'objectives')
      expect(id).toBe('audio-1')
    })

    it('should generate audio ID with correct page index for topics', () => {
      const id1 = idGenerator.generateMediaId('audio', 'topic-1')
      const id2 = idGenerator.generateMediaId('audio', 'topic-2')
      const id3 = idGenerator.generateMediaId('audio', 'topic-3')
      
      expect(id1).toBe('audio-2')
      expect(id2).toBe('audio-3')
      expect(id3).toBe('audio-4')
    })

    it('should handle caption IDs the same as audio', () => {
      expect(idGenerator.generateMediaId('caption', 'welcome')).toBe('caption-0')
      expect(idGenerator.generateMediaId('caption', 'objectives')).toBe('caption-1')
      expect(idGenerator.generateMediaId('caption', 'topic-1')).toBe('caption-2')
    })

    it('should generate sequential image IDs regardless of page', () => {
      const id1 = idGenerator.generateMediaId('image', 'welcome')
      const id2 = idGenerator.generateMediaId('image', 'objectives')
      const id3 = idGenerator.generateMediaId('image', 'topic-1')
      
      expect(id1).toBe('image-0')
      expect(id2).toBe('image-1')
      expect(id3).toBe('image-2')
    })

    it('should generate sequential video IDs', () => {
      const id1 = idGenerator.generateMediaId('video', 'welcome')
      const id2 = idGenerator.generateMediaId('video', 'topic-1')
      
      expect(id1).toBe('video-0')
      expect(id2).toBe('video-1')
    })

    it('should handle legacy page IDs', () => {
      expect(idGenerator.generateMediaId('audio', 'content-0')).toBe('audio-0')
      expect(idGenerator.generateMediaId('audio', 'content-1')).toBe('audio-1')
      expect(idGenerator.generateMediaId('audio', 'learning-objectives')).toBe('audio-1')
    })

    it('should return MediaId branded type', () => {
      const id = idGenerator.generateMediaId('audio', 'welcome')
      const _mediaId: idGenerator.MediaId = id
      expect(_mediaId).toBeDefined()
    })
  })

  describe('generateContentId', () => {
    it('should generate welcome content ID', () => {
      const id = idGenerator.generateContentId('welcome')
      expect(id).toBe('content-0')
    })

    it('should generate objectives content ID', () => {
      const id = idGenerator.generateContentId('objectives')
      expect(id).toBe('content-1')
    })

    it('should generate topic content IDs with index', () => {
      expect(idGenerator.generateContentId('topic', 0)).toBe('content-2')
      expect(idGenerator.generateContentId('topic', 1)).toBe('content-3')
      expect(idGenerator.generateContentId('topic', 2)).toBe('content-4')
    })

    it('should throw error for topic without index', () => {
      expect(() => idGenerator.generateContentId('topic')).toThrow('Topic content requires an index')
    })

    it('should return ContentId branded type', () => {
      const id = idGenerator.generateContentId('welcome')
      const _contentId: idGenerator.ContentId = id
      expect(_contentId).toBeDefined()
    })
  })

  describe('generateActivityId', () => {
    it('should generate UUID-based activity ID', () => {
      const id = idGenerator.generateActivityId()
      expect(id).toBe('activity_550e8400-e29b-41d4-a716-446655440000')
      expect(id).toMatch(/^activity_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })
  })

  describe('generateAudioRecordingId', () => {
    it('should generate timestamp-based recording filename', () => {
      const id = idGenerator.generateAudioRecordingId()
      expect(id).toMatch(/^recorded-\d+\.wav$/)
      
      // Verify it's using timestamps
      const timestamp = parseInt(id.match(/recorded-(\d+)\.wav/)?.[1] || '0')
      expect(timestamp).toBeGreaterThan(0)
      expect(timestamp).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('generateNotificationId', () => {
    it('should generate timestamp-based notification ID', () => {
      const id = idGenerator.generateNotificationId()
      expect(id).toMatch(/^notification-\d+$/)
      
      // Verify it's using timestamps
      const timestamp = parseInt(id.match(/notification-(\d+)/)?.[1] || '0')
      expect(timestamp).toBeGreaterThan(0)
      expect(timestamp).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('generateScormPackageId', () => {
    it('should generate timestamp-based SCORM package identifier', () => {
      const id = idGenerator.generateScormPackageId()
      expect(id).toMatch(/^course-\d+$/)
      
      // Verify it's using timestamps
      const timestamp = parseInt(id.match(/course-(\d+)/)?.[1] || '0')
      expect(timestamp).toBeGreaterThan(0)
      expect(timestamp).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('generateKnowledgeCheckId', () => {
    it('should generate knowledge check ID with UUID', () => {
      const id = idGenerator.generateKnowledgeCheckId()
      expect(id).toBe('kc_550e8400-e29b-41d4-a716-446655440000')
      expect(id).toMatch(/^kc_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })
    
    it('should generate unique IDs when crypto.randomUUID returns different values', () => {
      // Mock different UUIDs
      let callCount = 0
      global.crypto.randomUUID = vi.fn(() => {
        callCount++
        return `${callCount}50e8400-e29b-41d4-a716-446655440000`
      })
      
      const id1 = idGenerator.generateKnowledgeCheckId()
      const id2 = idGenerator.generateKnowledgeCheckId()
      
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^kc_/)
      expect(id2).toMatch(/^kc_/)
    })
  })

  describe('generateAssessmentId', () => {
    it('should generate assessment ID with UUID', () => {
      const id = idGenerator.generateAssessmentId()
      expect(id).toBe('assessment_550e8400-e29b-41d4-a716-446655440000')
      expect(id).toMatch(/^assessment_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })
    
    it('should generate unique IDs when crypto.randomUUID returns different values', () => {
      // Mock different UUIDs
      let callCount = 0
      global.crypto.randomUUID = vi.fn(() => {
        callCount++
        return `${callCount}50e8400-e29b-41d4-a716-446655440000`
      })
      
      const id1 = idGenerator.generateAssessmentId()
      const id2 = idGenerator.generateAssessmentId()
      
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^assessment_/)
      expect(id2).toMatch(/^assessment_/)
    })
  })

  describe('parseMediaId', () => {
    it('should parse valid media ID', () => {
      const parsed = idGenerator.parseMediaId('audio-5' as idGenerator.MediaId)
      expect(parsed).toEqual({
        type: 'audio',
        index: 5
      })
    })

    it('should parse image ID', () => {
      const parsed = idGenerator.parseMediaId('image-10' as idGenerator.MediaId)
      expect(parsed).toEqual({
        type: 'image',
        index: 10
      })
    })

    it('should return null for invalid format', () => {
      expect(idGenerator.parseMediaId('invalid-id' as idGenerator.MediaId)).toBeNull()
      expect(idGenerator.parseMediaId('audio-abc' as idGenerator.MediaId)).toBeNull()
      expect(idGenerator.parseMediaId('audio' as idGenerator.MediaId)).toBeNull()
    })
  })

  describe('isValidProjectId', () => {
    it('should validate correct project IDs', () => {
      expect(idGenerator.isValidProjectId('project_550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    })

    it('should reject invalid project IDs', () => {
      expect(idGenerator.isValidProjectId('project-123')).toBe(false)
      expect(idGenerator.isValidProjectId('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
      expect(idGenerator.isValidProjectId('project_invalid-uuid')).toBe(false)
    })
  })

  describe('isValidMediaId', () => {
    it('should validate correct media IDs', () => {
      expect(idGenerator.isValidMediaId('audio-0')).toBe(true)
      expect(idGenerator.isValidMediaId('image-123')).toBe(true)
      expect(idGenerator.isValidMediaId('video-99')).toBe(true)
      expect(idGenerator.isValidMediaId('caption-5')).toBe(true)
    })

    it('should reject invalid media IDs', () => {
      expect(idGenerator.isValidMediaId('audio-abc')).toBe(false)
      expect(idGenerator.isValidMediaId('invalid-0')).toBe(false)
      expect(idGenerator.isValidMediaId('audio')).toBe(false)
      expect(idGenerator.isValidMediaId('123')).toBe(false)
    })
  })

  describe('migrateOldMediaId', () => {
    it('should migrate old random media IDs', () => {
      const oldId = 'media-abc123def'
      const newId = idGenerator.migrateOldMediaId(oldId, 'image', 'welcome')
      expect(newId).toBe('image-0')
    })

    it('should migrate file-based IDs', () => {
      const oldId = 'file-1705317000000'
      const newId = idGenerator.migrateOldMediaId(oldId, 'audio', 'topic-1')
      expect(newId).toBe('audio-2')
    })

    it('should preserve already migrated IDs', () => {
      const validId = 'audio-5'
      const result = idGenerator.migrateOldMediaId(validId, 'audio', 'topic-3')
      expect(result).toBe('audio-5')
    })
  })

  describe('ID counter persistence', () => {
    it('should maintain separate counters for each media type', async () => {
      // Use the current instance
      const genId = idGenerator.generateMediaId
      
      // Generate multiple IDs of different types
      const img1 = genId('image', 'welcome')
      const aud1 = genId('audio', 'welcome')
      const img2 = genId('image', 'objectives')
      const vid1 = genId('video', 'topic-1')
      const img3 = genId('image', 'topic-1')
      
      expect(img1).toBe('image-0')
      expect(aud1).toBe('audio-0')
      expect(img2).toBe('image-1')
      expect(vid1).toBe('video-0')
      expect(img3).toBe('image-2')
    })
  })

  describe('type safety', () => {
    it('should not allow invalid MediaType', () => {
      // Test runtime validation
      expect(() => idGenerator.generateMediaId('invalid', 'welcome')).toThrow()
    })

    it('should not allow invalid ContentType', () => {
      // Test runtime validation
      expect(() => idGenerator.generateContentId('invalid')).toThrow()
    })
  })
})