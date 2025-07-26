import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Pagination } from '../Pagination'

// Mock the Button and Flex components
vi.mock('../Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}))

vi.mock('../Layout', () => ({
  Flex: ({ children, ...props }: any) => (
    <div data-testid="flex" {...props}>{children}</div>
  )
}))

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    hasNextPage: true,
    onPageChange: vi.fn()
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render pagination controls', () => {
      render(<Pagination {...defaultProps} />)
      
      expect(screen.getByTestId('pagination-controls')).toBeInTheDocument()
      expect(screen.getByText('Previous Page')).toBeInTheDocument()
      expect(screen.getByText('Next Page')).toBeInTheDocument()
      expect(screen.getByText('Page 1')).toBeInTheDocument()
    })

    it('should display current page number', () => {
      render(<Pagination {...defaultProps} currentPage={5} />)
      
      expect(screen.getByText('Page 5')).toBeInTheDocument()
    })

    it('should show result text without total', () => {
      render(<Pagination {...defaultProps} currentPage={2} />)
      
      expect(screen.getByText('Showing 11-20 of many results')).toBeInTheDocument()
    })

    it('should show result text with total', () => {
      render(<Pagination {...defaultProps} totalResults={50} />)
      
      expect(screen.getByText('Showing 1-10 of 50 results')).toBeInTheDocument()
    })

    it('should show loading text when loading', () => {
      render(<Pagination {...defaultProps} isLoading />)
      
      expect(screen.getByText('Loading more results...')).toBeInTheDocument()
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    })
  })

  describe('Button States', () => {
    it('should disable previous button on first page', () => {
      render(<Pagination {...defaultProps} currentPage={1} />)
      
      const prevButton = screen.getByLabelText('Go to previous page')
      expect(prevButton).toBeDisabled()
    })

    it('should enable previous button after first page', () => {
      render(<Pagination {...defaultProps} currentPage={2} />)
      
      const prevButton = screen.getByLabelText('Go to previous page')
      expect(prevButton).not.toBeDisabled()
    })

    it('should disable next button when no next page', () => {
      render(<Pagination {...defaultProps} hasNextPage={false} />)
      
      const nextButton = screen.getByLabelText('Go to next page')
      expect(nextButton).toBeDisabled()
    })

    it('should enable next button when has next page', () => {
      render(<Pagination {...defaultProps} hasNextPage={true} />)
      
      const nextButton = screen.getByLabelText('Go to next page')
      expect(nextButton).not.toBeDisabled()
    })

    it('should disable both buttons when loading', () => {
      render(<Pagination {...defaultProps} currentPage={2} isLoading />)
      
      const prevButton = screen.getByLabelText('Go to previous page')
      const nextButton = screen.getByLabelText('Go to next page')
      
      expect(prevButton).toBeDisabled()
      expect(nextButton).toBeDisabled()
    })
  })

  describe('Click Events', () => {
    it('should call onPageChange when clicking previous', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />)
      
      fireEvent.click(screen.getByLabelText('Go to previous page'))
      
      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('should call onPageChange when clicking next', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />)
      
      fireEvent.click(screen.getByLabelText('Go to next page'))
      
      expect(onPageChange).toHaveBeenCalledWith(4)
    })

    it('should not call onPageChange when buttons are disabled', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} currentPage={1} onPageChange={onPageChange} />)
      
      fireEvent.click(screen.getByLabelText('Go to previous page'))
      
      expect(onPageChange).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should navigate to previous page with left arrow', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />)
      
      const container = screen.getByTestId('pagination-controls')
      fireEvent.keyDown(container, { key: 'ArrowLeft' })
      
      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('should navigate to next page with right arrow', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />)
      
      const container = screen.getByTestId('pagination-controls')
      fireEvent.keyDown(container, { key: 'ArrowRight' })
      
      expect(onPageChange).toHaveBeenCalledWith(4)
    })

    it('should not navigate with arrow keys when on first page going back', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} currentPage={1} onPageChange={onPageChange} />)
      
      const container = screen.getByTestId('pagination-controls')
      fireEvent.keyDown(container, { key: 'ArrowLeft' })
      
      expect(onPageChange).not.toHaveBeenCalled()
    })

    it('should not navigate with arrow keys when no next page', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} hasNextPage={false} onPageChange={onPageChange} />)
      
      const container = screen.getByTestId('pagination-controls')
      fireEvent.keyDown(container, { key: 'ArrowRight' })
      
      expect(onPageChange).not.toHaveBeenCalled()
    })

    it('should not navigate with arrow keys when loading', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} currentPage={2} isLoading onPageChange={onPageChange} />)
      
      const container = screen.getByTestId('pagination-controls')
      fireEvent.keyDown(container, { key: 'ArrowLeft' })
      fireEvent.keyDown(container, { key: 'ArrowRight' })
      
      expect(onPageChange).not.toHaveBeenCalled()
    })

    it('should ignore other keys', () => {
      const onPageChange = vi.fn()
      render(<Pagination {...defaultProps} onPageChange={onPageChange} />)
      
      const container = screen.getByTestId('pagination-controls')
      fireEvent.keyDown(container, { key: 'Enter' })
      fireEvent.keyDown(container, { key: 'Space' })
      fireEvent.keyDown(container, { key: 'a' })
      
      expect(onPageChange).not.toHaveBeenCalled()
    })
  })

  describe('Result Calculations', () => {
    it('should calculate correct result range for first page', () => {
      render(<Pagination {...defaultProps} currentPage={1} totalResults={100} />)
      
      expect(screen.getByText('Showing 1-10 of 100 results')).toBeInTheDocument()
    })

    it('should calculate correct result range for middle page', () => {
      render(<Pagination {...defaultProps} currentPage={5} totalResults={100} />)
      
      expect(screen.getByText('Showing 41-50 of 100 results')).toBeInTheDocument()
    })

    it('should handle last page with fewer results', () => {
      render(<Pagination {...defaultProps} currentPage={5} totalResults={43} />)
      
      expect(screen.getByText('Showing 41-43 of 43 results')).toBeInTheDocument()
    })

    it('should use custom results per page', () => {
      render(<Pagination {...defaultProps} currentPage={2} resultsPerPage={20} totalResults={100} />)
      
      expect(screen.getByText('Showing 21-40 of 100 results')).toBeInTheDocument()
    })

    it('should handle single result', () => {
      render(<Pagination {...defaultProps} currentPage={1} totalResults={1} />)
      
      expect(screen.getByText('Showing 1-1 of 1 results')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria labels', () => {
      render(<Pagination {...defaultProps} />)
      
      expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument()
      expect(screen.getByLabelText('Go to next page')).toBeInTheDocument()
    })

    it('should be keyboard focusable', () => {
      render(<Pagination {...defaultProps} />)
      
      const container = screen.getByTestId('pagination-controls')
      expect(container).toHaveAttribute('tabIndex', '0')
    })

    it('should handle keyboard navigation correctly', async () => {
      const user = userEvent.setup()
      const onPageChange = vi.fn()
      
      render(<Pagination {...defaultProps} currentPage={2} onPageChange={onPageChange} />)
      
      const container = screen.getByTestId('pagination-controls')
      await user.click(container)
      await user.keyboard('{ArrowLeft}')
      
      expect(onPageChange).toHaveBeenCalledWith(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle page 1 with no next page', () => {
      render(<Pagination {...defaultProps} currentPage={1} hasNextPage={false} />)
      
      const prevButton = screen.getByLabelText('Go to previous page')
      const nextButton = screen.getByLabelText('Go to next page')
      
      expect(prevButton).toBeDisabled()
      expect(nextButton).toBeDisabled()
    })

    it('should handle very large page numbers', () => {
      render(<Pagination {...defaultProps} currentPage={9999} />)
      
      expect(screen.getByText('Page 9999')).toBeInTheDocument()
      expect(screen.getByText('Showing 99981-99990 of many results')).toBeInTheDocument()
    })

    it('should handle zero total results gracefully', () => {
      render(<Pagination {...defaultProps} currentPage={1} totalResults={0} />)
      
      // When totalResults is 0 (falsy), it falls back to "of many results"
      expect(screen.getByText('Showing 1-10 of many results')).toBeInTheDocument()
    })
  })

  describe('Style Application', () => {
    it('should apply pagination container styles', () => {
      const { container } = render(<Pagination {...defaultProps} />)
      
      const paginationContainer = container.querySelector('.pagination-container')
      expect(paginationContainer).toHaveStyle({
        marginTop: '1rem',
        padding: '1rem',
        borderTop: '1px solid var(--color-border-default)'
      })
    })

    it('should apply page number styles', () => {
      const { container } = render(<Pagination {...defaultProps} />)
      
      // Find the span that contains the page number
      const pageSpan = container.querySelector('span')
      expect(pageSpan).toBeInTheDocument()
      expect(pageSpan).toHaveTextContent('Page 1')
      
      // Check that inline styles are present in the style attribute
      const styleAttr = pageSpan?.getAttribute('style')
      expect(styleAttr).toContain('padding: 0.25rem 0.75rem')
      expect(styleAttr).toContain('background-color: var(--color-bg-secondary)')
      expect(styleAttr).toContain('border-radius: 0.25rem')
      expect(styleAttr).toContain('font-size: 0.875rem')
      expect(styleAttr).toContain('color: var(--color-text-primary)')
    })
  })
})