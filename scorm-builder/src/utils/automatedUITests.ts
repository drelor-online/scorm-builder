// Automated UI tests that simulate user interactions
import { MediaService } from '../services/MediaService'
import { PersistentStorage } from '../services/PersistentStorage'

interface TestResult {
  step: string
  success: boolean
  error?: string
  details?: any
}

/**
 * Automated UI tests updated to use new MediaService architecture
 */
export class AutomatedUITester {
  private results: TestResult[] = []
  private storage: PersistentStorage | null = null
  private mediaService: MediaService | null = null
  
  private logResult(step: string, success: boolean, error?: string, details?: any) {
    const result = { step, success, error, details }
    this.results.push(result)
    
    if (success) {
      console.log(`✅ ${step}`)
    } else {
      console.error(`❌ ${step}: ${error}`)
    }
    
    return result
  }
  
  async testNewProjectWorkflow(): Promise<TestResult[]> {
    console.log('🚀 Starting Automated New Project Workflow Test\n')
    this.results = []
    
    try {
      // Step 1: Initialize storage
      await this.testStorageInit()
      
      // Step 2: Create new project
      const projectId = await this.testCreateProject()
      
      if (!projectId) {
        throw new Error('Failed to create project')
      }
      
      // Step 3: Test course seed data
      await this.testCourseSeedData()
      
      // Step 4: Test content generation (mock)
      await this.testContentGeneration()
      
      // Step 5: Test media upload
      await this.testMediaUpload()
      
      // Step 6: Test audio recording
      await this.testAudioRecording()
      
      // Step 7: Test project save (implicit in new architecture)
      await this.testProjectSave()
      
      // Step 8: Test project reload
      await this.testProjectReload(projectId)
      
      // Step 9: Cleanup
      await this.testCleanup(projectId)
      
      // Print summary
      this.printSummary()
      
    } catch (error) {
      this.logResult('Overall Test', false, error instanceof Error ? error.message : String(error))
    }
    
    return this.results
  }
  
  private async testStorageInit(): Promise<void> {
    try {
      this.storage = new PersistentStorage()
      await this.storage.initialize()
      this.logResult('Storage Initialization', true)
    } catch (error) {
      this.logResult('Storage Initialization', false, error instanceof Error ? error.message : String(error))
      throw error
    }
  }
  
  private async testCreateProject(): Promise<string | null> {
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      const projectName = `UI Test Project ${new Date().toISOString()}`
      const project = await this.storage.createProject(projectName)
      
      if (!project || !project.id) {
        throw new Error('No project created')
      }
      
      // Open the project
      await this.storage.openProject(project.id)
      
      // Initialize MediaService for this project
      this.mediaService = new MediaService({ projectId: project.id })
      
      this.logResult('Create Project', true, undefined, { projectId: project.id, name: projectName })
      return project.id
    } catch (error) {
      this.logResult('Create Project', false, error instanceof Error ? error.message : String(error))
      return null
    }
  }
  
  private async testCourseSeedData(): Promise<void> {
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      const seedData = {
        courseTitle: 'Automated Test Course',
        difficulty: 3,
        topics: ['Topic 1', 'Topic 2', 'Topic 3'],
        customTopics: 'Topic 1\nTopic 2\nTopic 3',
        template: 'None',
        templateTopics: []
      }
      
      await this.storage.saveCourseMetadata(seedData)
      
      // Verify it was saved
      const loaded = await this.storage.getCourseMetadata()
      if (!loaded || loaded.courseTitle !== seedData.courseTitle) {
        throw new Error('Course metadata not saved correctly')
      }
      
      this.logResult('Course Seed Data', true, undefined, seedData)
    } catch (error) {
      this.logResult('Course Seed Data', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testContentGeneration(): Promise<void> {
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      const mockContent = {
        welcome: {
          title: 'Welcome',
          content: '<h1>Welcome to the Course</h1><p>This is a test course.</p>',
          narration: 'Welcome to this automated test course.',
          topicId: 'welcome'
        },
        objectives: {
          title: 'Learning Objectives',
          content: '<ul><li>Learn automated testing</li><li>Understand workflows</li></ul>',
          narration: 'By the end of this course, you will understand automated testing.',
          topicId: 'objectives'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            content: '<h2>Topic 1</h2><p>Content for topic 1</p>',
            narration: 'This is the narration for topic 1',
            topicId: 'topic-1',
            imageKeywords: [],
            imagePrompts: [],
            videoSearchTerms: [],
            duration: 5,
            knowledgeCheck: {
              questions: [
                {
                  id: 'kc-1-1',
                  type: 'multiple-choice' as const,
                  question: 'What is topic 1 about?',
                  options: ['Testing', 'Development', 'Design', 'Management'],
                  correct: 0
                }
              ]
            }
          },
          {
            id: 'topic-2',
            title: 'Topic 2',
            content: '<h2>Topic 2</h2><p>Content for topic 2</p>',
            narration: 'This is the narration for topic 2',
            topicId: 'topic-2',
            knowledgeCheck: {
              questions: [
                {
                  id: 'kc-2-1',
                  type: 'true-false' as const,
                  question: 'Topic 2 is about automation.',
                  correct: true
                }
              ]
            }
          },
          {
            id: 'topic-3',
            title: 'Topic 3',
            content: '<h2>Topic 3</h2><p>Content for topic 3</p>',
            narration: 'This is the narration for topic 3',
            topicId: 'topic-3',
            knowledgeCheck: {
              questions: [
                {
                  id: 'kc-3-1',
                  type: 'multiple-choice' as const,
                  question: 'What have we learned?',
                  options: ['Nothing', 'Everything', 'Something', 'Testing'],
                  correct: 3
                }
              ]
            }
          }
        ],
        assessment: {
          topicId: 'assessment',
          questions: [
            {
              id: 'assess-1',
              type: 'multiple-choice' as const,
              question: 'What is the main topic of this course?',
              options: ['Cooking', 'Testing', 'Gaming', 'Shopping'],
              correct: 1
            },
            {
              id: 'assess-2',
              type: 'true-false' as const,
              question: 'This course covered 3 topics.',
              correct: true
            }
          ]
        }
      }
      
      // Save content items
      await this.storage.saveContent('welcome', mockContent.welcome)
      await this.storage.saveContent('objectives', mockContent.objectives)
      
      for (const topic of mockContent.topics) {
        await this.storage.saveContent(topic.id, topic)
      }
      
      await this.storage.saveContent('assessment', mockContent.assessment)
      
      // Save full course content structure
      await this.storage.saveContent('course-content', {
        topicId: 'course-content', // Added to satisfy ContentItem interface
        welcome: mockContent.welcome,
        objectives: mockContent.objectives,
        topics: mockContent.topics,
        assessment: mockContent.assessment
      })
      
      // Verify content was saved
      const loaded = await this.storage.getContent('topic-1')
      if (!loaded) {
        throw new Error('Content not saved correctly')
      }
      
      this.logResult('Content Generation', true, undefined, { topicCount: mockContent.topics.length })
    } catch (error) {
      this.logResult('Content Generation', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testMediaUpload(): Promise<void> {
    try {
      if (!this.mediaService) throw new Error('MediaService not initialized')
      
      // Create a mock image blob
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 100
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'blue'
        ctx.fillRect(0, 0, 100, 100)
      }
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })
      
      const file = new File([blob], 'test-image.png', { type: 'image/png' })
      
      // Store the image using MediaService
      const mediaItem = await this.mediaService.storeMedia(file, 'topic-1', 'image')
      
      if (!mediaItem || !mediaItem.id) {
        throw new Error('Media not stored correctly')
      }
      
      // Verify media can be retrieved
      const mediaData = await this.mediaService.getMedia(mediaItem.id)
      if (!mediaData) {
        throw new Error('Media not retrieved correctly')
      }
      
      this.logResult('Media Upload', true, undefined, { mediaId: mediaItem.id })
    } catch (error) {
      this.logResult('Media Upload', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testAudioRecording(): Promise<void> {
    try {
      if (!this.mediaService) throw new Error('MediaService not initialized')
      
      // Create a mock audio blob
      const audioData = new Uint8Array(1000)
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.floor(Math.random() * 256)
      }
      
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' })
      
      // Store audio for each topic
      const topics = ['topic-1', 'topic-2', 'topic-3']
      const audioIds: string[] = []
      
      for (const topicId of topics) {
        const file = new File([audioBlob], `${topicId}.mp3`, { type: 'audio/mp3' })
        const mediaItem = await this.mediaService.storeMedia(file, topicId, 'audio')
        
        if (mediaItem && mediaItem.id) {
          audioIds.push(mediaItem.id)
        }
      }
      
      // Verify audio was stored
      if (audioIds.length !== topics.length) {
        throw new Error('Not all audio files were stored')
      }
      
      this.logResult('Audio Recording', true, undefined, { audioFilesStored: audioIds.length })
    } catch (error) {
      this.logResult('Audio Recording', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testProjectSave(): Promise<void> {
    try {
      // In the new architecture, data is automatically persisted
      // This test just verifies that we can list all media
      if (!this.mediaService) throw new Error('MediaService not initialized')
      
      const allMedia = await this.mediaService.listAllMedia()
      
      this.logResult('Project Save', true, undefined, { 
        note: 'Data is automatically persisted in new architecture',
        mediaCount: allMedia.length 
      })
    } catch (error) {
      this.logResult('Project Save', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testProjectReload(projectId: string): Promise<void> {
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      // Reopen the project
      await this.storage.openProject(projectId)
      
      // Create new MediaService instance
      this.mediaService = new MediaService({ projectId })
      
      // Verify all data is still there
      const metadata = await this.storage.getCourseMetadata()
      const content = await this.storage.getContent('topic-1')
      const allMedia = await this.mediaService.listAllMedia()
      
      if (!metadata || !metadata.courseTitle) {
        throw new Error('Metadata not reloaded correctly')
      }
      
      if (!content || !content.title) {
        throw new Error('Content not reloaded correctly')
      }
      
      if (!allMedia || allMedia.length === 0) {
        throw new Error('Media not reloaded correctly')
      }
      
      this.logResult('Project Reload', true, undefined, {
        hasMetadata: !!metadata,
        hasContent: !!content,
        mediaCount: allMedia.length
      })
    } catch (error) {
      this.logResult('Project Reload', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testCleanup(projectId: string): Promise<void> {
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      await this.storage.deleteProject(projectId)
      
      // Verify it was deleted
      const projects = await this.storage.listProjects()
      const found = projects.find(p => p.id === projectId)
      if (found) {
        throw new Error('Project was not deleted')
      }
      
      this.logResult('Cleanup', true)
    } catch (error) {
      this.logResult('Cleanup', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private printSummary(): void {
    console.log('\n📊 Test Summary:')
    const passed = this.results.filter(r => r.success).length
    const failed = this.results.filter(r => !r.success).length
    const total = this.results.length
    
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`)
    
    if (failed > 0) {
      console.log('\nFailed tests:')
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.step}: ${r.error}`)
      })
    }
    
    if (passed === total) {
      console.log('\n🎉 All tests PASSED!')
    }
  }
}

// Export for console use
export async function runUITests() {
  const tester = new AutomatedUITester()
  return await tester.testNewProjectWorkflow()
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).runUITests = runUITests
}