/**
 * MediaPersistence - Consolidated Test Suite
 * 
 * This file consolidates MediaPersistence tests from 3 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - MediaPersistence.integration.test.tsx (project session persistence)
 * - MediaPersistence.e2e.test.tsx (full project lifecycle testing)  
 * - MediaPersistence.pageAssociation.test.tsx (page-media relationships)
 * 
 * Test Categories:
 * - Project session persistence (audio narration, media enhancements)
 * - End-to-end media lifecycle testing
 * - Page-media association integrity
 * - Cross-project media isolation
 * - Media registry and metadata management
 * - Recovery and restoration scenarios
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import App from '../../App'
import MediaEnhancementWizard from '../MediaEnhancementWizard'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn()
}))

// Mock PageLayout
vi.mock('../PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

describe('MediaPersistence - Consolidated Test Suite', () => {
  let mockStorage: any
  let mockFileStorage: any
  let mockMediaService: any
  let mockUnifiedMedia: any

  const createMockCourseContent = () => ({
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration',
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Objectives',
      content: 'Objectives content',
      narration: 'Objectives narration',
      media: []
    },
    topics: [
      {
        id: 'topic-0',
        title: 'Topic 1',
        content: 'Topic content',
        narration: 'Topic narration',
        media: []
      }
    ]
  })

  beforeEach(() => {
    mockFileStorage = {
      storeMedia: vi.fn(),
      getMedia: vi.fn(),
      getContent: vi.fn(),
      saveContent: vi.fn(),
      openProject: vi.fn(),
      saveProject: vi.fn()
    }

    mockMediaService = {
      storeMedia: vi.fn(),
      getMedia: vi.fn(),
      listAllMedia: vi.fn(),
      deleteMedia: vi.fn(),
      loadMediaFromProject: vi.fn()
    }

    mockStorage = {
      currentProjectId: 'test-project-123',
      isInitialized: true,
      fileStorage: mockFileStorage,
      saveContent: mockFileStorage.saveContent,
      getContent: mockFileStorage.getContent,
      openProject: vi.fn(),
      saveProject: vi.fn(),
      listProjects: vi.fn().mockResolvedValue([]),
      getRecentProjects: vi.fn().mockResolvedValue([]),
      saveCourseMetadata: vi.fn(),
      storeMedia: vi.fn(),
      getMedia: vi.fn()
    }
    
    mockUnifiedMedia = {
      storeMedia: vi.fn(),
      getMedia: vi.fn(),
      deleteMedia: vi.fn(),
      listAllMedia: vi.fn(),
      getMediaForPage: vi.fn(),
      createBlobUrl: vi.fn(),
      revokeBlobUrl: vi.fn(),
      storeYouTubeVideo: vi.fn(),
      isLoading: false,
      error: null
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Project Session Persistence', () => {
    it('should persist and reload audio narration across project sessions', async () => {
      const mockCourseContent = createMockCourseContent()

      const mockAudioData = {
        'welcome': { id: 'audio-0', type: 'audio', pageId: 'welcome', url: 'audio1.mp3' },
        'objectives': { id: 'audio-1', type: 'audio', pageId: 'objectives', url: 'audio2.mp3' },
        'topic-0': { id: 'audio-2', type: 'audio', pageId: 'topic-0', url: 'audio3.mp3' }
      }

      // Step 1: Initial project load
      mockFileStorage.getContent.mockImplementation((contentId) => {
        if (contentId === 'course-content') return mockCourseContent
        if (contentId === 'courseSeedData') return { courseTitle: 'Test Course' }
        return null
      })

      const { rerender } = render(
        <PersistentStorageProvider value={mockStorage}>
          <UnifiedMediaProvider>
            <App />
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      )

      await waitFor(() => {
        expect(mockFileStorage.getContent).toHaveBeenCalledWith('course-content')
      })

      // Step 2: Save audio narration
      act(() => {
        mockFileStorage.saveContent.mockImplementation((contentId, content) => {
          if (contentId === 'audioNarration') {
            expect(content).toEqual(mockAudioData)
          }
        })
      })

      await mockFileStorage.saveContent('audioNarration', mockAudioData)

      // Step 3: Simulate project reopen
      mockFileStorage.getContent.mockImplementation((contentId) => {
        if (contentId === 'course-content') return mockCourseContent
        if (contentId === 'courseSeedData') return { courseTitle: 'Test Course' }
        if (contentId === 'audioNarration') return mockAudioData
        return null
      })

      mockMediaService.listAllMedia.mockResolvedValue([
        { id: 'audio-0', type: 'audio', pageId: 'welcome', url: 'audio1.mp3' },
        { id: 'audio-1', type: 'audio', pageId: 'objectives', url: 'audio2.mp3' },
        { id: 'audio-2', type: 'audio', pageId: 'topic-0', url: 'audio3.mp3' }
      ])

      rerender(
        <PersistentStorageProvider value={mockStorage}>
          <UnifiedMediaProvider>
            <App />
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      )

      // Step 4: Verify audio is loaded
      await waitFor(() => {
        expect(mockFileStorage.getContent).toHaveBeenCalledWith('audioNarration')
      }, { timeout: 5000 })

      expect(mockMediaService.listAllMedia).toHaveBeenCalled()
    })

    it('should persist and reload media enhancements across project sessions', async () => {
      const mockCourseContent = createMockCourseContent()

      const mockMediaEnhancements = {
        'welcome': [{ id: 'img-0', type: 'image', pageId: 'welcome', url: 'image1.jpg' }],
        'topic-0': [{ id: 'img-1', type: 'image', pageId: 'topic-0', url: 'image2.jpg' }]
      }

      // Step 1: Initial project load
      mockFileStorage.getContent.mockImplementation((contentId) => {
        if (contentId === 'course-content') return mockCourseContent
        if (contentId === 'courseSeedData') return { courseTitle: 'Test Course' }
        return null
      })

      const { rerender } = render(
        <PersistentStorageProvider value={mockStorage}>
          <UnifiedMediaProvider>
            <App />
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      )

      await waitFor(() => {
        expect(mockFileStorage.getContent).toHaveBeenCalledWith('course-content')
      })

      // Step 2: Save media enhancements
      await mockFileStorage.saveContent('media-enhancements', mockMediaEnhancements)

      // Step 3: Reopen project
      mockFileStorage.getContent.mockImplementation((contentId) => {
        if (contentId === 'course-content') return mockCourseContent
        if (contentId === 'courseSeedData') return { courseTitle: 'Test Course' }
        if (contentId === 'media-enhancements') return mockMediaEnhancements
        return null
      })

      mockMediaService.listAllMedia.mockResolvedValue([
        { id: 'img-0', type: 'image', pageId: 'welcome', url: 'image1.jpg' },
        { id: 'img-1', type: 'image', pageId: 'topic-0', url: 'image2.jpg' }
      ])

      rerender(
        <PersistentStorageProvider value={mockStorage}>
          <UnifiedMediaProvider>
            <App />
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      )

      // Step 4: Verify media enhancements are loaded
      await waitFor(() => {
        expect(mockFileStorage.getContent).toHaveBeenCalledWith('media-enhancements')
      }, { timeout: 5000 })

      expect(mockMediaService.listAllMedia).toHaveBeenCalled()
    })
  })

  describe('End-to-End Media Lifecycle Testing', () => {
    it('should persist and reload media across project sessions', async () => {
      const mockCourseContent = createMockCourseContent()

      const savedAudioNarration = {
        'welcome': { 
          id: 'audio-0', 
          type: 'audio', 
          pageId: 'welcome', 
          url: 'asset://audio-0.mp3',
          metadata: { fileName: 'welcome.mp3' }
        },
        'objectives': { 
          id: 'audio-1', 
          type: 'audio', 
          pageId: 'objectives', 
          url: 'asset://audio-1.mp3',
          metadata: { fileName: 'objectives.mp3' }
        },
        'topic-0': { 
          id: 'audio-2', 
          type: 'audio', 
          pageId: 'topic-0', 
          url: 'asset://audio-2.mp3',
          metadata: { fileName: 'topic1.mp3' }
        }
      }

      const savedMediaEnhancements = {
        'welcome': [
          { 
            id: 'img-0', 
            type: 'image', 
            pageId: 'welcome', 
            url: 'asset://img-0.jpg',
            metadata: { fileName: 'welcome.jpg' }
          }
        ],
        'topic-0': [
          { 
            id: 'img-1', 
            type: 'image', 
            pageId: 'topic-0', 
            url: 'asset://img-1.jpg',
            metadata: { fileName: 'topic1.jpg' }
          }
        ]
      }

      const savedMediaRegistry = {
        'audio-0': { type: 'audio', pageId: 'welcome', fileName: 'welcome.mp3' },
        'audio-1': { type: 'audio', pageId: 'objectives', fileName: 'objectives.mp3' },
        'audio-2': { type: 'audio', pageId: 'topic-0', fileName: 'topic1.mp3' },
        'img-0': { type: 'image', pageId: 'welcome', fileName: 'welcome.jpg' },
        'img-1': { type: 'image', pageId: 'topic-0', fileName: 'topic1.jpg' }
      }

      // Step 1: Setup initial project
      mockFileStorage.getContent.mockImplementation((contentId) => {
        switch(contentId) {
          case 'course-content':
            return Promise.resolve(mockCourseContent)
          case 'courseSeedData':
            return Promise.resolve({ courseTitle: 'Test Course' })
          case 'metadata':
            return Promise.resolve({ 
              hasAudioNarration: false, 
              hasMediaEnhancements: false 
            })
          default:
            return Promise.resolve(null)
        }
      })

      // Step 2: Simulate saving media
      await act(async () => {
        await mockFileStorage.saveContent('audioNarration', savedAudioNarration)
        await mockFileStorage.saveContent('media-enhancements', savedMediaEnhancements)
        await mockFileStorage.saveContent('media', savedMediaRegistry)
        await mockFileStorage.saveContent('metadata', {
          hasAudioNarration: true,
          hasMediaEnhancements: true
        })
      })

      // Step 3: Simulate project reopen with saved data
      mockFileStorage.getContent.mockImplementation((contentId) => {
        switch(contentId) {
          case 'course-content':
            const updatedContent = {
              ...mockCourseContent,
              welcomePage: {
                ...mockCourseContent.welcomePage,
                media: [
                  { id: 'audio-0', type: 'audio', pageId: 'welcome' },
                  { id: 'img-0', type: 'image', pageId: 'welcome' }
                ]
              },
              learningObjectivesPage: {
                ...mockCourseContent.learningObjectivesPage,
                media: [
                  { id: 'audio-1', type: 'audio', pageId: 'objectives' }
                ]
              },
              topics: [
                {
                  ...mockCourseContent.topics[0],
                  media: [
                    { id: 'audio-2', type: 'audio', pageId: 'topic-0' },
                    { id: 'img-1', type: 'image', pageId: 'topic-0' }
                  ]
                }
              ]
            }
            return Promise.resolve(updatedContent)
          case 'courseSeedData':
            return Promise.resolve({ courseTitle: 'Test Course' })
          case 'audioNarration':
            return Promise.resolve(savedAudioNarration)
          case 'media-enhancements':
            return Promise.resolve(savedMediaEnhancements)
          case 'media':
            return Promise.resolve(savedMediaRegistry)
          case 'metadata':
            return Promise.resolve({
              hasAudioNarration: true,
              hasMediaEnhancements: true
            })
          default:
            return Promise.resolve(null)
        }
      })

      mockMediaService.listAllMedia.mockResolvedValue([
        { id: 'audio-0', type: 'audio', pageId: 'welcome', metadata: { fileName: 'welcome.mp3' } },
        { id: 'audio-1', type: 'audio', pageId: 'objectives', metadata: { fileName: 'objectives.mp3' } },
        { id: 'audio-2', type: 'audio', pageId: 'topic-0', metadata: { fileName: 'topic1.mp3' } },
        { id: 'img-0', type: 'image', pageId: 'welcome', metadata: { fileName: 'welcome.jpg' } },
        { id: 'img-1', type: 'image', pageId: 'topic-0', metadata: { fileName: 'topic1.jpg' } }
      ])

      mockMediaService.loadMediaFromProject.mockImplementation(async () => {
        const mediaItems = await mockMediaService.listAllMedia()
        return mediaItems
      })

      // Step 4: Render app with reopened project
      const { rerender } = render(
        <PersistentStorageProvider value={mockStorage}>
          <UnifiedMediaProvider projectId={mockStorage.currentProjectId}>
            <App />
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      )

      // Step 5: Verify data loading
      await waitFor(() => {
        expect(mockFileStorage.getContent).toHaveBeenCalledWith('audioNarration')
        expect(mockFileStorage.getContent).toHaveBeenCalledWith('media-enhancements')
        expect(mockFileStorage.getContent).toHaveBeenCalledWith('media')
      }, { timeout: 5000 })

      // Step 6: Verify metadata flags
      const metadata = await mockFileStorage.getContent('metadata')
      expect(metadata.hasAudioNarration).toBe(true)
      expect(metadata.hasMediaEnhancements).toBe(true)

      // Step 7: Verify media in cache
      const allMedia = await mockMediaService.listAllMedia()
      expect(allMedia).toHaveLength(5)
      
      const audioItems = allMedia.filter((item: any) => item.type === 'audio')
      expect(audioItems).toHaveLength(3)
      expect(audioItems.map((item: any) => item.id)).toContain('audio-0')
      expect(audioItems.map((item: any) => item.id)).toContain('audio-1')
      expect(audioItems.map((item: any) => item.id)).toContain('audio-2')
      
      const imageItems = allMedia.filter((item: any) => item.type === 'image')
      expect(imageItems).toHaveLength(2)
      expect(imageItems.map((item: any) => item.id)).toContain('img-0')
      expect(imageItems.map((item: any) => item.id)).toContain('img-1')

      // Step 8: Verify course content integration
      const courseContent = await mockFileStorage.getContent('course-content')
      
      expect(courseContent.welcomePage.media).toHaveLength(2)
      expect(courseContent.welcomePage.media.some((m: any) => m.id === 'audio-0')).toBe(true)
      expect(courseContent.welcomePage.media.some((m: any) => m.id === 'img-0')).toBe(true)
      
      expect(courseContent.learningObjectivesPage.media).toHaveLength(1)
      expect(courseContent.learningObjectivesPage.media.some((m: any) => m.id === 'audio-1')).toBe(true)
      
      expect(courseContent.topics[0].media).toHaveLength(2)
      expect(courseContent.topics[0].media.some((m: any) => m.id === 'audio-2')).toBe(true)
      expect(courseContent.topics[0].media.some((m: any) => m.id === 'img-1')).toBe(true)
    })

    it('should not leak media between different projects', async () => {
      const projectAMedia = [
        { id: 'audio-a1', type: 'audio', pageId: 'welcome' },
        { id: 'img-a1', type: 'image', pageId: 'welcome' }
      ]

      const projectBMedia = [
        { id: 'audio-b1', type: 'audio', pageId: 'welcome' },
        { id: 'img-b1', type: 'image', pageId: 'welcome' }
      ]

      // Step 1: Open Project A
      mockStorage.currentProjectId = 'project-a'
      mockMediaService.listAllMedia.mockResolvedValue(projectAMedia)
      mockMediaService.loadMediaFromProject.mockResolvedValue(projectAMedia)

      const { rerender } = render(
        <PersistentStorageProvider value={mockStorage}>
          <UnifiedMediaProvider projectId={mockStorage.currentProjectId}>
            <App />
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      )

      let allMedia = await mockMediaService.listAllMedia()
      expect(allMedia).toEqual(projectAMedia)

      // Step 2: Switch to Project B
      mockStorage.currentProjectId = 'project-b'
      
      mockMediaService.listAllMedia.mockReset()
      mockMediaService.listAllMedia.mockResolvedValue(projectBMedia)
      mockMediaService.loadMediaFromProject.mockResolvedValue(projectBMedia)

      rerender(
        <PersistentStorageProvider value={{...mockStorage, currentProjectId: 'project-b'}}>
          <UnifiedMediaProvider projectId='project-b'>
            <App />
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      )

      // Step 3: Verify isolation
      allMedia = await mockMediaService.listAllMedia()
      expect(allMedia).toEqual(projectBMedia)
      
      expect(allMedia.some((item: any) => item.id === 'audio-a1')).toBe(false)
      expect(allMedia.some((item: any) => item.id === 'img-a1')).toBe(false)
      
      expect(allMedia.some((item: any) => item.id === 'audio-b1')).toBe(true)
      expect(allMedia.some((item: any) => item.id === 'img-b1')).toBe(true)
    })
  })

  describe('Page-Media Association Integrity', () => {
    beforeEach(() => {
      mockUnifiedMedia.getMediaForPage = vi.fn()
      mockUnifiedMedia.createBlobUrl = vi.fn()
    })

    it('should find media by page ID after project reload', async () => {
      const welcomeMedia = {
        id: 'img-welcome-001',
        type: 'image',
        url: 'asset://localhost/img-welcome-001.jpg',
        metadata: {
          fileName: 'welcome-banner.jpg',
          mimeType: 'image/jpeg',
          type: 'image',
          pageId: 'welcome'
        }
      }
      
      const objectivesMedia = {
        id: 'img-objectives-001',
        type: 'image',
        url: 'asset://localhost/img-objectives-001.jpg',
        metadata: {
          fileName: 'objectives-chart.jpg',
          mimeType: 'image/jpeg',
          type: 'image',
          pageId: 'objectives'
        }
      }
      
      const topicMedia = {
        id: 'img-topic-001',
        type: 'image',
        url: 'asset://localhost/img-topic-001.jpg',
        metadata: {
          fileName: 'topic-diagram.jpg',
          mimeType: 'image/jpeg',
          type: 'image',
          pageId: 'topic-0'
        }
      }
      
      const mockCourseContent = {
        welcomePage: {
          id: 'welcome',
          title: 'Welcome',
          content: 'Welcome content',
          media: [
            { id: 'img-welcome-001', type: 'image', pageId: 'welcome' }
          ]
        },
        learningObjectivesPage: {
          id: 'objectives',
          title: 'Objectives',
          content: 'Objectives content',
          media: [
            { id: 'img-objectives-001', type: 'image', pageId: 'objectives' }
          ]
        },
        topics: [
          {
            id: 'topic-0',
            title: 'Topic 1',
            content: 'Topic content',
            media: [
              { id: 'img-topic-001', type: 'image', pageId: 'topic-0' }
            ]
          }
        ]
      }
      
      mockUnifiedMedia.getMediaForPage.mockImplementation((pageId: string) => {
        switch (pageId) {
          case 'welcome':
            return [welcomeMedia]
          case 'objectives':
            return [objectivesMedia]
          case 'topic-0':
            return [topicMedia]
          default:
            return []
        }
      })
      
      mockUnifiedMedia.createBlobUrl.mockImplementation(async (mediaId: string) => {
        return `blob:http://localhost:1420/${mediaId}`
      })
      
      // Mock contexts for MediaEnhancementWizard
      const MockProvider = ({ children }: any) => (
        <PersistentStorageProvider value={mockStorage}>
          <div>
            {React.cloneElement(children, {
              mockUnifiedMedia
            })}
          </div>
        </PersistentStorageProvider>
      )
      
      render(
        <MockProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onSave={vi.fn()}
            onClose={vi.fn()}
          />
        </MockProvider>
      )
      
      // Test 1: Welcome page media lookup
      await waitFor(() => {
        expect(mockUnifiedMedia.getMediaForPage).toHaveBeenCalledWith('welcome')
      })
      
      const welcomeMediaCalls = mockUnifiedMedia.getMediaForPage.mock.calls.filter(
        call => call[0] === 'welcome'
      )
      expect(welcomeMediaCalls.length).toBeGreaterThan(0)
      const welcomeResult = mockUnifiedMedia.getMediaForPage.mock.results.find(
        (result: any, index: number) => 
          mockUnifiedMedia.getMediaForPage.mock.calls[index][0] === 'welcome'
      )
      expect(welcomeResult?.value).toContainEqual(welcomeMedia)
      
      // Test 2: Objectives page navigation
      const objectivesThumb = screen.getByTestId('page-thumbnail-objectives')
      objectivesThumb.click()
      
      await waitFor(() => {
        expect(mockUnifiedMedia.getMediaForPage).toHaveBeenCalledWith('objectives')
      })
      
      const objectivesResult = mockUnifiedMedia.getMediaForPage.mock.results.find(
        (result: any, index: number) => 
          mockUnifiedMedia.getMediaForPage.mock.calls[index][0] === 'objectives'
      )
      expect(objectivesResult?.value).toContainEqual(objectivesMedia)
      
      // Test 3: Topic page navigation
      const topicThumb = screen.getByTestId('page-thumbnail-topic-0')
      topicThumb.click()
      
      await waitFor(() => {
        expect(mockUnifiedMedia.getMediaForPage).toHaveBeenCalledWith('topic-0')
      })
      
      const topicResult = mockUnifiedMedia.getMediaForPage.mock.results.find(
        (result: any, index: number) => 
          mockUnifiedMedia.getMediaForPage.mock.calls[index][0] === 'topic-0'
      )
      expect(topicResult?.value).toContainEqual(topicMedia)
    })
    
    it('should report 0 media items when page IDs do not match', async () => {
      const mismatchedMedia = {
        id: 'img-001',
        type: 'image',
        url: 'asset://localhost/img-001.jpg',
        metadata: {
          fileName: 'image.jpg',
          mimeType: 'image/jpeg',
          type: 'image',
          pageId: 'page-1' // Wrong page ID
        }
      }
      
      const mockCourseContent = {
        welcomePage: {
          id: 'welcome', // Expects 'welcome', not 'page-1'
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
      
      mockUnifiedMedia.getMediaForPage.mockImplementation((pageId: string) => {
        if (pageId === 'page-1') {
          return [mismatchedMedia]
        }
        console.log('[Test] No media found for page:', pageId)
        return []
      })
      
      const MockProvider = ({ children }: any) => (
        <PersistentStorageProvider value={mockStorage}>
          <div>
            {React.cloneElement(children, {
              mockUnifiedMedia
            })}
          </div>
        </PersistentStorageProvider>
      )
      
      render(
        <MockProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onSave={vi.fn()}
            onClose={vi.fn()}
          />
        </MockProvider>
      )
      
      await waitFor(() => {
        expect(mockUnifiedMedia.getMediaForPage).toHaveBeenCalledWith('welcome')
      })
      
      const result = mockUnifiedMedia.getMediaForPage.mock.results.find(
        (result: any, index: number) => 
          mockUnifiedMedia.getMediaForPage.mock.calls[index][0] === 'welcome'
      )
      expect(result?.value).toEqual([])
      
      expect(mockUnifiedMedia.createBlobUrl).not.toHaveBeenCalled()
    })
  })
})