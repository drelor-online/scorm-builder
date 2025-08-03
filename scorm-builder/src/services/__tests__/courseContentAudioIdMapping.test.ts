import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import type { CourseContent } from '../../types/aiPrompt'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('CourseContent audioId mapping on project load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add audioId properties to courseContent based on MediaStore contents', async () => {
    // This is what courseContent looks like when saved (has audioId)
    const savedCourseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<h1>Welcome</h1>',
        narration: 'Welcome narration',
        audioId: 'audio-0',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<h2>Objectives</h2>',
        narration: 'Objectives narration',
        audioId: 'audio-1',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-0',
        title: 'Safety Basics',
        content: '<p>Safety content</p>',
        narration: 'Safety narration',
        audioId: 'audio-2',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    // Mock what comes from storage (potentially missing audioId)
    const loadedCourseContent = {
      ...savedCourseContent,
      welcomePage: { ...savedCourseContent.welcomePage, audioId: undefined },
      learningObjectivesPage: { ...savedCourseContent.learningObjectivesPage, audioId: undefined },
      topics: [{ ...savedCourseContent.topics[0], audioId: undefined }]
    }

    // Mock MediaStore having the audio files
    vi.mocked(invoke).mockImplementation(async (command: string, args: any) => {
      if (command === 'get_all_project_media') {
        return [
          {
            id: 'audio-0',
            metadata: { page_id: 'welcome', type: 'audio', original_name: 'audio-0.mp3' }
          },
          {
            id: 'audio-1',
            metadata: { page_id: 'objectives', type: 'audio', original_name: 'audio-1.mp3' }
          },
          {
            id: 'audio-2',
            metadata: { page_id: 'topic-0', type: 'audio', original_name: 'audio-2.mp3' }
          }
        ]
      }
      return null
    })

    // Function to map audioIds based on MediaStore contents
    const mapAudioIdsFromMediaStore = async (content: CourseContent, projectId: string): Promise<CourseContent> => {
      // Get all media from MediaStore
      const mediaList = await invoke('get_all_project_media', { projectId }) as any[]
      
      // Create a map of pageId to audioId
      const audioMap = new Map<string, string>()
      for (const media of mediaList) {
        if (media.metadata.type === 'audio') {
          audioMap.set(media.metadata.page_id, media.id)
        }
      }
      
      // Map audioIds to courseContent
      const mappedContent = { ...content }
      
      if (audioMap.has('welcome')) {
        mappedContent.welcomePage = { ...content.welcomePage, audioId: audioMap.get('welcome') }
      }
      
      if (audioMap.has('objectives')) {
        mappedContent.learningObjectivesPage = { ...content.learningObjectivesPage, audioId: audioMap.get('objectives') }
      }
      
      mappedContent.topics = content.topics.map(topic => {
        if (audioMap.has(topic.id)) {
          return { ...topic, audioId: audioMap.get(topic.id) }
        }
        return topic
      })
      
      return mappedContent
    }

    // Test the mapping function
    const mappedContent = await mapAudioIdsFromMediaStore(loadedCourseContent, 'test-project')
    
    expect(mappedContent.welcomePage.audioId).toBe('audio-0')
    expect(mappedContent.learningObjectivesPage.audioId).toBe('audio-1')
    expect(mappedContent.topics[0].audioId).toBe('audio-2')
  })

  it('should handle missing audio files gracefully', async () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<h1>Welcome</h1>',
        narration: 'Welcome narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<h2>Objectives</h2>',
        narration: 'Objectives narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-0',
        title: 'Safety Basics',
        content: '<p>Safety content</p>',
        narration: 'Safety narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    // Mock MediaStore having only some audio files
    vi.mocked(invoke).mockImplementation(async (command: string, args: any) => {
      if (command === 'get_all_project_media') {
        return [
          {
            id: 'audio-0',
            metadata: { page_id: 'welcome', type: 'audio', original_name: 'audio-0.mp3' }
          }
          // Missing objectives and topic audio
        ]
      }
      return null
    })

    // Function to map audioIds based on MediaStore contents
    const mapAudioIdsFromMediaStore = async (content: CourseContent, projectId: string): Promise<CourseContent> => {
      // Get all media from MediaStore
      const mediaList = await invoke('get_all_project_media', { projectId }) as any[]
      
      // Create a map of pageId to audioId
      const audioMap = new Map<string, string>()
      for (const media of mediaList) {
        if (media.metadata.type === 'audio') {
          audioMap.set(media.metadata.page_id, media.id)
        }
      }
      
      // Map audioIds to courseContent
      const mappedContent = { ...content }
      
      if (audioMap.has('welcome')) {
        mappedContent.welcomePage = { ...content.welcomePage, audioId: audioMap.get('welcome') }
      }
      
      if (audioMap.has('objectives')) {
        mappedContent.learningObjectivesPage = { ...content.learningObjectivesPage, audioId: audioMap.get('objectives') }
      }
      
      mappedContent.topics = content.topics.map(topic => {
        if (audioMap.has(topic.id)) {
          return { ...topic, audioId: audioMap.get(topic.id) }
        }
        return topic
      })
      
      return mappedContent
    }

    const mappedContent = await mapAudioIdsFromMediaStore(courseContent, 'test-project')
    
    // Should have audioId for welcome but not for others
    expect(mappedContent.welcomePage.audioId).toBe('audio-0')
    expect(mappedContent.learningObjectivesPage.audioId).toBeUndefined()
    expect(mappedContent.topics[0].audioId).toBeUndefined()
  })
})