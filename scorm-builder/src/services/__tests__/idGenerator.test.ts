import { describe, it, expect } from 'vitest'
import { generateContentId, generateMediaId, parseContentId, parseMediaId } from '../idGenerator'

describe('ID Generator', () => {
  describe('generateContentId', () => {
    it('should generate numeric IDs for pages', () => {
      expect(generateContentId('welcome')).toBe('content-0')
      expect(generateContentId('objectives')).toBe('content-1')
      expect(generateContentId('topic', 0)).toBe('content-2')
      expect(generateContentId('topic', 1)).toBe('content-3')
      expect(generateContentId('topic', 2)).toBe('content-4')
    })

    it('should handle knowledge check and summary pages', () => {
      expect(generateContentId('knowledgeCheck')).toBe('content-kc')
      expect(generateContentId('summary')).toBe('content-summary')
    })
  })

  describe('generateMediaId', () => {
    it('should generate numeric IDs for media', () => {
      expect(generateMediaId('audio', 0)).toBe('audio-0')
      expect(generateMediaId('audio', 1)).toBe('audio-1')
      expect(generateMediaId('caption', 0)).toBe('caption-0')
      expect(generateMediaId('image', 0)).toBe('image-0')
    })

    it('should handle topic media IDs', () => {
      expect(generateMediaId('audio', 2)).toBe('audio-2') // First topic
      expect(generateMediaId('audio', 3)).toBe('audio-3') // Second topic
    })
  })

  describe('parseContentId', () => {
    it('should parse content IDs correctly', () => {
      expect(parseContentId('content-0')).toEqual({ type: 'page', index: 0 })
      expect(parseContentId('content-1')).toEqual({ type: 'page', index: 1 })
      expect(parseContentId('content-2')).toEqual({ type: 'topic', index: 0 })
      expect(parseContentId('content-3')).toEqual({ type: 'topic', index: 1 })
    })
  })

  describe('parseMediaId', () => {
    it('should parse media IDs correctly', () => {
      expect(parseMediaId('audio-0')).toEqual({ type: 'audio', index: 0 })
      expect(parseMediaId('caption-1')).toEqual({ type: 'caption', index: 1 })
      expect(parseMediaId('image-2')).toEqual({ type: 'image', index: 2 })
    })
  })
})