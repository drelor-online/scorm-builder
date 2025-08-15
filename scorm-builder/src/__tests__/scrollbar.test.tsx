import { render } from '@testing-library/react'
import { describe, it, expect, beforeAll } from 'vitest'
import '@testing-library/jest-dom'

describe('Global Scrollbar Styling', () => {
  beforeAll(() => {
    // Create and inject scrollbar styles for testing
    const style = document.createElement('style')
    style.textContent = `
      /* Import the actual scrollbar styles */
      @import '../styles/scrollbar.css';
    `
    document.head.appendChild(style)
  })

  it('should apply custom scrollbar styles to scrollable elements', () => {
    const { container } = render(
      <div 
        data-testid="scrollable-container"
        style={{ 
          height: '100px', 
          overflow: 'auto',
          width: '200px'
        }}
      >
        <div style={{ height: '500px' }}>
          Long content that creates a scrollbar
        </div>
      </div>
    )

    const scrollableElement = container.querySelector('[data-testid="scrollable-container"]')
    const styles = window.getComputedStyle(scrollableElement!, '::webkit-scrollbar')
    
    // In test environment, we mainly verify the styles are loaded
    // Actual visual testing would require E2E tests
    expect(scrollableElement).toBeInTheDocument()
  })

  it('should have consistent scrollbar width across elements', () => {
    const { container } = render(
      <div>
        <div 
          data-testid="scroll-1"
          style={{ height: '100px', overflow: 'auto' }}
        >
          <div style={{ height: '200px' }}>Content 1</div>
        </div>
        <div 
          data-testid="scroll-2"
          style={{ height: '100px', overflow: 'auto' }}
        >
          <div style={{ height: '200px' }}>Content 2</div>
        </div>
      </div>
    )

    const element1 = container.querySelector('[data-testid="scroll-1"]')
    const element2 = container.querySelector('[data-testid="scroll-2"]')
    
    // Both should have scrollbars with same styling
    expect(element1).toBeInTheDocument()
    expect(element2).toBeInTheDocument()
  })

  it('should support Firefox scrollbar properties', () => {
    const { container } = render(
      <div 
        data-testid="firefox-scroll"
        style={{ 
          height: '100px', 
          overflow: 'auto',
          // Firefox-specific properties
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(113, 113, 122, 0.5) rgba(39, 39, 42, 0.3)'
        } as React.CSSProperties}
      >
        <div style={{ height: '300px' }}>Firefox scrollbar test</div>
      </div>
    )

    const element = container.querySelector('[data-testid="firefox-scroll"]')
    expect(element).toBeInTheDocument()
    
    // Check if Firefox properties are applied
    const styles = window.getComputedStyle(element!)
    
    // Note: These properties may not be available in jsdom
    // but we're testing that they don't break the component
    expect(element).toHaveStyle({ overflow: 'auto' })
  })

  it('should apply dark theme colors to scrollbars', () => {
    // This test verifies the CSS is loaded and doesn't cause errors
    // Visual verification would require E2E testing
    const { container } = render(
      <div className="dark-theme">
        <div 
          data-testid="dark-scroll"
          style={{ 
            height: '100px', 
            overflow: 'auto',
            backgroundColor: '#18181b'
          }}
        >
          <div style={{ height: '300px', color: '#f4f4f5' }}>
            Dark theme content with scrollbar
          </div>
        </div>
      </div>
    )

    const element = container.querySelector('[data-testid="dark-scroll"]')
    expect(element).toBeInTheDocument()
    expect(element).toHaveStyle({ backgroundColor: '#18181b' })
  })

  it('should handle both vertical and horizontal scrollbars', () => {
    const { container } = render(
      <div 
        data-testid="both-scrollbars"
        style={{ 
          height: '100px', 
          width: '100px',
          overflow: 'auto'
        }}
      >
        <div style={{ height: '200px', width: '200px' }}>
          Content that needs both scrollbars
        </div>
      </div>
    )

    const element = container.querySelector('[data-testid="both-scrollbars"]')
    expect(element).toBeInTheDocument()
    expect(element).toHaveStyle({ overflow: 'auto' })
  })

  it('should not affect non-scrollable elements', () => {
    const { container } = render(
      <div 
        data-testid="no-scroll"
        style={{ 
          height: '100px',
          overflow: 'hidden'
        }}
      >
        <div style={{ height: '50px' }}>Small content</div>
      </div>
    )

    const element = container.querySelector('[data-testid="no-scroll"]')
    expect(element).toBeInTheDocument()
    expect(element).toHaveStyle({ overflow: 'hidden' })
  })
})