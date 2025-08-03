import { render, screen , waitFor } from '../../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchInput } from './SearchInput'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

describe('SearchInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should render search input', () => {
    render(<SearchInput onSearch={vi.fn()} />)
    
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('should call onSearch when typing', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    
    render(<SearchInput onSearch={onSearch} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'test search')
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('test search')
    })
  })

  it('should show search history dropdown on focus', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['previous search', 'another search']))
    
    render(<SearchInput onSearch={vi.fn()} />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    await waitFor(() => {
      expect(screen.getByText('previous search')).toBeInTheDocument()
      expect(screen.getByText('another search')).toBeInTheDocument()
    })
  })

  it('should filter history based on input', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['apple', 'banana', 'apricot']))
    
    render(<SearchInput onSearch={vi.fn()} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'ap')
    
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument()
      expect(screen.getByText('apricot')).toBeInTheDocument()
      expect(screen.queryByText('banana')).not.toBeInTheDocument()
    })
  })

  it('should select history item on click', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['previous search']))
    
    render(<SearchInput onSearch={onSearch} />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    const historyItem = await screen.findByText('previous search')
    await user.click(historyItem)
    
    expect(input).toHaveValue('previous search')
    expect(onSearch).toHaveBeenCalledWith('previous search')
  })

  it('should navigate history with keyboard', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['first', 'second', 'third']))
    
    render(<SearchInput onSearch={vi.fn()} />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    // Navigate down
    await user.keyboard('{ArrowDown}')
    expect(screen.getByText('first')).toHaveAttribute('aria-selected', 'true')
    
    await user.keyboard('{ArrowDown}')
    expect(screen.getByText('second')).toHaveAttribute('aria-selected', 'true')
    
    // Navigate up
    await user.keyboard('{ArrowUp}')
    expect(screen.getByText('first')).toHaveAttribute('aria-selected', 'true')
    
    // Select with Enter
    await user.keyboard('{Enter}')
    expect(input).toHaveValue('first')
  })

  it('should close dropdown on Escape', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['search item']))
    
    render(<SearchInput onSearch={vi.fn()} />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    expect(screen.getByText('search item')).toBeInTheDocument()
    
    await user.keyboard('{Escape}')
    
    await waitFor(() => {
      expect(screen.queryByText('search item')).not.toBeInTheDocument()
    })
  })

  it('should add to history on Enter', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    
    render(<SearchInput onSearch={onSearch} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'new search{Enter}')
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'searchHistory:default',
      JSON.stringify(['new search'])
    )
  })

  it('should show clear button when input has value', async () => {
    const user = userEvent.setup()
    
    render(<SearchInput onSearch={vi.fn()} />)
    
    const input = screen.getByRole('textbox')
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    
    await user.type(input, 'search text')
    
    const clearButton = screen.getByLabelText('Clear search')
    expect(clearButton).toBeInTheDocument()
    
    await user.click(clearButton)
    expect(input).toHaveValue('')
  })

  it('should support custom placeholder', () => {
    render(<SearchInput onSearch={vi.fn()} placeholder="Find something..." />)
    
    expect(screen.getByPlaceholderText('Find something...')).toBeInTheDocument()
  })

  it('should support custom history key', () => {
    render(<SearchInput onSearch={vi.fn()} historyKey="custom-search" />)
    
    // Check that localStorage is accessed with custom key
    expect(localStorageMock.getItem).toHaveBeenCalledWith('searchHistory:custom-search')
  })

  it('should support disabling history', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['should not show']))
    
    render(<SearchInput onSearch={vi.fn()} showHistory={false} />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    // History should not be shown
    expect(screen.queryByText('should not show')).not.toBeInTheDocument()
  })

  it('should debounce onSearch calls', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    
    render(<SearchInput onSearch={onSearch} debounceMs={100} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'fast typing')
    
    // Should not be called immediately
    expect(onSearch).not.toHaveBeenCalled()
    
    // Should be called after debounce
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('fast typing')
    }, { timeout: 200 })
    
    // Should only be called once despite multiple keystrokes
    expect(onSearch).toHaveBeenCalledTimes(1)
  })
})