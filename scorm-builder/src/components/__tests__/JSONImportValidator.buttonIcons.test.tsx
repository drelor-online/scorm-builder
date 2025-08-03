import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { JSONImportValidator } from '../JSONImportValidator'

// Mock the storage context
vi.mock('../../contexts/PersistentStorageContext', () => ({
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

describe('JSONImportValidator - Button Icons Consistency', () => {
  const mockProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }
  
  it('should have consistent button styling with other pages', () => {
    render(<JSONImportValidator {...mockProps} />)
    
    // Find all action buttons
    const buttons = screen.getAllByRole('button')
    
    // Filter to get main action buttons (not navigation)
    const actionButtons = buttons.filter(btn => {
      const text = btn.textContent?.toLowerCase() || ''
      return text.includes('validate') || 
             text.includes('import') || 
             text.includes('clear') ||
             text.includes('format')
    })
    
    // Check that buttons have consistent classes
    actionButtons.forEach(button => {
      const classes = button.className
      
      // Should use the design system button classes
      expect(classes).toMatch(/btn|button/i)
      
      // Should not have inline styles that override design system
      const inlineStyles = button.getAttribute('style')
      if (inlineStyles) {
        // Inline styles should not override important properties
        expect(inlineStyles).not.toMatch(/font-family/i)
        expect(inlineStyles).not.toMatch(/border-radius: \d+px/i)
      }
    })
  })
  
  it('should use icon components consistently', () => {
    render(<JSONImportValidator {...mockProps} />)
    
    // Check for icon usage in buttons
    const validateButton = screen.getByRole('button', { name: /validate/i })
    const clearButton = screen.queryByRole('button', { name: /clear/i })
    
    // Buttons should either have icons or not, consistently
    const validateIcon = validateButton.querySelector('svg, [class*="icon"]')
    const clearIcon = clearButton?.querySelector('svg, [class*="icon"]')
    
    // If one has an icon, all should have icons (consistency)
    if (validateIcon || clearIcon) {
      expect(validateIcon).toBeTruthy()
      if (clearButton) {
        expect(clearIcon).toBeTruthy()
      }
    }
  })
  
  it('should have proper spacing between icon and text', () => {
    render(<JSONImportValidator {...mockProps} />)
    
    const buttons = screen.getAllByRole('button')
    
    buttons.forEach(button => {
      const icon = button.querySelector('svg, [class*="icon"]')
      if (icon) {
        // Check that button has flex layout for proper spacing
        const styles = window.getComputedStyle(button)
        
        // Should use flexbox for icon+text layout
        expect(['flex', 'inline-flex']).toContain(styles.display)
        
        // Should have gap or margin for spacing
        const gap = styles.gap || styles.columnGap
        if (gap && gap !== 'normal' && gap !== '0px') {
          expect(parseFloat(gap)).toBeGreaterThan(0)
        }
      }
    })
  })
  
  it('should match button variants used in other pages', () => {
    render(<JSONImportValidator {...mockProps} />)
    
    // Primary actions should use primary variant
    const validateButton = screen.getByRole('button', { name: /validate/i })
    expect(validateButton.className).toMatch(/primary|btn-primary/)
    
    // Secondary actions should use secondary variant
    const clearButton = screen.queryByRole('button', { name: /clear/i })
    if (clearButton) {
      expect(clearButton.className).toMatch(/secondary|btn-secondary|outline/)
    }
  })
})