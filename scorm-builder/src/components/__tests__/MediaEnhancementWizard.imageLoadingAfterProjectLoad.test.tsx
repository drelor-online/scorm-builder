import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { UnsavedChangesProvider } from '../../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../../contexts/NotificationContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { MockFileStorage } from '../../services/MockFileStorage'
import { CourseContent } from '../../types/aiPrompt'
import { CourseSeedData } from '../../types/course'

import { vi } from 'vitest'

// Mock the global URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
global.URL.createObjectURL = mockCreateObjectURL
global.URL.revokeObjectURL = mockRevokeObjectURL

const TestWrapper: React.FC<{ children: React.ReactNode; storage: MockFileStorage }> = ({ children, storage }) => (
  <NotificationProvider>
    <PersistentStorageProvider storage={storage}>
      <UnsavedChangesProvider>
        <StepNavigationProvider>
          <UnifiedMediaProvider>
            {children}
          </UnifiedMediaProvider>
        </StepNavigationProvider>
      </UnsavedChangesProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
)

describe('MediaEnhancementWizard - Image Loading After Project Load', () => {
  let mockStorage: MockFileStorage
  
  beforeEach(async () => {
    vi.clearAllMocks()
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()
    await mockStorage.createProject('Test Project')
    
    // Reset URL mocks
    mockCreateObjectURL.mockImplementation((blob) => `blob:http://localhost:1420/mock-${Math.random().toString(36).substring(2, 9)}`)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      media: [
        {
          id: 'image-0',
          type: 'image',
          url: 'mock-image-url',
          title: 'Test Image',
          source: 'upload'
        }
      ]
    },
    objectivesPage: {
      id: 'objectives',
      title: 'Objectives',
      content: 'Objectives content'
    },
    topics: [],
    assessmentQuestions: []
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Natural Gas Safety',
    difficulty: 3,
    template: 'None',
    customTopics: [],
    templateTopics: []
  }

  it('should reproduce image loading failure after project reload', async () => {
    // First render - simulate initial project load with image
    await mockStorage.storeMedia('image-0', new Uint8Array([1, 2, 3, 4]), 'image', {
      original_name: 'test-image.jpg',
      mime_type: 'image/jpeg',
      page_id: 'welcome'
    })

    const { rerender } = render(
      <TestWrapper storage={mockStorage}>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // Wait for component to load and media to be processed
    await waitFor(() => {
      expect(screen.getByText('Welcome to Natural Gas Safety')).toBeInTheDocument()
    })

    // Simulate project reload by clearing blob URLs (what happens in real scenario)
    const createdBlobUrls = mockCreateObjectURL.mock.results.map(result => result.value)
    createdBlobUrls.forEach(url => {
      // Simulate the browser invalidating the blob URL
      Object.defineProperty(window, 'fetch', {
        value: vi.fn().mockImplementation((url) => {
          if (url.startsWith('blob:')) {
            return Promise.reject(new Error('Failed to load resource: net::ERR_FILE_NOT_FOUND'))
          }
          return Promise.resolve({ ok: true })
        })
      })
    })

    // Re-render component (simulating navigation back to the page after project reload)
    rerender(
      <TestWrapper storage={mockStorage}>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // The issue: Image should show "Image unavailable" because blob URL is stale
    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument()
    }, { timeout: 5000 })

    // This test should FAIL initially, demonstrating the issue
    // After fix, the image should reload properly instead of showing "unavailable"
  })

  it('should clear blob URL cache when loading a new project', async () => {
    // Setup initial media
    await mockStorage.storeMedia('image-0', new Uint8Array([1, 2, 3, 4]), 'image', {
      original_name: 'test-image.jpg',
      mime_type: 'image/jpeg',
      page_id: 'welcome'
    })

    render(
      <TestWrapper storage={mockStorage}>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    const initialCallCount = mockCreateObjectURL.mock.calls.length

    // Simulate project switch by creating and opening a different project
    await mockStorage.createProject('Different Project')
    
    // Store same media in new project
    await mockStorage.storeMedia('image-0', new Uint8Array([5, 6, 7, 8]), 'image', {
      original_name: 'different-image.jpg',
      mime_type: 'image/jpeg',
      page_id: 'welcome'
    })

    // Component should detect project change and clear/recreate blob URLs
    await waitFor(() => {
      // Should have created new blob URLs (more calls than initial)
      expect(mockCreateObjectURL.mock.calls.length).toBeGreaterThan(initialCallCount)
    })

    // After fix: Should revoke old blob URLs to prevent memory leaks
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })
})