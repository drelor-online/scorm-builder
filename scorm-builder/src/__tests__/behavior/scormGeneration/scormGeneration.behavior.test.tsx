import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SCORMPackageBuilder } from '../../../components/SCORMPackageBuilderRefactored'
import { CourseContent } from '../../../types/aiPrompt'
import { CourseSeedData } from '../../../types/course'

// Mock dependencies
vi.mock('../../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    storageService: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined)
    }
  })
}))

vi.mock('../../../hooks/useStepData', () => ({
  useStepData: () => ({
    getStepData: vi.fn(),
    updateStepData: vi.fn().mockResolvedValue(undefined)
  })
}))

// Mock Tauri commands
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock Tauri dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}))

// Mock Tauri file system
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn()
}))

// Mock SCORM generation services
vi.mock('../../../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn((content) => content)
}))

vi.mock('../../../services/spaceEfficientScormGenerator', () => ({
  generateSpaceEfficientSCORM12Buffer: vi.fn().mockResolvedValue({
    buffer: new Uint8Array([1, 2, 3, 4, 5])
  })
}))

// Mock components
vi.mock('../../../components/CoursePreview', () => ({
  CoursePreview: () => <div data-testid="course-preview">Course Preview</div>
}))

vi.mock('../../../components/PageLayout', () => ({
  PageLayout: ({ children, title, description, onNext, onGenerateSCORM, isGenerating, coursePreview }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
      {coursePreview}
      {onGenerateSCORM && (
        <button onClick={onGenerateSCORM} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate SCORM Package'}
        </button>
      )}
      {onNext && !onGenerateSCORM && <button onClick={onNext}>Next</button>}
    </div>
  )
}))

vi.mock('../../../components/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, title, message, onConfirm, onCancel }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

// Mock the design system components
vi.mock('../../../components/DesignSystem', () => ({
  Button: ({ children, onClick, disabled, icon, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  ),
  Card: ({ children, title }: any) => (
    <div data-testid="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Input: ({ label, value, onChange, placeholder, type, disabled }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input 
        value={value || ''} 
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  ),
  Section: ({ children }: any) => <section>{children}</section>,
  Grid: ({ children }: any) => <div data-testid="grid">{children}</div>,
  Alert: ({ type, children }: any) => (
    <div className={`alert alert-${type}`} role="alert" data-type={type}>{children}</div>
  )
}))

describe('SCORM Generation Page Behavior', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Test Course',
      content: '<h1>Welcome</h1>',
      narration: 'Welcome narration'
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li></ul>',
      narration: 'Objectives narration'
    },
    topics: [
      {
        id: 'topic1',
        title: 'Topic 1',
        content: '<p>Content 1</p>',
        narration: 'Topic 1 narration'
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'What is 2 + 2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4'
        }
      ]
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course Title',
    difficulty: 3,
    template: 'None',
    customTopics: ['Topic 1'],
    templateTopics: []
  }

  const mockHandlers = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.alert
    window.alert = vi.fn()
  })

  it('should display course title from course seed data', () => {
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should show the course title in the course information section
    expect(screen.getByText('Title:')).toBeInTheDocument()
    expect(screen.getByText('Test Course Title')).toBeInTheDocument()
  })

  it('should have course version field', () => {
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should have a course version field
    const versionInput = screen.getByLabelText(/course version/i)
    expect(versionInput).toBeInTheDocument()
    // Should have default value of 1.0
    expect(versionInput).toHaveValue('1.0')
  })

  it('should show generate SCORM package button', () => {
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    expect(generateButton).toBeInTheDocument()
  })

  it('should allow editing course version before generation', async () => {
    const user = userEvent.setup()
    
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const versionInput = screen.getByLabelText(/course version/i)
    
    // Clear and type new version
    await user.clear(versionInput)
    await user.type(versionInput, '2.0')
    
    expect(versionInput).toHaveValue('2.0')
  })

  it('should show progress when generating SCORM package', async () => {
    const user = userEvent.setup()
    
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    
    // Click the button
    const clickPromise = user.click(generateButton)
    
    // Button should immediately change to generating state
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Generating...')
    })
    
    // Wait for click to complete
    await clickPromise
  })

  it('should call SCORM generation service when generating package', async () => {
    const user = userEvent.setup()
    const { generateSpaceEfficientSCORM12Buffer } = await import('../../../services/spaceEfficientScormGenerator')
    const mockGenerate = vi.mocked(generateSpaceEfficientSCORM12Buffer)
    
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    await user.click(generateButton)
    
    // Should call the SCORM generation service
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled()
    })
  })

  it('should download package in browser environment', async () => {
    const user = userEvent.setup()
    
    // Mock window.__TAURI__ to simulate browser environment
    Object.defineProperty(window, '__TAURI__', {
      value: undefined,
      configurable: true
    })
    
    // Mock document.createElement to track download link
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {}
    }
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockAnchor as any
      }
      return originalCreateElement(tagName)
    })
    
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    await user.click(generateButton)
    
    // Should trigger download
    await waitFor(() => {
      expect(mockAnchor.click).toHaveBeenCalled()
      expect(mockAnchor.download).toContain('.zip')
    })
    
    createElementSpy.mockRestore()
  })

  it('should show error message if generation fails', async () => {
    const user = userEvent.setup()
    const { generateSpaceEfficientSCORM12Buffer } = await import('../../../services/spaceEfficientScormGenerator')
    const mockGenerate = vi.mocked(generateSpaceEfficientSCORM12Buffer)
    
    mockGenerate.mockRejectedValueOnce(new Error('Generation failed'))
    
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    await user.click(generateButton)
    
    // Should show error alert
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error'))
    })
  })

  it('should disable generate button while generating', async () => {
    const user = userEvent.setup()
    const { generateSpaceEfficientSCORM12Buffer } = await import('../../../services/spaceEfficientScormGenerator')
    const mockGenerate = vi.mocked(generateSpaceEfficientSCORM12Buffer)
    
    // Mock with a delay to check disabled state
    mockGenerate.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ buffer: new Uint8Array([1, 2, 3]) }), 200))
    )
    
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    
    // Click generate
    const clickPromise = user.click(generateButton)
    
    // Button should be disabled immediately
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled()
    })
    
    // Wait for generation to complete
    await clickPromise
    
    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled()
    })
  })

  it('should have Generate SCORM Package button instead of Next button', () => {
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should not have a next button since this is the final step
    const nextButton = screen.queryByRole('button', { name: /next/i })
    expect(nextButton).not.toBeInTheDocument()
    
    // Should have generate button instead
    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    expect(generateButton).toBeInTheDocument()
  })

  it('should pass course data to SCORM generation service', async () => {
    const user = userEvent.setup()
    const { generateSpaceEfficientSCORM12Buffer } = await import('../../../services/spaceEfficientScormGenerator')
    const mockGenerate = vi.mocked(generateSpaceEfficientSCORM12Buffer)
    
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    await user.click(generateButton)
    
    // Should pass the course content to the generator
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.any(Object), // Enhanced content
        undefined // Storage (optional)
      )
    })
  })
})