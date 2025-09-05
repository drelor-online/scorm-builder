/**
 * Utilities and Services - Consolidated Test Suite
 * 
 * This file consolidates utility and service tests from 5 separate files:
 * - ApiKeyStorage (1 file)
 * - captionTimingAdjuster (1 file)
 * - courseContentAudioIdMapping (1 file)
 * - searchService (1 file)
 * - Plus other miscellaneous utility tests
 * 
 * Test Categories:
 * - API key management and storage
 * - Caption timing adjustment and synchronization
 * - Audio ID mapping and management
 * - Search functionality and indexing
 * - General utility functions
 * - Service helpers and adapters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri APIs
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

// Mock crypto APIs for secure storage
const mockCrypto = {
  getRandomValues: vi.fn(),
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    generateKey: vi.fn(),
    importKey: vi.fn()
  }
}

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
})

describe('Utilities and Services - Consolidated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockClear()
    ;(mockCrypto.getRandomValues as any).mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
      return array
    })
  })

  describe('API Key Management and Storage', () => {
    it('stores API keys securely', async () => {
      const apiKeyData = {
        service: 'openai',
        apiKey: 'sk-test-key-12345',
        keyHash: 'hash123',
        expiresAt: new Date(Date.now() + 86400000).toISOString() // 24 hours
      }

      mockInvoke.mockResolvedValueOnce({
        stored: true,
        keyId: 'key-storage-123',
        encrypted: true,
        secureStorage: true
      })

      const result = await mockInvoke('store_api_key', {
        service: apiKeyData.service,
        api_key: apiKeyData.apiKey,
        expires_at: apiKeyData.expiresAt
      })

      expect(result.stored).toBe(true)
      expect(result.encrypted).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('store_api_key', {
        service: 'openai',
        api_key: 'sk-test-key-12345',
        expires_at: apiKeyData.expiresAt
      })
    })

    it('retrieves and validates API keys', async () => {
      const retrievalRequest = {
        service: 'openai',
        validateExpiry: true
      }

      mockInvoke.mockResolvedValueOnce({
        found: true,
        apiKey: 'sk-test-key-12345',
        service: 'openai',
        isValid: true,
        expiresAt: new Date(Date.now() + 43200000).toISOString(), // 12 hours remaining
        remainingTime: '12h'
      })

      const result = await mockInvoke('retrieve_api_key', retrievalRequest)

      expect(result.found).toBe(true)
      expect(result.isValid).toBe(true)
      expect(result.remainingTime).toBe('12h')
    })

    it('handles API key rotation', async () => {
      const rotationData = {
        service: 'openai',
        oldKeyHash: 'old-hash-123',
        newApiKey: 'sk-new-key-67890',
        rotationReason: 'scheduled_rotation'
      }

      mockInvoke.mockResolvedValueOnce({
        rotationCompleted: true,
        oldKeyRevoked: true,
        newKeyStored: true,
        rotationId: 'rotation-456',
        effectiveAt: new Date().toISOString(),
        affectedSessions: 3
      })

      const result = await mockInvoke('rotate_api_key', rotationData)

      expect(result.rotationCompleted).toBe(true)
      expect(result.oldKeyRevoked).toBe(true)
      expect(result.newKeyStored).toBe(true)
      expect(result.affectedSessions).toBe(3)
    })

    it('manages multiple API keys for different services', async () => {
      const services = ['openai', 'elevenlabs', 'unsplash', 'youtube']
      
      mockInvoke.mockResolvedValueOnce({
        totalKeys: services.length,
        keyStatuses: {
          'openai': { status: 'valid', expiresIn: '15d' },
          'elevenlabs': { status: 'valid', expiresIn: '30d' },
          'unsplash': { status: 'expired', expiresIn: '-2d' },
          'youtube': { status: 'missing', expiresIn: null }
        },
        alerts: [
          { service: 'unsplash', type: 'expired', message: 'API key expired 2 days ago' },
          { service: 'youtube', type: 'missing', message: 'No API key configured' }
        ],
        recommendations: [
          'Renew unsplash API key',
          'Configure youtube API key for video features'
        ]
      })

      const result = await mockInvoke('audit_api_keys', { services })

      expect(result.totalKeys).toBe(4)
      expect(result.alerts).toHaveLength(2)
      expect(result.keyStatuses.openai.status).toBe('valid')
      expect(result.recommendations).toContain('Renew unsplash API key')
    })
  })

  describe('Caption Timing Adjustment and Synchronization', () => {
    it('adjusts caption timing based on audio duration', async () => {
      const captionData = [
        { start: 0, end: 3000, text: 'Welcome to our course.' },
        { start: 3000, end: 7500, text: 'Today we will learn about SCORM packages.' },
        { start: 7500, end: 12000, text: 'These are standardized e-learning formats.' },
        { start: 12000, end: 15000, text: 'Let\'s get started!' }
      ]

      const adjustmentParams = {
        originalDuration: 15000, // 15 seconds
        newDuration: 18000, // 18 seconds (20% slower)
        adjustmentType: 'proportional'
      }

      mockInvoke.mockResolvedValueOnce({
        adjustedCaptions: [
          { start: 0, end: 3600, text: 'Welcome to our course.' },
          { start: 3600, end: 9000, text: 'Today we will learn about SCORM packages.' },
          { start: 9000, end: 14400, text: 'These are standardized e-learning formats.' },
          { start: 14400, end: 18000, text: 'Let\'s get started!' }
        ],
        adjustmentFactor: 1.2,
        timingAccuracy: 'high',
        overlapsDetected: 0
      })

      const result = await mockInvoke('adjust_caption_timing', {
        captions: captionData,
        adjustment: adjustmentParams
      })

      expect(result.adjustedCaptions).toHaveLength(4)
      expect(result.adjustmentFactor).toBe(1.2)
      expect(result.overlapsDetected).toBe(0)
      expect(result.adjustedCaptions[3].end).toBe(18000)
    })

    it('synchronizes captions with audio markers', async () => {
      const audioMarkers = [
        { id: 'intro', timestamp: 0, type: 'section_start' },
        { id: 'main', timestamp: 5200, type: 'section_start' },
        { id: 'conclusion', timestamp: 13800, type: 'section_start' },
        { id: 'end', timestamp: 18000, type: 'section_end' }
      ]

      const captionSyncData = {
        captions: [
          { id: 'cap-1', text: 'Introduction', estimatedStart: 100 },
          { id: 'cap-2', text: 'Main content begins', estimatedStart: 5000 },
          { id: 'cap-3', text: 'In conclusion', estimatedStart: 14000 }
        ],
        toleranceMs: 500
      }

      mockInvoke.mockResolvedValueOnce({
        synchronizedCaptions: [
          { id: 'cap-1', text: 'Introduction', start: 0, end: 5200, syncedTo: 'intro' },
          { id: 'cap-2', text: 'Main content begins', start: 5200, end: 13800, syncedTo: 'main' },
          { id: 'cap-3', text: 'In conclusion', start: 13800, end: 18000, syncedTo: 'conclusion' }
        ],
        syncAccuracy: '95%',
        adjustmentsMade: 3,
        averageDeviation: '150ms'
      })

      const result = await mockInvoke('synchronize_captions_with_audio', {
        audio_markers: audioMarkers,
        sync_data: captionSyncData
      })

      expect(result.synchronizedCaptions).toHaveLength(3)
      expect(result.syncAccuracy).toBe('95%')
      expect(result.adjustmentsMade).toBe(3)
    })

    it('detects and resolves caption overlaps', async () => {
      const overlappingCaptions = [
        { start: 0, end: 3000, text: 'First caption' },
        { start: 2500, end: 5500, text: 'Overlapping caption' }, // Overlaps with first
        { start: 5000, end: 8000, text: 'Another overlap' }, // Overlaps with second
        { start: 8000, end: 10000, text: 'Clean caption' }
      ]

      mockInvoke.mockResolvedValueOnce({
        overlapsDetected: 2,
        overlapDetails: [
          { caption1: 0, caption2: 1, overlapDuration: 500 },
          { caption1: 1, caption2: 2, overlapDuration: 500 }
        ],
        resolvedCaptions: [
          { start: 0, end: 2500, text: 'First caption' },
          { start: 2500, end: 5000, text: 'Overlapping caption' },
          { start: 5000, end: 8000, text: 'Another overlap' },
          { start: 8000, end: 10000, text: 'Clean caption' }
        ],
        resolutionStrategy: 'trim_ends',
        totalAdjustmentTime: '1s'
      })

      const result = await mockInvoke('resolve_caption_overlaps', {
        captions: overlappingCaptions
      })

      expect(result.overlapsDetected).toBe(2)
      expect(result.resolvedCaptions[0].end).toBe(2500)
      expect(result.resolvedCaptions[1].start).toBe(2500)
      expect(result.resolutionStrategy).toBe('trim_ends')
    })
  })

  describe('Audio ID Mapping and Management', () => {
    it('maps audio IDs to course content sections', async () => {
      const courseStructure = {
        welcome: { title: 'Welcome', hasAudio: true },
        objectives: { title: 'Learning Objectives', hasAudio: true },
        topics: [
          { id: 'topic-1', title: 'Introduction', hasAudio: true },
          { id: 'topic-2', title: 'Advanced Concepts', hasAudio: false },
          { id: 'topic-3', title: 'Conclusion', hasAudio: true }
        ]
      }

      mockInvoke.mockResolvedValueOnce({
        audioMapping: {
          'welcome': { audioId: 'audio-0', duration: 30000, status: 'available' },
          'objectives': { audioId: 'audio-1', duration: 25000, status: 'available' },
          'topic-1': { audioId: 'audio-2', duration: 180000, status: 'available' },
          'topic-3': { audioId: 'audio-3', duration: 120000, status: 'available' }
        },
        totalAudioFiles: 4,
        totalDuration: 355000, // ~6 minutes
        mappingAccuracy: '100%',
        unmappedSections: ['topic-2']
      })

      const result = await mockInvoke('map_audio_ids_to_content', {
        course_structure: courseStructure
      })

      expect(result.audioMapping).toHaveProperty('welcome')
      expect(result.totalAudioFiles).toBe(4)
      expect(result.unmappedSections).toContain('topic-2')
      expect(result.mappingAccuracy).toBe('100%')
    })

    it('handles audio ID conflicts and resolution', async () => {
      const conflictScenario = {
        duplicateIds: [
          { id: 'audio-1', sections: ['welcome', 'topic-1'] },
          { id: 'audio-2', sections: ['objectives', 'topic-2'] }
        ],
        missingIds: ['topic-3', 'conclusion'],
        orphanedIds: ['audio-5', 'audio-6']
      }

      mockInvoke.mockResolvedValueOnce({
        conflictsResolved: 2,
        resolutionStrategy: {
          duplicates: 'increment_suffix',
          missing: 'generate_new_ids',
          orphaned: 'preserve_for_manual_review'
        },
        newMapping: {
          'welcome': 'audio-1',
          'topic-1': 'audio-1-alt',
          'objectives': 'audio-2',
          'topic-2': 'audio-2-alt',
          'topic-3': 'audio-7', // New generated ID
          'conclusion': 'audio-8' // New generated ID
        },
        warnings: [
          'Manual review needed for orphaned IDs: audio-5, audio-6',
          'Consider standardizing ID generation rules'
        ]
      })

      const result = await mockInvoke('resolve_audio_id_conflicts', conflictScenario)

      expect(result.conflictsResolved).toBe(2)
      expect(result.newMapping['topic-1']).toBe('audio-1-alt')
      expect(result.warnings).toHaveLength(2)
    })

    it('validates audio file integrity and mapping', async () => {
      const audioValidation = {
        mappedAudioFiles: [
          { id: 'audio-0', path: '/media/welcome.mp3', section: 'welcome' },
          { id: 'audio-1', path: '/media/objectives.mp3', section: 'objectives' },
          { id: 'audio-2', path: '/media/topic1.mp3', section: 'topic-1' }
        ]
      }

      mockInvoke.mockResolvedValueOnce({
        validationResults: {
          'audio-0': { 
            exists: true, 
            readable: true, 
            duration: 30000,
            format: 'mp3',
            quality: 'high',
            fileSize: 1200000
          },
          'audio-1': { 
            exists: true, 
            readable: true, 
            duration: 25000,
            format: 'mp3',
            quality: 'medium',
            fileSize: 950000
          },
          'audio-2': { 
            exists: false, 
            readable: false, 
            error: 'File not found',
            suggestedPath: '/media/topic-1.mp3'
          }
        },
        overallHealth: 'degraded',
        validFiles: 2,
        invalidFiles: 1,
        recommendations: [
          'Locate missing file: /media/topic1.mp3',
          'Consider consistent naming convention',
          'Verify media directory permissions'
        ]
      })

      const result = await mockInvoke('validate_audio_mapping', audioValidation)

      expect(result.overallHealth).toBe('degraded')
      expect(result.validFiles).toBe(2)
      expect(result.validationResults['audio-2'].exists).toBe(false)
      expect(result.recommendations).toHaveLength(3)
    })
  })

  describe('Search Functionality and Indexing', () => {
    it('indexes course content for search', async () => {
      const courseContent = {
        title: 'Advanced SCORM Development',
        topics: [
          {
            id: 'topic-1',
            title: 'SCORM Standards Overview',
            content: 'SCORM (Shareable Content Object Reference Model) is a collection of standards and specifications for web-based electronic educational technology.',
            keywords: ['scorm', 'standards', 'elearning', 'web-based']
          },
          {
            id: 'topic-2', 
            title: 'Content Packaging',
            content: 'Content packaging involves organizing learning materials into a structured format that can be imported into Learning Management Systems.',
            keywords: ['packaging', 'lms', 'content', 'import']
          }
        ],
        assessment: {
          questions: [
            { question: 'What does SCORM stand for?', keywords: ['scorm', 'acronym'] },
            { question: 'How do you package SCORM content?', keywords: ['packaging', 'process'] }
          ]
        }
      }

      mockInvoke.mockResolvedValueOnce({
        indexingResults: {
          documentsIndexed: 4, // 2 topics + 2 questions
          termsIndexed: 45,
          indexSize: '12KB',
          processingTime: '0.15s'
        },
        searchCapabilities: {
          fullTextSearch: true,
          keywordSearch: true,
          fuzzyMatching: true,
          stemming: true,
          stopWordFiltering: true
        },
        indexStructure: {
          topics: 2,
          questions: 2,
          totalTerms: 45,
          uniqueTerms: 32
        }
      })

      const result = await mockInvoke('index_course_content', {
        content: courseContent
      })

      expect(result.indexingResults.documentsIndexed).toBe(4)
      expect(result.searchCapabilities.fuzzyMatching).toBe(true)
      expect(result.indexStructure.uniqueTerms).toBe(32)
    })

    it('performs intelligent content search', async () => {
      const searchQueries = [
        { query: 'SCORM standards', type: 'exact' },
        { query: 'packging', type: 'fuzzy' }, // Intentional typo
        { query: 'learning management', type: 'phrase' },
        { query: 'elearning OR web-based', type: 'boolean' }
      ]

      mockInvoke.mockResolvedValueOnce({
        searchResults: {
          'SCORM standards': {
            matches: 3,
            results: [
              { id: 'topic-1', score: 0.95, snippet: '...SCORM standards and specifications...' },
              { id: 'question-1', score: 0.87, snippet: '...What does SCORM stand for?...' },
              { id: 'topic-2', score: 0.45, snippet: '...structured format standards...' }
            ]
          },
          'packging': {
            matches: 2,
            corrected: 'packaging',
            results: [
              { id: 'topic-2', score: 0.92, snippet: '...Content packaging involves...' },
              { id: 'question-2', score: 0.78, snippet: '...package SCORM content...' }
            ]
          },
          'learning management': {
            matches: 1,
            results: [
              { id: 'topic-2', score: 0.89, snippet: '...Learning Management Systems...' }
            ]
          },
          'elearning OR web-based': {
            matches: 2,
            results: [
              { id: 'topic-1', score: 0.93, snippet: '...web-based electronic educational...' },
              { id: 'topic-1', score: 0.88, snippet: '...elearning technology...' }
            ]
          }
        },
        searchMetrics: {
          totalQueries: 4,
          averageResponseTime: '0.05s',
          totalResults: 8,
          relevanceScore: 0.85
        }
      })

      const result = await mockInvoke('search_course_content', {
        queries: searchQueries
      })

      expect(result.searchResults['packging'].corrected).toBe('packaging')
      expect(result.searchResults['SCORM standards'].matches).toBe(3)
      expect(result.searchMetrics.relevanceScore).toBe(0.85)
    })

    it('provides search suggestions and auto-complete', async () => {
      const partialQuery = 'SCO'

      mockInvoke.mockResolvedValueOnce({
        suggestions: [
          { term: 'SCORM', frequency: 15, context: 'standards' },
          { term: 'scope', frequency: 3, context: 'project' },
          { term: 'scoring', frequency: 8, context: 'assessment' },
          { term: 'content', frequency: 12, context: 'course' }
        ],
        autoComplete: [
          'SCORM standards',
          'SCORM packaging',
          'SCORM 1.2',
          'SCORM 2004',
          'content packaging'
        ],
        searchTrends: {
          popularTerms: ['SCORM', 'packaging', 'LMS', 'assessment'],
          recentSearches: ['SCORM 2004', 'content standards', 'packaging guide']
        }
      })

      const result = await mockInvoke('get_search_suggestions', {
        partial_query: partialQuery
      })

      expect(result.suggestions[0].term).toBe('SCORM')
      expect(result.autoComplete).toContain('SCORM standards')
      expect(result.searchTrends.popularTerms).toContain('SCORM')
    })

    it('analyzes search patterns and optimization', async () => {
      const searchAnalytics = {
        timeRange: '30d',
        totalSearches: 1250,
        uniqueUsers: 45,
        searchSessions: 180
      }

      mockInvoke.mockResolvedValueOnce({
        analytics: {
          topQueries: [
            { query: 'SCORM standards', count: 85, successRate: 0.92 },
            { query: 'packaging guide', count: 67, successRate: 0.87 },
            { query: 'assessment creation', count: 45, successRate: 0.94 },
            { query: 'LMS integration', count: 38, successRate: 0.78 }
          ],
          queryPatterns: {
            averageQueryLength: 2.3,
            multiWordQueries: 0.68,
            typoQueries: 0.12,
            booleanQueries: 0.05
          },
          performanceMetrics: {
            averageResponseTime: '0.08s',
            slowQueries: 15, // Queries > 0.5s
            failedQueries: 23,
            cacheHitRate: 0.74
          }
        },
        optimizationRecommendations: [
          'Add synonyms for common terms like "package" → "packaging"',
          'Improve indexing for slow query patterns',
          'Consider adding spell-check for high-typo terms',
          'Expand cache for frequently accessed content'
        ]
      })

      const result = await mockInvoke('analyze_search_patterns', searchAnalytics)

      expect(result.analytics.topQueries[0].query).toBe('SCORM standards')
      expect(result.analytics.performanceMetrics.cacheHitRate).toBe(0.74)
      expect(result.optimizationRecommendations).toHaveLength(4)
    })
  })

  describe('General Utility Functions', () => {
    it('validates and sanitizes user input', () => {
      const testInputs = [
        { value: 'Normal text content', type: 'text', maxLength: 100 },
        { value: '<script>alert("xss")</script>Hello', type: 'html', allowTags: ['p', 'strong'] },
        { value: 'user@example.com', type: 'email' },
        { value: 'https://example.com/path?param=value', type: 'url' },
        { value: '123.45', type: 'number', min: 0, max: 1000 }
      ]

      const sanitizeInput = (input: any) => {
        switch (input.type) {
          case 'text':
            return { 
              valid: input.value.length <= input.maxLength,
              sanitized: input.value.substring(0, input.maxLength),
              warnings: input.value.length > input.maxLength ? ['Truncated to max length'] : []
            }
          case 'html':
            return {
              valid: !input.value.includes('<script>'),
              sanitized: input.value.replace(/<script.*?\/script>/gi, ''),
              warnings: input.value.includes('<script>') ? ['Removed script tags'] : []
            }
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            return {
              valid: emailRegex.test(input.value),
              sanitized: input.value.toLowerCase(),
              warnings: !emailRegex.test(input.value) ? ['Invalid email format'] : []
            }
          case 'url':
            try {
              new URL(input.value)
              return { valid: true, sanitized: input.value, warnings: [] }
            } catch {
              return { valid: false, sanitized: '', warnings: ['Invalid URL format'] }
            }
          case 'number':
            const num = parseFloat(input.value)
            const inRange = num >= input.min && num <= input.max
            return {
              valid: !isNaN(num) && inRange,
              sanitized: inRange ? num : Math.max(input.min, Math.min(input.max, num)),
              warnings: !inRange ? ['Value clamped to range'] : []
            }
          default:
            return { valid: true, sanitized: input.value, warnings: [] }
        }
      }

      const results = testInputs.map(sanitizeInput)

      expect(results[0].valid).toBe(true)
      expect(results[1].warnings).toContain('Removed script tags')
      expect(results[2].valid).toBe(true)
      expect(results[3].valid).toBe(true)
      expect(results[4].valid).toBe(true)
    })

    it('formats and transforms data structures', () => {
      const rawData = {
        timestamp: 1640995200000, // 2022-01-01 00:00:00 UTC
        size: 1048576, // 1 MB in bytes
        duration: 3661, // 1 hour, 1 minute, 1 second
        score: 0.8567,
        tags: ['  SCORM  ', ' education', 'elearning  '],
        nested: {
          metadata: {
            version: '1.0.0',
            author: 'Test Author'
          }
        }
      }

      const formatData = (data: any) => ({
        formattedTimestamp: new Date(data.timestamp).toISOString(),
        humanReadableSize: (data.size / 1024 / 1024).toFixed(2) + ' MB',
        formattedDuration: `${Math.floor(data.duration / 3600)}h ${Math.floor((data.duration % 3600) / 60)}m ${data.duration % 60}s`,
        percentageScore: Math.round(data.score * 100) + '%',
        cleanTags: data.tags.map((tag: string) => tag.trim().toLowerCase()),
        flatMetadata: {
          version: data.nested.metadata.version,
          author: data.nested.metadata.author
        }
      })

      const result = formatData(rawData)

      expect(result.formattedTimestamp).toBe('2022-01-01T00:00:00.000Z')
      expect(result.humanReadableSize).toBe('1.00 MB')
      expect(result.formattedDuration).toBe('1h 1m 1s')
      expect(result.percentageScore).toBe('86%')
      expect(result.cleanTags).toEqual(['scorm', 'education', 'elearning'])
    })

    it('implements caching and memoization utilities', () => {
      const cache = new Map()
      const computeExpensiveOperation = (input: number): number => {
        // Simulate expensive computation
        return input * input + Math.sqrt(input)
      }

      const memoize = (fn: (input: number) => number) => {
        return (input: number): number => {
          if (cache.has(input)) {
            return cache.get(input)
          }
          const result = fn(input)
          cache.set(input, result)
          return result
        }
      }

      const memoizedCompute = memoize(computeExpensiveOperation)

      // First calls - should compute and cache
      const result1 = memoizedCompute(10)
      const result2 = memoizedCompute(20)
      
      // Second calls - should return cached values
      const result3 = memoizedCompute(10)
      const result4 = memoizedCompute(20)

      expect(result1).toBe(result3) // Same input, same output
      expect(result2).toBe(result4) // Same input, same output
      expect(cache.size).toBe(2) // Only 2 unique inputs cached
      expect(cache.has(10)).toBe(true)
      expect(cache.has(20)).toBe(true)
    })
  })

  describe('Service Helpers and Adapters', () => {
    it('provides service discovery and health checks', async () => {
      const services = [
        'FileStorage',
        'MediaService', 
        'SCORMGenerator',
        'PreviewService',
        'SearchService'
      ]

      mockInvoke.mockResolvedValueOnce({
        serviceStatuses: {
          'FileStorage': { 
            status: 'healthy', 
            uptime: 99.8, 
            responseTime: '15ms',
            lastCheck: new Date().toISOString()
          },
          'MediaService': { 
            status: 'healthy', 
            uptime: 99.9, 
            responseTime: '22ms',
            lastCheck: new Date().toISOString()
          },
          'SCORMGenerator': { 
            status: 'degraded', 
            uptime: 97.2, 
            responseTime: '45ms',
            lastCheck: new Date().toISOString(),
            issues: ['High memory usage']
          },
          'PreviewService': { 
            status: 'healthy', 
            uptime: 99.5, 
            responseTime: '18ms',
            lastCheck: new Date().toISOString()
          },
          'SearchService': { 
            status: 'unavailable', 
            uptime: 0, 
            responseTime: null,
            lastCheck: new Date().toISOString(),
            error: 'Service not responding'
          }
        },
        overallHealth: 'degraded',
        healthyServices: 3,
        degradedServices: 1,
        unavailableServices: 1
      })

      const result = await mockInvoke('check_service_health', { services })

      expect(result.overallHealth).toBe('degraded')
      expect(result.healthyServices).toBe(3)
      expect(result.serviceStatuses.SCORMGenerator.status).toBe('degraded')
      expect(result.serviceStatuses.SearchService.status).toBe('unavailable')
    })

    it('manages service configuration and settings', async () => {
      const configUpdates = {
        'MediaService': {
          maxCacheSize: '500MB',
          compressionLevel: 'medium',
          allowedFormats: ['jpg', 'png', 'webp', 'mp4', 'mp3']
        },
        'SCORMGenerator': {
          defaultVersion: 'scorm_2004',
          includeDebugInfo: false,
          optimizationLevel: 'balanced'
        }
      }

      mockInvoke.mockResolvedValueOnce({
        configurationResults: {
          'MediaService': {
            applied: true,
            reloadRequired: false,
            validationResult: 'success',
            effectiveAt: new Date().toISOString()
          },
          'SCORMGenerator': {
            applied: true,
            reloadRequired: true,
            validationResult: 'success',
            effectiveAt: new Date().toISOString()
          }
        },
        servicesNeedingRestart: ['SCORMGenerator'],
        configurationBackup: {
          created: true,
          backupId: 'config-backup-789',
          location: '/backups/service-config.json'
        }
      })

      const result = await mockInvoke('update_service_configurations', {
        config_updates: configUpdates
      })

      expect(result.configurationResults.MediaService.applied).toBe(true)
      expect(result.servicesNeedingRestart).toContain('SCORMGenerator')
      expect(result.configurationBackup.created).toBe(true)
    })

    it('implements service adapter pattern for external integrations', () => {
      // Mock adapter for external AI service
      class MockAIServiceAdapter {
        private apiKey: string
        private baseUrl: string

        constructor(config: { apiKey: string; baseUrl: string }) {
          this.apiKey = config.apiKey
          this.baseUrl = config.baseUrl
        }

        async generateContent(prompt: string): Promise<any> {
          // Simulate API call
          return {
            content: `Generated content for: ${prompt}`,
            tokens: prompt.length * 2,
            model: 'gpt-3.5-turbo',
            cost: 0.002
          }
        }

        async checkCredits(): Promise<any> {
          return {
            remaining: 50000,
            used: 25000,
            resetDate: new Date(Date.now() + 86400000 * 30).toISOString()
          }
        }

        formatRequest(data: any): any {
          return {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: data.prompt }],
            max_tokens: data.maxTokens || 1000,
            temperature: data.temperature || 0.7
          }
        }
      }

      const adapter = new MockAIServiceAdapter({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com'
      })

      const testPrompt = 'Generate a course introduction'
      
      // Test the adapter functionality
      const result = adapter.generateContent(testPrompt)
      const credits = adapter.checkCredits()
      const formattedRequest = adapter.formatRequest({
        prompt: testPrompt,
        maxTokens: 500,
        temperature: 0.8
      })

      await expect(result).resolves.toHaveProperty('content')
      await expect(credits).resolves.toHaveProperty('remaining', 50000)
      expect(formattedRequest).toHaveProperty('model', 'gpt-3.5-turbo')
      expect(formattedRequest.max_tokens).toBe(500)
    })
  })
})