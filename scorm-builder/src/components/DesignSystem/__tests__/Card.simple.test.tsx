import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '../Card'

describe('Card Component - Simple Tests', () => {
  it('should render card with title', () => {
    render(
      <Card title="Test Card">
        <p>Card content</p>
      </Card>
    )

    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('should render card without title', () => {
    render(
      <Card>
        <p>Just content</p>
      </Card>
    )

    expect(screen.getByText('Just content')).toBeInTheDocument()
  })

  it('should apply variant classes', () => {
    const { rerender, container } = render(
      <Card variant="default">Default card</Card>
    )
    
    expect(container.firstChild).toHaveClass('card')
    expect(container.firstChild).not.toHaveClass('card-dark')

    rerender(<Card variant="dark">Dark card</Card>)
    expect(container.firstChild).toHaveClass('card-dark')
  })

  it('should apply padding prop', () => {
    const { rerender, container } = render(
      <Card padding="small">Small padding</Card>
    )
    
    expect(container.firstChild).toHaveClass('card-padding-small')

    rerender(<Card padding="medium">Medium padding</Card>)
    // Medium is default, so no extra class
    expect(container.firstChild).not.toHaveClass('card-padding-medium')

    rerender(<Card padding="large">Large padding</Card>)
    expect(container.firstChild).toHaveClass('card-padding-large')
  })

  it('should apply custom className', () => {
    const { container } = render(
      <Card className="custom-card">
        Custom styled card
      </Card>
    )

    expect(container.firstChild).toHaveClass('custom-card')
  })

  it('should handle noShadow prop', () => {
    const { container } = render(
      <Card noShadow>
        No shadow card
      </Card>
    )

    expect(container.firstChild).toHaveClass('card-no-shadow')
  })

  it('should handle mouse events', () => {
    const handleMouseEnter = vi.fn()
    const handleMouseLeave = vi.fn()
    
    const { container } = render(
      <Card 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        Interactive card
      </Card>
    )

    const card = container.firstChild as HTMLElement
    
    // Use fireEvent from testing-library
    fireEvent.mouseEnter(card)
    expect(handleMouseEnter).toHaveBeenCalledTimes(1)
    
    fireEvent.mouseLeave(card)
    expect(handleMouseLeave).toHaveBeenCalledTimes(1)
  })

  it('should apply data-testid when provided', () => {
    render(
      <Card data-testid="test-card">
        Test card
      </Card>
    )

    expect(screen.getByTestId('test-card')).toBeInTheDocument()
  })

  it('should apply inline styles', () => {
    const { container } = render(
      <Card style={{ backgroundColor: 'red' }}>
        Styled card
      </Card>
    )

    const card = container.firstChild as HTMLElement
    expect(card.style.backgroundColor).toBe('red')
  })

  it('should use default values', () => {
    const { container } = render(<Card>Default settings</Card>)
    
    const card = container.firstChild
    expect(card).toHaveClass('card')
    // Medium padding is default, so no extra class
    expect(card).not.toHaveClass('card-padding-medium')
    // Default variant doesn't add extra class
    expect(card).not.toHaveClass('card-default')
  })
})