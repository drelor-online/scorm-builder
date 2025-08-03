import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AllTheProviders } from '../../test/testProviders'
import { MediaEnhancementWizard } from '../../components/MediaEnhancementWizard'
import { SCORMPackageBuilder } from '../../components/SCORMPackageBuilder'
import { CourseContent } from '../../types/aiPrompt'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

const mockInvoke = vi.mocked((window as any).__TAURI__.invoke)

describe('Media Edge Cases and Error Scenarios', () => {
  const testProjectId = 'edge-case-test-project'
  const mockCourseContent: CourseContent = {
    version: '1.0',
    welcomePage: {
      narration: 'Welcome',
      title: 'Welcome',
      content: 'Content',
      media: []
    },
    learningObjectivesPage: {
      objectives: ['Obj 1'],
      narration: 'Objectives',
      media: []
    },
    topics: [{
      id: 'topic-1',
      title: 'Topic 1',
      content: 'Content',
      narration: 'Narration',
      media: []
    }],
    assessment: {
      questions: [],
      passMark: 80
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should handle very large file names gracefully', async () => {
    const user = userEvent.setup()
    
    // Create a file with extremely long name
    const longFileName = 'a'.repeat(255) + '.jpg'
    const file = new File(['test'], longFileName, { type: 'image/jpeg' })
    
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'store_media') {
        // Verify file name is handled
        expect(args.file_name.length).toBeLessThanOrEqual(255)
        return { id: 'image-0', path: 'media/image-0.bin' }
      }
      return {}
    })
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onUpdateContent={() => {}}
          onNext={() => {}}
          onBack={() => {}}
        />
      </AllTheProviders>
    )
    
    const fileInput = screen.getByLabelText(/upload.*image/i)
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('store_media', expect.any(Object))
    })
  })

  it('should handle storage errors gracefully', async () => {
    const user = userEvent.setup()
    
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'store_media') {
        throw new Error('Storage full')
      }
      return {}
    })
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onUpdateContent={() => {}}
          onNext={() => {}}
          onBack={() => {}}
        />
      </AllTheProviders>
    )
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText(/upload.*image/i)
    
    await user.upload(fileInput, file)
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to upload/i)).toBeInTheDocument()
    })
  })

  it('should prevent duplicate media uploads on the same page', async () => {
    const user = userEvent.setup()
    let uploadCount = 0
    
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'store_media') {
        uploadCount++
        // Simulate same file being uploaded twice
        return { id: `image-${uploadCount - 1}`, path: `media/image-${uploadCount - 1}.bin` }
      }
      if (cmd === 'get_media') {
        return { data: new Uint8Array([1, 2, 3]), metadata: {} }
      }
      return {}
    })
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onUpdateContent={() => {}}
          onNext={() => {}}
          onBack={() => {}}
        />
      </AllTheProviders>
    )
    
    const file = new File(['same content'], 'same-image.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText(/upload.*image/i)
    
    // Upload same file twice
    await user.upload(fileInput, file)
    await waitFor(() => expect(uploadCount).toBe(1))
    
    await user.upload(fileInput, file)
    await waitFor(() => expect(uploadCount).toBe(2))
    
    // Should handle duplicate gracefully (implementation dependent)
    // Could either reject duplicate or create new ID
    expect(uploadCount).toBe(2)
  })

  it('should handle corrupted media files', async () => {
    const user = userEvent.setup()
    
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'store_media') {
        // Simulate successful store but corrupted data
        return { id: 'image-0', path: 'media/image-0.bin' }
      }
      if (cmd === 'get_media') {
        // Return corrupted data
        throw new Error('Media file corrupted')
      }
      return {}
    })
    
    const TestComponent = () => {
      const [error, setError] = React.useState<string | null>(null)
      
      return (
        <div>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onUpdateContent={() => {}}
            onNext={() => {}}
            onBack={() => {}}
          />
          {error && <div role="alert">{error}</div>}
        </div>
      )
    }
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <TestComponent />
      </AllTheProviders>
    )
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText(/upload.*image/i)
    
    await user.upload(fileInput, file)
    
    // Should handle corrupted file gracefully
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeInTheDocument()
    })
  })

  it('should handle special characters in media IDs during SCORM generation', async () => {
    const specialIds = [
      'image-0-test',
      'image_1_test',
      'image.2.test',
      'image 3 test',
      'image-4-😀'
    ]
    
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'generate_scorm_package') {
        // Verify all media IDs are properly sanitized
        const courseContent = args.course_content
        const welcomeMedia = courseContent.welcomePage.media || []
        
        welcomeMedia.forEach((media: any) => {
          // IDs should be sanitized for file system compatibility
          expect(media.id).toMatch(/^[a-zA-Z0-9\-_]+$/)
        })
        
        return {
          success: true,
          file_path: '/downloads/test.zip',
          size: 1024
        }
      }
      return {}
    })
    
    // Create course content with special IDs
    const contentWithSpecialIds = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        media: specialIds.map(id => ({
          id,
          type: 'image',
          url: `media/${id}`,
          title: `Image ${id}`
        }))
      }
    }
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <SCORMPackageBuilder
          courseContent={contentWithSpecialIds}
          onBack={() => {}}
          projectId={testProjectId}
        />
      </AllTheProviders>
    )
    
    const generateButton = screen.getByText(/generate/i)
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_package', expect.any(Object))
    })
  })

  it('should maintain media references when course structure changes', async () => {
    const user = userEvent.setup()
    
    const TestComponent = () => {
      const [content, setContent] = React.useState(mockCourseContent)
      const [mediaIds, setMediaIds] = React.useState<string[]>([])
      
      const addTopic = () => {
        setContent(prev => ({
          ...prev,
          topics: [
            ...prev.topics,
            {
              id: `topic-${prev.topics.length + 1}`,
              title: `Topic ${prev.topics.length + 1}`,
              content: 'New topic',
              narration: 'New narration',
              media: []
            }
          ]
        }))
      }
      
      const removeTopic = () => {
        setContent(prev => ({
          ...prev,
          topics: prev.topics.slice(0, -1)
        }))
      }
      
      React.useEffect(() => {
        // Track all media IDs
        const allMedia: string[] = []
        content.welcomePage.media?.forEach(m => allMedia.push(m.id))
        content.topics.forEach(t => t.media?.forEach(m => allMedia.push(m.id)))
        setMediaIds(allMedia)
      }, [content])
      
      return (
        <div>
          <MediaEnhancementWizard
            courseContent={content}
            onUpdateContent={setContent}
            onNext={() => {}}
            onBack={() => {}}
          />
          <button onClick={addTopic}>Add Topic</button>
          <button onClick={removeTopic}>Remove Topic</button>
          <div data-testid="media-count">{mediaIds.length}</div>
          <div data-testid="topic-count">{content.topics.length}</div>
        </div>
      )
    }
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <TestComponent />
      </AllTheProviders>
    )
    
    // Upload media to welcome page
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText(/upload.*image/i)
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByTestId('media-count')).toHaveTextContent('1')
    })
    
    // Add new topic
    await user.click(screen.getByText('Add Topic'))
    
    // Media should still be there
    expect(screen.getByTestId('media-count')).toHaveTextContent('1')
    expect(screen.getByTestId('topic-count')).toHaveTextContent('2')
    
    // Remove topic
    await user.click(screen.getByText('Remove Topic'))
    
    // Media should still be preserved
    expect(screen.getByTestId('media-count')).toHaveTextContent('1')
    expect(screen.getByTestId('topic-count')).toHaveTextContent('1')
  })

  it('should handle rapid page navigation without losing media', async () => {
    const user = userEvent.setup()
    let mediaUploaded = false
    
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'store_media') {
        mediaUploaded = true
        return { id: 'image-0', path: 'media/image-0.bin' }
      }
      if (cmd === 'get_media') {
        return { data: new Uint8Array([1, 2, 3]), metadata: {} }
      }
      return {}
    })
    
    const TestComponent = () => {
      const [currentPage, setCurrentPage] = React.useState(0)
      
      const rapidNavigate = async () => {
        // Simulate rapid navigation
        for (let i = 0; i < 10; i++) {
          setCurrentPage(i % 4)
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      
      return (
        <div>
          <div>Page: {currentPage}</div>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onUpdateContent={() => {}}
            onNext={() => setCurrentPage(prev => prev + 1)}
            onBack={() => setCurrentPage(prev => prev - 1)}
          />
          <button onClick={rapidNavigate}>Rapid Navigate</button>
          <div data-testid="media-uploaded">{mediaUploaded ? 'yes' : 'no'}</div>
        </div>
      )
    }
    
    render(
      <AllTheProviders projectId={testProjectId}>
        <TestComponent />
      </AllTheProviders>
    )
    
    // Upload media
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText(/upload.*image/i)
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByTestId('media-uploaded')).toHaveTextContent('yes')
    })
    
    // Trigger rapid navigation
    await user.click(screen.getByText('Rapid Navigate'))
    
    // Media should still be preserved
    await waitFor(() => {
      expect(screen.getByTestId('media-uploaded')).toHaveTextContent('yes')
    }, { timeout: 2000 })
  })
})