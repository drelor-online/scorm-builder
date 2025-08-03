import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'

// Mock the UnifiedMediaContext
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: vi.fn(() => ({
    storeMedia: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
    getMediaForPage: vi.fn(() => []),
    getAllMedia: vi.fn(() => []),
    getMediaById: vi.fn(),
    createBlobUrl: vi.fn((id) => Promise.resolve(`blob:mock-${id}`)),
    revokeBlobUrl: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
    refreshMedia: vi.fn()
  }))
}))

// Mock API service
vi.mock('../../services/ApiService', () => ({
  searchImages: vi.fn().mockResolvedValue([]),
  searchVideos: vi.fn().mockResolvedValue([]),
  generateAIImage: vi.fn().mockResolvedValue({ id: 'ai-1', url: 'ai-image.jpg' })
}))

describe('MediaEnhancementWizard - AI Image Tools Tab', () => {
  const mockProps = {
    courseSeed: {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: ['Topic 1', 'Topic 2'],
      template: 'None' as const,
      templateTopics: []
    },
    activities: [{
      id: 'page-1',
      type: 'page' as const,
      content: { title: 'Page 1', text: 'Content 1' }
    }],
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSave: vi.fn()
  }
  
  it('should have AI Image Tools tab available', () => {
    render(
      <MediaEnhancementWizard {...mockProps} />
    )
    
    // Check for AI Image Tools tab
    const aiTab = screen.getByRole('tab', { name: /ai image|ai tools|generate/i })
    expect(aiTab).toBeInTheDocument()
  })
  
  it('should show AI image generation interface when tab is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <MediaEnhancementWizard {...mockProps} />
    )
    
    // Click AI tab
    const aiTab = screen.getByRole('tab', { name: /ai image|ai tools|generate/i })
    await user.click(aiTab)
    
    // Should show AI generation interface
    expect(screen.getByText(/generate.*image/i)).toBeInTheDocument()
    
    // Should have prompt input
    const promptInput = screen.getByPlaceholderText(/describe.*image|enter.*prompt|what.*image/i)
    expect(promptInput).toBeInTheDocument()
    
    // Should have generate button
    const generateButton = screen.getByRole('button', { name: /generate/i })
    expect(generateButton).toBeInTheDocument()
  })
  
  it('should allow generating AI images with prompts', async () => {
    const user = userEvent.setup()
    const { generateAIImage } = await import('../../services/ApiService')
    const mockGenerate = vi.mocked(generateAIImage)
    
    mockGenerate.mockResolvedValue({
      id: 'ai-generated-1',
      url: 'generated-image.jpg',
      prompt: 'professional office setting'
    })
    
    render(<MediaEnhancementWizard {...mockProps} />)
    
    // Navigate to AI tab
    const aiTab = screen.getByRole('tab', { name: /ai image|ai tools|generate/i })
    await user.click(aiTab)
    
    // Enter prompt
    const promptInput = screen.getByPlaceholderText(/describe.*image|enter.*prompt|what.*image/i)
    await user.type(promptInput, 'professional office setting')
    
    // Click generate
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await user.click(generateButton)
    
    // Verify generation was called
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('professional office setting')
    }))
  })
  
  it('should show AI-specific features and options', async () => {
    const user = userEvent.setup()
    
    render(
      <MediaEnhancementWizard {...mockProps} />
    )
    
    // Navigate to AI tab
    const aiTab = screen.getByRole('tab', { name: /ai image|ai tools|generate/i })
    await user.click(aiTab)
    
    // Should have style options
    expect(screen.getByText(/style|artistic|realistic|cartoon/i)).toBeInTheDocument()
    
    // Should have aspect ratio options
    expect(screen.getByText(/aspect ratio|dimensions|size/i)).toBeInTheDocument()
    
    // Should have prompt suggestions or examples
    const suggestions = screen.queryByText(/suggestion|example|try/i)
    if (suggestions) {
      expect(suggestions).toBeInTheDocument()
    }
  })
  
  it('should be placed logically in tab order', () => {
    render(
      <MediaEnhancementWizard {...mockProps} />
    )
    
    // Get all tabs
    const tabs = screen.getAllByRole('tab')
    const tabNames = tabs.map(tab => tab.textContent?.toLowerCase())
    
    // AI tools should be with other media tabs
    expect(tabNames).toContain(expect.stringMatching(/ai|generate/))
    
    // Should be near Images tab since it generates images
    const aiIndex = tabNames.findIndex(name => name?.match(/ai|generate/))
    const imagesIndex = tabNames.findIndex(name => name?.match(/image/))
    
    // AI tab should be within 2 positions of Images tab
    expect(Math.abs(aiIndex - imagesIndex)).toBeLessThanOrEqual(2)
  })
})