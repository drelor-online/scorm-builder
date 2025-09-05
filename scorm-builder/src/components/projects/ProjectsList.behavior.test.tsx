/**
 * Behavior test for ProjectsList component
 * 
 * Tests the complete user experience of the virtualized project list:
 * - Display projects in table-style rows (56px height)
 * - Search functionality with debouncing (150ms)
 * - Sort by Title, Last Accessed, Folder Path
 * - Keyboard navigation (arrows, Enter, Del, F2, /)
 * - Actions: Open (double-click + button), Export, Delete, Rename
 * - Performance: 12+ projects visible on 1366x768 screen
 * - Accessibility: focus states, aria-labels, screen reader support
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatDistanceToNow } from 'date-fns'

// Mock react-virtuoso to render all items directly
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ totalCount, itemContent, ...props }: any) => {
    return (
      <div data-testid="virtualized-list" {...props}>
        {Array.from({ length: totalCount }, (_, index) => (
          <div key={index}>
            {itemContent(index)}
          </div>
        ))}
      </div>
    )
  }
}))

// Mock components that will be implemented
import { ProjectsList } from './ProjectsList'

// Mock project data matching the existing interface from ProjectDashboard
const mockProjects = [
  {
    id: 'project-1',
    name: 'Introduction to React',
    path: '/Users/john/projects/react-intro',
    created: '2024-01-15T10:00:00Z',
    lastAccessed: '2024-01-20T14:30:00Z',
    last_modified: '2024-01-19T16:45:00Z'
  },
  {
    id: 'project-2', 
    name: 'Advanced TypeScript Course',
    path: '/Users/john/projects/typescript-advanced',
    created: '2024-01-10T09:00:00Z',
    lastAccessed: '2024-01-18T11:15:00Z',
    last_modified: '2024-01-17T13:20:00Z'
  },
  {
    id: 'project-3',
    name: 'JavaScript Fundamentals',
    path: '/Users/jane/development/js-fundamentals', 
    created: '2024-01-05T08:00:00Z',
    lastAccessed: '2024-01-25T09:45:00Z',
    last_modified: '2024-01-24T17:30:00Z'
  },
  {
    id: 'project-4',
    name: 'Python for Beginners',
    path: '/Users/bob/courses/python-basics',
    created: '2024-01-01T07:00:00Z', 
    lastAccessed: '2024-01-16T10:20:00Z',
    last_modified: '2024-01-15T14:10:00Z'
  }
]

// Mock handlers that match ProjectDashboard interface
const mockHandlers = {
  onOpen: vi.fn(),
  onExport: vi.fn(), 
  onDelete: vi.fn(),
  onRename: vi.fn(),
  onOpenFolder: vi.fn()
}

describe('ProjectsList - Behavior Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Display & Layout', () => {
    it('should render projects in table-style rows with correct structure', async () => {
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      // Verify all projects are displayed
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
      expect(screen.getByText('Advanced TypeScript Course')).toBeInTheDocument()
      expect(screen.getByText('JavaScript Fundamentals')).toBeInTheDocument()
      expect(screen.getByText('Python for Beginners')).toBeInTheDocument()

      // Verify row structure: each project should have folder icon, title, path, last accessed, actions
      const firstRow = screen.getByRole('row', { name: /Introduction to React/ })
      
      // Should have folder icon
      expect(firstRow.querySelector('[data-testid="folder-icon"]')).toBeInTheDocument()
      
      // Should have title (semibold)  
      expect(screen.getByText('Introduction to React')).toHaveClass('font-semibold')
      
      // Should have path with truncation
      expect(screen.getByText('/Users/john/projects/react-intro')).toBeInTheDocument()
      
      // Should have relative time display
      const relativeTime = formatDistanceToNow(new Date('2024-01-20T14:30:00Z'), { addSuffix: true })
      const timeElements = screen.getAllByText(relativeTime)
      expect(timeElements.length).toBeGreaterThan(0)
      
      // Should have actions column with Open button (hidden initially)
      expect(firstRow.querySelector('[data-testid="project-actions"]')).toBeInTheDocument()
    })

    it('should show 12+ projects on 1366x768 screen (density requirement)', async () => {
      // Create array of 15 projects to test density
      const manyProjects = Array.from({ length: 15 }, (_, i) => ({
        id: `project-${i + 1}`,
        name: `Test Project ${i + 1}`,
        path: `/path/to/project-${i + 1}`,
        created: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-02T00:00:00Z',
        last_modified: '2024-01-01T12:00:00Z'
      }))

      // Mock viewport size to 1366x768
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1366 })
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 })

      render(<ProjectsList projects={manyProjects} {...mockHandlers} />)

      // With 56px row height + header, should show 12+ projects
      // This will be verified by the virtualization implementation
      const visibleProjects = screen.getAllByRole('row').length - 1 // Subtract header row
      expect(visibleProjects).toBeGreaterThanOrEqual(12)
    })

    it('should show pin star placeholder when pinning is supported', async () => {
      render(<ProjectsList projects={mockProjects} {...mockHandlers} supportPinning={true} />)

      // Should show pin star icons (initially empty/outline)
      const pinIcons = screen.getAllByTestId('pin-star')
      expect(pinIcons).toHaveLength(mockProjects.length)
    })
  })

  describe('Search Functionality', () => {
    it('should filter projects by title (fuzzy search)', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const searchInput = screen.getByPlaceholderText(/search projects/i)
      
      // Search for partial title match
      await user.type(searchInput, 'react')

      // Wait for debounce (150ms)
      await waitFor(() => {
        expect(screen.getByText('Introduction to React')).toBeInTheDocument()
        expect(screen.queryByText('Python for Beginners')).not.toBeInTheDocument()
      }, { timeout: 300 })
    })

    it('should filter projects by path (fuzzy search)', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const searchInput = screen.getByPlaceholderText(/search projects/i)
      
      // Search for path component
      await user.type(searchInput, 'jane')

      await waitFor(() => {
        expect(screen.getByText('JavaScript Fundamentals')).toBeInTheDocument()
        expect(screen.queryByText('Introduction to React')).not.toBeInTheDocument()
      }, { timeout: 300 })
    })

    it('should debounce search input (150ms)', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const searchInput = screen.getByPlaceholderText(/search projects/i)
      
      // Type quickly without waiting
      await user.type(searchInput, 'type', { delay: 50 })

      // Should still show all projects immediately after typing
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
      expect(screen.getByText('Python for Beginners')).toBeInTheDocument()

      // After debounce period, should filter
      await waitFor(() => {
        expect(screen.getByText('Advanced TypeScript Course')).toBeInTheDocument()
        expect(screen.queryByText('Python for Beginners')).not.toBeInTheDocument()
      }, { timeout: 300 })
    })

    it('should clear search with Escape key', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const searchInput = screen.getByPlaceholderText(/search projects/i)
      
      await user.type(searchInput, 'react')
      await waitFor(() => {
        expect(screen.queryByText('Python for Beginners')).not.toBeInTheDocument()
      }, { timeout: 300 })

      // Press Escape to clear
      await user.keyboard('{Escape}')
      
      expect(searchInput).toHaveValue('')
      expect(screen.getByText('Python for Beginners')).toBeInTheDocument()
    })
  })

  describe('Sort Functionality', () => {
    it('should sort by title (alphabetical)', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      // Click title column header to sort
      await user.click(screen.getByText('Title'))

      // Should be sorted alphabetically
      const rows = screen.getAllByRole('row')
      const projectRows = rows.slice(1) // Skip header row
      
      expect(projectRows[0]).toHaveTextContent('Advanced TypeScript Course')
      expect(projectRows[1]).toHaveTextContent('Introduction to React')
      expect(projectRows[2]).toHaveTextContent('JavaScript Fundamentals')
      expect(projectRows[3]).toHaveTextContent('Python for Beginners')
    })

    it('should sort by last accessed (most recent first)', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      await user.click(screen.getByText('Last Accessed'))

      const rows = screen.getAllByRole('row')
      const projectRows = rows.slice(1)
      
      // Most recently accessed first (project-3: Jan 25)
      expect(projectRows[0]).toHaveTextContent('JavaScript Fundamentals')
      expect(projectRows[1]).toHaveTextContent('Introduction to React')
      expect(projectRows[2]).toHaveTextContent('Advanced TypeScript Course')
      expect(projectRows[3]).toHaveTextContent('Python for Beginners')
    })

    it('should toggle sort direction on repeated clicks', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      // First click - ascending
      await user.click(screen.getByText('Title'))
      let rows = screen.getAllByRole('row').slice(1)
      expect(rows[0]).toHaveTextContent('Advanced TypeScript Course')

      // Second click - descending  
      await user.click(screen.getByText('Title'))
      rows = screen.getAllByRole('row').slice(1)
      expect(rows[0]).toHaveTextContent('Python for Beginners')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should navigate rows with arrow keys', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1] // Skip header
      
      // Focus first project row
      await user.click(firstRow)
      
      // Arrow down should move to next row
      await user.keyboard('{ArrowDown}')
      
      const secondRow = screen.getAllByRole('row')[2]
      expect(secondRow).toHaveFocus()
    })

    it('should open project with Enter key', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1]
      await user.click(firstRow)
      
      await user.keyboard('{Enter}')
      
      expect(mockHandlers.onOpen).toHaveBeenCalledWith('project-1', '/Users/john/projects/react-intro')
    })

    it('should trigger delete with Delete key', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1]
      await user.click(firstRow)
      
      await user.keyboard('{Delete}')
      
      expect(mockHandlers.onDelete).toHaveBeenCalledWith('project-1')
    })

    it('should trigger rename with F2 key', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1]
      await user.click(firstRow)
      
      await user.keyboard('{F2}')
      
      expect(mockHandlers.onRename).toHaveBeenCalledWith('project-1', 'Introduction to React')
    })

    it('should focus search with / key', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      await user.keyboard('/')
      
      const searchInput = screen.getByPlaceholderText(/search projects/i)
      expect(searchInput).toHaveFocus()
    })
  })

  describe('Mouse Interactions', () => {
    it('should open project on double-click', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1]
      
      await user.dblClick(firstRow)
      
      expect(mockHandlers.onOpen).toHaveBeenCalledWith('project-1', '/Users/john/projects/react-intro')
    })

    it('should show Open button on row hover', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1]
      
      // Open button should be hidden initially
      const openButton = firstRow.querySelector('[data-testid="open-button"]')
      expect(openButton).toHaveClass('opacity-0')
      
      await user.hover(firstRow)
      
      // Open button should become visible
      expect(openButton).toHaveClass('opacity-100')
    })

    it('should show actions menu on overflow button click', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1]
      const overflowButton = firstRow.querySelector('[data-testid="overflow-menu"]')
      
      await user.click(overflowButton!)
      
      // Should show dropdown menu with all actions
      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
      expect(screen.getByText('Rename')).toBeInTheDocument() 
      expect(screen.getByText('Delete')).toBeInTheDocument()
      expect(screen.getByText('Open Folder')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      // Table should have proper role
      expect(screen.getByRole('table')).toBeInTheDocument()
      
      // Header should be marked as such
      expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Last Accessed' })).toBeInTheDocument()
      
      // Rows should have proper labels
      const firstRow = screen.getByRole('row', { name: /Introduction to React/ })
      expect(firstRow).toHaveAccessibleName()
    })

    it('should have visible focus rings', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1]
      
      await user.tab() // Tab to first focusable element
      await user.keyboard('{ArrowDown}') // Navigate to row
      
      expect(firstRow).toHaveClass('focus:ring-2')
    })

    it('should support screen readers with proper announcements', async () => {
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const firstRow = screen.getAllByRole('row')[1]
      
      // Should announce project title and last accessed info
      expect(firstRow).toHaveAccessibleDescription()
    })
  })

  describe('Performance', () => {
    it('should virtualize large lists (100+ projects)', async () => {
      const manyProjects = Array.from({ length: 150 }, (_, i) => ({
        id: `project-${i + 1}`,
        name: `Project ${i + 1}`,
        path: `/path/to/project-${i + 1}`,
        created: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-02T00:00:00Z',
        last_modified: '2024-01-01T12:00:00Z'
      }))

      render(<ProjectsList projects={manyProjects} {...mockHandlers} />)

      // Should not render all 150 rows in DOM at once
      const renderedRows = screen.getAllByRole('row')
      expect(renderedRows.length).toBeLessThan(50) // Only visible + buffer rows
    })

    it('should handle search performance (≤200ms on 500 projects)', async () => {
      const manyProjects = Array.from({ length: 500 }, (_, i) => ({
        id: `project-${i + 1}`,
        name: `Project ${i + 1}`,
        path: `/path/to/project-${i + 1}`,
        created: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-02T00:00:00Z',
        last_modified: '2024-01-01T12:00:00Z'
      }))

      const user = userEvent.setup()
      render(<ProjectsList projects={manyProjects} {...mockHandlers} />)

      const searchInput = screen.getByPlaceholderText(/search projects/i)
      
      const startTime = performance.now()
      await user.type(searchInput, 'Project 1')
      
      await waitFor(() => {
        const endTime = performance.now()
        const searchTime = endTime - startTime
        expect(searchTime).toBeLessThan(200) // 200ms requirement
      })
    })
  })

  describe('Empty States', () => {
    it('should show "No projects found" when search returns no results', async () => {
      const user = userEvent.setup()
      render(<ProjectsList projects={mockProjects} {...mockHandlers} />)

      const searchInput = screen.getByPlaceholderText(/search projects/i)
      await user.type(searchInput, 'nonexistent project')

      await waitFor(() => {
        expect(screen.getByText('No projects found')).toBeInTheDocument()
      })
    })

    it('should show "No projects yet" when no projects exist', async () => {
      render(<ProjectsList projects={[]} {...mockHandlers} />)

      expect(screen.getByText('No projects yet')).toBeInTheDocument()
      // Should show CTA to import/create
      expect(screen.getByText(/import or create/i)).toBeInTheDocument()
    })
  })
})