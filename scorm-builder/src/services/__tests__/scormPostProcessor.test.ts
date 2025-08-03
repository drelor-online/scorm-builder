import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
import { postProcessSCORMPackage } from '../scormPostProcessor'

// Mock JSZip
vi.mock('jszip')

describe('scormPostProcessor', () => {
  let mockZip: any
  let mockProcessedZip: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock zip instances
    mockZip = {
      files: {},
      file: vi.fn()
    }
    
    mockProcessedZip = {
      file: vi.fn()
    }
    
    // Mock JSZip constructor
    vi.mocked(JSZip).mockImplementation(() => mockProcessedZip as any)
  })
  
  describe('postProcessSCORMPackage', () => {
    it('should create a new zip and copy all files', async () => {
      // Setup mock files
      mockZip.files = {
        'manifest.xml': {},
        'pages/welcome.html': {},
        'media/image.png': {}
      }
      
      // Mock file reading
      const mockFile = {
        async: vi.fn()
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      // Mock content for different file types
      mockFile.async.mockImplementation((type: string) => {
        if (type === 'string') {
          return Promise.resolve('<html><body>Test</body></html>')
        }
        return Promise.resolve(new Uint8Array([1, 2, 3]))
      })
      
      const result = await postProcessSCORMPackage(mockZip)
      
      // Verify new zip was created
      expect(JSZip).toHaveBeenCalled()
      
      // Verify files were processed
      expect(mockZip.file).toHaveBeenCalledWith('manifest.xml')
      expect(mockZip.file).toHaveBeenCalledWith('pages/welcome.html')
      expect(mockZip.file).toHaveBeenCalledWith('media/image.png')
      
      // Verify files were added to processed zip
      expect(mockProcessedZip.file).toHaveBeenCalled()
      expect(result).toBe(mockProcessedZip)
    })
    
    it('should process HTML files in pages directory', async () => {
      mockZip.files = {
        'pages/welcome.html': {},
        'index.html': {}, // Not in pages directory
        'pages/topic1.html': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue('<html><body>Content</body></html>')
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      await postProcessSCORMPackage(mockZip)
      
      // Check that HTML files in pages/ were read as strings
      const htmlCalls = mockFile.async.mock.calls.filter(call => call[0] === 'string')
      expect(htmlCalls).toHaveLength(2) // Only files in pages/
      
      // Check that other files were read as uint8array
      const binaryCalls = mockFile.async.mock.calls.filter(call => call[0] === 'uint8array')
      expect(binaryCalls).toHaveLength(1) // index.html
    })
    
    it('should handle missing files gracefully', async () => {
      mockZip.files = {
        'pages/missing.html': {}
      }
      
      // Return null for missing file
      mockZip.file.mockReturnValue(null)
      
      await postProcessSCORMPackage(mockZip)
      
      // Should not throw error
      expect(mockProcessedZip.file).not.toHaveBeenCalled()
    })
  })
  
  describe('YouTube video processing', () => {
    it('should convert YouTube video tags to iframe embeds', async () => {
      const htmlWithYouTube = `
        <html>
          <body>
            <video controls>
              <source src="https://www.youtube.com/watch?v=ABC123" type="video/mp4">
            </video>
          </body>
        </html>
      `
      
      mockZip.files = {
        'pages/topic.html': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlWithYouTube)
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      await postProcessSCORMPackage(mockZip)
      
      // Get the processed content
      const processedCall = mockProcessedZip.file.mock.calls.find(
        call => call[0] === 'pages/topic.html'
      )
      
      expect(processedCall).toBeDefined()
      const processedContent = processedCall![1]
      
      // Check iframe was created
      expect(processedContent).toContain('<iframe')
      expect(processedContent).toContain('src="https://www.youtube.com/embed/ABC123"')
      expect(processedContent).toContain('class="video-container"')
      expect(processedContent).not.toContain('<video')
    })
    
    it('should handle youtu.be short URLs', async () => {
      const htmlWithShortUrl = `
        <video>
          <source src="https://youtu.be/XYZ789">
        </video>
      `
      
      mockZip.files = {
        'pages/video.html': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlWithShortUrl)
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      await postProcessSCORMPackage(mockZip)
      
      const processedCall = mockProcessedZip.file.mock.calls[0]
      const processedContent = processedCall[1]
      
      expect(processedContent).toContain('src="https://www.youtube.com/embed/XYZ789"')
    })
    
    it('should strip extra parameters from YouTube URLs', async () => {
      const htmlWithParams = `
        <video>
          <source src="https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST&index=1">
        </video>
      `
      
      mockZip.files = {
        'pages/video.html': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlWithParams)
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      await postProcessSCORMPackage(mockZip)
      
      const processedCall = mockProcessedZip.file.mock.calls[0]
      const processedContent = processedCall[1]
      
      // Should only include the video ID, not other parameters
      expect(processedContent).toContain('src="https://www.youtube.com/embed/VIDEO_ID"')
      expect(processedContent).not.toContain('list=')
      expect(processedContent).not.toContain('index=')
    })
  })
  
  describe('Audio player injection', () => {
    it('should inject audio player for welcome page with correct audio index', async () => {
      const htmlNoAudio = `
        <html>
          <body>
            <div class="media-panel">
            </div>
          </div>
          </body>
        </html>
      `
      
      mockZip.files = {
        'pages/welcome.html': {},
        'media/audio-0.bin': {},
        'media/audio-0.json': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlNoAudio)
      }
      
      const mockAudioFile = {
        async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
      }
      const mockAudioMeta = {
        async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
      }
      
      mockZip.file.mockImplementation((path: string) => {
        if (path === 'pages/welcome.html') return mockFile
        if (path === 'media/audio-0.bin') return mockAudioFile
        if (path === 'media/audio-0.json') return mockAudioMeta
        // Return objects with async method for other files in zip.files
        if (Object.keys(mockZip.files).includes(path)) {
          return {
            async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
          }
        }
        return null
      })
      
      await postProcessSCORMPackage(mockZip)
      
      const processedCall = mockProcessedZip.file.mock.calls[0]
      const processedContent = processedCall[1]
      
      // Check audio player was injected
      expect(processedContent).toContain('class="audio-player"')
      expect(processedContent).toContain('src="../media/audio-0.bin"')
      expect(processedContent).toContain('id="audio-player-welcome"')
    })
    
    it('should include captions track when caption file exists', async () => {
      const htmlNoAudio = `
        <html>
          <body>
            <div class="media-panel"></div>
          </div>
          </body>
        </html>
      `
      
      mockZip.files = {
        'pages/learning-objectives.html': {},
        'media/audio-1.bin': {},
        'media/audio-1.json': {},
        'media/caption-1.bin': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlNoAudio)
      }
      
      mockZip.file.mockImplementation((path: string) => {
        if (path === 'pages/learning-objectives.html') return mockFile
        if (path.startsWith('media/')) {
          return {
            async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
          }
        }
        // Return objects with async method for other files in zip.files
        if (Object.keys(mockZip.files).includes(path)) {
          return {
            async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
          }
        }
        return null
      })
      
      await postProcessSCORMPackage(mockZip)
      
      const processedCall = mockProcessedZip.file.mock.calls[0]
      const processedContent = processedCall[1]
      
      // Check caption track was included
      expect(processedContent).toContain('<track kind="captions"')
      expect(processedContent).toContain('src="../media/caption-1.bin"')
    })
    
    it('should not inject audio player if page already has one', async () => {
      const htmlWithAudio = `
        <html>
          <body>
            <div class="audio-player">Existing player</div>
          </body>
        </html>
      `
      
      mockZip.files = {
        'pages/welcome.html': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlWithAudio)
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      await postProcessSCORMPackage(mockZip)
      
      const processedCall = mockProcessedZip.file.mock.calls[0]
      const processedContent = processedCall[1]
      
      // Should not duplicate audio player
      expect(processedContent).toBe(htmlWithAudio)
      expect(processedContent.match(/audio-player/g)?.length).toBe(1)
    })
    
    it('should skip pages without corresponding audio files', async () => {
      const htmlNoAudio = `
        <html>
          <body>
            <div class="media-panel"></div>
          </div>
          </body>
        </html>
      `
      
      mockZip.files = {
        'pages/welcome.html': {}
        // No audio files
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlNoAudio)
      }
      
      mockZip.file.mockImplementation((path: string) => {
        if (path === 'pages/welcome.html') return mockFile
        return null // No audio files
      })
      
      await postProcessSCORMPackage(mockZip)
      
      const processedCall = mockProcessedZip.file.mock.calls[0]
      const processedContent = processedCall[1]
      
      // Should not inject audio player
      expect(processedContent).not.toContain('audio-player')
      expect(processedContent).toBe(htmlNoAudio)
    })
    
    it('should not add audio to summary page', async () => {
      const htmlSummary = `
        <html>
          <body>
            <div class="media-panel"></div>
          </div>
          </body>
        </html>
      `
      
      mockZip.files = {
        'pages/summary.html': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlSummary)
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      await postProcessSCORMPackage(mockZip)
      
      const processedCall = mockProcessedZip.file.mock.calls[0]
      const processedContent = processedCall[1]
      
      // Summary page should not get audio
      expect(processedContent).not.toContain('audio-player')
    })
    
    it('should handle objectives as alias for learning-objectives', async () => {
      const htmlObjectives = `
        <html>
          <body>
            <div class="media-panel"></div>
          </div>
          </body>
        </html>
      `
      
      mockZip.files = {
        'pages/objectives.html': {},
        'media/audio-1.bin': {},
        'media/audio-1.json': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(htmlObjectives)
      }
      
      mockZip.file.mockImplementation((path: string) => {
        if (path === 'pages/objectives.html') return mockFile
        if (path.startsWith('media/audio-1')) {
          return {
            async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
          }
        }
        // Return objects with async method for other files in zip.files
        if (Object.keys(mockZip.files).includes(path)) {
          return {
            async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
          }
        }
        return null
      })
      
      await postProcessSCORMPackage(mockZip)
      
      const processedCall = mockProcessedZip.file.mock.calls[0]
      const processedContent = processedCall[1]
      
      // Should use audio-1 for objectives page
      expect(processedContent).toContain('src="../media/audio-1.bin"')
    })
  })
  
  describe('Edge cases', () => {
    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = `
        <html>
          <body>
            <div class="media-panel"
            <!-- Missing closing tags -->
      `
      
      mockZip.files = {
        'pages/broken.html': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(malformedHtml)
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      // Should not throw
      await expect(postProcessSCORMPackage(mockZip)).resolves.toBeDefined()
    })
    
    it('should handle empty zip', async () => {
      mockZip.files = {}
      
      const result = await postProcessSCORMPackage(mockZip)
      
      expect(result).toBe(mockProcessedZip)
      expect(mockProcessedZip.file).not.toHaveBeenCalled()
    })
    
    it('should preserve binary file integrity', async () => {
      const binaryData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]) // JPEG header
      
      mockZip.files = {
        'media/image.jpg': {}
      }
      
      const mockFile = {
        async: vi.fn().mockResolvedValue(binaryData)
      }
      
      mockZip.file.mockReturnValue(mockFile)
      
      await postProcessSCORMPackage(mockZip)
      
      // Verify binary data was preserved
      expect(mockProcessedZip.file).toHaveBeenCalledWith('media/image.jpg', binaryData)
    })
  })
})