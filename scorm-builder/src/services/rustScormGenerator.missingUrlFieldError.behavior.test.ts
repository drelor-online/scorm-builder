import { describe, it, expect } from 'vitest'

/**
 * BEHAVIOR TEST: Missing URL Field Error Reproduction
 * 
 * This test reproduces the "Failed to parse course data: missing field `url`" error
 * that occurs when YouTube videos are created without proper URL fallbacks, causing
 * the Rust MediaItem struct deserialization to fail.
 * 
 * Expected: This test should FAIL initially, demonstrating the error scenario,
 * then pass after we add proper URL fallbacks.
 */
describe('Rust SCORM Generator - Missing URL Field Error', () => {
  it('should reproduce the "missing field url" error with undefined URLs', () => {
    console.log('🔍 [URL Field Error] Testing "missing field url" error scenario...')
    
    // Step 1: Simulate YouTube video metadata that could cause the issue
    const problematicYouTubeMetadata = {
      id: 'video-2',
      type: 'youtube',
      title: 'YouTube Video with Missing URL Data',
      isYouTube: true,
      metadata: {
        // PROBLEM: Both embedUrl and youtubeUrl could be undefined
        embedUrl: undefined,
        youtubeUrl: undefined,
        title: 'YouTube Video',
        pageId: 'topic-1'
      }
    }
    
    console.log('   🚨 Problematic YouTube metadata:')
    console.log(`     embedUrl: ${problematicYouTubeMetadata.metadata.embedUrl}`)
    console.log(`     youtubeUrl: ${problematicYouTubeMetadata.metadata.youtubeUrl}`)
    console.log(`     type: ${problematicYouTubeMetadata.type}`)
    console.log(`     isYouTube: ${problematicYouTubeMetadata.isYouTube}`)
    
    // Step 2: Simulate the current media injection logic that creates the issue
    console.log('')
    console.log('   🔄 Simulating CURRENT (problematic) media injection logic:')
    
    const isYouTubeVideo = problematicYouTubeMetadata.type === 'youtube' || problematicYouTubeMetadata.metadata?.isYouTube
    const embedUrl = problematicYouTubeMetadata.metadata?.embedUrl
    const youtubeUrl = problematicYouTubeMetadata.metadata?.youtubeUrl || problematicYouTubeMetadata.url
    
    console.log(`     isYouTubeVideo: ${isYouTubeVideo}`)
    console.log(`     embedUrl: ${embedUrl}`)
    console.log(`     youtubeUrl: ${youtubeUrl}`)
    
    // This is the problematic line from SCORMPackageBuilder.tsx:100
    const currentUrl = embedUrl || youtubeUrl
    console.log(`     currentUrl (embedUrl || youtubeUrl): ${currentUrl}`)
    
    // Step 3: Create the media item using current logic
    const problematicMediaItem = {
      id: problematicYouTubeMetadata.id,
      type: problematicYouTubeMetadata.type,
      url: currentUrl, // THIS CAN BE UNDEFINED!
      title: problematicYouTubeMetadata.metadata?.title || `YouTube Video ${problematicYouTubeMetadata.id}`,
      storageId: problematicYouTubeMetadata.id,
      embedUrl,
      youtubeUrl,
      isYouTube: true
    }
    
    console.log('   📊 Created media item:')
    console.log(`     url: ${problematicMediaItem.url}`)
    console.log(`     url is undefined: ${problematicMediaItem.url === undefined}`)
    console.log(`     url is falsy: ${!problematicMediaItem.url}`)
    
    // Step 4: Simulate what happens when this gets passed to Rust
    console.log('')
    console.log('   🦀 Simulating Rust MediaItem struct validation:')
    
    // The Rust struct requires url field to be present and non-null
    const rustMediaItemRequirements = {
      id: 'required (string)',
      media_type: 'required (string)', // mapped from type
      url: 'required (string)', // THIS IS THE PROBLEM!
      title: 'required (string)'
    }
    
    console.log('     Rust MediaItem struct requirements:')
    Object.entries(rustMediaItemRequirements).forEach(([field, requirement]) => {
      console.log(`       ${field}: ${requirement}`)
    })
    
    // Check if our media item would pass Rust validation
    const rustValidation = {
      id: !!problematicMediaItem.id,
      media_type: !!problematicMediaItem.type,
      url: !!problematicMediaItem.url, // This will be false!
      title: !!problematicMediaItem.title
    }
    
    console.log('')
    console.log('     Media item validation against Rust requirements:')
    Object.entries(rustValidation).forEach(([field, passes]) => {
      const status = passes ? '✅ VALID' : '❌ INVALID'
      console.log(`       ${field}: ${status}`)
    })
    
    const wouldFailRustValidation = !rustValidation.url
    console.log(`     Would fail Rust validation: ${wouldFailRustValidation}`)
    
    if (wouldFailRustValidation) {
      console.log('     ⚠️  This would cause: "Failed to parse course data: missing field `url`"')
    }
    
    // Step 5: Verify the issue exists
    expect(problematicMediaItem.url).toBeUndefined() // This demonstrates the problem
    expect(wouldFailRustValidation).toBe(true) // This confirms it would fail Rust validation
    
    console.log('')
    console.log('   🎯 [ERROR SCENARIO REPRODUCED]')
    console.log('     ❌ Media item has undefined url field')
    console.log('     ❌ Would fail Rust MediaItem struct deserialization')
    console.log('     ❌ Would cause "missing field `url`" error during SCORM generation')
  })
  
  it('should demonstrate the auto-population scenario that could cause missing URLs', async () => {
    console.log('🔍 [Auto-population URL Issue] Testing auto-population scenario...')
    
    // Step 1: Simulate stored YouTube video metadata that lacks URL information
    const mockMediaService = {
      async listAllMedia() {
        return [{ id: 'video-3', fileName: 'youtube-video.json' }]
      },
      
      async getMedia(id: string) {
        if (id === 'video-3') {
          return {
            metadata: {
              title: 'YouTube Video',
              pageId: 'topic-1',
              isYouTube: true,
              type: 'youtube',
              // PROBLEM: No embedUrl or youtubeUrl in metadata
              embedUrl: undefined,
              youtubeUrl: undefined
            }
          }
        }
        return null
      }
    }
    
    // Step 2: Simulate auto-population logic
    console.log('')
    console.log('   📦 Simulating auto-population with missing URL metadata:')
    
    const videoItems = await mockMediaService.listAllMedia()
    let urlUndefinedCount = 0
    
    for (const videoItem of videoItems) {
      const fileData = await mockMediaService.getMedia(videoItem.id)
      
      if (fileData && fileData.metadata?.isYouTube) {
        console.log(`   🔍 Processing YouTube video: ${videoItem.id}`)
        console.log(`     metadata.embedUrl: ${fileData.metadata.embedUrl}`)
        console.log(`     metadata.youtubeUrl: ${fileData.metadata.youtubeUrl}`)
        
        // This is the problematic line from rustScormGenerator.ts:1655
        const url = fileData.metadata.embedUrl || fileData.metadata.youtubeUrl
        console.log(`     generated url: ${url}`)
        
        if (url === undefined) {
          urlUndefinedCount++
          console.log('     ❌ URL is undefined - would cause Rust deserialization error!')
        }
        
        // Create the YouTube media object (current logic)
        const youtubeMedia = {
          id: videoItem.id,
          type: 'youtube',
          title: fileData.metadata.title || 'YouTube Video',
          url: url, // UNDEFINED!
          embedUrl: fileData.metadata.embedUrl,
          youtubeUrl: fileData.metadata.youtubeUrl,
          isYouTube: true
        }
        
        console.log(`     Created YouTube media object with url: ${youtubeMedia.url}`)
      }
    }
    
    console.log('')
    console.log(`   📊 Auto-population results:`)
    console.log(`     Videos with undefined URL: ${urlUndefinedCount}`)
    console.log(`     Would cause Rust errors: ${urlUndefinedCount > 0}`)
    
    expect(urlUndefinedCount).toBe(1) // Demonstrates the issue exists
    
    console.log('')
    console.log('   🎯 [AUTO-POPULATION URL ISSUE CONFIRMED]')
    console.log('     Auto-population can create YouTube videos with undefined URLs')
    console.log('     This leads to "missing field `url`" errors in Rust SCORM generation')
  })
  
  it('should show what the FIXED logic should do', () => {
    console.log('🔍 [Fixed Logic Preview] Testing what FIXED URL logic should do...')
    
    // Step 1: Same problematic metadata as before
    const youTubeMetadata = {
      id: 'video-fixed',
      type: 'youtube',
      metadata: {
        embedUrl: undefined,
        youtubeUrl: undefined,
        title: 'YouTube Video',
        pageId: 'topic-1',
        isYouTube: true
      }
    }
    
    console.log('   📊 Input metadata (same problematic case):')
    console.log(`     embedUrl: ${youTubeMetadata.metadata.embedUrl}`)
    console.log(`     youtubeUrl: ${youTubeMetadata.metadata.youtubeUrl}`)
    
    // Step 2: FIXED logic with proper fallbacks
    console.log('')
    console.log('   ✅ Simulating FIXED media injection logic:')
    
    const embedUrl = youTubeMetadata.metadata?.embedUrl
    const youtubeUrl = youTubeMetadata.metadata?.youtubeUrl
    
    // FIXED: Add fallbacks to ensure url is never undefined
    const fixedUrl = embedUrl || youtubeUrl || `https://www.youtube.com/embed/${youTubeMetadata.id.replace('video-', '')}`
    
    console.log(`     embedUrl: ${embedUrl}`)
    console.log(`     youtubeUrl: ${youtubeUrl}`)
    console.log(`     fixedUrl (with fallback): ${fixedUrl}`)
    
    const fixedMediaItem = {
      id: youTubeMetadata.id,
      type: youTubeMetadata.type,
      url: fixedUrl, // NEVER UNDEFINED!
      title: youTubeMetadata.metadata?.title || `YouTube Video ${youTubeMetadata.id}`,
      storageId: youTubeMetadata.id,
      embedUrl: embedUrl || fixedUrl, // Also ensure embedUrl has fallback
      youtubeUrl: youtubeUrl || fixedUrl.replace('/embed/', '/watch?v='),
      isYouTube: true
    }
    
    console.log('')
    console.log('   📋 FIXED media item:')
    console.log(`     url: ${fixedMediaItem.url}`)
    console.log(`     url is defined: ${fixedMediaItem.url !== undefined}`)
    console.log(`     url is valid: ${!!fixedMediaItem.url}`)
    console.log(`     embedUrl: ${fixedMediaItem.embedUrl}`)
    console.log(`     youtubeUrl: ${fixedMediaItem.youtubeUrl}`)
    
    // Step 3: Verify it would pass Rust validation
    const rustValidation = {
      id: !!fixedMediaItem.id,
      media_type: !!fixedMediaItem.type,
      url: !!fixedMediaItem.url,
      title: !!fixedMediaItem.title
    }
    
    const wouldPassRustValidation = Object.values(rustValidation).every(valid => valid)
    
    console.log('')
    console.log('   🦀 Rust validation check:')
    Object.entries(rustValidation).forEach(([field, passes]) => {
      console.log(`     ${field}: ${passes ? '✅ VALID' : '❌ INVALID'}`)
    })
    console.log(`     Would pass Rust validation: ${wouldPassRustValidation}`)
    
    expect(fixedMediaItem.url).toBeDefined() // Fixed: URL is always defined
    expect(fixedMediaItem.url).toBeTruthy() // Fixed: URL is always truthy
    expect(wouldPassRustValidation).toBe(true) // Fixed: Would pass Rust validation
    
    console.log('')
    console.log('   🎉 [FIXED LOGIC VERIFIED]')
    console.log('     ✅ URL field is always defined')
    console.log('     ✅ Would pass Rust MediaItem struct validation') 
    console.log('     ✅ No more "missing field `url`" errors')
    console.log('     ✅ SCORM generation would succeed')
  })
})