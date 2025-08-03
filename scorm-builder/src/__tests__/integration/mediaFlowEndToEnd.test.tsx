import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AllTheProviders } from '../../test/testProviders'
import App from '../../App'
import { CourseContent } from '../../types/aiPrompt'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock window.__TAURI_INTERNALS__
;(global as any).window.__TAURI_INTERNALS__ = {
  transformCallback: (callback: Function) => callback,
  invoke: vi.fn()
}

const mockInvoke = vi.mocked((window as any).__TAURI__.invoke)

describe('Media Flow End-to-End Integration Tests', () => {
  const testProjectId = 'e2e-media-test-project'
  let storedMedia: Map<string, { data: Uint8Array; metadata: any }> = new Map()
  let projectStorage: Map<string, any> = new Map()
  
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    storedMedia.clear()
    projectStorage.clear()
    
    // Mock Tauri responses
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      console.log('[Mock Tauri]', cmd, args)
      
      switch (cmd) {
        case 'store_media':
          const mediaId = args.media_id
          const mediaData = args.data
          storedMedia.set(mediaId, { 
            data: mediaData, 
            metadata: { 
              fileName: args.file_name,
              mimeType: args.mime_type,
              projectId: args.project_id
            }
          })
          return { id: mediaId, path: `media/${mediaId}.bin` }
          
        case 'get_media':
          const media = storedMedia.get(args.media_id)
          if (!media) throw new Error(`Media not found: ${args.media_id}`)
          return media
          
        case 'list_media':
          return Array.from(storedMedia.entries())
            .filter(([_, data]) => data.metadata.projectId === args.project_id)
            .map(([id, data]) => ({
              id,
              fileName: data.metadata.fileName,
              mimeType: data.metadata.mimeType
            }))
            
        case 'save_project':
          projectStorage.set(args.project_id, {
            projectData: args.project_data,
            metadata: args.metadata
          })
          return true
          
        case 'load_project':
          const project = projectStorage.get(args.project_id)
          if (!project) throw new Error(`Project not found: ${args.project_id}`)
          return project
          
        case 'generate_scorm_package':
          // Validate that all referenced media exists
          const courseContent = args.course_content
          const missingMedia: string[] = []
          
          // Check welcome page media
          if (courseContent.welcomePage?.media) {
            courseContent.welcomePage.media.forEach((m: any) => {
              if (m.id && !storedMedia.has(m.id)) {
                missingMedia.push(m.id)
              }
            })
          }
          
          // Check topics media
          courseContent.topics?.forEach((topic: any) => {
            if (topic.media) {
              topic.media.forEach((m: any) => {
                if (m.id && !storedMedia.has(m.id)) {
                  missingMedia.push(m.id)
                }
              })
            }
          })
          
          if (missingMedia.length > 0) {
            throw new Error(`Missing media files: ${missingMedia.join(', ')}`)
          }
          
          return {
            success: true,
            file_path: '/downloads/test-scorm.zip',
            size: 1024 * 1024
          }
          
        case 'get_api_keys':
          return {}
          
        default:
          console.warn('[Mock Tauri] Unhandled command:', cmd)
          return {}
      }
    })
  })

  afterEach(() => {
    // Cleanup blob URLs
    const blobUrls = document.querySelectorAll('img[src^="blob:"], video[src^="blob:"], audio[src^="blob:"]')
    blobUrls.forEach(el => {
      const src = el.getAttribute('src')
      if (src?.startsWith('blob:')) {
        URL.revokeObjectURL(src)
      }
    })
  })

  it('should complete full media flow: upload → save → reload → generate SCORM', async () => {
    const user = userEvent.setup()
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <App />
      </AllTheProviders>
    )
    
    // Wait for app to load
    await waitFor(() => {
      expect(screen.getByText(/project dashboard/i)).toBeInTheDocument()
    })
    
    // Create new project
    const newProjectButton = screen.getByText(/new project/i)
    await user.click(newProjectButton)
    
    // Fill project details
    const projectNameInput = screen.getByLabelText(/project name/i)
    await user.type(projectNameInput, 'E2E Media Test Project')
    
    // Start project creation
    const createButton = screen.getByText(/create/i)
    await user.click(createButton)
    
    // Navigate through steps to Media Enhancement
    // Step 1: Course Seed (skip)
    await waitFor(() => {
      expect(screen.getByText(/course seed/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/next/i))
    
    // Step 2: Media Enhancement
    await waitFor(() => {
      expect(screen.getByText(/media enhancement/i)).toBeInTheDocument()
    })
    
    // Upload an image
    const fileInput = screen.getByLabelText(/upload.*image/i)
    const imageFile = new File(['image data'], 'test-image.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, imageFile)
    
    // Wait for upload to complete
    await waitFor(() => {
      expect(storedMedia.size).toBe(1)
    })
    
    // Get the uploaded media ID
    const uploadedMediaId = Array.from(storedMedia.keys())[0]
    expect(uploadedMediaId).toMatch(/^image-\d+$/)
    
    // Continue to Audio Narration
    await user.click(screen.getByText(/next/i))
    
    // Step 3: Audio Narration (skip)
    await waitFor(() => {
      expect(screen.getByText(/audio narration/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/next/i))
    
    // Step 4: SCORM Package Builder
    await waitFor(() => {
      expect(screen.getByText(/scorm package/i)).toBeInTheDocument()
    })
    
    // Save the project
    const saveButton = screen.getByText(/save project/i)
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(projectStorage.size).toBe(1)
    })
    
    // Verify saved data includes media reference
    const savedProject = projectStorage.get(testProjectId)
    expect(savedProject).toBeDefined()
    expect(savedProject.projectData.welcomePage.media).toHaveLength(1)
    expect(savedProject.projectData.welcomePage.media[0].id).toBe(uploadedMediaId)
    
    // Simulate page reload by clearing and reloading
    storedMedia.clear()
    
    // Reload the project
    const loadButton = screen.getByText(/load project/i)
    await user.click(loadButton)
    
    // Select our project
    await waitFor(() => {
      expect(screen.getByText('E2E Media Test Project')).toBeInTheDocument()
    })
    await user.click(screen.getByText('E2E Media Test Project'))
    
    // Verify media is restored
    await waitFor(() => {
      expect(screen.getByText(/media enhancement/i)).toBeInTheDocument()
    })
    
    // Check that media is displayed
    const mediaElements = screen.getAllByRole('img')
    expect(mediaElements.length).toBeGreaterThan(0)
    
    // Continue to SCORM generation
    await user.click(screen.getByText(/next/i))
    await user.click(screen.getByText(/next/i))
    
    // Generate SCORM package
    const generateButton = screen.getByText(/generate scorm/i)
    await user.click(generateButton)
    
    // Verify SCORM generation succeeds
    await waitFor(() => {
      expect(screen.getByText(/scorm package generated/i)).toBeInTheDocument()
    })
    
    // Verify the mock was called with correct data
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_package', 
      expect.objectContaining({
        course_content: expect.objectContaining({
          welcomePage: expect.objectContaining({
            media: expect.arrayContaining([
              expect.objectContaining({
                id: uploadedMediaId
              })
            ])
          })
        })
      })
    )
  })

  it('should handle YouTube videos differently from uploaded media', async () => {
    const user = userEvent.setup()
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    
    // Mock search service to return YouTube video
    vi.mock('../../services/searchService', () => ({
      searchGoogleImages: vi.fn().mockResolvedValue({
        results: [{
          id: 'yt-video-1',
          url: youtubeUrl,
          embedUrl: embedUrl,
          title: 'Test YouTube Video',
          thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg'
        }]
      })
    }))
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <App />
      </AllTheProviders>
    )
    
    // Navigate to Media Enhancement
    // ... (navigation code similar to above)
    
    // Search for YouTube video
    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'test video')
    
    const searchButton = screen.getByText(/search/i)
    await user.click(searchButton)
    
    // Select YouTube video
    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    })
    
    const selectButton = screen.getByText(/select/i)
    await user.click(selectButton)
    
    // Verify YouTube URL is NOT stored as media file
    expect(storedMedia.size).toBe(0)
    
    // Save project
    const saveButton = screen.getByText(/save project/i)
    await user.click(saveButton)
    
    // Verify YouTube URL is preserved in project data
    const savedProject = projectStorage.get(testProjectId)
    expect(savedProject.projectData.welcomePage.media[0]).toEqual(
      expect.objectContaining({
        url: youtubeUrl,
        embedUrl: embedUrl,
        type: 'video',
        title: 'Test YouTube Video'
      })
    )
    
    // Generate SCORM
    await user.click(screen.getByText(/next/i))
    await user.click(screen.getByText(/next/i))
    
    const generateButton = screen.getByText(/generate scorm/i)
    await user.click(generateButton)
    
    // Verify SCORM generation includes YouTube data
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_package',
      expect.objectContaining({
        course_content: expect.objectContaining({
          welcomePage: expect.objectContaining({
            media: expect.arrayContaining([
              expect.objectContaining({
                url: youtubeUrl,
                embed_url: embedUrl,
                is_youtube: true
              })
            ])
          })
        })
      })
    )
  })

  it('should handle media deletion and ensure consistency', async () => {
    const user = userEvent.setup()
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <App />
      </AllTheProviders>
    )
    
    // ... navigate to Media Enhancement ...
    
    // Upload multiple images
    const fileInput = screen.getByLabelText(/upload.*image/i)
    const files = [
      new File(['image1'], 'image1.jpg', { type: 'image/jpeg' }),
      new File(['image2'], 'image2.jpg', { type: 'image/jpeg' }),
      new File(['image3'], 'image3.jpg', { type: 'image/jpeg' })
    ]
    
    for (const file of files) {
      await user.upload(fileInput, file)
    }
    
    // Wait for all uploads
    await waitFor(() => {
      expect(storedMedia.size).toBe(3)
    })
    
    // Delete middle image
    const deleteButtons = screen.getAllByLabelText(/delete/i)
    await user.click(deleteButtons[1])
    
    // Confirm deletion
    const confirmButton = screen.getByText(/confirm/i)
    await user.click(confirmButton)
    
    // Verify media was deleted
    await waitFor(() => {
      expect(storedMedia.size).toBe(2)
    })
    
    // Save and generate SCORM
    const saveButton = screen.getByText(/save project/i)
    await user.click(saveButton)
    
    // Navigate to SCORM generation
    await user.click(screen.getByText(/next/i))
    await user.click(screen.getByText(/next/i))
    
    const generateButton = screen.getByText(/generate scorm/i)
    await user.click(generateButton)
    
    // Verify only 2 media items in SCORM
    const scormCall = mockInvoke.mock.calls.find(call => call[0] === 'generate_scorm_package')
    expect(scormCall).toBeDefined()
    
    const courseContent = scormCall![1].course_content
    expect(courseContent.welcomePage.media).toHaveLength(2)
    
    // Verify deleted media ID is not present
    const mediaIds = courseContent.welcomePage.media.map((m: any) => m.id)
    expect(mediaIds).not.toContain('image-1')
    expect(mediaIds).toContain('image-0')
    expect(mediaIds).toContain('image-2')
  })
})