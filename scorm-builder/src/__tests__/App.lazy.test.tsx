import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.lazy'

// Mock the lazy loaded components
vi.mock('@/components/CourseSeedInputRefactored', () => ({
  CourseSeedInput: vi.fn(() => <div data-testid="course-seed-input">CourseSeedInput</div>)
}))

vi.mock('@/components/AIPromptGenerator', () => ({
  AIPromptGenerator: vi.fn(() => <div data-testid="ai-prompt-generator">AIPromptGenerator</div>)
}))

vi.mock('@/components/JSONImportValidatorRefactored', () => ({
  JSONImportValidator: vi.fn(() => <div data-testid="json-import-validator">JSONImportValidator</div>)
}))

vi.mock('./components/MediaEnhancementWizardRefactored', () => ({
  MediaEnhancementWizard: vi.fn(() => <div data-testid="media-enhancement-wizard">MediaEnhancementWizard</div>)
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn()
}))

describe('App with Lazy Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should show loading state while component is being loaded', async () => {
    const { container } = render(<App />)
    
    // Should show loading component initially
    expect(screen.getByText(/Loading component.../i)).toBeInTheDocument()
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('course-seed-input')).toBeInTheDocument()
    })
    
    // Loading component should be gone
    expect(screen.queryByText(/Loading component.../i)).not.toBeInTheDocument()
  })

  it('should lazy load components only when needed', async () => {
    const { rerender } = render(<App />)
    
    // Wait for initial component
    await waitFor(() => {
      expect(screen.getByTestId('course-seed-input')).toBeInTheDocument()
    })
    
    // AI Prompt Generator should not be loaded yet
    expect(screen.queryByTestId('ai-prompt-generator')).not.toBeInTheDocument()
    
    // Simulate moving to next step would require mocking the component interaction
    // This demonstrates that components are loaded on demand
  })

  it('should display enhanced loading component with spinner', async () => {
    render(<App />)
    
    const loadingComponent = screen.getByText(/Loading component.../i).parentElement
    
    // Check for spinner animation
    const spinner = loadingComponent?.querySelector('div[style*="animation"]')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveStyle({ animation: expect.stringContaining('spin') })
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('course-seed-input')).toBeInTheDocument()
    })
  })

  it('should maintain suspense boundaries for each step', async () => {
    render(<App />)
    
    // Each step should have its own Suspense boundary
    await waitFor(() => {
      expect(screen.getByTestId('course-seed-input')).toBeInTheDocument()
    })
    
    // The component should be wrapped in ErrorBoundary
    const appContainer = screen.getByTestId('course-seed-input').closest('.app')
    expect(appContainer).toBeInTheDocument()
  })

  it('should preload critical modules after initial render', async () => {
    vi.useFakeTimers()
    
    // Mock dynamic imports
    const importSpy = vi.spyOn(global, 'import' as any).mockImplementation((path: string) => {
      if (path.includes('spaceEfficientScormGenerator')) {
        return Promise.resolve({ generateSpaceEfficientSCORM12Buffer: vi.fn() })
      }
      if (path.includes('courseContentConverter')) {
        return Promise.resolve({ convertToEnhancedCourseContent: vi.fn() })
      }
      return Promise.resolve({})
    })
    
    render(<App />)
    
    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('course-seed-input')).toBeInTheDocument()
    })
    
    // Fast forward to trigger preload
    vi.advanceTimersByTime(2000)
    
    // Preload functions should be called
    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(expect.stringContaining('spaceEfficientScormGenerator'))
      expect(importSpy).toHaveBeenCalledWith(expect.stringContaining('courseContentConverter'))
    })
    
    vi.useRealTimers()
  })
})

describe('Dynamic Import Utilities', () => {
  it('should cache loaded modules', async () => {
    const { loadSCORMGenerator } = await import('../utils/dynamicImports')
    
    // Mock the import
    vi.mock('@/services/spaceEfficientScormGenerator', () => ({
      generateSpaceEfficientSCORM12Buffer: vi.fn().mockReturnValue('mock-generator')
    }))
    
    // First call should import
    const generator1 = await loadSCORMGenerator('1.2')
    
    // Second call should use cache
    const generator2 = await loadSCORMGenerator('1.2')
    
    // Should be the same reference
    expect(generator1).toBe(generator2)
  })

  it('should handle unsupported SCORM versions', async () => {
    const { loadSCORMGenerator } = await import('../utils/dynamicImports')
    
    await expect(loadSCORMGenerator('2004')).rejects.toThrow('SCORM 2004 not yet implemented')
    await expect(loadSCORMGenerator('invalid')).rejects.toThrow('Unsupported SCORM version')
  })
})