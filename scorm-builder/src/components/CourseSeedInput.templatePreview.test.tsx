import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CourseSeedInput } from './CourseSeedInput'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { templateTopics } from '../types/course'

// Mock the storage context
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
  listProjects: vi.fn(),
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage,
}))

// Mock other dependencies
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        {children}
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </NotificationProvider>
)

describe('CourseSeedInput Template Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.listProjects.mockResolvedValue([])
  })

  it('should show template preview tooltip when hovering over template select', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <CourseSeedInput onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    // Find the template select dropdown
    const templateSelect = screen.getByTestId('template-select')
    expect(templateSelect).toBeInTheDocument()

    // Change to How-to Guide template
    fireEvent.change(templateSelect, { target: { value: 'How-to Guide' } })

    // Hover over the template select to show preview
    fireEvent.mouseEnter(templateSelect)

    // Should show tooltip with template topics
    await waitFor(() => {
      expect(screen.getByTestId('template-preview-tooltip')).toBeInTheDocument()
    })

    // Should show the first few topics from the How-to Guide template
    expect(screen.getByText('Introduction and Overview')).toBeInTheDocument()
    expect(screen.getByText('Prerequisites and Requirements')).toBeInTheDocument()
    expect(screen.getByText('Step-by-Step Instructions')).toBeInTheDocument()
  })

  it('should hide template preview tooltip when mouse leaves', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <CourseSeedInput onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    // Find template select and set to Corporate
    const templateSelect = screen.getByTestId('template-select')
    fireEvent.change(templateSelect, { target: { value: 'Corporate' } })
    
    // Hover over the template select
    fireEvent.mouseEnter(templateSelect)

    // Should show tooltip
    await waitFor(() => {
      expect(screen.getByTestId('template-preview-tooltip')).toBeInTheDocument()
    })

    // Move mouse away
    fireEvent.mouseLeave(templateSelect)

    // Should hide tooltip
    await waitFor(() => {
      expect(screen.queryByTestId('template-preview-tooltip')).not.toBeInTheDocument()
    })
  })

  it('should show different topics for different templates', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <CourseSeedInput onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    const templateSelect = screen.getByTestId('template-select')

    // Test Corporate template
    fireEvent.change(templateSelect, { target: { value: 'Corporate' } })
    fireEvent.mouseEnter(templateSelect)

    await waitFor(() => {
      expect(screen.getByTestId('template-preview-tooltip')).toBeInTheDocument()
    })

    // Should show Corporate template topics
    expect(screen.getByText('Company Mission and Values')).toBeInTheDocument()
    expect(screen.getByText('Organizational Structure')).toBeInTheDocument()

    // Move away and test Technical template
    fireEvent.mouseLeave(templateSelect)
    
    await waitFor(() => {
      expect(screen.queryByTestId('template-preview-tooltip')).not.toBeInTheDocument()
    })

    fireEvent.change(templateSelect, { target: { value: 'Technical' } })
    fireEvent.mouseEnter(templateSelect)

    await waitFor(() => {
      expect(screen.getByTestId('template-preview-tooltip')).toBeInTheDocument()
    })

    // Should show Technical template topics
    expect(screen.getByText('Introduction and Overview')).toBeInTheDocument()
    expect(screen.getByText('Fundamental Concepts')).toBeInTheDocument()
  })

  it('should not show tooltip for None template option', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <CourseSeedInput onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    // Template select should default to None
    const templateSelect = screen.getByTestId('template-select')
    expect(templateSelect).toHaveValue('None')

    // Hover over the template select with None selected
    fireEvent.mouseEnter(templateSelect)

    // Should not show tooltip since None template has no topics
    await waitFor(() => {
      expect(screen.queryByTestId('template-preview-tooltip')).not.toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('should show template preview with proper positioning and styling', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <CourseSeedInput onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    const templateSelect = screen.getByTestId('template-select')
    fireEvent.change(templateSelect, { target: { value: 'Safety' } })
    fireEvent.mouseEnter(templateSelect)

    await waitFor(() => {
      expect(screen.getByTestId('template-preview-tooltip')).toBeInTheDocument()
    })

    const tooltip = screen.getByTestId('template-preview-tooltip')
    
    // Should have proper styling classes
    expect(tooltip).toHaveClass('templatePreviewTooltip')
    
    // Should have a title indicating it's a preview
    expect(screen.getByText(/Safety Template Topics:/i)).toBeInTheDocument()
    
    // Should show some Safety-specific topics
    expect(screen.getByText('Safety Fundamentals')).toBeInTheDocument()
    expect(screen.getByText('Hazard Identification')).toBeInTheDocument()
  })
})