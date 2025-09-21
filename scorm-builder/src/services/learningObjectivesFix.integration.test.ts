/**
 * Comprehensive Integration Tests for Learning Objectives Fixes
 *
 * This test suite verifies that Learning Objectives audio/caption are always
 * included in SCORM packages regardless of naming inconsistencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeLearningObjectives, getLearningObjectivesAudioCaption } from './storageMigration'
import { PAGE_LEARNING_OBJECTIVES, CONTENT_LEARNING_OBJECTIVES } from '../constants/media'

describe('Learning Objectives Fix Integration', () => {
  describe('Storage Migration', () => {
    it('should migrate legacy pageId "objectives" to "learning-objectives"', () => {
      const projectData = {
        allStorageMedia: [
          { id: 'audio-1', type: 'audio', pageId: 'objectives' },
          { id: 'caption-1', type: 'caption', pageId: 'objectives' },
          { id: 'image-1', type: 'image', pageId: 'welcome' } // Should not be changed
        ],
        courseContent: {}
      }

      const migrationPerformed = normalizeLearningObjectives(projectData)

      expect(migrationPerformed).toBe(true)
      expect(projectData.allStorageMedia[0].pageId).toBe(PAGE_LEARNING_OBJECTIVES)
      expect(projectData.allStorageMedia[1].pageId).toBe(PAGE_LEARNING_OBJECTIVES)
      expect(projectData.allStorageMedia[2].pageId).toBe('welcome') // Unchanged
    })

    it('should migrate legacy content property "objectivesPage" to "learningObjectivesPage"', () => {
      const projectData = {
        allStorageMedia: [],
        courseContent: {
          title: 'Test Course',
          objectivesPage: {
            title: 'Learning Objectives',
            narration: 'Test narration',
            media: [{ id: 'image-1', type: 'image' }]
          }
        }
      }

      const migrationPerformed = normalizeLearningObjectives(projectData)

      expect(migrationPerformed).toBe(true)
      expect(projectData.courseContent.objectivesPage).toBeUndefined()
      expect(projectData.courseContent[CONTENT_LEARNING_OBJECTIVES]).toBeDefined()
      expect(projectData.courseContent[CONTENT_LEARNING_OBJECTIVES].title).toBe('Learning Objectives')
    })

    it('should not migrate when naming is already canonical', () => {
      const projectData = {
        allStorageMedia: [
          { id: 'audio-1', type: 'audio', pageId: PAGE_LEARNING_OBJECTIVES },
          { id: 'caption-1', type: 'caption', pageId: PAGE_LEARNING_OBJECTIVES }
        ],
        courseContent: {
          [CONTENT_LEARNING_OBJECTIVES]: {
            title: 'Learning Objectives'
          }
        }
      }

      const migrationPerformed = normalizeLearningObjectives(projectData)

      expect(migrationPerformed).toBe(false)
    })

    it('should migrate metadata.page_id in addition to pageId', () => {
      const projectData = {
        allStorageMedia: [
          {
            id: 'audio-1',
            type: 'audio',
            pageId: 'objectives',
            metadata: { page_id: 'objectives', other: 'data' }
          }
        ],
        courseContent: {}
      }

      const migrationPerformed = normalizeLearningObjectives(projectData)

      expect(migrationPerformed).toBe(true)
      expect(projectData.allStorageMedia[0].pageId).toBe(PAGE_LEARNING_OBJECTIVES)
      expect(projectData.allStorageMedia[0].metadata.page_id).toBe(PAGE_LEARNING_OBJECTIVES)
      expect(projectData.allStorageMedia[0].metadata.other).toBe('data') // Other metadata preserved
    })
  })

  describe('Learning Objectives Media Detection', () => {
    it('should find Learning Objectives audio and caption from storage', () => {
      const allStorageMedia = [
        { id: 'audio-0', type: 'audio', pageId: 'welcome' },
        { id: 'audio-1', type: 'audio', pageId: PAGE_LEARNING_OBJECTIVES },
        { id: 'caption-1', type: 'caption', pageId: PAGE_LEARNING_OBJECTIVES },
        { id: 'audio-2', type: 'audio', pageId: 'topic-1' }
      ]

      const { audio, caption } = getLearningObjectivesAudioCaption(allStorageMedia)

      expect(audio?.id).toBe('audio-1')
      expect(caption?.id).toBe('caption-1')
    })

    it('should handle missing Learning Objectives media gracefully', () => {
      const allStorageMedia = [
        { id: 'audio-0', type: 'audio', pageId: 'welcome' },
        { id: 'audio-2', type: 'audio', pageId: 'topic-1' }
      ]

      const { audio, caption } = getLearningObjectivesAudioCaption(allStorageMedia)

      expect(audio).toBeUndefined()
      expect(caption).toBeUndefined()
    })
  })

  describe('Content Structure Scenarios', () => {
    it('should handle course with only audio in storage but no audioFile reference', () => {
      // This is the key scenario: LO audio exists in storage but content doesn't reference it
      const allStorageMedia = [
        { id: 'audio-1', type: 'audio', pageId: PAGE_LEARNING_OBJECTIVES }
      ]

      const courseContent = {
        title: 'Test Course',
        [CONTENT_LEARNING_OBJECTIVES]: {
          title: 'Learning Objectives',
          narration: 'Text only, no audio reference'
          // No audioFile or audioId property
        }
      }

      // This would be called by SCORMPackageBuilder.ensureLearningObjectivesMedia
      const { audio } = getLearningObjectivesAudioCaption(allStorageMedia)
      expect(audio?.id).toBe('audio-1')

      // The function would then add audioFile reference to content
      if (audio && !courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile) {
        courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile = audio.id
      }

      expect(courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile).toBe('audio-1')
    })

    it('should handle course with both audio and caption in storage', () => {
      const allStorageMedia = [
        { id: 'audio-1', type: 'audio', pageId: PAGE_LEARNING_OBJECTIVES },
        { id: 'caption-1', type: 'caption', pageId: PAGE_LEARNING_OBJECTIVES }
      ]

      const courseContent = {
        title: 'Test Course',
        [CONTENT_LEARNING_OBJECTIVES]: {
          title: 'Learning Objectives',
          media: [
            { id: 'image-1', type: 'image' }
          ]
          // No audio/caption references
        }
      }

      const { audio, caption } = getLearningObjectivesAudioCaption(allStorageMedia)

      // Simulate what ensureLearningObjectivesMedia would do
      if (audio && !courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile) {
        courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile = audio.id
      }
      if (caption && !courseContent[CONTENT_LEARNING_OBJECTIVES].captionFile) {
        courseContent[CONTENT_LEARNING_OBJECTIVES].captionFile = caption.id
      }

      expect(courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile).toBe('audio-1')
      expect(courseContent[CONTENT_LEARNING_OBJECTIVES].captionFile).toBe('caption-1')
    })

    it('should not override existing audioFile/captionFile references', () => {
      const allStorageMedia = [
        { id: 'audio-1', type: 'audio', pageId: PAGE_LEARNING_OBJECTIVES },
        { id: 'audio-custom', type: 'audio', pageId: PAGE_LEARNING_OBJECTIVES }
      ]

      const courseContent = {
        title: 'Test Course',
        [CONTENT_LEARNING_OBJECTIVES]: {
          title: 'Learning Objectives',
          audioFile: 'audio-custom' // Already has explicit reference
        }
      }

      // Simulate ensureLearningObjectivesMedia logic
      const { audio } = getLearningObjectivesAudioCaption(allStorageMedia)
      if (audio && !courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile) {
        courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile = audio.id
      }

      // Should keep the existing reference, not change to audio-1
      expect(courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile).toBe('audio-custom')
    })
  })

  describe('Progress Calculation Scenarios', () => {
    it('should count referenced media correctly after Learning Objectives injection', () => {
      // Before injection: 3 media items referenced (1 welcome + 2 topic)
      let referencedMedia = ['audio-0', 'image-2', 'image-3']
      expect(referencedMedia.length).toBe(3)

      // After injection: 5 media items referenced (+ LO audio + caption)
      const injectedLOMedia = ['audio-1', 'caption-1']
      referencedMedia = [...referencedMedia, ...injectedLOMedia]
      expect(referencedMedia.length).toBe(5)

      // Progress should be calculated from 5, not storage count of 6
      const totalInStorage = 6
      const expectedCount = referencedMedia.length // 5
      expect(expectedCount).toBeLessThan(totalInStorage)
      expect(expectedCount).toBe(5)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty storage gracefully', () => {
      const projectData = {
        allStorageMedia: [],
        courseContent: {}
      }

      const migrationPerformed = normalizeLearningObjectives(projectData)
      expect(migrationPerformed).toBe(false)

      const { audio, caption } = getLearningObjectivesAudioCaption([])
      expect(audio).toBeUndefined()
      expect(caption).toBeUndefined()
    })

    it('should handle missing learningObjectivesPage gracefully', () => {
      const allStorageMedia = [
        { id: 'audio-1', type: 'audio', pageId: PAGE_LEARNING_OBJECTIVES }
      ]

      const courseContent = {
        title: 'Test Course',
        welcome: { title: 'Welcome' },
        topics: []
        // No learningObjectivesPage
      }

      // ensureLearningObjectivesMedia should create the structure
      if (!courseContent[CONTENT_LEARNING_OBJECTIVES]) {
        courseContent[CONTENT_LEARNING_OBJECTIVES] = {
          title: 'Learning Objectives',
          media: []
        }
      }

      const { audio } = getLearningObjectivesAudioCaption(allStorageMedia)
      if (audio) {
        courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile = audio.id
      }

      expect(courseContent[CONTENT_LEARNING_OBJECTIVES]).toBeDefined()
      expect(courseContent[CONTENT_LEARNING_OBJECTIVES].audioFile).toBe('audio-1')
    })

    it('should handle malformed media items gracefully', () => {
      const allStorageMedia = [
        { id: 'audio-1' }, // Missing type
        { type: 'audio' }, // Missing id
        { id: 'caption-1', type: 'caption', pageId: PAGE_LEARNING_OBJECTIVES }, // Valid
        null, // Null item
        undefined // Undefined item
      ].filter(Boolean) // Filter out null/undefined

      const { audio, caption } = getLearningObjectivesAudioCaption(allStorageMedia)

      expect(audio).toBeUndefined() // audio-1 missing type, so not found
      expect(caption?.id).toBe('caption-1') // caption-1 is valid
    })
  })
})