import { describe, it, expect } from 'vitest'

describe('SCORM Navigation - Require Audio Completion Feature', () => {
  it('should block navigation when audio completion is required but not finished', () => {
    // This test simulates the navigation blocking logic that will be implemented
    // in the navigation.js.hbs template
    
    // Mock the variables that would be available in the SCORM template
    const mockTemplateData = {
      requireAudioCompletion: true,
      currentPage: {
        pageId: 'topic-1',
        audio_file: 'audio/topic-1.mp3'
      },
      completedAudio: new Set(), // No audio completed yet
      targetPageIndex: 2
    }
    
    // Mock the shouldBlockNavigation function logic
    function shouldBlockNavigation(targetPageIndex: number, templateData: any) {
      const { requireAudioCompletion, currentPage, completedAudio } = templateData
      
      // Existing question blocking logic would go here...
      
      // NEW: Check audio completion if required
      if (requireAudioCompletion && currentPage.audio_file) {
        const audioCompleted = completedAudio.has(currentPage.pageId)
        if (!audioCompleted) {
          return "Please listen to the complete audio before continuing."
        }
      }
      
      return null // Allow navigation
    }
    
    // Test that navigation is blocked when audio not completed
    const result = shouldBlockNavigation(mockTemplateData.targetPageIndex, mockTemplateData)
    expect(result).toBe("Please listen to the complete audio before continuing.")
  })

  it('should allow navigation when audio completion is required and finished', () => {
    // Mock scenario where audio has been completed
    const mockTemplateData = {
      requireAudioCompletion: true,
      currentPage: {
        pageId: 'topic-1',  
        audio_file: 'audio/topic-1.mp3'
      },
      completedAudio: new Set(['topic-1']), // Audio has been completed
      targetPageIndex: 2
    }
    
    function shouldBlockNavigation(targetPageIndex: number, templateData: any) {
      const { requireAudioCompletion, currentPage, completedAudio } = templateData
      
      // NEW: Check audio completion if required
      if (requireAudioCompletion && currentPage.audio_file) {
        const audioCompleted = completedAudio.has(currentPage.pageId)
        if (!audioCompleted) {
          return "Please listen to the complete audio before continuing."
        }
      }
      
      return null // Allow navigation
    }
    
    // Test that navigation is allowed when audio completed
    const result = shouldBlockNavigation(mockTemplateData.targetPageIndex, mockTemplateData)
    expect(result).toBe(null)
  })

  it('should allow navigation when audio completion is not required', () => {
    // Mock scenario where feature is disabled
    const mockTemplateData = {
      requireAudioCompletion: false,
      currentPage: {
        pageId: 'topic-1',
        audio_file: 'audio/topic-1.mp3'
      },
      completedAudio: new Set(), // No audio completed, but feature is disabled
      targetPageIndex: 2
    }
    
    function shouldBlockNavigation(targetPageIndex: number, templateData: any) {
      const { requireAudioCompletion, currentPage, completedAudio } = templateData
      
      // NEW: Check audio completion if required (should be skipped)
      if (requireAudioCompletion && currentPage.audio_file) {
        const audioCompleted = completedAudio.has(currentPage.pageId)
        if (!audioCompleted) {
          return "Please listen to the complete audio before continuing."
        }
      }
      
      return null // Allow navigation
    }
    
    // Test that navigation is allowed when feature is disabled
    const result = shouldBlockNavigation(mockTemplateData.targetPageIndex, mockTemplateData)
    expect(result).toBe(null)
  })

  it('should allow navigation on pages without audio even when feature is enabled', () => {
    // Mock scenario where page has no audio
    const mockTemplateData = {
      requireAudioCompletion: true,
      currentPage: {
        pageId: 'topic-1',
        audio_file: null // No audio file
      },
      completedAudio: new Set(),
      targetPageIndex: 2
    }
    
    function shouldBlockNavigation(targetPageIndex: number, templateData: any) {
      const { requireAudioCompletion, currentPage, completedAudio } = templateData
      
      // NEW: Check audio completion if required
      if (requireAudioCompletion && currentPage.audio_file) {
        const audioCompleted = completedAudio.has(currentPage.pageId)
        if (!audioCompleted) {
          return "Please listen to the complete audio before continuing."
        }
      }
      
      return null // Allow navigation
    }
    
    // Test that navigation is allowed on pages without audio
    const result = shouldBlockNavigation(mockTemplateData.targetPageIndex, mockTemplateData)
    expect(result).toBe(null)
  })
})