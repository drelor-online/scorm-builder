import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card } from './Card'

describe('Card Component', () => {
  it('renders children content', () => {
    render(
      <Card>
        <p>Card content</p>
      </Card>
    )
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders with title when provided', () => {
    render(<Card title="Card Title">Content</Card>)
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card Title').tagName).toBe('H3')
  })

  it('applies default padding', () => {
    const { container } = render(<Card>Content</Card>)
    const card = container.firstChild
    expect(card).toHaveClass('card')
  })

  it('applies different padding sizes', () => {
    const { container, rerender } = render(<Card padding="small">Content</Card>)
    expect(container.firstChild).toHaveClass('card-padding-small')
    
    rerender(<Card padding="large">Content</Card>)
    expect(container.firstChild).toHaveClass('card-padding-large')
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-card">Content</Card>)
    expect(container.firstChild).toHaveClass('custom-card')
  })

  it('renders with no shadow when specified', () => {
    const { container } = render(<Card noShadow>Content</Card>)
    expect(container.firstChild).toHaveClass('card-no-shadow')
  })
})