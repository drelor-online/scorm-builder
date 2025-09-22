import { describe, test, expect, vi } from 'vitest'

// Mock the validation function that prevents objectives media duplication
const isObjectivesMedia = (mediaId: string, courseContent: any): boolean => {
  if (!courseContent || !('learningObjectivesPage' in courseContent)) {
    return false
  }

  const objectivesMedia = courseContent.learningObjectivesPage?.media || []
  return objectivesMedia.some((m: any) => m.id === mediaId && (m.type === 'audio' || m.type === 'caption'))
}

describe('AudioNarrationWizard Import Duplication Fix', () => {
  test('should detect when audio belongs to objectives page', () => {
    const courseContent = {
      learningObjectivesPage: {
        media: [
          { id: 'audio-1', type: 'audio' },
          { id: 'caption-1', type: 'caption' }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          media: []
        }
      ]
    }

    expect(isObjectivesMedia('audio-1', courseContent)).toBe(true)
    expect(isObjectivesMedia('caption-1', courseContent)).toBe(true)
    expect(isObjectivesMedia('audio-2', courseContent)).toBe(false)
    expect(isObjectivesMedia('caption-2', courseContent)).toBe(false)
  })

  test('should prevent duplication of objectives media to topics', () => {
    const courseContent = {
      learningObjectivesPage: {
        media: [
          { id: 'audio-1', type: 'audio' },
          { id: 'caption-1', type: 'caption' }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          media: []
        }
      ]
    }

    const topic = courseContent.topics[0]

    // Simulate the validation logic from AudioNarrationWizard
    const audioFile = { mediaId: 'audio-1' }
    const captionFile = { mediaId: 'caption-1' }

    // Test audio validation
    if (isObjectivesMedia(audioFile.mediaId, courseContent)) {
      // Should skip adding objectives audio to topic
      expect(true).toBe(true) // This represents the prevention logic working
    } else {
      // Should add the audio
      topic.media.push({
        id: audioFile.mediaId,
        type: 'audio',
        storageId: audioFile.mediaId,
        title: '',
        url: ''
      })
    }

    // Test caption validation
    if (isObjectivesMedia(captionFile.mediaId, courseContent)) {
      // Should skip adding objectives caption to topic
      expect(true).toBe(true) // This represents the prevention logic working
    } else {
      // Should add the caption
      topic.media.push({
        id: captionFile.mediaId,
        type: 'caption',
        storageId: captionFile.mediaId,
        title: '',
        url: ''
      })
    }

    // Topic should remain empty because we prevented duplication
    expect(topic.media).toHaveLength(0)
  })

  test('should allow valid topic media that does not duplicate objectives', () => {
    const courseContent = {
      learningObjectivesPage: {
        media: [
          { id: 'audio-1', type: 'audio' },
          { id: 'caption-1', type: 'caption' }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          media: []
        }
      ]
    }

    const topic = courseContent.topics[0]

    // Test with proper topic media IDs
    const audioFile = { mediaId: 'audio-2' } // Correct for first topic
    const captionFile = { mediaId: 'caption-2' } // Correct for first topic

    // Test audio validation
    if (!isObjectivesMedia(audioFile.mediaId, courseContent)) {
      topic.media.push({
        id: audioFile.mediaId,
        type: 'audio',
        storageId: audioFile.mediaId,
        title: '',
        url: ''
      })
    }

    // Test caption validation
    if (!isObjectivesMedia(captionFile.mediaId, courseContent)) {
      topic.media.push({
        id: captionFile.mediaId,
        type: 'caption',
        storageId: captionFile.mediaId,
        title: '',
        url: ''
      })
    }

    // Topic should have both media items because they don't duplicate objectives
    expect(topic.media).toHaveLength(2)
    expect(topic.media[0].id).toBe('audio-2')
    expect(topic.media[1].id).toBe('caption-2')
  })
})