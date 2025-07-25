// Browser-based E2E tests that can be run from the console
import { fileStorage } from '../services/FileStorage'

export async function testNewProjectCreation() {
  console.log('🧪 Testing New Project Creation Workflow')
  
  try {
    // Step 1: Initialize storage if needed
    console.log('1️⃣ Initializing storage...')
    if (!fileStorage.isInitialized) {
      await fileStorage.initialize()
    }
    
    // Step 2: Create a new project
    console.log('2️⃣ Creating new project...')
    const projectName = `E2E Test Project ${Date.now()}`
    const projectMetadata = await fileStorage.createProject(projectName)
    
    if (!projectMetadata || !projectMetadata.id) {
      throw new Error('Failed to create project - no metadata returned')
    }
    
    console.log('✅ Project created:', projectMetadata)
    
    // Step 3: Save course metadata
    console.log('3️⃣ Saving course metadata...')
    const courseMetadata = {
      courseTitle: 'Test Course Title',
      difficulty: 3,
      topics: ['Introduction to Testing', 'Advanced Testing', 'Conclusion'],
      customTopics: 'Introduction to Testing\nAdvanced Testing\nConclusion'
    }
    
    await fileStorage.saveCourseMetadata(courseMetadata)
    console.log('✅ Course metadata saved')
    
    // Step 4: Save content for topics
    console.log('4️⃣ Saving topic content...')
    const mockContent = {
      welcome: {
        title: 'Welcome',
        content: '<p>Welcome to the test course</p>',
        narration: 'Welcome to this test course'
      },
      objectives: {
        title: 'Learning Objectives',
        content: '<ul><li>Learn testing</li><li>Master E2E</li></ul>',
        narration: 'By the end of this course you will know testing'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Introduction to Testing',
          content: '<p>Testing is important</p>',
          narration: 'Let us begin with testing basics',
          knowledgeCheck: {
            questions: [
              {
                id: 'kc-1',
                type: 'multiple-choice',
                question: 'What is testing?',
                options: ['Quality assurance', 'Writing code', 'Debugging', 'Documentation'],
                correct: 0
              }
            ]
          }
        }
      ],
      assessment: {
        questions: [
          {
            id: 'assess-1',
            type: 'multiple-choice',
            question: 'Why is testing important?',
            options: ['Ensures quality', 'Saves time', 'Reduces bugs', 'All of the above'],
            correct: 3
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
    
    // Save assessment
    await fileStorage.saveContent('assessment', { ...mockContent.assessment, topicId: 'assessment' })
    console.log('✅ Content saved')
    
    // Step 5: Save project
    console.log('5️⃣ Saving project...')
    await fileStorage.saveProject()
    console.log('✅ Project saved')
    
    // Step 6: Verify project can be loaded
    console.log('6️⃣ Verifying project loads...')
    const projects = await fileStorage.listProjects()
    const foundProject = projects.find(p => p.id === projectMetadata.id)
    
    if (!foundProject) {
      throw new Error('Created project not found in project list')
    }
    
    // Step 7: Open the project
    console.log('7️⃣ Opening project...')
    await fileStorage.openProject(projectMetadata.id)
    
    // Step 8: Verify data loaded correctly
    console.log('8️⃣ Verifying loaded data...')
    const loadedMetadata = await fileStorage.getCourseMetadata()
    // Check if content loaded by getting a topic
    const loadedContent = await fileStorage.getContent('topic-1')
    
    if (!loadedMetadata || loadedMetadata.courseTitle !== courseMetadata.courseTitle) {
      throw new Error('Course metadata not loaded correctly')
    }
    
    if (!loadedContent || !loadedContent.title) {
      throw new Error('Content not loaded correctly')
    }
    
    console.log('✅ All data loaded successfully')
    
    // Step 9: Cleanup
    console.log('9️⃣ Cleaning up test project...')
    await fileStorage.deleteProject(projectMetadata.id)
    console.log('✅ Test project deleted')
    
    console.log('\n🎉 New Project Creation Test PASSED!')
    return { success: true, projectId: projectMetadata.id }
    
  } catch (error) {
    console.error('❌ Test FAILED:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).testNewProject = testNewProjectCreation
}