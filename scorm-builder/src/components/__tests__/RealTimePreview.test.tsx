import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RealTimePreview } from '../RealTimePreview'
import React from 'react'

// Mock the preview generator
vi.mock('../../services/previewGenerator', () => ({
  generatePreviewHTML: vi.fn()
}))

// Mock storage
const mockGetContent = vi.fn()
const mockGetMedia = vi.fn()
const mockGetCourseMetadata = vi.fn()

vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    getContent: mockGetContent,
    getMedia: mockGetMedia,
    getCourseMetadata: mockGetCourseMetadata
  })
}))

import { generatePreviewHTML } from '../../services/previewGenerator'

describe('RealTimePreview - Intent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCourseMetadata.mockResolvedValue({
      title: 'Test Course',
      topics: ['topic-1', 'topic-2']
    })
    
    // Mock preview generator to return valid HTML
    vi.mocked(generatePreviewHTML).mockResolvedValue('<html><body>Preview</body></html>')
  })
  
  it('should generate preview from actual stored data, not mocks', async () => {
    // Intent: Preview shows real content that user has entered
    mockGetContent.mockImplementation((id) => {
      if (id === 'topic-1') {
        return Promise.resolve({
          topicId: 'topic-1',
          title: 'Safety Basics',
          content: 'This is the real content user typed'
        })
      }
      return Promise.resolve(null)
    })
    
    render(<RealTimePreview />)
    
    // Should show loading initially
    expect(screen.getByText(/Generating preview/i)).toBeInTheDocument()
    
    // Should load and display real content
    await waitFor(() => {
      const iframe = screen.getByTitle('Course Preview')
      expect(iframe).toBeInTheDocument()
      expect(iframe.getAttribute('src')).toContain('blob:')
    })
  })
  
  it('should update preview when content changes', async () => {
    // Intent: Preview updates in real-time as user edits
    const { rerender } = render(<RealTimePreview />)
    
    await waitFor(() => {
      expect(screen.getByTitle('Course Preview')).toBeInTheDocument()
    })
    
    // Simulate content change
    mockGetContent.mockResolvedValue({
      topicId: 'topic-1',
      title: 'Updated Title',
      content: 'Updated content'
    })
    
    // Trigger refresh
    const refreshButton = screen.getByLabelText(/Refresh preview/i)
    fireEvent.click(refreshButton)
    
    await waitFor(() => {
      expect(mockGetContent).toHaveBeenCalledTimes(2)
    })
  })
  
  it('should include uploaded media files in preview', async () => {
    // Intent: Images and audio user uploaded appear in preview
    mockGetMedia.mockResolvedValue({
      id: 'topic-1-image',
      blob: new Blob(['image data'], { type: 'image/png' }),
      type: 'image/png',
      mediaType: 'image'
    })
    
    render(<RealTimePreview />)
    
    await waitFor(() => {
      expect(generatePreviewHTML).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: expect.arrayContaining([
            expect.objectContaining({
              media: expect.arrayContaining([
                expect.objectContaining({
                  blob: expect.any(Blob)
                })
              ])
            })
          ])
        })
      )
    })
  })
  
  it('should show empty state when no content exists', async () => {
    // Intent: Clear message when nothing to preview
    mockGetCourseMetadata.mockResolvedValue(null)
    mockGetContent.mockResolvedValue(null)
    
    render(<RealTimePreview />)
    
    await waitFor(() => {
      expect(screen.getByText(/No content to preview/i)).toBeInTheDocument()
      expect(screen.getByText(/Start adding content/i)).toBeInTheDocument()
    })
  })
  
  it('should handle preview generation errors gracefully', async () => {
    // Intent: User sees helpful error instead of crash
    const { generatePreviewHTML } = await import('../../services/previewGenerator')
    vi.mocked(generatePreviewHTML).mockRejectedValue(new Error('Generation failed'))
    
    render(<RealTimePreview />)
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate preview/i)).toBeInTheDocument()
      expect(screen.getByText(/Try again/i)).toBeInTheDocument()
    })
  })
  
  it('should progressively show more content as user adds it', async () => {
    // Intent: Preview grows as user builds course
    
    // Start with one topic
    mockGetCourseMetadata.mockResolvedValue({
      title: 'Test Course',
      topics: ['topic-1']
    })
    
    const { rerender } = render(<RealTimePreview />)
    
    await waitFor(() => {
      expect(screen.getByTitle('Course Preview')).toBeInTheDocument()
    })
    
    // Add another topic
    mockGetCourseMetadata.mockResolvedValue({
      title: 'Test Course', 
      topics: ['topic-1', 'topic-2']
    })
    
    // Refresh preview
    fireEvent.click(screen.getByLabelText(/Refresh preview/i))
    
    await waitFor(() => {
      const { generatePreviewHTML } = require('../../services/previewGenerator')
      const lastCall = generatePreviewHTML.mock.calls[generatePreviewHTML.mock.calls.length - 1]
      expect(lastCall[0].topics).toHaveLength(2)
    })
  })
})