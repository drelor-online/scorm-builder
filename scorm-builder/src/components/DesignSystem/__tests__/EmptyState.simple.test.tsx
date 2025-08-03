import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../../test/testProviders'
import { EmptyState } from '../EmptyState'

describe('EmptyState Component - Simple Tests', () => {
  it('should render with title and description', () => {
    render(
      <EmptyState 
        icon={<span>📭</span>}
        title="No data found"
        description="Try adjusting your filters"
      />
    )

    expect(screen.getByText('No data found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
  })

  it('should render with icon', () => {
    const icon = <svg data-testid="empty-icon" />
    render(
      <EmptyState 
        icon={icon}
        title="Empty"
      />
    )

    expect(screen.getByTestId('empty-icon')).toBeInTheDocument()
  })

  it('should render action button', () => {
    const handleAction = vi.fn()
    render(
      <EmptyState 
        icon={<span>📭</span>}
        title="No projects"
        action={{
          label: 'Create Project',
          onClick: handleAction
        }}
      />
    )

    const button = screen.getByRole('button', { name: 'Create Project' })
    expect(button).toBeInTheDocument()
    
    fireEvent.click(button)
    expect(handleAction).toHaveBeenCalledTimes(1)
  })

  it('should only render primary action', () => {
    const handlePrimary = vi.fn()
    
    render(
      <EmptyState 
        icon={<span>📭</span>}
        title="No results"
        action={{
          label: 'Primary Action',
          onClick: handlePrimary
        }}
      />
    )

    const primaryButton = screen.getByRole('button', { name: 'Primary Action' })
    
    expect(primaryButton).toBeInTheDocument()
    
    fireEvent.click(primaryButton)
    expect(handlePrimary).toHaveBeenCalledTimes(1)
  })

  it('should render without description', () => {
    render(
      <EmptyState 
        icon={<span>📭</span>}
        title="No items"
      />
    )
    
    expect(screen.getByText('No items')).toBeInTheDocument()
    expect(screen.queryByText('Try adjusting your filters')).not.toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(
      <EmptyState 
        title="Custom"
        className="custom-empty-state"
      />
    )

    expect(container.firstChild).toHaveClass('custom-empty-state')
  })

  it('should render without action button', () => {
    render(
      <EmptyState 
        icon={<span>📭</span>}
        title="Empty list"
        description="No items to display"
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should handle minimal props', () => {
    render(<EmptyState icon={<span>📭</span>} title="Just a title" />)
    
    expect(screen.getByText('Just a title')).toBeInTheDocument()
  })

  it('should apply base empty-state class', () => {
    render(
      <EmptyState icon={<span>📭</span>} title="Default" />
    )

    expect(container.firstChild).toHaveClass('empty-state')
  })
})