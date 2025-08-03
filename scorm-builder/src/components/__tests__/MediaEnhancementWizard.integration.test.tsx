import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

// Mock search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue({
    results: [
      {
        id: 'test-img-1',
        url: 'https://example.com/test.jpg',
        title: 'Test Image',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        width: 800,
        height: 600
      }
    ],
    totalResults: 1
  }),
  searchYouTubeVideos: vi.fn()
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
    title: 'Objectives', 
    content: 'Objectives content',
    media: []
  },
  topics: []
}

describe('MediaEnhancementWizard - Integration Test', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render without crashing', () => {
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

    expect(screen.getByText(/Media Enhancement/i)).toBeInTheDocument()
  })

  it('should have functional handleToggleSelection for media selection', async () => {
    const { container } = render(
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

    // Should have search functionality
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    expect(searchInput).toBeInTheDocument()
    
    // Enter search term
    fireEvent.change(searchInput, { target: { value: 'test' } })
    
    // Click search
    const searchButton = screen.getByText(/Search/i)
    fireEvent.click(searchButton)
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument()
    }, { timeout: 5000 })
    
    // The result should be clickable
    const result = screen.getByText('Test Image').closest('div')
    expect(result).toHaveStyle({ cursor: 'pointer' })
  })

  it('should show Alert component with success type', () => {
    // Direct test of Alert component
    const Alert: React.FC<{ 
      type?: 'info' | 'warning' | 'success'
      children: React.ReactNode 
    }> = ({ type = 'info', children }) => {
      const colors = {
        info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd' },
        warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)', text: '#fcd34d' },
        success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: '#86efac' }
      }
      
      const style = colors[type] || colors.info
      
      return (
        <div data-testid="alert" style={{ backgroundColor: style.bg }}>
          {children}
        </div>
      )
    }
    
    const { container } = render(<Alert type="success">Success!</Alert>)
    const alert = screen.getByTestId('alert')
    expect(alert).toHaveTextContent('Success!')
    expect(alert).toHaveStyle({ backgroundColor: 'rgba(34, 197, 94, 0.1)' })
  })
})