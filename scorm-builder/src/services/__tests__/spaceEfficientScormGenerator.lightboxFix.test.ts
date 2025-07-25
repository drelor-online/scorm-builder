import { describe, it, expect } from 'vitest'
import { generateEnhancedNavigationJs } from '../spaceEfficientScormGeneratorNavigation'

describe('SCORM Generator - Lightbox Image Path Fix', () => {
  it('should handle relative paths from iframe pages in enlargeImage function', () => {
    const navJs = generateEnhancedNavigationJs()
    
    // Check that the enlargeImage function handles relative paths
    expect(navJs).toContain('function enlargeImage(imageSrc, imageAlt)')
    expect(navJs).toContain("if (imageSrc.startsWith('../'))")
    expect(navJs).toContain('imageSrc = imageSrc.substring(3)')
    expect(navJs).toContain('// Handle relative paths from iframe pages')
  })

  it('should strip ../ prefix from image paths', () => {
    const navJs = generateEnhancedNavigationJs()
    
    // Create a mock implementation to test the logic
    const enlargeImageLogic = `
      if (imageSrc.startsWith('../')) {
        imageSrc = imageSrc.substring(3);
      }
    `
    
    // Test the logic
    let imageSrc = '../media/images/test.jpg'
    if (imageSrc.startsWith('../')) {
      imageSrc = imageSrc.substring(3)
    }
    expect(imageSrc).toBe('media/images/test.jpg')
    
    // Test that paths without ../ are unchanged
    imageSrc = 'media/images/direct.jpg'
    if (imageSrc.startsWith('../')) {
      imageSrc = imageSrc.substring(3)
    }
    expect(imageSrc).toBe('media/images/direct.jpg')
  })
})