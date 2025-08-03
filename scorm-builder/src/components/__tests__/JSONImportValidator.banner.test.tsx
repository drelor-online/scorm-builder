import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JSONImportValidator } from '../JSONImportValidator'

describe('JSONImportValidator - Success Banner Spacing and Contrast', () => {
  const mockOnNext = vi.fn()
  const validJSON = JSON.stringify({
    title: 'Test Course',
    topics: [
      { title: 'Topic 1', content: 'Content 1' }
    ]
  }, null, 2)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have proper spacing between success banner and Clear button', async () => {
    const { container } = render(<JSONImportValidator onNext={mockOnNext} />)

    // Input valid JSON
    const textarea = screen.getByPlaceholderText(/paste.*json/i)
    fireEvent.change(textarea, { target: { value: validJSON } })

    // Click validate
    const validateBtn = screen.getByText(/validate json/i)
    fireEvent.click(validateBtn)

    // Wait for validation result
    await waitFor(() => {
      expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
    })

    // Get the success alert and clear button
    const successAlert = container.querySelector('.alert-success') || 
                         container.querySelector('[class*="success"]') ||
                         screen.getByText(/valid json structure/i).closest('div')
    
    const clearButton = screen.getByText(/clear json/i)

    expect(successAlert).toBeInTheDocument()
    expect(clearButton).toBeInTheDocument()

    // Check spacing - banner should have margin bottom
    const alertStyles = window.getComputedStyle(successAlert!)
    const marginBottom = parseFloat(alertStyles.marginBottom)
    
    // Should have at least 16px (1rem) margin bottom
    expect(marginBottom).toBeGreaterThanOrEqual(16)

    // Check they don't overlap
    const alertRect = successAlert!.getBoundingClientRect()
    const clearRect = clearButton.getBoundingClientRect()
    
    // Bottom of alert should be above top of clear button with gap
    expect(alertRect.bottom).toBeLessThan(clearRect.top)
    const gap = clearRect.top - alertRect.bottom
    expect(gap).toBeGreaterThanOrEqual(8) // At least 8px gap
  })

  it('should have high contrast white text on green background', async () => {
    const { container } = render(<JSONImportValidator onNext={mockOnNext} />)

    // Input valid JSON
    const textarea = screen.getByPlaceholderText(/paste.*json/i)
    fireEvent.change(textarea, { target: { value: validJSON } })

    // Click validate
    const validateBtn = screen.getByText(/validate json/i)
    fireEvent.click(validateBtn)

    // Wait for validation result
    await waitFor(() => {
      expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
    })

    // Get the success alert
    const successAlert = container.querySelector('.alert-success') || 
                         container.querySelector('[class*="success"]') ||
                         screen.getByText(/valid json structure/i).closest('div')

    const alertStyles = window.getComputedStyle(successAlert!)
    
    // Check background is green
    expect(alertStyles.backgroundColor).toMatch(/rgb\(22, 163, 74\)|#16a34a|green/i)
    
    // Check text is white for maximum contrast
    expect(alertStyles.color).toMatch(/white|rgb\(255, 255, 255\)|#ffffff/i)

    // Check text within alert is also white
    const textElements = successAlert!.querySelectorAll('*')
    textElements.forEach(element => {
      const styles = window.getComputedStyle(element)
      if (styles.color && styles.color !== 'rgba(0, 0, 0, 0)') {
        // All text should be white or very light
        expect(styles.color).toMatch(/white|rgb\(255, 255, 255\)|#ffffff|rgba\(255, 255, 255/i)
      }
    })
  })

  it('should not have light gray text on green background', async () => {
    const { container } = render(<JSONImportValidator onNext={mockOnNext} />)

    // Input valid JSON
    const textarea = screen.getByPlaceholderText(/paste.*json/i)
    fireEvent.change(textarea, { target: { value: validJSON } })

    // Click validate
    const validateBtn = screen.getByText(/validate json/i)
    fireEvent.click(validateBtn)

    // Wait for validation result
    await waitFor(() => {
      expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
    })

    // Get all text in success alert
    const successAlert = screen.getByText(/valid json structure/i).closest('div')
    const allText = successAlert!.querySelectorAll('*')

    allText.forEach(element => {
      const styles = window.getComputedStyle(element)
      if (styles.color) {
        // Should NOT be gray
        expect(styles.color).not.toMatch(/gray|grey|#[6789abcdef]{6}|rgb\(1[0-9]{2}/i)
      }
    })
  })

  it('should have proper padding inside the alert', async () => {
    const { container } = render(<JSONImportValidator onNext={mockOnNext} />)

    // Input valid JSON
    const textarea = screen.getByPlaceholderText(/paste.*json/i)
    fireEvent.change(textarea, { target: { value: validJSON } })

    // Click validate
    const validateBtn = screen.getByText(/validate json/i)
    fireEvent.click(validateBtn)

    // Wait for validation result
    await waitFor(() => {
      expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
    })

    const successAlert = screen.getByText(/valid json structure/i).closest('div')
    const alertStyles = window.getComputedStyle(successAlert!)
    
    // Should have substantial padding
    const padding = parseFloat(alertStyles.padding)
    expect(padding).toBeGreaterThanOrEqual(16) // At least 1rem
  })
})