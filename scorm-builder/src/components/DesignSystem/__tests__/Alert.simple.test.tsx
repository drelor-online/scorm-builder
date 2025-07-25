import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Alert } from '../Alert'

describe('Alert Component - Simple Tests', () => {
  it('should render info alert', () => {
    render(
      <Alert variant="info">
        This is an informational message
      </Alert>
    )

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('This is an informational message')).toBeInTheDocument()
    expect(alert.className).toContain('alert-info')
  })

  it('should render success alert', () => {
    render(
      <Alert variant="success">
        Operation completed successfully!
      </Alert>
    )

    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('alert-success')
    expect(screen.getByText('Operation completed successfully!')).toBeInTheDocument()
  })

  it('should render warning alert', () => {
    render(
      <Alert variant="warning">
        Please review before continuing
      </Alert>
    )

    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('alert-warning')
  })

  it('should render error alert', () => {
    render(
      <Alert variant="error">
        An error occurred
      </Alert>
    )

    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('alert-error')
  })

  it('should apply custom className', () => {
    render(
      <Alert variant="info" className="custom-alert">
        Custom styled alert
      </Alert>
    )

    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('custom-alert')
  })

  it('should use info variant by default', () => {
    render(
      <Alert>
        Default alert
      </Alert>
    )

    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('alert-info')
  })
})