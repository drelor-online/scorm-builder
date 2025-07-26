import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('should render with icon, title and description', () => {
    render(
      <EmptyState
        icon="🔍"
        title="No results found"
        description="Try different keywords or check your spelling"
      />
    )

    expect(screen.getByText('🔍')).toBeInTheDocument()
    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.getByText('Try different keywords or check your spelling')).toBeInTheDocument()
  })

  it('should render without description', () => {
    render(
      <EmptyState
        icon="📁"
        title="No files uploaded"
      />
    )

    expect(screen.getByText('📁')).toBeInTheDocument()
    expect(screen.getByText('No files uploaded')).toBeInTheDocument()
  })

  it('should render with action button', () => {
    const mockAction = vi.fn()
    
    render(
      <EmptyState
        icon="📷"
        title="No images found"
        description="Upload your first image to get started"
        action={{
          label: 'Upload Image',
          onClick: mockAction
        }}
      />
    )

    const button = screen.getByRole('button', { name: 'Upload Image' })
    expect(button).toBeInTheDocument()
    
    button.click()
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('should support custom className', () => {
    const { container } = render(
      <EmptyState
        icon="🚀"
        title="Get started"
        className="custom-empty-state"
      />
    )

    expect(container.querySelector('.custom-empty-state')).toBeInTheDocument()
  })

  it('should support React node as icon', () => {
    render(
      <EmptyState
        icon={<svg data-testid="custom-icon"><circle /></svg>}
        title="Custom icon"
      />
    )

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })
})