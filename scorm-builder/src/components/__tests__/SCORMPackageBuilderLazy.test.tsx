// Removed unused React import
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import { SCORMPackageBuilder } from '../SCORMPackageBuilderLazy'
import type { CourseContent } from '../../types/aiPrompt'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn()
}))

// Mock dynamic imports
vi.mock('../../utils/dynamicImports', () => ({
  loadCourseContentConverter: vi.fn().mockResolvedValue(
    (content: any, metadata: any) => ({ 
      ...content, 
      metadata,
      enhanced: true 
    })
  ),
  loadSCORMGenerator: vi.fn().mockResolvedValue(
    async (content: any) => ({ 
      buffer: new Uint8Array([1, 2, 3, 4, 5]) 
    })
  )
}))

// Mock window.URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock components
vi.mock('../PageLayout', () => ({
  PageLayout: ({ children, title, description, actions, onExport, onImport }: any) => (
    <div data-testid="page-layout">
      <h1>{title}</h1>
      <p>{description}</p>
      <div data-testid="actions">{actions}</div>
      <button onClick={onExport}>Export</button>
      <button onClick={onImport}>Import</button>
      {children}
    </div>
  )
}))

vi.mock('../CoursePreview', () => ({
  CoursePreview: ({ courseContent, courseSeedData }: any) => (
    <div data-testid="course-preview">
      <h2>{courseSeedData.courseTitle}</h2>
      <p>Topics: {courseContent.topics?.length || 0}</p>
    </div>
  )
}))

vi.mock('../ProjectExportImport', () => ({
  ProjectExportButton: ({ projectData }: any) => (
    <div data-testid="export-button">
      Exporting: {projectData.metadata.projectName}
    </div>
  ),
  ProjectImportButton: ({ onImport }: any) => (
    <button data-testid="import-button" onClick={onImport}>
      Import Project
    </button>
  )
}))

vi.mock('../DesignSystem', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  Input: ({ label, value, onChange, placeholder }: any) => (
    <div>
      <label htmlFor="package-version">{label}</label>
      <input 
        id="package-version"
        value={value} 
        onChange={onChange} 
        placeholder={placeholder}
      />
    </div>
  ),
  Section: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Flex: ({ children, gap }: any) => (
    <div data-testid="flex" data-gap={gap}>{children}</div>
  ),
  Grid: ({ children, cols, gap }: any) => (
    <div data-testid="grid" data-cols={cols} data-gap={gap}>{children}</div>
  ),
  LoadingSpinner: ({ size }: any) => (
    <div data-testid="loading-spinner" data-size={size}>Loading...</div>
  ),
  Modal: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div data-testid="modal">
        <h3>{title}</h3>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null
}))

describe('SCORMPackageBuilder', () => {
  const mockCourseContent: CourseContent = {
    learningObjectivesPage: 'Test objectives',
    topics: [
      { title: 'Topic 1', content: 'Content 1' },
      { title: 'Topic 2', content: 'Content 2' }
    ],
    assessment: {
      questions: [
        { 
          question: 'Test question',
          options: ['A', 'B', 'C'],
          correctAnswer: 0,
          explanation: 'Test explanation'
        }
      ]
    }
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    audienceDescription: 'Test Audience',
    duration: 60,
    difficulty: 3
  }

  const mockHandlers = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.__TAURI__
    ;(window as any).__TAURI__ = undefined
  })

  it('should render course information', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('Test Course')).toBeInTheDocument()
    expect(screen.getByText(/✓ objectives/)).toBeInTheDocument()
    expect(screen.getByText(/2 topics/)).toBeInTheDocument()
    expect(screen.getByText(/1 assessment questions/)).toBeInTheDocument()
  })

  it('should render package configuration section', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    expect(screen.getByLabelText('Package Version')).toBeInTheDocument()
    expect(screen.getByText('SCORM Version')).toBeInTheDocument()
    expect(screen.getByText('SCORM 1.2')).toBeInTheDocument()
  })

  it('should update version when input changes', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const versionInput = screen.getByLabelText('Package Version') as HTMLInputElement
    expect(versionInput.value).toBe('1.0')

    fireEvent.change(versionInput, { target: { value: '2.0' } })
    expect(versionInput.value).toBe('2.0')
  })

  it('should show initial generation status', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    expect(screen.getByText(/No package has been generated yet/)).toBeInTheDocument()
  })

  it('should handle generate SCORM package click', async () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByText('Generate SCORM Package')
    fireEvent.click(generateButton)

    // Should show loading state
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByText('Generating...')).toBeInTheDocument()

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.getByText(/SCORM package generated successfully/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should handle preview button click', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const previewButton = screen.getByText('Preview Course')
    fireEvent.click(previewButton)

    expect(screen.getByTestId('course-preview')).toBeInTheDocument()
    // Use getAllByText since there are multiple elements with 'Test Course'
    const courseTitle = screen.getAllByText('Test Course')
    expect(courseTitle.length).toBeGreaterThan(0)
  })

  it('should close preview modal', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Open preview
    fireEvent.click(screen.getByText('Preview Course'))
    expect(screen.getByTestId('course-preview')).toBeInTheDocument()

    // Close preview
    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByTestId('course-preview')).not.toBeInTheDocument()
  })

  it('should handle export button click', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    fireEvent.click(screen.getByText('Export'))
    expect(screen.getByTestId('export-button')).toBeInTheDocument()
    expect(screen.getByText('Exporting: Test Course')).toBeInTheDocument()
  })

  it('should handle import button click', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    fireEvent.click(screen.getByText('Import'))
    expect(screen.getByTestId('import-button')).toBeInTheDocument()
  })

  it('should close import modal after import', async () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Open import modal
    fireEvent.click(screen.getByText('Import'))
    expect(screen.getByTestId('import-button')).toBeInTheDocument()

    // Click import button inside modal
    fireEvent.click(screen.getByTestId('import-button'))

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByTestId('import-button')).not.toBeInTheDocument()
    })
  })

  it('should handle step click', () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // PageLayout should be rendered with onStepClick handler
    expect(screen.getByTestId('page-layout')).toBeInTheDocument()
  })

  it('should detect Tauri environment', () => {
    ;(window as any).__TAURI__ = {}

    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // The component should detect Tauri environment
    // This affects the success message after generation
    expect(screen.getByTestId('page-layout')).toBeInTheDocument()
  })

  it('should show generation progress', async () => {
    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByText('Generate SCORM Package')
    fireEvent.click(generateButton)

    // Should show progress messages
    await waitFor(() => {
      expect(screen.getByText(/Loading SCORM generator|Loading content converter|Generating SCORM package/)).toBeInTheDocument()
    })
  })

  it('should handle generation error', async () => {
    // Mock console.error to avoid test output pollution
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    // Make the dynamic import fail
    const { loadSCORMGenerator } = await import('../../utils/dynamicImports')
    vi.mocked(loadSCORMGenerator).mockRejectedValueOnce(new Error('Test error'))

    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const generateButton = screen.getByText('Generate SCORM Package')
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error generating SCORM package. Please check the console for details.')
    })

    // Cleanup
    consoleSpy.mockRestore()
    alertSpy.mockRestore()
  })

  it('should render with minimal course seed data', () => {
    const minimalSeedData = {
      courseTitle: 'Minimal Course'
    }

    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={minimalSeedData}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('Minimal Course')).toBeInTheDocument()
  })

  it('should handle course content without assessment', () => {
    const contentWithoutAssessment = {
      ...mockCourseContent,
      assessment: undefined
    }

    render(
      <SCORMPackageBuilder 
        courseContent={contentWithoutAssessment}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    expect(screen.getByText(/0 assessment questions/)).toBeInTheDocument()
  })
})