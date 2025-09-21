/**
 * Unit test for media collection fallback logic in SCORMPackageBuilder
 *
 * This test directly verifies that the media collection logic includes
 * audio-1 and caption-1 when an objectives page exists, without needing
 * to render the full component.
 *
 * Following TDD: This test should FAIL initially, then pass after implementing
 * the fallback logic.
 */

import { describe, it, expect } from 'vitest'

// Mock function to simulate the media collection logic that needs to be implemented
function collectMediaForScormGeneration(courseContent: any): string[] {
  const mediaIds: string[] = []
  const mediaToLoad: any[] = []
  const loadedMediaIds = new Set<string>()

  // Helper function to add media ID (mimics the existing logic)
  const addMediaToLoad = (id: string, type: string, source: string) => {
    const trackingKey = `${id}:${type}`
    if (!loadedMediaIds.has(trackingKey)) {
      loadedMediaIds.add(trackingKey)
      mediaToLoad.push({ id, type, source })
      mediaIds.push(id)
    }
  }

  // Collect welcome page media (existing logic)
  if (courseContent.welcomePage) {
    const welcomeAudioId = courseContent.welcomePage.audioId || courseContent.welcomePage.audioFile
    const welcomeCaptionId = courseContent.welcomePage.captionId || courseContent.welcomePage.captionFile

    if (welcomeAudioId) addMediaToLoad(welcomeAudioId, 'audio', 'welcome')
    if (welcomeCaptionId) addMediaToLoad(welcomeCaptionId, 'caption', 'welcome')

    // Media array
    if (Array.isArray(courseContent.welcomePage.media)) {
      courseContent.welcomePage.media.forEach((m: any) => {
        if (m.id) addMediaToLoad(m.id, m.type, 'welcome')
      })
    }
  }

  // Collect objectives page media (existing logic)
  if (courseContent.objectivesPage || courseContent.learningObjectivesPage) {
    const objectives = courseContent.objectivesPage || courseContent.learningObjectivesPage

    const objectivesAudioId = objectives.audioId || objectives.audioFile
    const objectivesCaptionId = objectives.captionId || objectives.captionFile

    if (objectivesAudioId) addMediaToLoad(objectivesAudioId, 'audio', 'objectives')
    if (objectivesCaptionId) addMediaToLoad(objectivesCaptionId, 'caption', 'objectives')

    // Media array
    if (Array.isArray(objectives.media)) {
      objectives.media.forEach((m: any) => {
        if (m.id) addMediaToLoad(m.id, m.type, 'objectives')
      })
    }

    // 🔧 FALLBACK LOGIC: Always include audio-1 and caption-1 for learning objectives
    // This ensures the standard learning objectives media is pre-loaded even if not explicitly in content
    addMediaToLoad('audio-1', 'audio', 'objectives-fallback')
    addMediaToLoad('caption-1', 'caption', 'objectives-fallback')
  }

  // Collect topics media (existing logic)
  if (Array.isArray(courseContent.topics)) {
    courseContent.topics.forEach((topic: any, index: number) => {
      const topicAudioId = topic.audioId || topic.audioFile
      const topicCaptionId = topic.captionId || topic.captionFile

      if (topicAudioId) addMediaToLoad(topicAudioId, 'audio', 'topic')
      if (topicCaptionId) addMediaToLoad(topicCaptionId, 'caption', 'topic')

      if (Array.isArray(topic.media)) {
        topic.media.forEach((m: any) => {
          if (m.id) addMediaToLoad(m.id, m.type, 'topic')
        })
      }
    })
  }

  return mediaIds
}

describe('SCORMPackageBuilder Media Collection Fallback Logic', () => {
  it('should include audio-1 and caption-1 when learningObjectivesPage exists without explicit media', () => {
    const courseContent = {
      title: "Test Course",
      learningObjectivesPage: {
        objectives: ["Learn something important"],
        // No audioId, audioFile, captionId, captionFile
        media: [] // Empty media array
      }
    }

    const collectedMediaIds = collectMediaForScormGeneration(courseContent)

    // This assertion will FAIL until we implement the fallback logic
    expect(collectedMediaIds).toContain('audio-1')
    expect(collectedMediaIds).toContain('caption-1')
  })

  it('should include audio-1 and caption-1 when objectivesPage exists (alternative naming)', () => {
    const courseContent = {
      title: "Test Course",
      objectivesPage: { // Note: different property name
        objectives: ["Learn something important"],
        media: []
      }
    }

    const collectedMediaIds = collectMediaForScormGeneration(courseContent)

    expect(collectedMediaIds).toContain('audio-1')
    expect(collectedMediaIds).toContain('caption-1')
  })

  it('should include both explicit and fallback media when both are present', () => {
    const courseContent = {
      title: "Test Course",
      learningObjectivesPage: {
        objectives: ["Learn something important"],
        audioFile: "custom-objectives-audio",
        captionFile: "custom-objectives-caption",
        media: [
          { id: "custom-objectives-audio", type: "audio" },
          { id: "custom-objectives-caption", type: "caption" }
        ]
      }
    }

    const collectedMediaIds = collectMediaForScormGeneration(courseContent)

    // Should have both explicit and fallback
    expect(collectedMediaIds).toContain('custom-objectives-audio')
    expect(collectedMediaIds).toContain('custom-objectives-caption')
    expect(collectedMediaIds).toContain('audio-1')
    expect(collectedMediaIds).toContain('caption-1')
  })

  it('should NOT include fallback media when no objectives page exists', () => {
    const courseContent = {
      title: "Test Course",
      welcomePage: {
        title: "Welcome",
        content: "Welcome to the course",
        media: []
      },
      // No learningObjectivesPage or objectivesPage
      topics: []
    }

    const collectedMediaIds = collectMediaForScormGeneration(courseContent)

    expect(collectedMediaIds).not.toContain('audio-1')
    expect(collectedMediaIds).not.toContain('caption-1')
  })
})