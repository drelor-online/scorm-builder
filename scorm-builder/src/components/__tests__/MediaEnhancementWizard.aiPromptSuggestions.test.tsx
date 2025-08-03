import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock the search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn()
}))

describe('MediaEnhancementWizard - AI Prompt Suggestions', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()
  
  const mockCourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration',
      imageKeywords: ['safety', 'training'],
      imagePrompts: ['Professional training image for "Welcome". Context: Welcome content... Style: corporate training, clean, modern, educational. Aspect ratio: 16:9 for presentations.'],
      videoSearchTerms: ['safety video', 'training video'],
      duration: 1,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      narration: 'Objectives narration',
      imageKeywords: ['objectives', 'goals'],
      imagePrompts: ['Professional training image for "Learning Objectives". Context: Objectives content... Style: corporate training, clean, modern, educational. Aspect ratio: 16:9 for presentations.'],
      videoSearchTerms: [],
      duration: 1,
      media: []
    },
    topics: [],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }
  
  it('should not show AI prompts in image search suggestions', async () => {
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider projectId="test-project">
          <StepNavigationProvider totalSteps={7}>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={0}
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText(/Search Images/i)).toBeInTheDocument()
    })
    
    // Check that suggested searches appear
    const suggestedSearches = screen.getByText(/Suggested searches:/i)
    expect(suggestedSearches).toBeInTheDocument()
    
    // Check that imageKeywords appear as suggestions
    expect(screen.getByRole('button', { name: /Search for safety/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Search for training/i })).toBeInTheDocument()
    
    // Check that AI prompts do NOT appear as suggestions
    const aiPromptButton = screen.queryByRole('button', { 
      name: /Professional training image/i 
    })
    expect(aiPromptButton).not.toBeInTheDocument()
    
    // AI prompts should not be in the suggestions at all
    const allButtons = screen.getAllByRole('button')
    const suggestionButtons = allButtons.filter(btn => 
      btn.getAttribute('aria-label')?.startsWith('Search for')
    )
    
    // Should only have 2 suggestion buttons (from imageKeywords)
    expect(suggestionButtons).toHaveLength(2)
    
    // None should contain the AI prompt text
    suggestionButtons.forEach(button => {
      expect(button.textContent).not.toContain('Professional training image')
      expect(button.textContent).not.toContain('16:9')
      expect(button.textContent).not.toContain('corporate training')
    })
  })
  
  it('should show AI prompts only in the AI tab', async () => {
    const { container } = render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider projectId="test-project">
          <StepNavigationProvider totalSteps={7}>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={0}
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText(/Search Images/i)).toBeInTheDocument()
    })
    
    // Click on AI tab
    const aiTab = container.querySelector('[data-testid="ai-icon"]')?.closest('button')
    if (aiTab) {
      aiTab.click()
    }
    
    // Wait for AI tab content
    await waitFor(() => {
      expect(screen.getByText(/AI Image Generation Helper/i)).toBeInTheDocument()
    })
    
    // AI prompt should be visible in AI tab
    expect(screen.getByText(/Professional training image for "Welcome"/)).toBeInTheDocument()
  })
})