import { describe, it, expect } from 'vitest'
import { generateEnhancedNavigationJs } from '../spaceEfficientScormGeneratorNavigation'

describe('spaceEfficientScormGeneratorNavigation', () => {
  describe('generateEnhancedNavigationJs', () => {
    it('should generate JavaScript code as a string', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(typeof js).toBe('string')
      expect(js.length).toBeGreaterThan(0)
    })

    it('should include core navigation variables', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('let currentPage')
      expect(js).toContain('let completedPages')
      expect(js).toContain('let courseStructure')
      expect(js).toContain('let audioPlayers')
    })

    it('should include navigation functions', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('function loadPage(')
      expect(js).toContain('function initializeCourse(')
      expect(js).toContain('function updateProgress(')
      expect(js).toContain('completedPages.add(')
    })

    it('should include SCORM integration', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('scormAPI')
      expect(js).toContain('LMSInitialize')
      expect(js).toContain('LMSSetValue')
      expect(js).toContain('cmi.core.lesson_status')
    })

    it('should handle audio player functionality', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('toggleAudio')
      expect(js).toContain('changeSpeed')
      expect(js).toContain('toggleCaptions')
      expect(js).toContain('skip')
      expect(js).toContain('playbackSpeeds')
    })

    it('should include navigation UI updates', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('nav-item')
      expect(js).toContain('classList')
      expect(js).toContain('active')
      expect(js).toContain('completed')
    })

    it('should handle time formatting', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('formatTime')
      expect(js).toContain('Math.floor')
      expect(js).toContain(':')
    })

    it('should include caption handling', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('captionDisplay')
      expect(js).toContain('toggleCaptions')
      expect(js).toContain('cc-btn')
    })

    it('should handle progress tracking', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('progress-fill')
      expect(js).toContain('updateProgress')
      expect(js).toContain('completedPages.size')
    })

    it('should include audio progress tracking', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('timeupdate')
      expect(js).toContain('currentTime')
      expect(js).toContain('duration')
      expect(js).toContain('updateAudioProgress')
    })
  })
})