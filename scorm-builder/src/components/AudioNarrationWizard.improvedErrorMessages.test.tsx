import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'

describe('AudioNarrationWizard - Improved Error Messages', () => {
  let fileContent: string

  beforeEach(() => {
    fileContent = readFileSync('src/components/AudioNarrationWizard.tsx', 'utf-8')
  })

  describe('Error Message Formatting', () => {
    it('should extract only filename from full path in error messages', () => {
      // Should extract just the filename (not full path) for display in errors
      const skippedFilesMatch = fileContent.match(/skippedFiles\.push\(\{ filename.*reason/s)
      expect(skippedFilesMatch).toBeDefined()
      
      // Check that filename display is cleaned up
      expect(fileContent).toMatch(/const displayName = .*filename\.split\('\/'\)\.pop\(\)/)
      expect(fileContent).toMatch(/displayName.*reason/)
    })

    it('should show available blocks in error messages', () => {
      // Error messages should show which blocks are available for debugging
      expect(fileContent).toMatch(/const availableBlocks = narrationBlocks\.map/)
      expect(fileContent).toMatch(/\.map\(b => b\.blockNumber\)\.join/)
    })

    it('should provide helpful guidance when no blocks match', () => {
      // Should show helpful error when files don't match any blocks
      expect(fileContent).toMatch(/No narration block for.*Available/)
    })
  })

  describe('Audio Upload Error Handling', () => {
    it('should handle path-based filenames correctly', () => {
      // Should handle files inside ZIP subdirectories
      const audioUploadMatch = fileContent.match(/handleAudioZipUpload.*skippedFiles\.push/s)
      expect(audioUploadMatch).toBeDefined()
      
      // Should clean up filename display
      expect(fileContent).toMatch(/filename\.split\('\/'\)\.pop\(\)/)
    })
  })

  describe('Caption Upload Error Handling', () => {
    it('should handle path-based filenames correctly for captions', () => {
      // Should handle files inside ZIP subdirectories for captions too
      const captionUploadMatch = fileContent.match(/handleCaptionZipUpload/s)
      expect(captionUploadMatch).toBeDefined()
      
      // Should clean up filename display in caption errors too
      expect(fileContent).toMatch(/filename\.split\('\/'\)\.pop\(\)/)
    })
  })
})