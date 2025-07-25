import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import App from '../App'

describe('Dark Professional Theme', () => {
  describe('Theme Colors', () => {
    it('should use dark professional theme colors', () => {
      const { container } = render(<App />)
      const mainContainer = container.firstChild as HTMLElement
      
      // Check dark theme background
      expect(mainContainer).toHaveStyle('background-color: #18181b')
    })
  })

  describe('Theme Typography', () => {
    it('should use professional fonts', () => {
      const { container } = render(<App />)
      const h1 = container.querySelector('h1')
      
      // Check that headings exist
      expect(h1).toBeInTheDocument()
      expect(h1).toHaveTextContent('SCORM Course Builder')
    })

    it('should have consistent heading styles', () => {
      const { container } = render(<App />)
      const h1 = container.querySelector('h1')
      
      // Check heading color
      expect(h1).toBeInTheDocument()
      expect(h1).toHaveStyle('color: #f4f4f5')
    })
  })

  describe('Professional Styling', () => {
    it('should have consistent spacing and layout', () => {
      const { container } = render(<App />)
      const mainContent = container.querySelector('main')
      
      expect(mainContent).toBeInTheDocument()
      expect(mainContent).toHaveAttribute('id', 'main-content')
    })

    it('should have professional button styles', () => {
      const { container } = render(<App />)
      const buttons = container.querySelectorAll('button')
      
      expect(buttons.length).toBeGreaterThan(0)
      // Verify dark theme button exists
      const primaryButton = Array.from(buttons).find(btn => 
        btn.textContent?.includes('Continue')
      )
      expect(primaryButton).toBeInTheDocument()
    })

    it('should have consistent card/section styling', () => {
      const { container } = render(<App />)
      
      // Find dark theme cards
      const cards = container.querySelectorAll('div')
      const darkCard = Array.from(cards).find(div => {
        const style = (div as HTMLElement).style
        return style.backgroundColor === 'rgb(39, 39, 42)'
      })
      
      expect(darkCard).toBeTruthy()
    })
  })

  describe('Responsive Design', () => {
    it('should have mobile-friendly styles', () => {
      const { container } = render(<App />)
      
      // Check for responsive container
      const responsiveContainer = container.querySelector('[style*="max-width"]')
      expect(responsiveContainer).toBeInTheDocument()
    })
  })

  describe('Dark Theme Header', () => {
    it('should display dark theme header', () => {
      const { container } = render(<App />)
      const header = container.querySelector('header')
      
      expect(header).toBeInTheDocument()
      expect(header).toHaveStyle('background-color: #27272a')
    })
  })

  describe('Dark Theme Components', () => {
    it('should have dark styled form inputs', () => {
      const { container } = render(<App />)
      const input = container.querySelector('input[type="text"]')
      
      expect(input).toBeInTheDocument()
      expect(input).toHaveStyle('background-color: #18181b')
      expect(input).toHaveStyle('border: 1px solid #3f3f46')
    })
  })
})