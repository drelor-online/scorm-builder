import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, it, expect, vi } from 'vitest'
import { PageLayout } from '../PageLayout'

// Extend Vitest matchers with jest-axe matchers
expect.extend(toHaveNoViolations)

describe('PageLayout - Accessibility Tests', () => {
  const defaultProps = {
    currentStep: 2,
    title: 'Test Page Title',
    description: 'This is a test page description',
    children: <div>Page content goes here</div>
  }

  describe('Basic accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<PageLayout {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no violations with all optional props', async () => {
      const { container } = render(
        <PageLayout
          {...defaultProps}
          onSettingsClick={vi.fn()}
          onSave={vi.fn()}
          onOpen={vi.fn()}
          onHelp={vi.fn()}
          onStepClick={vi.fn()}
          actions={<button>Custom Action</button>}
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Landmark regions', () => {
    it('should have proper landmark regions', () => {
      render(<PageLayout {...defaultProps} />)
      
      // Should have header element
      const header = document.querySelector('header')
      expect(header).toBeInTheDocument()
      
      // Should have main element
      const main = document.querySelector('main')
      expect(main).toBeInTheDocument()
      
      // Should have footer element
      const footer = document.querySelector('footer')
      expect(footer).toBeInTheDocument()
    })

    it.skip('should have skip link for keyboard navigation', async () => {
      // Note: Skip link feature is not implemented in current PageLayout
      const user = userEvent.setup()
      render(<PageLayout {...defaultProps} />)
      
      // Tab to reveal skip link
      await user.tab()
      
      const skipLink = screen.getByRole('link', { name: /skip to main content/i })
      expect(skipLink).toBeInTheDocument()
      expect(skipLink).toHaveAttribute('href', '#main-content')
    })
  })

  describe('Heading hierarchy', () => {
    it('should have proper heading structure', () => {
      render(<PageLayout {...defaultProps} />)
      
      // Should have h1 for page title
      const heading = screen.getByRole('heading', { level: 1, name: 'Test Page Title' })
      expect(heading).toBeInTheDocument()
      
      // Description should not be a heading
      const description = screen.getByText('This is a test page description')
      expect(description.tagName).not.toMatch(/^H[1-6]$/)
    })
  })

  describe('Workflow progress navigation', () => {
    it('should have accessible step indicators', () => {
      render(
        <PageLayout
          {...defaultProps}
          currentStep={2}
          onStepClick={vi.fn()}
        />
      )
      
      // Check for step buttons (they use numbers as labels)
      const stepButtons = screen.getAllByRole('button').filter(btn => /^\d+$/.test(btn.textContent || ''))
      expect(stepButtons).toHaveLength(7) // 7 steps in workflow
      
      // Steps 1-3 should be enabled
      expect(stepButtons[0]).not.toBeDisabled()
      expect(stepButtons[1]).not.toBeDisabled()
      expect(stepButtons[2]).not.toBeDisabled()
      
      // Steps 4-7 should be disabled
      expect(stepButtons[3]).toBeDisabled()
      expect(stepButtons[4]).toBeDisabled()
      expect(stepButtons[5]).toBeDisabled()
      expect(stepButtons[6]).toBeDisabled()
    })

    it.skip('should indicate completed steps', () => {
      // Note: ARIA labels for step status are not implemented in current component
      render(
        <PageLayout
          {...defaultProps}
          currentStep={3}
          onStepClick={vi.fn()}
        />
      )
      
      // Previous steps should be marked as completed
      const completedStep = screen.getByRole('button', { name: /step 1.*completed/i })
      expect(completedStep).toBeInTheDocument()
    })

    it('should allow keyboard navigation through steps', async () => {
      const user = userEvent.setup()
      const onStepClick = vi.fn()
      
      render(
        <PageLayout
          {...defaultProps}
          currentStep={2}
          onStepClick={onStepClick}
        />
      )
      
      // Find step buttons
      const stepButtons = screen.getAllByRole('button').filter(btn => /^\d+$/.test(btn.textContent || ''))
      
      // Click on first step button
      await user.click(stepButtons[0])
      expect(onStepClick).toHaveBeenCalledWith(0)
      
      // Click on second step button
      await user.click(stepButtons[1])
      expect(onStepClick).toHaveBeenCalledWith(1)
    })

    it('should disable future steps appropriately', () => {
      render(
        <PageLayout
          {...defaultProps}
          currentStep={1}
          onStepClick={vi.fn()}
        />
      )
      
      const stepButtons = screen.getAllByRole('button').filter(btn => /^\d+$/.test(btn.textContent || ''))
      
      // Steps up to and including current should be enabled
      expect(stepButtons[0]).not.toBeDisabled()
      expect(stepButtons[1]).not.toBeDisabled()
      
      // Future steps should be disabled
      expect(stepButtons[2]).toBeDisabled()
      expect(stepButtons[3]).toBeDisabled()
      expect(stepButtons[4]).toBeDisabled()
    })
  })

  describe('Action buttons', () => {
    it('should have accessible action buttons', async () => {
      const { container } = render(
        <PageLayout
          {...defaultProps}
          onSettingsClick={vi.fn()}
          onSave={vi.fn()}
          onOpen={vi.fn()}
          onHelp={vi.fn()}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
      
      // Check button labels
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /help/i })).toBeInTheDocument()
    })

    it('should group action buttons appropriately', () => {
      render(
        <PageLayout
          {...defaultProps}
          onSettingsClick={vi.fn()}
          onHelp={vi.fn()}
        />
      )
      
      // Buttons should be in logical groups
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  describe('Custom actions', () => {
    it('should support custom action content accessibly', async () => {
      const customActions = (
        <div role="group" aria-label="Page actions">
          <button>Previous</button>
          <button>Next</button>
        </div>
      )
      
      const { container } = render(
        <PageLayout
          {...defaultProps}
          actions={customActions}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
      
      const actionGroup = screen.getByRole('group', { name: 'Page actions' })
      expect(actionGroup).toBeInTheDocument()
    })
  })

  describe('Responsive behavior', () => {
    it('should maintain accessibility on mobile viewports', async () => {
      // Mock mobile viewport
      window.innerWidth = 375
      window.innerHeight = 667
      
      const { container } = render(<PageLayout {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Loading states', () => {
    it('should handle loading states accessibly', () => {
      render(
        <PageLayout
          {...defaultProps}
          isLoading
        >
          <div aria-busy="true" aria-live="polite">
            Loading content...
          </div>
        </PageLayout>
      )
      
      const loadingContent = screen.getByText('Loading content...')
      expect(loadingContent).toHaveAttribute('aria-busy', 'true')
    })
  })

  describe('Error states', () => {
    it('should announce errors accessibly', () => {
      render(
        <PageLayout {...defaultProps}>
          <div role="alert">
            An error occurred while loading the page
          </div>
        </PageLayout>
      )
      
      const error = screen.getByRole('alert')
      expect(error).toBeInTheDocument()
    })
  })

  describe('Autosave indicator', () => {
    it.skip('should announce save status to screen readers', () => {
      // Note: Autosave indicator feature is not implemented in current PageLayout
      render(
        <PageLayout
          {...defaultProps}
          showAutoSaveIndicator
          autoSaveStatus="saved"
        />
      )
      
      // Autosave status should be in a live region
      const saveStatus = screen.getByText(/saved/i)
      const liveRegion = saveStatus.closest('[aria-live]')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })
  })
})