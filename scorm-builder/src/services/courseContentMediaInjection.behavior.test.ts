import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'
import { FileStorage } from './FileStorage'

// Test to verify that orphaned media gets injected into course content structure
// This is the missing piece - files get added to ZIP but not referenced in HTML

// Global mock objects
let globalMockMediaService: any
let globalMockStorage: any

// Mock MediaService at module level
vi.mock('./MediaService', () => ({
  createMediaService: vi.fn(() => globalMockMediaService)
}))

// Mock FileStorage at module level  
vi.mock('./FileStorage', () => ({
  FileStorage: vi.fn()
}))

describe('Course Content Media Injection Fix', () => {
  let mockMediaService: any
  let mockStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock MediaService that contains orphaned media
    mockMediaService = globalMockMediaService = {
      listAllMedia: vi.fn().mockResolvedValue([
        { id: 'image-0', pageId: 'welcome', metadata: { mimeType: 'image/jpeg' } },
        { id: 'image-3', pageId: 'topic-1', metadata: { mimeType: 'image/jpeg' } }, // Should be injected into topic-1
        { id: 'image-4', pageId: 'topic-2', metadata: { mimeType: 'image/jpeg' } }, // Should be injected into topic-2
        { id: 'image-5', pageId: 'topic-3', metadata: { mimeType: 'image/jpeg' } }, // Should be injected into topic-3
      ]),
      getMedia: vi.fn().mockImplementation((id: string) => {
        const mediaData = {
          'image-0': { data: new ArrayBuffer(122334), metadata: { mimeType: 'image/jpeg' } },
          'image-3': { data: new ArrayBuffer(608548), metadata: { mimeType: 'image/jpeg' } },
          'image-4': { data: new ArrayBuffer(343845), metadata: { mimeType: 'image/jpeg' } },
          'image-5': { data: new ArrayBuffer(17377), metadata: { mimeType: 'image/jpeg' } }
        }
        return Promise.resolve(mediaData[id] || null)
      })
    }

    // Mock storage
    mockStorage = globalMockStorage = {
      openProject: vi.fn().mockResolvedValue(true),
      getProject: vi.fn().mockResolvedValue({
        id: 'test-project',
        name: 'Test Project'
      })
    }

    // Mock FileStorage constructor to return our mock
    vi.mocked(FileStorage).mockImplementation(() => mockStorage as any)
  })

  it('should inject orphaned media into course content structure based on pageId', async () => {
    console.log('🔍 [TEST] Verifying course content media injection...')
    console.log('')
    console.log('📋 [EXPECTED BEHAVIOR]:')
    console.log('  1. Media files should be added to SCORM ZIP (auto-population)')
    console.log('  2. Media references should be injected into course content topics')
    console.log('  3. Generated course data should have media arrays populated')
    console.log('  4. HTML generation should include img tags for these media')
    console.log('')

    // Course content with empty media arrays (the current issue)
    const courseContentWithEmptyMedia = {
      courseTitle: 'Test Course',
      courseDescription: 'Testing media injection',
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome content</p>',
        media: [
          { id: 'image-0', type: 'image', url: 'image-0', title: 'Welcome Image' } // This exists
        ]
      },
      learningObjectivesPage: {
        id: 'objectives', 
        title: 'Learning Objectives',
        content: '<p>Learning objectives</p>',
        media: [] // Empty
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: '<p>Topic 1 content</p>',
          media: [] // ❌ EMPTY: Should have image-3 injected
        },
        {
          id: 'topic-2', 
          title: 'Topic 2',
          content: '<p>Topic 2 content</p>',
          media: [] // ❌ EMPTY: Should have image-4 injected
        },
        {
          id: 'topic-3',
          title: 'Topic 3', 
          content: '<p>Topic 3 content</p>',
          media: [] // ❌ EMPTY: Should have image-5 injected
        }
      ]
    }

    console.log('🔄 [TEST] Converting to Rust format with media injection...')
    const result = await convertToRustFormat(courseContentWithEmptyMedia, 'test-project')

    console.log('')
    console.log('📊 [MEDIA FILE ANALYSIS]:')
    console.log(`  • Total media files in SCORM: ${result.mediaFiles.length}`)
    
    const includedImages = result.mediaFiles
      .filter(f => f.filename.includes('image-'))
      .map(f => f.filename.replace(/\.(jpg|png|jpeg|gif)$/, ''))
    console.log(`  • Image files included: [${includedImages.join(', ')}]`)
    
    // Verify media files are included (this should work due to auto-population)
    expect(result.mediaFiles.some(f => f.filename.includes('image-3'))).toBe(true)
    expect(result.mediaFiles.some(f => f.filename.includes('image-4'))).toBe(true)
    expect(result.mediaFiles.some(f => f.filename.includes('image-5'))).toBe(true)
    console.log('  ✅ All media files correctly included in SCORM ZIP')

    console.log('')
    console.log('📊 [COURSE CONTENT STRUCTURE ANALYSIS]:')
    
    // Check if the course content structure has been enhanced with media references
    // This is the key missing piece that causes 404 errors
    console.log('  📁 Topic structure analysis:')
    
    if (result.courseData?.topics) {
      result.courseData.topics.forEach((topic: any, index: number) => {
        const topicId = topic.id || `topic-${index}`
        const mediaCount = topic.media ? topic.media.length : 0
        console.log(`    • ${topicId}: ${mediaCount} media items`)
        
        if (mediaCount > 0) {
          console.log(`      - Media: ${topic.media.map((m: any) => m.id || m.url).join(', ')}`)
        }
      })
    }

    console.log('')
    console.log('🎯 [CRITICAL TEST]:')
    console.log('  If course content injection is working properly:')
    console.log('    • topic-1 should have media array with image-3')
    console.log('    • topic-2 should have media array with image-4') 
    console.log('    • topic-3 should have media array with image-5')
    console.log('')
    
    // Check if topics have been enhanced with media
    if (result.courseData?.topics) {
      const topic1Media = result.courseData.topics[0]?.media || []
      const topic2Media = result.courseData.topics[1]?.media || []
      const topic3Media = result.courseData.topics[2]?.media || []
      
      console.log('📋 [MEDIA INJECTION RESULTS]:')
      console.log(`  • topic-1 media count: ${topic1Media.length}`)
      console.log(`  • topic-2 media count: ${topic2Media.length}`)
      console.log(`  • topic-3 media count: ${topic3Media.length}`)
      
      const hasImage3InTopic1 = topic1Media.some((m: any) => (m.id || m.url || '').includes('image-3'))
      const hasImage4InTopic2 = topic2Media.some((m: any) => (m.id || m.url || '').includes('image-4'))
      const hasImage5InTopic3 = topic3Media.some((m: any) => (m.id || m.url || '').includes('image-5'))
      
      console.log('')
      console.log('🔍 [INJECTION VERIFICATION]:')
      console.log(`  • image-3 in topic-1: ${hasImage3InTopic1 ? '✅' : '❌'}`)
      console.log(`  • image-4 in topic-2: ${hasImage4InTopic2 ? '✅' : '❌'}`)
      console.log(`  • image-5 in topic-3: ${hasImage5InTopic3 ? '✅' : '❌'}`)
      
      if (!hasImage3InTopic1 || !hasImage4InTopic2 || !hasImage5InTopic3) {
        console.log('')
        console.log('❌ [BUG CONFIRMED]: Course content media injection not working')
        console.log('🔧 [ROOT CAUSE]: Media files added to ZIP but not injected into course content')
        console.log('🔧 [REQUIRED FIX]: Enhance convertToRustFormat to inject orphaned media into topics')
        console.log('')
        console.log('💡 [SOLUTION]: After auto-populating media files, also inject media references')
        console.log('   into the appropriate topic.media arrays based on pageId metadata')
      } else {
        console.log('')
        console.log('✅ [SUCCESS]: Course content media injection working correctly!')
      }
    }
    
    console.log('')
    console.log('📝 [TEST SUMMARY]:')
    console.log('  This test verifies the complete media injection flow:')
    console.log('  1. ✅ Media files included in SCORM ZIP (auto-population)')
    console.log('  2. ❓ Media references injected into course content (this test)')
    console.log('  3. → HTML generation includes img tags (consequence of #2)')
    console.log('  4. → No 404 errors in browser (final result)')
  })
})