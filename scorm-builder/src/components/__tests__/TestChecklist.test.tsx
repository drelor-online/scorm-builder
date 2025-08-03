// Removed unused React import
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '../../test/testProviders'
import { TestChecklist } from '../TestChecklist'

// Mock the testRunner utility
vi.mock('../../utils/testRunner', () => ({
  logMemoryUsage: vi.fn()
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: { displayName: 'Check' },
  X: { displayName: 'X' },
  ArrowRight: { displayName: 'ArrowRight' },
  Edit2: { displayName: 'Edit2' }
}))

// Mock DesignSystem components
vi.mock('../DesignSystem', () => ({
  Card: ({ children, title, padding }: any) => (
    <div data-testid="card" data-padding={padding}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  ),
  Button: ({ children, onClick, size, variant }: any) => (
    <button 
      onClick={onClick}
      data-size={size}
      data-variant={variant}
    >
      {children}
    </button>
  ),
  IconButton: ({ icon, onClick, size, variant, tooltip, ariaLabel }: any) => (
    <button
      onClick={onClick}
      data-size={size}
      data-variant={variant}
      title={tooltip}
      aria-label={ariaLabel}
      data-testid="icon-button"
    >
      {icon.displayName || 'Icon'}
    </button>
  ),
  Flex: ({ children, justify, align, gap, style }: any) => (
    <div 
      data-testid="flex"
      data-justify={justify}
      data-align={align}
      data-gap={gap}
      style={style}
    >
      {children}
    </div>
  )
}))

describe('TestChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render with test checklist title', () => {
    render(<TestChecklist />)
    
    expect(screen.getByText('End-to-End Test Checklist')).toBeInTheDocument()
  })

  it('should log memory usage on mount and unmount', async () => {
    const { logMemoryUsage } = await import('../../utils/testRunner')
    const { unmount } = render(<TestChecklist />)
    
    expect(logMemoryUsage).toHaveBeenCalledWith('TestChecklist mounted')
    
    unmount()
    
    expect(logMemoryUsage).toHaveBeenCalledWith('TestChecklist unmounted')
  })

  it('should display test progress stats', () => {
    render(<TestChecklist />)
    
    expect(screen.getByText('Test Progress')).toBeInTheDocument()
    expect(screen.getByText(/Total: 12/)).toBeInTheDocument()
    expect(screen.getByText(/Passed: 0/)).toBeInTheDocument()
    expect(screen.getByText(/Failed: 0/)).toBeInTheDocument()
    expect(screen.getByText(/Skipped: 0/)).toBeInTheDocument()
    expect(screen.getByText(/Pending: 12/)).toBeInTheDocument()
  })

  it('should render all test items', () => {
    render(<TestChecklist />)
    
    // Check for specific test items
    expect(screen.getByText('[Project Management] Create New Project')).toBeInTheDocument()
    expect(screen.getByText('[Course Creation] Course Seed Data Entry')).toBeInTheDocument()
    expect(screen.getByText('[Content Generation] AI Content Generation')).toBeInTheDocument()
    expect(screen.getByText('[Audio] Audio Recording')).toBeInTheDocument()
    expect(screen.getByText('[Audio] Audio File Upload')).toBeInTheDocument()
    expect(screen.getByText('[Media] Image Enhancement')).toBeInTheDocument()
    expect(screen.getByText('[Media] Video Enhancement')).toBeInTheDocument()
    expect(screen.getByText('[Activities] Knowledge Check Editing')).toBeInTheDocument()
    expect(screen.getByText('[SCORM] SCORM Package Generation')).toBeInTheDocument()
    expect(screen.getByText('[SCORM] SCORM Package Testing')).toBeInTheDocument()
    expect(screen.getByText('[Data] Project Persistence')).toBeInTheDocument()
    expect(screen.getByText('[Performance] Memory Usage Check')).toBeInTheDocument()
  })

  it('should render test steps for each item', () => {
    render(<TestChecklist />)
    
    // Check for some specific steps
    expect(screen.getByText('Click "Create New Project"')).toBeInTheDocument()
    expect(screen.getByText('Enter project name')).toBeInTheDocument()
    expect(screen.getByText('Review AI prompt')).toBeInTheDocument()
    expect(screen.getByText('Click Generate Content')).toBeInTheDocument()
  })

  it('should update test status to pass when pass button clicked', () => {
    render(<TestChecklist />)
    
    // Find all icon buttons
    const iconButtons = screen.getAllByTestId('icon-button')
    // Pass buttons are the first button in each group of 4 (pass, fail, skip, notes)
    const passButtons = iconButtons.filter((_, index) => index % 4 === 0)
    
    // Click the first pass button
    fireEvent.click(passButtons[0])
    
    // The first test's pass button should now have a success variant
    expect(passButtons[0]).toHaveAttribute('data-variant', 'success')
    
    // Stats should update
    expect(screen.getByText(/Passed: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Pending: 11/)).toBeInTheDocument()
  })

  it('should update test status to fail when fail button clicked', () => {
    render(<TestChecklist />)
    
    // Find all icon buttons
    const iconButtons = screen.getAllByTestId('icon-button')
    // Fail buttons are the second button in each group of 4
    const failButtons = iconButtons.filter((_, index) => index % 4 === 1)
    
    // Click the first fail button
    fireEvent.click(failButtons[0])
    
    // The first test's fail button should now have a danger variant
    expect(failButtons[0]).toHaveAttribute('data-variant', 'danger')
    
    // Stats should update
    expect(screen.getByText(/Failed: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Pending: 11/)).toBeInTheDocument()
  })

  it('should update test status to skip when skip button clicked', () => {
    render(<TestChecklist />)
    
    // Find all icon buttons
    const iconButtons = screen.getAllByTestId('icon-button')
    // Skip buttons are the third button in each group of 4
    const skipButtons = iconButtons.filter((_, index) => index % 4 === 2)
    
    // Click the first skip button
    fireEvent.click(skipButtons[0])
    
    // The first test's skip button should now have a primary variant
    expect(skipButtons[0]).toHaveAttribute('data-variant', 'primary')
    
    // Stats should update
    expect(screen.getByText(/Skipped: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Pending: 11/)).toBeInTheDocument()
  })

  it('should show notes input when notes button clicked', () => {
    render(<TestChecklist />)
    
    // Find all icon buttons
    const iconButtons = screen.getAllByTestId('icon-button')
    // Notes buttons are the fourth button in each group of 4
    const notesButtons = iconButtons.filter((_, index) => index % 4 === 3)
    
    // Click the first notes button
    fireEvent.click(notesButtons[0])
    
    // Should show textarea
    const textarea = screen.getByPlaceholderText('Add notes about this test...')
    expect(textarea).toBeInTheDocument()
    
    // Should show save and cancel buttons
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('should save notes when save button clicked', () => {
    render(<TestChecklist />)
    
    // Open notes for first test
    const iconButtons = screen.getAllByTestId('icon-button')
    const notesButtons = iconButtons.filter((_, index) => index % 4 === 3)
    fireEvent.click(notesButtons[0])
    
    // Enter note text
    const textarea = screen.getByPlaceholderText('Add notes about this test...')
    fireEvent.change(textarea, { target: { value: 'Test note content' } })
    
    // Save the note
    fireEvent.click(screen.getByText('Save'))
    
    // Textarea should be hidden
    expect(screen.queryByPlaceholderText('Add notes about this test...')).not.toBeInTheDocument()
    
    // Note should be displayed
    expect(screen.getByText('Notes:')).toBeInTheDocument()
    expect(screen.getByText('Test note content')).toBeInTheDocument()
  })

  it('should cancel notes when cancel button clicked', () => {
    render(<TestChecklist />)
    
    // Open notes for first test
    const iconButtons = screen.getAllByTestId('icon-button')
    const notesButtons = iconButtons.filter((_, index) => index % 4 === 3)
    fireEvent.click(notesButtons[0])
    
    // Enter note text
    const textarea = screen.getByPlaceholderText('Add notes about this test...')
    fireEvent.change(textarea, { target: { value: 'Test note content' } })
    
    // Cancel
    fireEvent.click(screen.getByText('Cancel'))
    
    // Textarea should be hidden
    expect(screen.queryByPlaceholderText('Add notes about this test...')).not.toBeInTheDocument()
    
    // Note should not be displayed
    expect(screen.queryByText('Notes:')).not.toBeInTheDocument()
    expect(screen.queryByText('Test note content')).not.toBeInTheDocument()
  })

  it('should load existing notes when editing', () => {
    render(<TestChecklist />)
    
    // First, add a note
    const iconButtons = screen.getAllByTestId('icon-button')
    const notesButtons = iconButtons.filter((_, index) => index % 4 === 3)
    fireEvent.click(notesButtons[0])
    
    const textarea = screen.getByPlaceholderText('Add notes about this test...')
    fireEvent.change(textarea, { target: { value: 'Existing note' } })
    fireEvent.click(screen.getByText('Save'))
    
    // Now click notes button again to edit
    const updatedIconButtons = screen.getAllByTestId('icon-button')
    const updatedNotesButtons = updatedIconButtons.filter((_, index) => index % 4 === 3)
    fireEvent.click(updatedNotesButtons[0])
    
    // Textarea should have the existing note
    const editTextarea = screen.getByPlaceholderText('Add notes about this test...')
    expect(editTextarea).toHaveValue('Existing note')
  })

  it('should reset all tests when reset button clicked', async () => {
    render(<TestChecklist />)
    
    // First, mark some tests
    const iconButtons = screen.getAllByTestId('icon-button')
    const passButtons = iconButtons.filter((_, index) => index % 4 === 0)
    const failButtons = iconButtons.filter((_, index) => index % 4 === 1)
    const skipButtons = iconButtons.filter((_, index) => index % 4 === 2)
    
    fireEvent.click(passButtons[0])
    fireEvent.click(failButtons[1])
    fireEvent.click(skipButtons[2])
    
    // Verify stats changed
    expect(screen.getByText(/Passed: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Failed: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Skipped: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Pending: 9/)).toBeInTheDocument()
    
    // Click reset
    fireEvent.click(screen.getByText('Reset All Tests'))
    
    // All should be pending again
    expect(screen.getByText(/Passed: 0/)).toBeInTheDocument()
    expect(screen.getByText(/Failed: 0/)).toBeInTheDocument()
    expect(screen.getByText(/Skipped: 0/)).toBeInTheDocument()
    expect(screen.getByText(/Pending: 12/)).toBeInTheDocument()
    
    // Memory usage should be logged
    const { logMemoryUsage } = await import('../../utils/testRunner')
    expect(logMemoryUsage).toHaveBeenCalledWith('Before reset')
    expect(logMemoryUsage).toHaveBeenCalledWith('After reset')
  })

  it('should have correct status colors', () => {
    render(<TestChecklist />)
    
    // Initially all should be pending (blue)
    const firstTestTitle = screen.getByText('[Project Management] Create New Project')
    expect(firstTestTitle).toHaveStyle({ color: 'rgb(59, 130, 246)' })
    
    // Mark as pass
    const iconButtons = screen.getAllByTestId('icon-button')
    const passButtons = iconButtons.filter((_, index) => index % 4 === 0)
    fireEvent.click(passButtons[0])
    expect(firstTestTitle).toHaveStyle({ color: 'rgb(34, 197, 94)' })
    
    // Mark as fail
    const failButtons = iconButtons.filter((_, index) => index % 4 === 1)
    fireEvent.click(failButtons[0])
    expect(firstTestTitle).toHaveStyle({ color: 'rgb(239, 68, 68)' })
    
    // Mark as skip
    const skipButtons = iconButtons.filter((_, index) => index % 4 === 2)
    fireEvent.click(skipButtons[0])
    expect(firstTestTitle).toHaveStyle({ color: 'rgb(107, 114, 128)' })
  })

  it('should handle multiple tests with different statuses', () => {
    render(<TestChecklist />)
    
    const iconButtons = screen.getAllByTestId('icon-button')
    const passButtons = iconButtons.filter((_, index) => index % 4 === 0)
    const failButtons = iconButtons.filter((_, index) => index % 4 === 1)
    const skipButtons = iconButtons.filter((_, index) => index % 4 === 2)
    
    // Mark different tests with different statuses
    fireEvent.click(passButtons[0]) // First test - pass
    fireEvent.click(passButtons[1]) // Second test - pass
    fireEvent.click(failButtons[2]) // Third test - fail
    fireEvent.click(skipButtons[3]) // Fourth test - skip
    
    // Check stats
    expect(screen.getByText(/Passed: 2/)).toBeInTheDocument()
    expect(screen.getByText(/Failed: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Skipped: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Pending: 8/)).toBeInTheDocument()
  })

  it('should clear notes when reset all tests clicked', () => {
    render(<TestChecklist />)
    
    // Add a note to first test
    const iconButtons = screen.getAllByTestId('icon-button')
    const notesButtons = iconButtons.filter((_, index) => index % 4 === 3)
    fireEvent.click(notesButtons[0])
    
    const textarea = screen.getByPlaceholderText('Add notes about this test...')
    fireEvent.change(textarea, { target: { value: 'Test note' } })
    fireEvent.click(screen.getByText('Save'))
    
    // Verify note is shown
    expect(screen.getByText('Notes:')).toBeInTheDocument()
    expect(screen.getByText('Test note')).toBeInTheDocument()
    
    // Reset all tests
    fireEvent.click(screen.getByText('Reset All Tests'))
    
    // Note should be cleared
    expect(screen.queryByText('Notes:')).not.toBeInTheDocument()
    expect(screen.queryByText('Test note')).not.toBeInTheDocument()
  })
})