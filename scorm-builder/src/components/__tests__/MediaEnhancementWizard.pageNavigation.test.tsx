import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock storage functions
vi.mock('../../services/PersistentStorage', () => ({
  PersistentStorage: {
    saveProject: vi.fn(),
    loadProject: vi.fn(),
    getAvailableProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn(),
    autoSave: vi.fn()
  }
}))

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock media context
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUnifiedMedia: () => ({
    listMedia: vi.fn().mockResolvedValue([]),
    getMediaForPage: vi.fn().mockReturnValue([]),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    createBlobUrl: vi.fn(),
    revokeBlobUrl: vi.fn(),
    getMediaUrl: vi.fn(),
    storeExternalMedia: vi.fn(),
    storeYouTubeVideo: vi.fn()
  })
}))

const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    media: []
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Learning Objectives', 
    content: 'Objectives content',
    media: []
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Introduction to Safety',
      content: 'Safety basics',
      media: []
    },
    {
      id: 'topic-2',
      title: 'Advanced Concepts',
      content: 'Advanced topics',
      media: []
    }
  ]
}

describe('MediaEnhancementWizard - Page Navigation', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display page navigation UI with all pages', () => {
    render(
      <PersistentStorageProvider>
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
      </PersistentStorageProvider>
    )

    // Should show a way to navigate between pages
    expect(screen.getByText(/Welcome/)).toBeInTheDocument()
    
    // Should be able to see or access Learning Objectives page
    // This could be in a dropdown, button group, or navigation list
    const navElement = screen.getByTestId('page-navigation') || 
                      screen.getByRole('navigation') ||
                      screen.getByLabelText(/Select page/i)
    expect(navElement).toBeInTheDocument()
  })

  it('should allow selecting the Learning Objectives page', () => {
    render(
      <PersistentStorageProvider>
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
      </PersistentStorageProvider>
    )

    // Find and click on Learning Objectives navigation
    const objectivesButton = screen.getByText(/Learning Objectives/i, { 
      selector: 'button, option, [role="button"], [role="option"]' 
    })
    fireEvent.click(objectivesButton)

    // Should update the current page
    expect(mockOnPageChange).toHaveBeenCalledWith(1)
  })

  it('should allow navigating to topic pages', () => {
    render(
      <PersistentStorageProvider>
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
      </PersistentStorageProvider>
    )

    // Should be able to navigate to topic pages
    const topicButton = screen.getByText(/Introduction to Safety/i, {
      selector: 'button, option, [role="button"], [role="option"]'
    })
    fireEvent.click(topicButton)

    // Should update to topic index (2 = first topic after welcome and objectives)
    expect(mockOnPageChange).toHaveBeenCalledWith(2)
  })

  it('should highlight the current page in navigation', () => {
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={1} // Start on Learning Objectives
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Learning Objectives should be highlighted/selected
    const objectivesElement = screen.getByText(/Learning Objectives/i).closest('button, [role="button"]')
    expect(objectivesElement).toHaveAttribute('aria-selected', 'true')
    // or check for a selected class/style
  })

  it('should clear search results when changing pages', () => {
    const { rerender } = render(
      <PersistentStorageProvider>
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
      </PersistentStorageProvider>
    )

    // Simulate having search results by typing in search
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test' } })

    // Change to a different page
    rerender(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={1}
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Search input should be cleared
    const newSearchInput = screen.getByPlaceholderText(/search for images/i)
    expect(newSearchInput).toHaveValue('')
  })
})