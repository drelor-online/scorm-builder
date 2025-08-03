import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CourseSeedInput } from '../CourseSeedInput'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'

describe('CourseSeedInput - Difficulty Button Highlighting', () => {
  const mockOnSubmit = vi.fn()
  
  it('should highlight the selected difficulty button', () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider totalSteps={7}>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            initialData={{
              courseTitle: 'Test Course',
              difficulty: 3,
              customTopics: ['Topic 1'],
              template: 'None',
              templateTopics: []
            }}
          />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )
    
    // Check that Medium (difficulty 3) is selected
    const mediumButton = screen.getByTestId('difficulty-3')
    const easyButton = screen.getByTestId('difficulty-2')
    
    // The selected button should have primary variant
    expect(mediumButton).toHaveAttribute('data-selected', 'true')
    expect(mediumButton).toHaveClass('selected')
    
    // Non-selected button should not have these
    expect(easyButton).toHaveAttribute('data-selected', 'false')
    expect(easyButton).not.toHaveClass('selected')
    
    // Click Easy button
    fireEvent.click(easyButton)
    
    // Now Easy should be selected
    expect(easyButton).toHaveAttribute('data-selected', 'true')
    expect(easyButton).toHaveClass('selected')
    expect(mediumButton).toHaveAttribute('data-selected', 'false')
    expect(mediumButton).not.toHaveClass('selected')
  })
  
  it('should have visible styling difference between selected and unselected buttons', () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider totalSteps={7}>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            initialData={{
              courseTitle: 'Test Course',
              difficulty: 3,
              customTopics: ['Topic 1'],
              template: 'None',
              templateTopics: []
            }}
          />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )
    
    const mediumButton = screen.getByTestId('difficulty-3')
    const styles = window.getComputedStyle(mediumButton)
    
    // Selected button should have a background color (not transparent/white)
    expect(styles.backgroundColor).not.toBe('')
    expect(styles.backgroundColor).not.toBe('transparent')
    expect(styles.backgroundColor).not.toBe('rgb(255, 255, 255)')
  })
})