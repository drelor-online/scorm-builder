import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PageThumbnailGrid } from '../PageThumbnailGrid'
import { vi } from 'vitest'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'

// Mock MediaService
vi.mock('../../services/MediaService', () => ({
  createMediaService: vi.fn().mockReturnValue({
    getMedia: vi.fn(),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    listMedia: vi.fn().mockResolvedValue([]),
    listAllMedia: vi.fn().mockResolvedValue([])
  })
}))

describe('PageThumbnailGrid - Objectives Page Selection', () => {
  const mockCourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content'
    },
    objectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives content'
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic 1 content'
      }
    ]
  }

  it('should allow selecting the learning objectives page', () => {
    const onPageSelect = vi.fn()
    
    render(
      <UnifiedMediaProvider projectId="test">
        <PageThumbnailGrid
          courseContent={mockCourseContent}
          currentPageId="welcome"
          onPageSelect={onPageSelect}
        />
      </UnifiedMediaProvider>
    )

    // Find the objectives page thumbnail
    const objectivesThumbnail = screen.getByTestId('page-thumbnail-objectives')
    
    // Click on it
    fireEvent.click(objectivesThumbnail)
    
    // Check that onPageSelect was called with 'objectives'
    expect(onPageSelect).toHaveBeenCalledWith('objectives')
  })

  it('should highlight the objectives page when it is current', () => {
    const onPageSelect = vi.fn()
    
    render(
      <UnifiedMediaProvider projectId="test">
        <PageThumbnailGrid
          courseContent={mockCourseContent}
          currentPageId="objectives"
          onPageSelect={onPageSelect}
        />
      </UnifiedMediaProvider>
    )

    // Find the objectives page thumbnail
    const objectivesThumbnail = screen.getByTestId('page-thumbnail-objectives')
    
    // It should have the 'selected' class
    expect(objectivesThumbnail).toHaveClass('selected')
  })
})