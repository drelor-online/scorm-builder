// Automated UI tests that simulate user interactions
import { fileStorage } from '../services/FileStorage'

interface TestResult {
  step: string
  success: boolean
  error?: string
  details?: any
}

export class AutomatedUITester {
  private results: TestResult[] = []
  
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
      
      // Step 7: Test project save
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
      if (!fileStorage.isInitialized) {
        await fileStorage.initialize()
      }
      this.logResult('Storage Initialization', true)
    } catch (error) {
      this.logResult('Storage Initialization', false, error instanceof Error ? error.message : String(error))
      throw error
    }
  }
  
  private async testCreateProject(): Promise<string | null> {
    try {
      const projectName = `UI Test Project ${new Date().toISOString()}`
      const metadata = await fileStorage.createProject(projectName)
      
      if (!metadata || !metadata.id) {
        throw new Error('No project metadata returned')
      }
      
      this.logResult('Create Project', true, undefined, { projectId: metadata.id, name: projectName })
      return metadata.id
    } catch (error) {
      this.logResult('Create Project', false, error instanceof Error ? error.message : String(error))
      return null
    }
  }
  
  private async testCourseSeedData(): Promise<void> {
    try {
      const seedData = {
        courseTitle: 'Automated Test Course',
        difficulty: 3,
        topics: ['Topic 1', 'Topic 2', 'Topic 3'],
        customTopics: 'Topic 1\nTopic 2\nTopic 3',
        template: 'None',
        templateTopics: []
      }
      
      await fileStorage.saveCourseMetadata(seedData)
      
      // Verify it was saved
      const loaded = await fileStorage.getCourseMetadata()
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
      const mockContent = {
        welcome: {
          title: 'Welcome',
          content: '<h1>Welcome to the Course</h1><p>This is a test course.</p>',
          narration: 'Welcome to this automated test course.'
        },
        objectives: {
          title: 'Learning Objectives',
          content: '<ul><li>Learn automated testing</li><li>Understand workflows</li></ul>',
          narration: 'By the end of this course, you will understand automated testing.'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            content: '<h2>Topic 1</h2><p>Content for topic 1</p>',
            narration: 'This is the narration for topic 1',
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
      
      // Save content items individually
      await fileStorage.saveContent('welcome', { ...mockContent.welcome, topicId: 'welcome' })
      await fileStorage.saveContent('objectives', { ...mockContent.objectives, topicId: 'objectives' })
      
      for (const topic of mockContent.topics) {
        await fileStorage.saveContent(topic.id, { ...topic, topicId: topic.id })
      }
      
      // Save assessment as content
      await fileStorage.saveContent('assessment', { ...mockContent.assessment, topicId: 'assessment' })
      
      // Verify it was saved
      // Verify content was saved by checking a topic
      const loaded = await fileStorage.getContent('topic-1')
      if (!loaded || !loaded.topics || loaded.topics.length !== 3) {
        throw new Error('Content not saved correctly')
      }
      
      this.logResult('Content Generation', true, undefined, { topicCount: mockContent.topics.length })
    } catch (error) {
      this.logResult('Content Generation', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testMediaUpload(): Promise<void> {
    try {
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
      
      // Store the image
      await fileStorage.storeMedia('test-image-topic-1', blob, 'image', {
        topicId: 'topic-1',
        fileName: 'test-image.png'
      })
      
      // Verify it was stored
      const media = await fileStorage.getMediaForTopic('topic-1')
      if (!media || media.length === 0) {
        throw new Error('Media not stored correctly')
      }
      
      this.logResult('Media Upload', true, undefined, { mediaCount: media.length })
    } catch (error) {
      this.logResult('Media Upload', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testAudioRecording(): Promise<void> {
    try {
      // Create a mock audio blob
      const audioData = new Uint8Array(1000)
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.floor(Math.random() * 256)
      }
      
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' })
      
      // Store audio for each topic
      const topics = ['topic-1', 'topic-2', 'topic-3']
      for (let i = 0; i < topics.length; i++) {
        const blockNumber = String(i + 1).padStart(4, '0')
        await fileStorage.storeMedia(`audio-${blockNumber}`, audioBlob, 'audio', {
          topicId: topics[i],
          fileName: `${blockNumber}-${topics[i]}.mp3`,
          blockNumber: blockNumber
        })
      }
      
      // Verify audio was stored
      const topic1Media = await fileStorage.getMediaForTopic('topic-1')
      const audioFiles = topic1Media.filter(m => m.type === 'audio')
      if (audioFiles.length === 0) {
        throw new Error('Audio not stored correctly')
      }
      
      this.logResult('Audio Recording', true, undefined, { audioFilesStored: topics.length })
    } catch (error) {
      this.logResult('Audio Recording', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testProjectSave(): Promise<void> {
    try {
      await fileStorage.saveProject()
      this.logResult('Project Save', true)
    } catch (error) {
      this.logResult('Project Save', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testProjectReload(projectId: string): Promise<void> {
    try {
      // First close the current project
      // Close project by setting current to null
      await fileStorage.openProject('temp-close')
      await fileStorage.openProject(projectId)
      
      // Then open it again
      await fileStorage.openProject(projectId)
      
      // Verify all data is still there
      const metadata = await fileStorage.getCourseMetadata()
      const content = await fileStorage.getContent('topic-1')
      const media = await fileStorage.getMediaForTopic('topic-1')
      
      if (!metadata || !metadata.courseTitle) {
        throw new Error('Metadata not reloaded correctly')
      }
      
      if (!content || !content.title) {
        throw new Error('Content not reloaded correctly')
      }
      
      // Check if we have at least the test image
      if (!media || media.length === 0) {
        throw new Error('Media not reloaded correctly')
      }
      
      this.logResult('Project Reload', true, undefined, {
        hasMetadata: !!metadata,
        hasContent: !!content,
        mediaCount: media?.length || 0
      })
    } catch (error) {
      this.logResult('Project Reload', false, error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testCleanup(projectId: string): Promise<void> {
    try {
      await fileStorage.deleteProject(projectId)
      
      // Verify it was deleted
      const projects = await fileStorage.listProjects()
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