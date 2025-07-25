import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SCORMPackageBuilder } from '../SCORMPackageBuilderRefactored'
import { CourseContent } from '../../types/aiPrompt'
import * as courseContentConverter from '../../services/courseContentConverter'
import * as spaceEfficientScormGenerator from '../../services/spaceEfficientScormGenerator'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn()
}))

// Mock services
vi.mock('../../services/courseContentConverter')
vi.mock('../../services/spaceEfficientScormGenerator')

// Mock components
vi.mock('../PageLayout', () => ({
  PageLayout: ({ children, title, description, actions }: any) => (
    <div data-testid="page-layout">
      <h1>{title}</h1>
      <p>{description}</p>
      <div data-testid="actions">{actions}</div>
      {children}
    </div>
  )
}))

vi.mock('../CoursePreview', () => ({
  CoursePreview: () => <button>Preview Course</button>
}))

vi.mock('../ProjectExportImport', () => ({
  ProjectExportButton: ({ onExport, buttonText }: any) => (
    <button onClick={() => onExport({ success: true })}>{buttonText}</button>
  ),
  ProjectImportButton: ({ onImport, buttonText }: any) => (
    <button onClick={() => onImport({ success: true, data: {} })}>{buttonText}</button>
  )
}))

vi.mock('../DesignSystem', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={`btn ${variant ? `btn-${variant}` : ''} ${size ? `btn-${size}` : ''}`}
    >
      {children}
    </button>
  ),
  Card: ({ children, title }: any) => (
    <div data-testid="card" className="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Input: ({ label, value, onChange, id, placeholder }: any) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input 
        id={id}
        value={value} 
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  ),
  Section: ({ children }: any) => <div data-testid="section" className="section">{children}</div>,
  Flex: ({ children }: any) => <div style={{ display: 'flex' }}>{children}</div>,
  Grid: ({ children }: any) => <div className="grid" style={{ display: 'grid' }}>{children}</div>,
  LoadingSpinner: () => <div>Loading...</div>,
  Modal: ({ children, isOpen, title }: any) => isOpen ? (
    <div data-testid="modal">
      <h2>{title}</h2>
      {children}
    </div>
  ) : null
}))

// Mock window.alert
global.alert = vi.fn()

describe('SCORMPackageBuilderRefactored', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      duration: 2
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li></ul>',
      narration: 'Objectives narration',
      duration: 3
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Topic 1 content</p>',
        narration: 'Topic 1 narration',
        duration: 5,
        knowledgeCheck: {
          questions: [{
            id: 'kc-1',
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            feedback: {
              correct: 'Correct!',
              incorrect: 'Try again'
            }
          }]
        }
      }
    ],
    assessment: {
      questions: [{
        id: 'q1',
        type: 'multiple-choice',
        question: 'Assessment question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'B',
        feedback: {
          correct: 'Well done!',
          incorrect: 'Review the material'
        }
      }],
      passMark: 80
    }
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test course description',
    audienceDescription: 'Test audience',
    duration: 30
  }

  const mockProps = {
    courseContent: mockCourseContent,
    courseSeedData: mockCourseSeedData,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  // Store original window.__TAURI__
  const originalTauri = (window as any).__TAURI__

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    
    // Suppress navigation errors from jsdom
    const originalError = console.error
    vi.spyOn(console, 'error').mockImplementation((msg, ...args) => {
      if (typeof msg === 'string' && msg.includes('Not implemented: navigation')) {
        return
      }
      originalError(msg, ...args)
    })
    
    // Mock the conversion and generation functions
    vi.mocked(courseContentConverter.convertToEnhancedCourseContent).mockReturnValue({
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear' as const,
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start'
      },
      objectives: ['Objective 1'],
      topics: [],
      assessment: { questions: [] }
    })
    
    vi.mocked(spaceEfficientScormGenerator.generateSpaceEfficientSCORM12Buffer).mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3, 4])
    })
  })

  afterEach(() => {
    // Clean up all mocks and stubs
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    
    // Restore window.__TAURI__
    if (originalTauri !== undefined) {
      (window as any).__TAURI__ = originalTauri
    } else {
      delete (window as any).__TAURI__
    }
  })

  describe('User sees course information displayed', () => {
    it('should display course title and description', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      expect(screen.getByText('Test Course')).toBeInTheDocument()
      expect(screen.getByText('Test course description')).toBeInTheDocument()
      expect(screen.getByText('30 minutes')).toBeInTheDocument()
    })

    it('should display the page title and description', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      expect(screen.getByText('SCORM Package Builder')).toBeInTheDocument()
      expect(screen.getByText('Configure your SCORM package settings and generate the final course package.')).toBeInTheDocument()
    })

    it('should display course information in a card', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      expect(screen.getByText('Course Information')).toBeInTheDocument()
      const cards = screen.getAllByTestId('card')
      expect(cards.length).toBeGreaterThan(0)
    })
  })

  describe('User can configure package settings', () => {
    it('should allow changing course version', async () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const versionInput = screen.getByLabelText('Course Version')
      await userEvent.clear(versionInput)
      await userEvent.type(versionInput, '2.0')
      
      expect(versionInput).toHaveValue('2.0')
    })

    it('should display SCORM version as read-only', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      // Should show SCORM version label
      expect(screen.getByText('SCORM Version')).toBeInTheDocument()
      
      // Should show SCORM 1.2 as static text
      expect(screen.getByText('SCORM 1.2')).toBeInTheDocument()
      
      // Should NOT have any radio buttons
      const radioButtons = screen.queryAllByRole('radio')
      expect(radioButtons).toHaveLength(0)
    })

    it('should show SCORM 1.2 description', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      // Check SCORM 1.2 description is always shown
      expect(screen.getByText(/broader compatibility with older LMS/)).toBeInTheDocument()
    })

    it('should NOT have course title or description input fields', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      // These fields should not exist as they come from courseSeedData
      expect(screen.queryByLabelText(/course title/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/course description/i)).not.toBeInTheDocument()
    })
  })

  describe('User can generate SCORM package', () => {
    it('should show loading state while generating', async () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
      fireEvent.click(generateButton)
      
      await waitFor(() => {
        expect(screen.getByText('Generating Package...')).toBeInTheDocument()
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })
    })

    it.skip('should generate package in browser mode', async () => {
      // Mock window.__TAURI__ to undefined for browser mode
      vi.stubGlobal('__TAURI__', undefined)
      
      // Mock URL.createObjectURL and URL.revokeObjectURL
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
      const mockRevokeObjectURL = vi.fn()
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL
      
      // Create a mock anchor element
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        style: {}
      }
      
      // Mock only createElement when called with 'a'
      const originalCreateElement = document.createElement.bind(document)
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockAnchor as any
        }
        return originalCreateElement(tagName)
      })
      
      // Mock appendChild and removeChild for anchor elements
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        if (node === mockAnchor) {
          return node
        }
        return node
      })
      
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => {
        if (node === mockAnchor) {
          return node
        }
        return node
      })
      
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
      fireEvent.click(generateButton)
      
      await waitFor(() => {
        expect(courseContentConverter.convertToEnhancedCourseContent).toHaveBeenCalled()
        expect(spaceEfficientScormGenerator.generateSpaceEfficientSCORM12Buffer).toHaveBeenCalled()
        expect(mockCreateObjectURL).toHaveBeenCalled()
        expect(mockAnchor.click).toHaveBeenCalled()
        expect(mockAnchor.download).toBe('Test_Course.zip')
      })
      
      // Cleanup
      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it.skip('should show browser mode warning', () => {
      // Mock window.__TAURI__ to undefined for browser mode
      vi.stubGlobal('__TAURI__', undefined)
      
      render(<SCORMPackageBuilder {...mockProps} />)
      
      expect(screen.getByText(/Running in browser mode/)).toBeInTheDocument()
    })

    it.skip('should show success message after generation', async () => {
      // Mock window.__TAURI__ to undefined for browser mode
      vi.stubGlobal('__TAURI__', undefined)
      
      // Mock URL and document methods
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      global.URL.revokeObjectURL = vi.fn()
      
      // Create a mock anchor element
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        style: {}
      }
      
      // Mock only createElement when called with 'a'
      const originalCreateElement = document.createElement.bind(document)
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockAnchor as any
        }
        return originalCreateElement(tagName)
      })
      
      // Mock appendChild and removeChild
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)
      
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
      fireEvent.click(generateButton)
      
      await waitFor(() => {
        expect(screen.getByText('✓ Package generated successfully!')).toBeInTheDocument()
      })
      
      createElementSpy.mockRestore()
    })

    it('should handle generation errors gracefully', async () => {
      vi.mocked(spaceEfficientScormGenerator.generateSpaceEfficientSCORM12Buffer).mockRejectedValue(
        new Error('Generation failed')
      )
      
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
      fireEvent.click(generateButton)
      
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Error generating SCORM package: Generation failed')
      })
    })

    it('should disable button during generation', async () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
      expect(generateButton).not.toBeDisabled()
      
      fireEvent.click(generateButton)
      
      expect(generateButton).toBeDisabled()
      expect(generateButton).toHaveTextContent('Generating Package...')
    })
  })

  describe('User sees package contents information', () => {
    it('should display what is included in the package', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      expect(screen.getByText("What's in your SCORM package?")).toBeInTheDocument()
      expect(screen.getByText('All course content and activities')).toBeInTheDocument()
      expect(screen.getByText('SCORM 1.2 compliant manifest')).toBeInTheDocument()
      expect(screen.getByText('Progress tracking capabilities')).toBeInTheDocument()
      expect(screen.getByText('Quiz results and scoring')).toBeInTheDocument()
      expect(screen.getByText('Media assets (images and videos)')).toBeInTheDocument()
      expect(screen.getByText('Audio narration files')).toBeInTheDocument()
    })

    it('should display package info in an alert', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const packageInfoSection = screen.getByText("What's in your SCORM package?").parentElement
      expect(packageInfoSection?.querySelector('.alert')).toBeTruthy()
    })
  })

  describe('User can navigate between steps', () => {
    it('should call onBack when Back button is clicked', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const backButton = screen.getByText('← Back')
      fireEvent.click(backButton)
      
      expect(mockProps.onBack).toHaveBeenCalledOnce()
    })

    it('should have preview course button', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      expect(screen.getByText('Preview Course')).toBeInTheDocument()
    })

    it('should use secondary variant for back button', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const backButton = screen.getByText('← Back')
      expect(backButton).toHaveClass('btn-secondary')
    })

    it('should use success variant for generate button', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
      expect(generateButton).toHaveClass('btn-success')
      expect(generateButton).toHaveClass('btn-large')
    })
  })

  describe('User sees proper SCORM version handling', () => {
    it('should use SCORM 1.2 generator', async () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
      fireEvent.click(generateButton)
      
      await waitFor(() => {
        // Should use SCORM 1.2 generator
        expect(spaceEfficientScormGenerator.generateSpaceEfficientSCORM12Buffer).toHaveBeenCalled()
      })
    })

    it('should pass correct metadata to converter', async () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
      fireEvent.click(generateButton)
      
      await waitFor(() => {
        expect(courseContentConverter.convertToEnhancedCourseContent).toHaveBeenCalledWith(
          mockCourseContent,
          expect.objectContaining({
            title: 'Test Course',
            description: 'Test course description',
            version: '1.0',
            scormVersion: '1.2', // Only SCORM 1.2 is implemented
            duration: 30,
            passMark: 80
          })
        )
      })
    })
  })

  describe('User sees design system components', () => {
    it('should use Section components for layout', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const sections = screen.getAllByTestId('section')
      expect(sections.length).toBeGreaterThan(0)
    })

    it('should use Card components for content grouping', () => {
      render(<SCORMPackageBuilder {...mockProps} />)
      
      const cards = screen.getAllByTestId('card')
      expect(cards.length).toBeGreaterThan(0)
      expect(cards[0]).toHaveClass('card')
    })

    it('should use Grid layout for form fields', () => {
      const { container } = render(<SCORMPackageBuilder {...mockProps} />)
      
      const grids = container.querySelectorAll('.grid')
      expect(grids.length).toBeGreaterThan(0)
    })
  })
})