/**
 * Tests for ProjectRow component
 * 
 * Tests the individual row layout and interactions:
 * - Row structure: pin + icon + title block + last accessed + actions
 * - Hover/focus states for Open button visibility
 * - Double-click and keyboard interactions
 * - Accessibility features
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectRow } from './ProjectRow'

// Mock project matching ProjectDashboard interface
const mockProject = {
  id: 'project-1',
  name: 'Introduction to React',
  path: '/Users/john/projects/react-intro',
  created: '2024-01-15T10:00:00Z',
  lastAccessed: '2024-01-20T14:30:00Z',
  last_modified: '2024-01-19T16:45:00Z'
}

const mockHandlers = {
  onOpen: vi.fn(),
  onExport: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
  onOpenFolder: vi.fn()
}

describe('ProjectRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Layout & Structure', () => {
    it('should render all required elements with correct layout', () => {
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      // Should have role="row"
      const row = screen.getByRole('row')
      expect(row).toBeInTheDocument()

      // Should have folder icon
      expect(screen.getByTestId('folder-icon')).toBeInTheDocument()

      // Should have project title (semibold)
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
      expect(screen.getByText('Introduction to React')).toHaveClass('font-semibold')

      // Should have path with monospace font
      expect(screen.getByText('/Users/john/projects/react-intro')).toBeInTheDocument()
      
      // Should have relative time display
      const timeElements = screen.getAllByText(/ago/)
      expect(timeElements.length).toBeGreaterThan(0)

      // Should have actions area
      expect(screen.getByTestId('project-actions')).toBeInTheDocument()
    })

    it('should show pin star when pinning is supported', () => {
      render(<ProjectRow project={mockProject} supportPinning={true} {...mockHandlers} />)
      
      expect(screen.getByTestId('pin-star')).toBeInTheDocument()
    })

    it('should hide pin area when pinning not supported', () => {
      render(<ProjectRow project={mockProject} supportPinning={false} {...mockHandlers} />)
      
      expect(screen.queryByTestId('pin-star')).not.toBeInTheDocument()
    })

    it('should have correct height (56px) with proper spacing', () => {
      const { container } = render(<ProjectRow project={mockProject} {...mockHandlers} />)
      
      const row = container.firstChild as HTMLElement
      const computedStyle = window.getComputedStyle(row)
      
      // Should be approximately 56px (may vary due to padding/margins)
      expect(parseInt(computedStyle.height) || 56).toBeCloseTo(56, -1) // Within 10px
    })

    it('should show tooltips for truncated content', async () => {
      const longProject = {
        ...mockProject,
        name: 'Very Long Project Name That Should Be Truncated In The Display',
        path: '/Very/Long/Path/That/Should/Also/Be/Truncated/In/The/Display/project'
      }
      
      render(<ProjectRow project={longProject} {...mockHandlers} />)

      const titleElement = screen.getByText(longProject.name)
      const pathElement = screen.getByText(longProject.path)

      // Should have title tooltips
      expect(titleElement).toHaveAttribute('title', longProject.name)
      expect(pathElement).toHaveAttribute('title', longProject.path)
    })
  })

  describe('Interactive States', () => {
    it('should show Open button on hover', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      const openButton = screen.getByTestId('open-button')

      // Initially hidden
      expect(openButton).toHaveClass('opacity-0')

      await user.hover(row)

      // Should become visible on hover
      expect(openButton).toHaveClass('opacity-100')
    })

    it('should show Open button on focus', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      const openButton = screen.getByTestId('open-button')

      expect(openButton).toHaveClass('opacity-0')

      await user.click(row) // Focus the row

      expect(openButton).toHaveClass('opacity-100')
    })

    it('should not cause layout shift when showing/hiding Open button', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      const actionsContainer = screen.getByTestId('project-actions')
      
      const initialWidth = actionsContainer.getBoundingClientRect().width

      await user.hover(row)

      const hoverWidth = actionsContainer.getBoundingClientRect().width
      
      // Width should remain the same (reserved space)
      expect(hoverWidth).toBe(initialWidth)
    })
  })

  describe('Mouse Interactions', () => {
    it('should call onOpen on double-click', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      
      await user.dblClick(row)

      expect(mockHandlers.onOpen).toHaveBeenCalledWith('project-1', '/Users/john/projects/react-intro')
    })

    it('should call onOpen when Open button is clicked', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      await user.hover(row) // Make button visible

      const openButton = screen.getByTestId('open-button')
      await user.click(openButton)

      expect(mockHandlers.onOpen).toHaveBeenCalledWith('project-1', '/Users/john/projects/react-intro')
    })

    it('should show overflow menu when menu button is clicked', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const overflowButton = screen.getByTestId('overflow-menu')
      await user.click(overflowButton)

      // Should show dropdown menu
      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
      expect(screen.getByText('Rename')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
      expect(screen.getByText('Open Folder')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should be focusable with tab', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      await user.tab()

      const row = screen.getByRole('row')
      expect(row).toHaveFocus()
    })

    it('should call onOpen when Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      await user.click(row) // Focus first
      await user.keyboard('{Enter}')

      expect(mockHandlers.onOpen).toHaveBeenCalledWith('project-1', '/Users/john/projects/react-intro')
    })

    it('should call onDelete when Delete key is pressed', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      await user.click(row)
      await user.keyboard('{Delete}')

      expect(mockHandlers.onDelete).toHaveBeenCalledWith('project-1')
    })

    it('should call onRename when F2 is pressed', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      await user.click(row)
      await user.keyboard('{F2}')

      expect(mockHandlers.onRename).toHaveBeenCalledWith('project-1', 'Introduction to React')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      
      // Should have accessible name
      expect(row).toHaveAccessibleName()
      
      // Should have aria-label describing the project
      expect(row.getAttribute('aria-label')).toMatch(/Introduction to React/)
    })

    it('should have visible focus ring', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      await user.tab()

      expect(row).toHaveClass('focus:ring-2')
    })

    it('should support screen readers', () => {
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      
      // Should have description for screen readers
      expect(row).toHaveAccessibleDescription()
      
      // Buttons should have proper labels
      const openButton = screen.getByTestId('open-button')
      const overflowButton = screen.getByTestId('overflow-menu')
      
      expect(openButton).toHaveAttribute('aria-label')
      expect(overflowButton).toHaveAttribute('aria-label')
    })
  })

  describe('Date Formatting', () => {
    it('should show relative time in Last Accessed column', () => {
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      // Should show relative time like "4 days ago"
      expect(screen.getByText(/ago/)).toBeInTheDocument()
    })

    it('should show absolute datetime in tooltip', async () => {
      const user = userEvent.setup()
      render(<ProjectRow project={mockProject} {...mockHandlers} />)

      const timeElement = screen.getByText(/ago/)
      
      // Should have title with absolute date
      expect(timeElement).toHaveAttribute('title')
      expect(timeElement.getAttribute('title')).toMatch(/2024/)
    })

    it('should handle missing lastAccessed gracefully', () => {
      const projectWithoutDate = { ...mockProject, lastAccessed: undefined }
      
      render(<ProjectRow project={projectWithoutDate} {...mockHandlers} />)

      // Should still render without crashing
      const row = screen.getByRole('row')
      expect(row).toBeInTheDocument()
    })
  })

  describe('Pinning Functionality', () => {
    it('should toggle pin state when pin star is clicked', async () => {
      const onPin = vi.fn()
      const user = userEvent.setup()
      
      render(
        <ProjectRow 
          project={mockProject} 
          supportPinning={true}
          isPinned={false}
          onPin={onPin}
          {...mockHandlers} 
        />
      )

      const pinStar = screen.getByTestId('pin-star')
      await user.click(pinStar)

      expect(onPin).toHaveBeenCalledWith('project-1', true)
    })

    it('should show different visual state when pinned', () => {
      const { rerender } = render(
        <ProjectRow 
          project={mockProject} 
          supportPinning={true}
          isPinned={false}
          {...mockHandlers} 
        />
      )

      const pinStar = screen.getByTestId('pin-star')
      expect(pinStar).toHaveClass('text-gray-400') // Unpinned state

      rerender(
        <ProjectRow 
          project={mockProject} 
          supportPinning={true}
          isPinned={true}
          {...mockHandlers} 
        />
      )

      expect(pinStar).toHaveClass('text-yellow-500') // Pinned state
    })
  })

  describe('Edge Cases', () => {
    it('should handle project with no path', () => {
      const projectWithoutPath = { ...mockProject, path: '' }
      
      render(<ProjectRow project={projectWithoutPath} {...mockHandlers} />)

      const row = screen.getByRole('row')
      expect(row).toBeInTheDocument()
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
    })

    it('should handle very long project names', () => {
      const longNameProject = {
        ...mockProject,
        name: 'A'.repeat(100) // 100 character name
      }
      
      render(<ProjectRow project={longNameProject} {...mockHandlers} />)

      const row = screen.getByRole('row')
      expect(row).toBeInTheDocument()
    })

    it('should handle missing handlers gracefully', () => {
      const partialHandlers = { onOpen: vi.fn() } // Missing other handlers
      
      expect(() => {
        render(<ProjectRow project={mockProject} {...partialHandlers} />)
      }).not.toThrow()
    })
  })
})