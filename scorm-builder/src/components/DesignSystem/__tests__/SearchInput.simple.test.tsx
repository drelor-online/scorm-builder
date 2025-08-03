import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../../test/testProviders'
import { SearchInput } from '../SearchInput'

// Mock the hooks
vi.mock('../../../hooks/useSearchHistory', () => ({
  useSearchHistory: vi.fn(() => ({
    addToHistory: vi.fn(),
    getFilteredHistory: vi.fn(() => ['previous search', 'another search'])
  }))
}))

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: vi.fn((value) => value)
}))

import { useSearchHistory } from '../../../hooks/useSearchHistory'
import { useDebounce } from '../../../hooks/useDebounce'

describe('SearchInput Component - Simple Tests', () => {
  const mockOnSearch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock to default behavior
    vi.mocked(useSearchHistory).mockReturnValue({
      addToHistory: vi.fn(),
      getFilteredHistory: vi.fn(() => ['previous search', 'another search'])
    })
    vi.mocked(useDebounce).mockImplementation((value) => value)
  })

  it('should render with placeholder', () => {
    render(<SearchInput onSearch={mockOnSearch} placeholder="Search items..." />)
    
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument()
  })

  it('should render with default placeholder', () => {
    render(<SearchInput onSearch={mockOnSearch} />)
    
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('should call onSearch when typing (no debounce)', () => {
    render(<SearchInput onSearch={mockOnSearch} debounceMs={0} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.change(input, { target: { value: 'test query' } })
    
    expect(mockOnSearch).toHaveBeenCalledWith('test query')
  })

  it('should show search icon', () => {
    render(<SearchInput onSearch={mockOnSearch} />)
    
    expect(screen.getByText('🔍')).toBeInTheDocument()
  })

  it('should show clear button when has value', () => {
    render(<SearchInput onSearch={mockOnSearch} />)
    
    const input = screen.getByPlaceholderText('Search...')
    
    // No clear button initially
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    
    // Type something
    fireEvent.change(input, { target: { value: 'test' } })
    
    // Clear button should appear
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
  })

  it('should clear input when clear button clicked', () => {
    render(<SearchInput onSearch={mockOnSearch} />)
    
    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test' } })
    
    expect(input.value).toBe('test')
    
    const clearButton = screen.getByLabelText('Clear search')
    fireEvent.click(clearButton)
    
    expect(input.value).toBe('')
    expect(mockOnSearch).toHaveBeenCalledWith('')
  })

  it('should show history dropdown on focus when showHistory is true', () => {
    render(<SearchInput onSearch={mockOnSearch} showHistory={true} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.focus(input)
    
    expect(screen.getByText('previous search')).toBeInTheDocument()
    expect(screen.getByText('another search')).toBeInTheDocument()
  })

  it('should not show history when showHistory is false', () => {
    render(<SearchInput onSearch={mockOnSearch} showHistory={false} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.focus(input)
    
    expect(screen.queryByText('previous search')).not.toBeInTheDocument()
  })

  it('should handle Enter key to search', () => {
    const mockAddToHistory = vi.fn()
    vi.mocked(useSearchHistory).mockReturnValue({
      addToHistory: mockAddToHistory,
      getFilteredHistory: vi.fn(() => [])
    })
    
    render(<SearchInput onSearch={mockOnSearch} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.change(input, { target: { value: 'search term' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    
    expect(mockAddToHistory).toHaveBeenCalledWith('search term')
    expect(mockOnSearch).toHaveBeenCalledWith('search term')
  })

  it('should handle arrow keys for history navigation', async () => {
    render(<SearchInput onSearch={mockOnSearch} showHistory={true} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.focus(input)
    
    // Wait for dropdown to appear
    await waitFor(() => {
      expect(screen.getByText('previous search')).toBeInTheDocument()
    })
    
    // Press down arrow
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    
    // First item should be selected
    const firstItem = screen.getByRole('option', { name: 'previous search' })
    expect(firstItem).toHaveAttribute('aria-selected', 'true')
    
    // Press down arrow again
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    
    // Second item should be selected
    const secondItem = screen.getByRole('option', { name: 'another search' })
    expect(secondItem).toHaveAttribute('aria-selected', 'true')
    
    // Press up arrow
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(firstItem).toHaveAttribute('aria-selected', 'true')
  })

  it('should select history item on Enter when navigated', async () => {
    render(<SearchInput onSearch={mockOnSearch} showHistory={true} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.focus(input)
    
    // Wait for dropdown
    await waitFor(() => {
      expect(screen.getByText('previous search')).toBeInTheDocument()
    })
    
    // Navigate to first item
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    
    // Press Enter
    fireEvent.keyDown(input, { key: 'Enter' })
    
    expect(mockOnSearch).toHaveBeenCalledWith('previous search')
    expect((input as HTMLInputElement).value).toBe('previous search')
  })

  it('should close dropdown on Escape', async () => {
    render(<SearchInput onSearch={mockOnSearch} showHistory={true} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.focus(input)
    
    await waitFor(() => {
      expect(screen.getByText('previous search')).toBeInTheDocument()
    })
    
    fireEvent.keyDown(input, { key: 'Escape' })
    
    expect(screen.queryByText('previous search')).not.toBeInTheDocument()
  })

  it('should handle clicking history item', async () => {
    render(<SearchInput onSearch={mockOnSearch} showHistory={true} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.focus(input)
    
    await waitFor(() => {
      expect(screen.getByText('previous search')).toBeInTheDocument()
    })
    
    const historyItem = screen.getByText('previous search')
    fireEvent.click(historyItem)
    
    expect(mockOnSearch).toHaveBeenCalledWith('previous search')
    expect((input as HTMLInputElement).value).toBe('previous search')
  })

  it('should apply custom className', () => {
    render(
      <SearchInput onSearch={mockOnSearch} className="custom-search" />
    )
    
    expect(container.firstChild).toHaveClass('custom-search')
  })

  it('should close dropdown when clicking outside', async () => {
    render(
      <div>
        <SearchInput onSearch={mockOnSearch} showHistory={true} />
        <button>Outside button</button>
      </div>
    )
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.focus(input)
    
    expect(screen.getByText('previous search')).toBeInTheDocument()
    
    // Click outside
    const outsideButton = screen.getByText('Outside button')
    fireEvent.mouseDown(outsideButton)
    
    await waitFor(() => {
      expect(screen.queryByText('previous search')).not.toBeInTheDocument()
    })
  })

  it('should handle mouse hover on history items', async () => {
    render(<SearchInput onSearch={mockOnSearch} showHistory={true} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.focus(input)
    
    await waitFor(() => {
      expect(screen.getByText('previous search')).toBeInTheDocument()
    })
    
    const historyItem = screen.getByRole('option', { name: 'previous search' })
    
    // Hover should select the item
    fireEvent.mouseEnter(historyItem)
    expect(historyItem).toHaveAttribute('aria-selected', 'true')
  })

  it('should use debounced value when debounceMs > 0', () => {
    vi.mocked(useDebounce).mockReturnValue('debounced value')
    
    render(<SearchInput onSearch={mockOnSearch} debounceMs={300} />)
    
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.change(input, { target: { value: 'quick typing' } })
    
    // Should not call immediately when debounce is set
    expect(mockOnSearch).not.toHaveBeenCalledWith('quick typing')
  })
})