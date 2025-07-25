import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

// Mock heavy components
vi.mock('../components/CourseSeedInputRefactored', () => ({
  CourseSeedInput: () => <div data-testid="course-seed-input">Course Seed Input</div>
}))

vi.mock('../components/AIPromptGenerator', () => ({
  AIPromptGenerator: () => <div data-testid="ai-prompt-generator">AI Prompt Generator</div>
}))

vi.mock('../components/JSONImportValidatorRefactored', () => ({
  JSONImportValidator: () => <div data-testid="json-import-validator">JSON Import Validator</div>
}))

// Mock ErrorBoundary
vi.mock('../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <div data-testid="error-boundary">{children}</div>
}))

// Mock services
vi.mock('../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: true,
    currentProjectId: null,
    createProject: vi.fn().mockResolvedValue({ id: 'test-id', name: 'Test Project', created: new Date().toISOString(), last_modified: new Date().toISOString() }),
    openProject: vi.fn().mockResolvedValue(undefined),
    saveProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    listProjects: vi.fn().mockResolvedValue([]),
    getRecentProjects: vi.fn().mockResolvedValue([]),
    getCurrentProjectId: vi.fn().mockReturnValue(null),
    clearCurrentProject: vi.fn(),
    saveContent: vi.fn().mockResolvedValue(undefined),
    getContent: vi.fn().mockResolvedValue(null),
    saveCourseMetadata: vi.fn().mockResolvedValue(undefined),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    addStateChangeListener: vi.fn().mockReturnValue(() => {})
  }
}))

// Mock PersistentStorageContext
vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: any) => children,
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: null,
    error: null,
    createProject: vi.fn(),
    openProject: vi.fn(),
    saveProject: vi.fn(),
    deleteProject: vi.fn(),
    listProjects: vi.fn().mockResolvedValue([]),
    getRecentProjects: vi.fn().mockResolvedValue([]),
    clearCurrentProject: vi.fn(),
    saveContent: vi.fn(),
    getContent: vi.fn(),
    saveCourseMetadata: vi.fn(),
    getCourseMetadata: vi.fn().mockResolvedValue(null)
  })
}))

// Mock hooks
vi.mock('../hooks/useAutoSave', () => ({
  useAutoSave: () => ({
    status: 'idle',
    save: vi.fn(),
    hasUnsavedChanges: false
  })
}))

describe('App Component - Simple Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should render without crashing', () => {
    render(<App />)
    expect(document.body).toBeTruthy()
  })

  it('should wrap app in error boundary', () => {
    render(<App />)
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
  })

  it('should render course seed input as first step', () => {
    render(<App />)
    expect(screen.getByTestId('course-seed-input')).toBeInTheDocument()
  })

  it('should have main content area', () => {
    render(<App />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('should include skip to main content link for accessibility', () => {
    render(<App />)
    expect(screen.getByText('Skip to main content')).toBeInTheDocument()
  })
})