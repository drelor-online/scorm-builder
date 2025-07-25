import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
import { 
  exportProject, 
  importProject, 
  ProjectExportData
} from './ProjectExportImport'

// Mock JSZip
vi.mock('jszip')

// Mock file system access
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

describe('ProjectExportImport', () => {
  let mockZipInstance: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock zip instance
    mockZipInstance = {
      file: vi.fn(),
      folder: vi.fn().mockReturnValue({
        file: vi.fn(),
        folder: vi.fn().mockReturnValue({
          file: vi.fn()
        })
      }),
      generateAsync: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'application/zip' })),
      loadAsync: vi.fn().mockResolvedValue(mockZipInstance),
      files: {}
    }
    
    // Mock JSZip constructor
    vi.mocked(JSZip).mockImplementation(() => mockZipInstance as any)
  })

  describe('exportProject', () => {
    const mockProjectData: ProjectExportData = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        projectName: 'Test Project'
      },
      courseData: {
        title: 'Test Course',
        language: 'en',
        keywords: ['test'],
        topics: [
          {
            title: 'Topic 1',
            content: 'Content 1',
            media: [
              {
                id: '1',
                type: 'image',
                url: 'blob:http://localhost/image1.jpg',
                name: 'image1.jpg'
              },
              {
                id: '2',
                type: 'audio',
                url: 'blob:http://localhost/audio1.mp3',
                name: 'audio1.mp3'
              },
              {
                id: '3',
                type: 'youtube',
                url: 'https://youtube.com/embed/test123',
                name: 'YouTube Video'
              }
            ]
          }
        ]
      },
      media: {
        images: [
          {
            filename: 'image1.jpg',
            data: 'base64ImageData',
            mimeType: 'image/jpeg'
          }
        ],
        audio: [
          {
            filename: 'audio1.mp3',
            data: 'base64AudioData',
            mimeType: 'audio/mpeg'
          }
        ],
        captions: [
          {
            filename: 'audio1.vtt',
            data: 'WEBVTT\n\n00:00.000 --> 00:05.000\nTest caption',
            mimeType: 'text/vtt'
          }
        ]
      }
    }

    it('should create a zip file with project data', async () => {
      const result = await exportProject(mockProjectData)
      
      expect(result).toEqual({
        success: true,
        filename: expect.stringMatching(/^scorm-project-.*\.zip$/),
        blob: expect.any(Blob)
      })
    })

    it('should include manifest.json with project metadata', async () => {
      await exportProject(mockProjectData)
      
      // Check that file was called with manifest.json
      const manifestCall = mockZipInstance.file.mock.calls.find((call: any[]) => call[0] === 'manifest.json')
      expect(manifestCall).toBeDefined()
      expect(manifestCall[1]).toContain('"version": "1.0.0"')
    })

    it('should organize media files in appropriate folders', async () => {
      const mockFolder = mockZipInstance.folder()
      await exportProject(mockProjectData)
      
      // Check images folder
      expect(mockFolder.folder().file).toHaveBeenCalledWith(
        'image1.jpg',
        'base64ImageData',
        { base64: true }
      )
      
      // Check audio folder
      expect(mockFolder.folder().file).toHaveBeenCalledWith(
        'audio1.mp3',
        'base64AudioData',
        { base64: true }
      )
      
      // Check captions folder
      expect(mockFolder.folder().file).toHaveBeenCalledWith(
        'audio1.vtt',
        'WEBVTT\n\n00:00.000 --> 00:05.000\nTest caption'
      )
    })

    it('should include course data JSON', async () => {
      await exportProject(mockProjectData)
      
      // Check that file was called with course-data.json
      const courseDataCall = mockZipInstance.file.mock.calls.find((call: any[]) => call[0] === 'course-data.json')
      expect(courseDataCall).toBeDefined()
      expect(courseDataCall[1]).toContain('"title": "Test Course"')
    })

    it('should exclude YouTube videos from media export', async () => {
      await exportProject(mockProjectData)
      
      // Should not try to download YouTube content
      const mockFolder = mockZipInstance.folder()
      expect(mockFolder.folder().file).not.toHaveBeenCalledWith(
        expect.stringMatching(/youtube/),
        expect.anything()
      )
    })

    it('should handle empty media arrays', async () => {
      const projectWithNoMedia = {
        ...mockProjectData,
        media: {
          images: [],
          audio: [],
          captions: []
        }
      }
      
      const result = await exportProject(projectWithNoMedia)
      expect(result.success).toBe(true)
    })

    it('should handle export errors gracefully', async () => {
      mockZipInstance.generateAsync = vi.fn().mockRejectedValue(new Error('Zip error'))
      
      const result = await exportProject(mockProjectData)
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to export project: Zip error'
      })
    })
  })

  describe('importProject', () => {
    it('should extract and parse project data from zip file', async () => {
      const mockFile = new File(['mock zip content'], 'project.zip', { type: 'application/zip' })
      
      // Mock JSZip to return expected structure
      mockZipInstance.files = {
        'manifest.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            projectName: 'Imported Project'
          }))
        },
        'course-data.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({
            title: 'Imported Course',
            topics: []
          }))
        },
        'media/images/image1.jpg': {
          async: vi.fn().mockResolvedValue('base64ImageData')
        }
      }
      
      const result = await importProject(mockFile)
      
      expect(result.success).toBe(true)
      expect(result.data?.courseData.title).toBe('Imported Course')
    })

    it('should reconstruct media URLs after import', async () => {
      const mockFile = new File(['mock zip'], 'project.zip')
      
      mockZipInstance.files = {
        'manifest.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({
            version: '1.0.0'
          }))
        },
        'course-data.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({
            topics: [{
              title: 'Topic 1',
              media: [
                {
                  id: '1',
                  type: 'image',
                  filename: 'image1.jpg'
                }
              ]
            }]
          }))
        },
        'media/images/image1.jpg': {
          async: vi.fn().mockResolvedValue('base64ImageData')
        }
      }
      
      const result = await importProject(mockFile)
      
      expect(result.data?.mediaMap).toHaveProperty('image1.jpg')
      expect(result.data?.mediaMap['image1.jpg']).toMatch(/^blob:/)
    })

    it('should handle version compatibility check', async () => {
      const mockFile = new File(['mock zip'], 'project.zip')
      
      mockZipInstance.files = {
        'manifest.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({
            version: '2.0.0' // Incompatible version
          }))
        },
        'course-data.json': {
          async: vi.fn().mockResolvedValue('{}')
        }
      }
      
      const result = await importProject(mockFile)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('version')
    })

    it('should validate imported data structure', async () => {
      const mockFile = new File(['mock zip'], 'project.zip')
      
      mockZipInstance.files = {
        'manifest.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({ version: '1.0.0' }))
        },
        'course-data.json': {
          async: vi.fn().mockResolvedValue('invalid json')
        }
      }
      
      const result = await importProject(mockFile)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })

    it('should handle missing required files', async () => {
      const mockFile = new File(['mock zip'], 'project.zip')
      
      mockZipInstance.files = {} // Empty zip
      
      const result = await importProject(mockFile)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing required files')
    })

    it('should import captions correctly', async () => {
      const mockFile = new File(['mock zip'], 'project.zip')
      
      mockZipInstance.files = {
        'manifest.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({ version: '1.0.0' }))
        },
        'course-data.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({
            topics: [{
              media: [{
                type: 'audio',
                filename: 'audio1.mp3',
                captionFile: 'audio1.vtt'
              }]
            }]
          }))
        },
        'media/audio/audio1.mp3': {
          async: vi.fn().mockResolvedValue('YXVkaW9EYXRh') // base64 encoded 'audioData'
        },
        'media/captions/audio1.vtt': {
          async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nTest')
        }
      }
      
      const result = await importProject(mockFile)
      
      if (!result.success) {
        console.log('Import failed with error:', result.error)
      }
      
      expect(result.success).toBe(true)
      expect(result.data?.captionsMap).toBeDefined()
      expect(result.data?.captionsMap).toHaveProperty('audio1.vtt')
    })

    it('should preserve YouTube URLs during import', async () => {
      const mockFile = new File(['mock zip'], 'project.zip')
      
      mockZipInstance.files = {
        'manifest.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({ version: '1.0.0' }))
        },
        'course-data.json': {
          async: vi.fn().mockResolvedValue(JSON.stringify({
            topics: [{
              media: [{
                type: 'youtube',
                url: 'https://youtube.com/embed/test123'
              }]
            }]
          }))
        }
      }
      
      const result = await importProject(mockFile)
      
      expect(result.data?.courseData.topics[0].media[0].url).toBe('https://youtube.com/embed/test123')
    })
  })
})