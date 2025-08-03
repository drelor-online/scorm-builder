import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CourseSeedInput } from '../CourseSeedInput'

describe('CourseSeedInput - Difficulty Level Highlighting', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should visually highlight selected difficulty level with primary variant', () => {
    render(<CourseSeedInput onSubmit={mockOnSubmit} />)

    // Get all difficulty buttons
    const beginnerBtn = screen.getByTestId('difficulty-1')
    const intermediateBtn = screen.getByTestId('difficulty-2')
    const advancedBtn = screen.getByTestId('difficulty-3')
    const expertBtn = screen.getByTestId('difficulty-4')

    // Initially, Beginner (1) should be selected by default
    expect(beginnerBtn).toHaveClass('btn-primary')
    expect(intermediateBtn).toHaveClass('btn-secondary')
    expect(advancedBtn).toHaveClass('btn-secondary')
    expect(expertBtn).toHaveClass('btn-secondary')

    // Click on Advanced
    fireEvent.click(advancedBtn)

    // Advanced should now be primary, others secondary
    expect(beginnerBtn).toHaveClass('btn-secondary')
    expect(intermediateBtn).toHaveClass('btn-secondary')
    expect(advancedBtn).toHaveClass('btn-primary')
    expect(expertBtn).toHaveClass('btn-secondary')

    // Visual check - primary button should have blue background
    const advancedStyles = window.getComputedStyle(advancedBtn)
    expect(advancedStyles.backgroundColor).toMatch(/rgb\(59, 130, 246\)|#3b82f6/i)
    expect(advancedStyles.color).toMatch(/white|rgb\(255, 255, 255\)/i)
  })

  it('should apply difficulty-button-group class for proper CSS targeting', () => {
    const { container } = render(<CourseSeedInput onSubmit={mockOnSubmit} />)

    // Find the button group container
    const buttonGroup = container.querySelector('.difficulty-button-group')
    expect(buttonGroup).toBeInTheDocument()

    // All difficulty buttons should be within this group
    const buttonsInGroup = buttonGroup?.querySelectorAll('button[data-testid^="difficulty-"]')
    expect(buttonsInGroup).toHaveLength(4)
  })

  it('should have strong visual distinction for selected difficulty', () => {
    render(<CourseSeedInput onSubmit={mockOnSubmit} />)

    const expertBtn = screen.getByTestId('difficulty-4')
    
    // Click Expert
    fireEvent.click(expertBtn)

    // Check for strong visual indicators
    const expertStyles = window.getComputedStyle(expertBtn)
    
    // Should have blue background
    expect(expertStyles.backgroundColor).toMatch(/rgb\(59, 130, 246\)|#3b82f6/i)
    
    // Should have white text
    expect(expertStyles.color).toMatch(/white|rgb\(255, 255, 255\)/i)
    
    // Should have bold font weight
    expect(expertStyles.fontWeight).toMatch(/600|bold/i)
    
    // Should have box shadow for depth
    expect(expertStyles.boxShadow).toBeTruthy()
    expect(expertStyles.boxShadow).not.toBe('none')
  })

  it('should update difficulty value when button is clicked', () => {
    const { container } = render(<CourseSeedInput onSubmit={mockOnSubmit} />)

    // Get buttons
    const intermediateBtn = screen.getByTestId('difficulty-2')
    const expertBtn = screen.getByTestId('difficulty-4')

    // Click Intermediate
    fireEvent.click(intermediateBtn)
    
    // Check data attribute or aria-pressed to verify selection state
    expect(intermediateBtn).toHaveAttribute('data-selected', 'true')
    expect(expertBtn).toHaveAttribute('data-selected', 'false')

    // Click Expert
    fireEvent.click(expertBtn)
    
    // Check updated selection
    expect(intermediateBtn).toHaveAttribute('data-selected', 'false')
    expect(expertBtn).toHaveAttribute('data-selected', 'true')
  })

  it('should maintain visual highlighting after form interactions', () => {
    render(<CourseSeedInput onSubmit={mockOnSubmit} />)

    const advancedBtn = screen.getByTestId('difficulty-3')
    const titleInput = screen.getByLabelText(/course title/i)

    // Select Advanced difficulty
    fireEvent.click(advancedBtn)
    expect(advancedBtn).toHaveClass('btn-primary')

    // Interact with other form elements
    fireEvent.change(titleInput, { target: { value: 'Test Course' } })
    fireEvent.blur(titleInput)

    // Advanced should still be highlighted
    expect(advancedBtn).toHaveClass('btn-primary')
    
    // Visual check still applies
    const advancedStyles = window.getComputedStyle(advancedBtn)
    expect(advancedStyles.backgroundColor).toMatch(/rgb\(59, 130, 246\)|#3b82f6/i)
  })
})