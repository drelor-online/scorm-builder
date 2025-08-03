import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'

// Mock the media context
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUnifiedMedia: () => ({
    listMedia: vi.fn().mockResolvedValue([]),
    getMediaForPage: vi.fn().mockReturnValue([]),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    createBlobUrl: vi.fn(),
    getMediaUrl: vi.fn(),
    storeExternalMedia: vi.fn(),
    storeYouTubeVideo: vi.fn()
  })
}))

const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome to Natural Gas Safety',
    content: 'This course covers natural gas safety procedures.',
    media: []
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Learning Objectives',
    content: 'By the end of this course, you will understand gas safety.',
    media: []
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Introduction to Natural Gas',
      content: 'Natural gas is a fossil fuel used for heating.',
      media: []
    },
    {
      id: 'topic-2',
      title: 'Safety Equipment',
      content: 'Proper safety equipment includes gas detectors.',
      media: []
    }
  ]
}

describe('MediaEnhancementWizard - AI Image Tools Tab', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not crash when AI Image Tools tab is selected', async () => {
    // This test should initially FAIL with "pages is not defined" error
    const { container } = render(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    // Click on AI Image Tools tab
    const aiToolsTab = screen.getByText('AI Image Tools')
    fireEvent.click(aiToolsTab)

    // Should not crash and should display AI tools content
    await waitFor(() => {
      expect(screen.getByText(/AI Image Generation Helper/i)).toBeInTheDocument()
    })

    // Should display the prompt based on current page
    const promptElement = container.querySelector('[style*="fontFamily"]')
    expect(promptElement).toBeInTheDocument()
    expect(promptElement?.textContent).toContain('Welcome to Natural Gas Safety')
  })

  it('should generate correct prompt for different pages', async () => {
    const { rerender } = render(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    // Click on AI Image Tools tab
    const aiToolsTab = screen.getByText('AI Image Tools')
    fireEvent.click(aiToolsTab)

    // Check prompt for welcome page
    let promptText = screen.getByText(/Professional training image/i).textContent
    expect(promptText).toContain('Welcome to Natural Gas Safety')

    // Change to topic page
    rerender(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={2} // First topic
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    // Prompt should update for new page
    await waitFor(() => {
      promptText = screen.getByText(/Professional training image/i).textContent
      expect(promptText).toContain('Introduction to Natural Gas')
    })
  })

  it('should allow copying prompt to clipboard', async () => {
    // Mock clipboard API
    const mockWriteText = vi.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText
      }
    })

    render(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    // Click on AI Image Tools tab
    const aiToolsTab = screen.getByText('AI Image Tools')
    fireEvent.click(aiToolsTab)

    // Click copy button
    const copyButton = screen.getByText('Copy Prompt')
    fireEvent.click(copyButton)

    // Should copy prompt to clipboard
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('Professional training image')
    )
  })

  it('should display external AI tool links', () => {
    render(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    // Click on AI Image Tools tab
    const aiToolsTab = screen.getByText('AI Image Tools')
    fireEvent.click(aiToolsTab)

    // Should show links to external AI tools
    expect(screen.getByText(/DALL-E 3/i)).toBeInTheDocument()
    expect(screen.getByText(/Midjourney/i)).toBeInTheDocument()
    expect(screen.getByText(/Stable Diffusion/i)).toBeInTheDocument()
    expect(screen.getByText(/Microsoft Designer/i)).toBeInTheDocument()
  })
})