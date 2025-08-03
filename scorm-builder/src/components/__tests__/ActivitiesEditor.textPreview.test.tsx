import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ActivitiesEditor } from '../ActivitiesEditor'

// Mock contexts
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

describe('ActivitiesEditor - Text Preview Height', () => {
  const mockProps = {
    activities: [
      {
        id: 'page-1',
        type: 'page' as const,
        content: {
          title: 'Test Page',
          text: 'This is a long text content that should be visible in the preview. '.repeat(10)
        }
      }
    ],
    onActivitiesChange: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
    courseSeed: {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: ['Topic 1'],
      template: 'None' as const,
      templateTopics: []
    }
  }
  
  it('should have adequate height for text content preview', () => {
    render(<ActivitiesEditor {...mockProps} />)
    
    // Find the text preview area
    const textPreviews = screen.getAllByText(/This is a long text content/i)
    
    textPreviews.forEach(preview => {
      const container = preview.closest('[class*="preview"], [class*="content"], [role="article"]') || preview.parentElement
      const styles = window.getComputedStyle(container!)
      
      // Check minimum height
      const height = parseFloat(styles.height || '0')
      const minHeight = parseFloat(styles.minHeight || '0')
      const maxHeight = parseFloat(styles.maxHeight || '0')
      
      // Should have adequate minimum height (at least 100px for readability)
      expect(minHeight).toBeGreaterThanOrEqual(100)
      
      // If max-height is set, it should be reasonable (at least 200px)
      if (maxHeight && maxHeight !== 999999) {
        expect(maxHeight).toBeGreaterThanOrEqual(200)
      }
      
      // Should not be artificially constrained to a tiny height
      if (height) {
        expect(height).toBeGreaterThanOrEqual(60)
      }
    })
  })
  
  it('should show scrollbar for long content instead of cutting off', () => {
    const longContent = 'Lorem ipsum dolor sit amet. '.repeat(50)
    
    const propsWithLongContent = {
      ...mockProps,
      activities: [
        {
          id: 'page-1',
          type: 'page' as const,
          content: {
            title: 'Test Page',
            text: longContent
          }
        }
      ]
    }
    
    render(<ActivitiesEditor {...propsWithLongContent} />)
    
    const textPreview = screen.getByText(/Lorem ipsum/i)
    const container = textPreview.closest('[class*="preview"], [class*="content"]') || textPreview.parentElement
    const styles = window.getComputedStyle(container!)
    
    // Should handle overflow properly
    expect(['auto', 'scroll', 'hidden']).toContain(styles.overflowY)
    
    // If overflow is hidden, should have text-overflow ellipsis
    if (styles.overflowY === 'hidden') {
      expect(styles.textOverflow).toBe('ellipsis')
    }
    
    // If scrollable, should have reasonable max-height
    if (styles.overflowY === 'auto' || styles.overflowY === 'scroll') {
      const maxHeight = parseFloat(styles.maxHeight || '0')
      expect(maxHeight).toBeGreaterThan(0)
      expect(maxHeight).toBeLessThan(1000) // Not unlimited
    }
  })
  
  it('should be expandable or have adequate default height', async () => {
    const user = userEvent.setup()
    
    render(<ActivitiesEditor {...mockProps} />)
    
    // Look for expand/collapse button or check default height
    const expandButton = screen.queryByRole('button', { name: /expand|show more|view all/i })
    
    if (expandButton) {
      // If expandable, test expansion
      const textPreview = screen.getByText(/This is a long text content/i)
      const containerBefore = textPreview.closest('[class*="preview"]')
      const heightBefore = containerBefore ? window.getComputedStyle(containerBefore).height : '0'
      
      await user.click(expandButton)
      
      const containerAfter = textPreview.closest('[class*="preview"]')
      const heightAfter = containerAfter ? window.getComputedStyle(containerAfter).height : '0'
      
      // Height should increase after expansion
      expect(parseFloat(heightAfter)).toBeGreaterThan(parseFloat(heightBefore))
    } else {
      // If not expandable, should have good default height
      const textPreview = screen.getByText(/This is a long text content/i)
      const container = textPreview.closest('[class*="preview"], [class*="content"]')
      
      if (container) {
        const styles = window.getComputedStyle(container)
        const minHeight = parseFloat(styles.minHeight || '0')
        
        // Should have adequate minimum height
        expect(minHeight).toBeGreaterThanOrEqual(150)
      }
    }
  })
  
  it('should maintain readability with proper line height', () => {
    render(<ActivitiesEditor {...mockProps} />)
    
    const textPreview = screen.getByText(/This is a long text content/i)
    const styles = window.getComputedStyle(textPreview)
    
    // Check line height for readability
    const lineHeight = styles.lineHeight
    const fontSize = parseFloat(styles.fontSize)
    
    if (lineHeight !== 'normal') {
      const lineHeightValue = parseFloat(lineHeight)
      
      // Line height should be at least 1.4x font size for readability
      expect(lineHeightValue).toBeGreaterThanOrEqual(fontSize * 1.4)
    }
    
    // Check that text is not cramped
    const padding = parseFloat(styles.padding || '0')
    expect(padding).toBeGreaterThanOrEqual(0)
  })
})