import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CourseSeedInput } from '../CourseSeedInput'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'

// Mock contexts
vi.mock('../../contexts/PersistentStorageContext', () => ({
  usePersistentStorage: () => ({
    getApiKeys: vi.fn().mockResolvedValue({})
  }),
  useStorage: () => ({
    loading: false,
    error: null,
    projects: [],
    refreshProjects: vi.fn(),
    deleteProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn()
  })
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <StepNavigationProvider visitedSteps={[0]} currentStep={0}>
      {children}
    </StepNavigationProvider>
  )
}

describe('CourseSeedInput - Manage Templates Button', () => {
  const mockProps = {
    courseSeed: '',
    onChangeSeed: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn()
  }
  
  it('should NOT display Manage Templates button', () => {
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    )
    
    // The button should not exist
    const manageTemplatesButton = screen.queryByText(/Manage Templates/i)
    expect(manageTemplatesButton).not.toBeInTheDocument()
  })
  
  it('should NOT have any template management buttons', () => {
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    )
    
    // Check various possible variations
    expect(screen.queryByText(/Manage Templates/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Edit Templates/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Template Manager/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('manage-templates-button')).not.toBeInTheDocument()
  })
})