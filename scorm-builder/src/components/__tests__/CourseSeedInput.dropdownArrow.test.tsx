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

describe('CourseSeedInput - Dropdown Arrow Contrast', () => {
  const mockProps = {
    courseSeed: '',
    onChangeSeed: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn()
  }
  
  it('should have sufficient contrast for dropdown arrow', () => {
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    )
    
    // Find the template select element
    const templateSelect = screen.getByTestId('template-select')
    expect(templateSelect).toBeInTheDocument()
    
    // Check the computed styles
    const styles = window.getComputedStyle(templateSelect)
    
    // The dropdown arrow should have light color on dark background
    // Check that we're not using default black arrow
    expect(styles.color).not.toBe('black')
    expect(styles.color).not.toBe('#000000')
    expect(styles.color).not.toBe('rgb(0, 0, 0)')
    
    // Verify appearance is set to show custom styling
    expect(styles.appearance || styles.webkitAppearance).toBe('none')
  })
  
  it('should have custom arrow styling with good visibility', () => {
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    )
    
    const templateSelect = screen.getByTestId('template-select')
    const styles = window.getComputedStyle(templateSelect)
    
    // Should have background image for custom arrow or proper color
    const hasCustomArrow = styles.backgroundImage && styles.backgroundImage !== 'none'
    const hasLightColor = styles.color && (
      styles.color.includes('255') || // RGB white
      styles.color.includes('fff') || // Hex white
      styles.color.includes('e5e7eb') || // Light gray
      styles.color.includes('9ca3af') // Medium gray
    )
    
    expect(hasCustomArrow || hasLightColor).toBeTruthy()
  })
})