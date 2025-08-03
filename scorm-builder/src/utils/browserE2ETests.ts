// Browser-based E2E tests that can be run from the console
import { MediaService } from '../services/MediaService'
import { PersistentStorage } from '../services/PersistentStorage'

/**
 * Browser E2E tests updated to use new MediaService architecture
 * These tests can be run directly from the browser console
 */
export async function testNewProjectCreation() {
  console.log('🧪 Testing New Project Creation Workflow')
  
  let storage: PersistentStorage | null = null
  let mediaService: MediaService | null = null
  let projectId: string | null = null
  
  try {
    // Step 1: Initialize storage
    console.log('1️⃣ Initializing storage...')
    storage = new PersistentStorage()
    await storage.initialize()
    console.log('✅ Storage initialized')
    
    // Step 2: Create a new project
    console.log('2️⃣ Creating new project...')
    const projectName = `E2E Test Project ${Date.now()}`
    const project = await storage.createProject(projectName)
    
    if (!project || !project.id) {
      throw new Error('Failed to create project - no project returned')
    }
    
    projectId = project.id
    console.log('✅ Project created:', project)
    
    // Open the project
    await storage.openProject(projectId)
    
    // Initialize MediaService for this project
    mediaService = new MediaService({ projectId })
    
    // Step 3: Save course metadata
    console.log('3️⃣ Saving course metadata...')
    const courseMetadata = {
      courseTitle: 'Test Course Title',
      difficulty: 3,
      topics: ['Introduction to Testing', 'Advanced Testing', 'Conclusion'],
      customTopics: 'Introduction to Testing\nAdvanced Testing\nConclusion'
    }
    
    await storage.saveCourseMetadata(courseMetadata)
    console.log('✅ Course metadata saved')
    
    // Step 4: Save content for topics
    console.log('4️⃣ Saving topic content...')
    const mockContent = {
      welcome: {
        title: 'Welcome',
        content: '<p>Welcome to the test course</p>',
        narration: 'Welcome to this test course',
        topicId: 'welcome'
      },
      objectives: {
        title: 'Learning Objectives',
        content: '<ul><li>Learn testing</li><li>Master E2E</li></ul>',
        narration: 'By the end of this course you will know testing',
        topicId: 'objectives'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Introduction to Testing',
          content: '<p>Testing is important</p>',
          narration: 'Let us begin with testing basics',
          topicId: 'topic-1',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5,
          knowledgeCheck: {
            questions: [
              {
                id: 'kc-1',
                type: 'multiple-choice' as const,
                question: 'What is testing?',
                options: ['Quality assurance', 'Writing code', 'Debugging', 'Documentation'],
                correct: 0
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
            question: 'Why is testing important?',
            options: ['Ensures quality', 'Saves time', 'Reduces bugs', 'All of the above'],
            correct: 3
          }
        ]
      }
    }
    
    // Save content items
    await storage.saveContent('welcome', mockContent.welcome)
    await storage.saveContent('objectives', mockContent.objectives)
    
    for (const topic of mockContent.topics) {
      await storage.saveContent(topic.id, topic)
    }
    
    await storage.saveContent('assessment', mockContent.assessment)
    console.log('✅ Content saved')
    
    // Step 5: Test media storage
    console.log('5️⃣ Testing media storage...')
    
    // Create a test image
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'green'
      ctx.fillRect(0, 0, 100, 100)
    }
    
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    })
    
    const file = new File([blob], 'test-image.png', { type: 'image/png' })
    const mediaItem = await mediaService.storeMedia(file, 'topic-1', 'image')
    
    if (!mediaItem || !mediaItem.id) {
      throw new Error('Failed to store test image')
    }
    
    console.log('✅ Media stored:', mediaItem.id)
    
    // Step 6: Verify project can be reloaded
    console.log('6️⃣ Verifying project reloads...')
    const projects = await storage.listProjects()
    const foundProject = projects.find(p => p.id === projectId)
    
    if (!foundProject) {
      throw new Error('Created project not found in project list')
    }
    
    // Step 7: Reopen the project
    console.log('7️⃣ Reopening project...')
    await storage.openProject(projectId)
    mediaService = new MediaService({ projectId })
    
    // Step 8: Verify data loaded correctly
    console.log('8️⃣ Verifying loaded data...')
    const loadedMetadata = await storage.getCourseMetadata()
    const loadedContent = await storage.getContent('topic-1')
    const allMedia = await mediaService.listAllMedia()
    
    if (!loadedMetadata || loadedMetadata.courseTitle !== courseMetadata.courseTitle) {
      throw new Error('Course metadata not loaded correctly')
    }
    
    if (!loadedContent || !loadedContent.title) {
      throw new Error('Content not loaded correctly')
    }
    
    if (!allMedia || allMedia.length === 0) {
      throw new Error('Media not loaded correctly')
    }
    
    console.log('✅ All data loaded successfully')
    console.log(`   - Metadata: ${loadedMetadata.courseTitle}`)
    console.log(`   - Content: ${loadedContent.title}`)
    console.log(`   - Media: ${allMedia.length} items`)
    
    // Step 9: Test media retrieval
    console.log('9️⃣ Testing media retrieval...')
    const mediaData = await mediaService.getMedia(mediaItem.id)
    if (!mediaData) {
      throw new Error('Failed to retrieve media')
    }
    
    const blobUrl = await mediaService.createBlobUrl(mediaItem.id)
    if (!blobUrl) {
      throw new Error('Failed to create blob URL')
    }
    
    console.log('✅ Media retrieved successfully')
    console.log(`   - Blob URL: ${blobUrl.substring(0, 50)}...`)
    
    // Step 10: Cleanup
    console.log('🔟 Cleaning up test project...')
    await storage.deleteProject(projectId)
    console.log('✅ Test project deleted')
    
    console.log('\n🎉 New Project Creation Test PASSED!')
    return { success: true, projectId }
    
  } catch (error) {
    console.error('❌ Test FAILED:', error)
    
    // Attempt cleanup on failure
    if (storage && projectId) {
      try {
        await storage.deleteProject(projectId)
        console.log('🧹 Cleaned up failed test project')
      } catch (cleanupError) {
        console.warn('Failed to cleanup:', cleanupError)
      }
    }
    
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Test YouTube video handling
 */
export async function testYouTubeVideoHandling() {
  console.log('🧪 Testing YouTube Video Handling')
  
  let storage: PersistentStorage | null = null
  let mediaService: MediaService | null = null
  let projectId: string | null = null
  
  try {
    // Initialize and create project
    storage = new PersistentStorage()
    await storage.initialize()
    
    const project = await storage.createProject('YouTube Test Project')
    projectId = project.id
    await storage.openProject(projectId)
    
    mediaService = new MediaService({ projectId })
    
    // Test YouTube URL storage
    console.log('🎥 Storing YouTube video...')
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const videoItem = await mediaService.storeYouTubeVideo(
      youtubeUrl,
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'topic-1',
      { title: 'Test Video' }
    )
    
    if (!videoItem || !videoItem.metadata.youtubeUrl || !videoItem.metadata.youtubeUrl.includes('youtube.com')) {
      throw new Error('YouTube URL not preserved')
    }
    
    console.log('✅ YouTube video stored correctly')
    console.log(`   - ID: ${videoItem.id}`)
    console.log(`   - URL: ${videoItem.metadata.youtubeUrl}`)
    
    // Cleanup
    await storage.deleteProject(projectId)
    
    console.log('\n🎉 YouTube Video Test PASSED!')
    return { success: true }
    
  } catch (error) {
    console.error('❌ Test FAILED:', error)
    
    if (storage && projectId) {
      try {
        await storage.deleteProject(projectId)
      } catch (cleanupError) {
        console.warn('Failed to cleanup:', cleanupError)
      }
    }
    
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Test security features
 */
export async function testSecurityFeatures() {
  console.log('🧪 Testing Security Features')
  
  const mediaService = new MediaService({ projectId: 'security-test' })
  
  try {
    // Test 1: Malicious URL validation
    console.log('🔒 Testing URL validation...')
    const maliciousUrls = [
      'javascript:alert("XSS")',
      'data:text/html,<script>alert("XSS")</script>',
      'file:///etc/passwd',
      'http://localhost/admin'
    ]
    
    for (const url of maliciousUrls) {
      const result = (mediaService as any).validateExternalUrl(url)
      if (result.valid) {
        throw new Error(`Should reject malicious URL: ${url}`)
      }
    }
    
    console.log('✅ URL validation passed')
    
    // Test 2: Path traversal protection
    console.log('🔒 Testing path sanitization...')
    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      'uploads/../../../config',
      '/etc/passwd'
    ]
    
    for (const path of maliciousPaths) {
      const result = (mediaService as any).sanitizePath(path)
      if (result.safe) {
        throw new Error(`Should reject path traversal: ${path}`)
      }
    }
    
    console.log('✅ Path sanitization passed')
    
    console.log('\n🎉 Security Tests PASSED!')
    return { success: true }
    
  } catch (error) {
    console.error('❌ Test FAILED:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testNewProject = testNewProjectCreation;
  (window as any).testYouTube = testYouTubeVideoHandling;
  (window as any).testSecurity = testSecurityFeatures;
  
  // Convenience function to run all tests
  (window as any).runAllBrowserTests = async () => {
    console.log('🚀 Running all browser E2E tests...\n')
    
    const results = []
    
    // Run each test
    results.push(await testNewProjectCreation())
    results.push(await testYouTubeVideoHandling())
    results.push(await testSecurityFeatures())
    
    // Summary
    console.log('\n📊 Test Summary:')
    const passed = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)
    
    if (failed === 0) {
      console.log('\n🎉 All tests PASSED!')
    } else {
      console.log('\n❌ Some tests failed')
    }
    
    return results
  }
  
  console.log('💡 Browser E2E tests loaded. Available commands:')
  console.log('   - testNewProject() - Test project creation workflow')
  console.log('   - testYouTube() - Test YouTube video handling')
  console.log('   - testSecurity() - Test security features')
  console.log('   - runAllBrowserTests() - Run all tests')
}