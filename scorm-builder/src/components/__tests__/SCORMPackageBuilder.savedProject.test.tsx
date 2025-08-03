import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/testProviders'
import { SCORMPackageBuilder } from '../SCORMPackageBuilder'
import type { CourseContent } from '../../types/aiPrompt'

// Mock dependencies
vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    getMedia: vi.fn(),
    getMediaForTopic: vi.fn()
  })
}))

vi.mock('../PageLayout', () => ({
  PageLayout: ({ children, coursePreview }: any) => (
    <div data-testid="page-layout">
      {coursePreview && <div data-testid="course-preview-wrapper">{coursePreview}</div>}
      {children}
    </div>
  )
}))

vi.mock('../CoursePreview', () => ({
  CoursePreview: () => <div data-testid="course-preview">Course Preview</div>
}))

vi.mock('../DesignSystem', () => ({
  Card: ({ children, title }: any) => <div data-testid="card">{title && <h3>{title}</h3>}{children}</div>,
  Input: ({ label, value }: any) => <div data-testid="input">{label}: {value}</div>,
  Section: ({ children }: any) => <div data-testid="section">{children}</div>,
  Grid: ({ children }: any) => <div data-testid="grid">{children}</div>,
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  DesignAlert: ({ children, variant }: any) => <div data-testid={`alert`} data-variant={variant}>{children}</div>
}))

describe('SCORMPackageBuilder - Saved Project Loading', () => {
  const mockCourseContent: CourseContent = {
    topics: [
      {
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5
      }
    ],
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      duration: 2
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Objectives',
      content: 'Objectives content',
      duration: 2
    },
    objectives: ['Objective 1'],
    assessment: {
      questions: [],
      passMark: 80
    }
  }

  it('should render when loading a saved project with minimal courseSeedData', () => {
    // Minimal courseSeedData that might be loaded from storage
    const minimalCourseSeedData = {
      courseTitle: 'Saved Course Title',
      courseDescription: 'Saved course description'
    }

    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={minimalCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Should render the page layout
    expect(screen.getByTestId('page-layout')).toBeInTheDocument()

    // Should display course information with title
    expect(screen.getByText('Saved Course Title')).toBeInTheDocument()
    expect(screen.getByText('Saved course description')).toBeInTheDocument()

    // Should render course preview wrapper (the preview is included in PageLayout)
    expect(screen.getByTestId('course-preview-wrapper')).toBeInTheDocument()
  })

  it('should render with only courseTitle in courseSeedData', () => {
    // Very minimal data - just the required courseTitle
    const minimalCourseSeedData = {
      courseTitle: 'My Course'
    }

    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={minimalCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Should render without errors
    expect(screen.getByTestId('page-layout')).toBeInTheDocument()
    expect(screen.getByText('My Course')).toBeInTheDocument()
  })

  it('should show error message when courseContent is missing', () => {
    const courseSeedData = {
      courseTitle: 'Test Course'
    }

    render(
      <SCORMPackageBuilder
        courseContent={null as any}
        courseSeedData={courseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Should show error message
    expect(screen.getByText(/Unable to load course data/)).toBeInTheDocument()
  })

  it('should show error message when courseSeedData is missing', () => {
    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={null as any}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Should show error message
    expect(screen.getByText(/Unable to load course data/)).toBeInTheDocument()
  })

  it('should handle courseSeedData with all optional fields missing', () => {
    const courseSeedData = {
      courseTitle: 'Basic Course',
      // All other fields undefined
      courseDescription: undefined,
      audienceDescription: undefined,
      duration: undefined
    }

    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={courseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Should render successfully
    expect(screen.getByTestId('page-layout')).toBeInTheDocument()
    expect(screen.getByText('Basic Course')).toBeInTheDocument()
    
    // Should not show duration or description since they're undefined
    expect(screen.queryByText(/minutes/)).not.toBeInTheDocument()
  })
})