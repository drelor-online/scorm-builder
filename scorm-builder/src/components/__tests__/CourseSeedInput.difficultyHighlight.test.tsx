import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('CourseSeedInput - Difficulty Level Highlighting', () => {
  const mockProps = {
    courseSeed: '',
    onChangeSeed: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn()
  }
  
  it('should visually distinguish selected difficulty with btn-primary class', async () => {
    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    )
    
    // Find difficulty buttons by their parent buttons
    const buttons = screen.getAllByRole('button')
    const difficultyButtons = buttons.filter(btn => 
      ['Basic', 'Easy', 'Medium', 'Hard', 'Expert'].includes(btn.textContent || '')
    )
    
    // Medium should be selected by default (difficulty = 3)
    const mediumButton = difficultyButtons.find(btn => btn.textContent === 'Medium')
    expect(mediumButton?.className).toContain('btn-primary')
    
    // Others should have btn-secondary
    const otherButtons = difficultyButtons.filter(btn => btn.textContent !== 'Medium')
    otherButtons.forEach(btn => {
      expect(btn.className).toContain('btn-secondary')
      expect(btn.className).not.toContain('btn-primary')
    })
    
    // Click Hard button
    const hardButton = difficultyButtons.find(btn => btn.textContent === 'Hard')
    if (hardButton) {
      await user.click(hardButton)
      
      // Hard should now have btn-primary
      expect(hardButton.className).toContain('btn-primary')
      expect(hardButton.className).not.toContain('btn-secondary')
      
      // Medium should now have btn-secondary
      expect(mediumButton?.className).toContain('btn-secondary')
      expect(mediumButton?.className).not.toContain('btn-primary')
    }
  })
  
  it('should highlight the selected difficulty level', async () => {
    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    )
    
    // Find difficulty buttons - note the actual labels
    const basicButton = screen.getByText('Basic')
    const easyButton = screen.getByText('Easy')
    const mediumButton = screen.getByText('Medium')
    const hardButton = screen.getByText('Hard')
    const expertButton = screen.getByText('Expert')
    
    // Click Medium button
    await user.click(mediumButton)
    
    // Medium should have aria-pressed=true indicating it's selected
    expect(mediumButton.getAttribute('aria-pressed')).toBe('true')
    
    // Others should have aria-pressed=false
    expect(basicButton.getAttribute('aria-pressed')).toBe('false')
    expect(easyButton.getAttribute('aria-pressed')).toBe('false')
    expect(hardButton.getAttribute('aria-pressed')).toBe('false')
    expect(expertButton.getAttribute('aria-pressed')).toBe('false')
  })
  
  it('should update highlighting when different difficulty is selected', async () => {
    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    )
    
    const mediumButton = screen.getByText('Medium')
    const hardButton = screen.getByText('Hard')
    
    // Initially click Medium
    await user.click(mediumButton)
    
    // Verify Medium is selected
    expect(mediumButton.getAttribute('aria-pressed')).toBe('true')
    expect(hardButton.getAttribute('aria-pressed')).toBe('false')
    
    // Now click Hard
    await user.click(hardButton)
    
    // Hard should now be selected
    expect(hardButton.getAttribute('aria-pressed')).toBe('true')
    
    // Medium should no longer be selected
    expect(mediumButton.getAttribute('aria-pressed')).toBe('false')
  })
  
  it('should have visual distinction for selected difficulty', () => {
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    )
    
    // Find the selected button (default or after interaction)
    const buttons = screen.getAllByRole('button').filter(btn => 
      ['Basic', 'Easy', 'Medium', 'Hard', 'Expert'].includes(btn.textContent || '')
    )
    
    // At least one should be selected (default is difficulty level 3 = Medium)
    const hasSelectedButton = buttons.some(button => {
      return button.getAttribute('aria-pressed') === 'true'
    })
    
    expect(hasSelectedButton).toBeTruthy()
    
    // Specifically, Medium should be selected by default (difficulty = 3)
    const mediumButton = screen.getByText('Medium')
    expect(mediumButton.getAttribute('aria-pressed')).toBe('true')
  })
})