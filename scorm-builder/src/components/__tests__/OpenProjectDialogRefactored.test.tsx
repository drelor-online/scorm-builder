import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenProjectDialog } from '../OpenProjectDialogRefactored'
import type { SavedProject } from '../../types/project'

describe('OpenProjectDialog with Design System', () => {
  const mockOnOpen = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnClose = vi.fn()
  const mockOnNewProject = vi.fn()

  const mockProjects: SavedProject[] = [
    {
      id: '1',
      title: 'Test Project 1',
      template: 'None' as const,
      lastModified: '2024-01-01T12:00:00Z',
      preview: 'Preview text',
      size: 1024,
      currentStep: 1
    },
    {
      id: '2',
      title: 'Test Project 2',
      template: 'Technical' as const,
      lastModified: '2024-01-02T12:00:00Z',
      preview: 'Another preview',
      size: 2048,
      currentStep: 2
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses design system components for layout', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    // Check for Card components for project items
    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('uses Modal component for dialog', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    // Check for modal overlay
    const modal = document.querySelector('.modal-overlay')
    expect(modal).toBeInTheDocument()
  })

  it('uses Button components with consistent styling', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    // Check Open buttons
    const openButtons = screen.getAllByRole('button', { name: /open/i })
    openButtons.forEach(button => {
      expect(button).toHaveClass('btn')
    })

    // Check Delete buttons
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    deleteButtons.forEach(button => {
      expect(button).toHaveClass('btn', 'btn-danger')
    })

    // Check New Project button
    const newProjectButton = screen.getByRole('button', { name: /new project/i })
    expect(newProjectButton).toHaveClass('btn')

    // Check Cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    expect(cancelButton).toHaveClass('btn')
  })

  it('uses Input component for search', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search projects/i)
    expect(searchInput).toHaveClass('input')
  })

  it('displays project cards with proper formatting', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    // Check project titles
    expect(screen.getByText('Test Project 1')).toBeInTheDocument()
    expect(screen.getByText('Test Project 2')).toBeInTheDocument()

    // Check templates
    expect(screen.getByText('None')).toBeInTheDocument()
    expect(screen.getByText('Technical')).toBeInTheDocument()
  })

  it('filters projects based on search input', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search projects/i)
    
    // Search for project 1
    fireEvent.change(searchInput, { target: { value: 'Test Project 1' } })
    
    expect(screen.getByText('Test Project 1')).toBeInTheDocument()
    expect(screen.queryByText('Test Project 2')).not.toBeInTheDocument()
  })

  it('shows empty state when no projects', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={[]}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    expect(screen.getByText(/no saved projects/i)).toBeInTheDocument()
    expect(screen.getByText(/create your first project/i)).toBeInTheDocument()
  })

  it('calls onOpen when Open button is clicked', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const openButtons = screen.getAllByRole('button', { name: /open/i })
    fireEvent.click(openButtons[0])

    expect(mockOnOpen).toHaveBeenCalledWith('1')
  })

  it('should show confirmation dialog when Delete button is clicked', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])

    // Should show confirmation dialog
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument()
    expect(screen.getByText(/are you sure you want to delete "Test Project 1"/i)).toBeInTheDocument()
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()

    // Should NOT delete immediately
    expect(mockOnDelete).not.toHaveBeenCalled()
  })

  it('should cancel deletion when cancel is clicked', async () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])

    // Click cancel in confirmation dialog (last one, as it's rendered after the main cancel button)
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButtons[cancelButtons.length - 1])

    // Confirmation should be gone
    expect(screen.queryByText(/are you sure you want to delete/i)).not.toBeInTheDocument()
    
    // Should NOT delete
    expect(mockOnDelete).not.toHaveBeenCalled()
  })

  it('should delete project when confirmed', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm delete/i })
    fireEvent.click(confirmButton)

    // Should call onDelete
    expect(mockOnDelete).toHaveBeenCalledWith('1', 'Test Project 1')
  })

  it('calls onClose when Cancel button is clicked', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onNewProject when New Project button is clicked', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const newProjectButton = screen.getByRole('button', { name: /new project/i })
    fireEvent.click(newProjectButton)

    expect(mockOnNewProject).toHaveBeenCalledTimes(1)
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <OpenProjectDialog
        isOpen={false}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('formats dates correctly', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    // Should format date
    expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument()
  })

  it('formats file sizes correctly', () => {
    render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    // Should format sizes
    expect(screen.getByText(/1.0 KB/)).toBeInTheDocument()
    expect(screen.getByText(/2.0 KB/)).toBeInTheDocument()
  })

  it('uses Grid layout for project cards', () => {
    const { container } = render(
      <OpenProjectDialog
        isOpen={true}
        projects={mockProjects}
        onOpen={mockOnOpen}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        onNewProject={mockOnNewProject}
      />
    )

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
  })
})