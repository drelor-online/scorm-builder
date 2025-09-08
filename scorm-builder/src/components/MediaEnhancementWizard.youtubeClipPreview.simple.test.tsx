import { describe, test, expect } from 'vitest'
import { buildYouTubeEmbed } from '../services/mediaUrl'

describe('YouTube Clip Preview - Simple Unit Test', () => {
  test('buildYouTubeEmbed should generate URL with clip timing parameters', () => {
    const originalUrl = 'https://www.youtube.com/watch?v=testVideoId'
    const clipStart = 90  // 1:30
    const clipEnd = 225   // 3:45

    const embedUrl = buildYouTubeEmbed(originalUrl, clipStart, clipEnd)
    
    console.log('[TEST] Generated embed URL:', embedUrl)
    
    // Should contain the YouTube embed base URL
    expect(embedUrl).toContain('https://www.youtube.com/embed/testVideoId')
    
    // Should contain clip timing parameters
    expect(embedUrl).toContain('start=90')
    expect(embedUrl).toContain('end=225')
    
    console.log('[TEST] ✅ YouTube clip preview URL generation works correctly')
  })
  
  test('buildYouTubeEmbed should work without clip timing', () => {
    const originalUrl = 'https://www.youtube.com/watch?v=testVideoId'
    
    const embedUrl = buildYouTubeEmbed(originalUrl)
    
    console.log('[TEST] Generated embed URL without timing:', embedUrl)
    
    // Should contain the YouTube embed base URL
    expect(embedUrl).toContain('https://www.youtube.com/embed/testVideoId')
    
    // Should NOT contain clip timing parameters
    expect(embedUrl).not.toContain('start=')
    expect(embedUrl).not.toContain('end=')
    
    console.log('[TEST] ✅ YouTube embed without clip timing works correctly')
  })
})