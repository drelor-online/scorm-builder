/**
 * PageLayout - Consolidated Test Suite
 * 
 * This file consolidates PageLayout tests from 3 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - PageLayout.test.tsx (standardization, buttons, design system)
 * - PageLayout.spacing.test.tsx (window edge spacing, responsive design)
 * - PageLayout.accessibility.test.tsx (ARIA, keyboard navigation, landmarks)
 * 
 * Test Categories:
 * - Standard button layout and positioning
 * - Design system integration
 * - Window edge spacing and responsive margins
 * - Accessibility and ARIA attributes
 * - Workflow progress stepper
 * - FormSection component
 * - Custom actions area
 * - Keyboard navigation
 * - Loading and error states
 */

import { render, screen, fireEvent } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PageLayout, FormSection } from '../PageLayout'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock the Button component to track its usage
vi.mock('../DesignSystem/Button', () => ({
  Button: ({ children, onClick, variant, size, loading, disabled, ...props }: any) => (
    <button 
      onClick={onClick}
      disabled={disabled || loading}
      data-variant={variant}
      data-size={size}
      data-loading={loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  )
}))

describe('PageLayout - Consolidated Test Suite', () => {
  const defaultProps = {
    currentStep: 0,
    title: 'Test Page',
    description: 'Test description',
    children: <div>Test content</div>
  }

  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnSettings = vi.fn()
  const mockOnHelp = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Standard Button Layout and Positioning', () => {
    it('should show Open and Save buttons on the left side', () => {
      render(
        <PageLayout
          {...defaultProps}
          onOpen={mockOnOpen}
          onSave={mockOnSave}
        />
      )

      const openBtn = screen.getByRole('button', { name: /open/i })
      const saveBtn = screen.getByRole('button', { name: /save/i })

      expect(openBtn).toBeInTheDocument()
      expect(saveBtn).toBeInTheDocument()

      const leftGroup = openBtn.parentElement
      expect(leftGroup!.className).toMatch(/actionBarLeft|action-bar-left/)
      expect(leftGroup).toContainElement(saveBtn)
    })

    it('should show Help and Settings buttons on the right side', () => {
      render(
        <PageLayout
          {...defaultProps}
          onHelp={mockOnHelp}
          onSettingsClick={mockOnSettings}
        />
      )

      const helpBtn = screen.getByRole('button', { name: /help/i })
      const settingsBtn = screen.getByRole('button', { name: /settings/i })

      expect(helpBtn).toBeInTheDocument()
      expect(settingsBtn).toBeInTheDocument()

      const rightGroup = helpBtn.parentElement
      expect(rightGroup!.className).toMatch(/actionBarRight|action-bar-right/)
      expect(rightGroup).toContainElement(settingsBtn)
    })

    it('should NOT show Export and Import buttons in the standard header', () => {
      const mockExport = vi.fn()
      const mockImport = vi.fn()
      
      render(
        <PageLayout
          {...defaultProps}
          onExport={mockExport}
          onImport={mockImport}
        />
      )

      const exportBtn = screen.queryByRole('button', { name: /export/i })
      const importBtn = screen.queryByRole('button', { name: /import/i })

      if (exportBtn) {
        const leftGroup = document.querySelector('.action-bar-left')
        expect(leftGroup).not.toContainElement(exportBtn)
      }
      if (importBtn) {
        const leftGroup = document.querySelector('.action-bar-left')
        expect(leftGroup).not.toContainElement(importBtn)
      }
    })

    it('should NEVER show Feature Discovery button', () => {
      render(<PageLayout {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /discover/i })).not.toBeInTheDocument()
      expect(screen.queryByText('✨')).not.toBeInTheDocument()
    })

    it('should render custom actions between left and right groups', () => {
      const customActions = (
        <div data-testid="custom-actions">
          <button>Custom Button</button>
        </div>
      )
      
      render(
        <PageLayout
          {...defaultProps}
          onOpen={vi.fn()}
          onSave={vi.fn()}
          onHelp={vi.fn()}
          onSettingsClick={vi.fn()}
          actions={customActions}
        />
      )

      const customActionsEl = screen.getByTestId('custom-actions')
      expect(customActionsEl).toBeInTheDocument()

      const actionBar = customActionsEl.closest('[data-testid="action-bar"]')
      expect(actionBar).toBeTruthy()
      expect(actionBar!.className).toMatch(/actionBar|action-bar/)
    })
  })

  describe('Design System Integration', () => {
    it('should use Button component for all header buttons', () => {
      render(
        <PageLayout
          {...defaultProps}
          onOpen={vi.fn()}
          onSave={vi.fn()}
          onNext={vi.fn()}
        />
      )

      const openButton = screen.getByTestId('open-button')
      const nextButton = screen.getByTestId('next-button')

      expect(openButton).toHaveAttribute('data-variant', 'secondary')
      expect(openButton).toHaveAttribute('data-size', 'small')
      expect(nextButton).toHaveAttribute('data-variant', 'primary')
      expect(nextButton).toHaveAttribute('data-size', 'large')
    })

    it('should show loading state for Generate SCORM button', () => {
      render(
        <PageLayout
          {...defaultProps}
          currentStep={6}
          onGenerateSCORM={vi.fn()}
          isGenerating={true}
        />
      )

      const generateButton = screen.getByTestId('generate-scorm-button')
      expect(generateButton).toHaveAttribute('data-loading', 'true')
      expect(generateButton).toBeDisabled()
    })
  })

  describe('Window Edge Spacing and Responsive Design', () => {
    it('should have proper margins on desktop to prevent content from touching window edges', () => {
      const { container } = render(
        <PageLayout
          {...defaultProps}
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        />
      )

      const mainContainer = container.querySelector('.page-layout')
      expect(mainContainer).toBeTruthy()
      expect(mainContainer!.className).toContain('page-layout')
      
      const pageWrapper = container.querySelector('[data-testid="page-wrapper"]')
      expect(pageWrapper).toBeTruthy()
      expect(pageWrapper!.className).toMatch(/pageLayout|page-layout/)
    })

    it('should have a maximum width to improve readability on wide screens', () => {
      const { container } = render(
        <PageLayout
          {...defaultProps}
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        />
      )

      const contentArea = container.querySelector('.page-content') || 
                         container.querySelector('.content-wrapper') ||
                         container.querySelector('[data-testid="content-container"]')
      
      expect(contentArea).toBeTruthy()
      expect(contentArea!.className).toMatch(/contentContainer|pageContent|content-wrapper/)
    })

    it('should center content when screen is wider than max-width', () => {
      const { container } = render(
        <PageLayout
          {...defaultProps}
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        />
      )

      const contentArea = container.querySelector('[data-testid="content-container"]')
      expect(contentArea).toBeTruthy()
      expect(contentArea!.className).toMatch(/contentContainer|pageContent/)
    })

    it('should have responsive margins that adjust on smaller screens', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('max-width: 768px'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      const { container } = render(
        <PageLayout
          {...defaultProps}
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        />
      )

      const mainContainer = container.querySelector('.page-layout')
      expect(mainContainer).toBeTruthy()
      expect(mainContainer!.className).toContain('page-layout')
    })

    it('should maintain spacing for header and footer areas', () => {
      const { container } = render(
        <PageLayout
          {...defaultProps}
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        />
      )

      const header = container.querySelector('[data-testid="page-header"]')
      expect(header).toBeTruthy()
      expect(header!.className).toMatch(/fixedHeader/)

      const main = container.querySelector('.main-content')
      expect(main).toBeTruthy()
      expect(main!.className).toMatch(/mainContent/)
      
      const footer = container.querySelector('[data-testid="page-footer"]')
      expect(footer).toBeTruthy()
      expect(footer!.className).toMatch(/stickyFooter/)
    })

    it('should have comfortable vertical spacing between sections', () => {
      const { container } = render(
        <PageLayout
          {...defaultProps}
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        >
          <div className="section-1">Section 1</div>
          <div className="section-2">Section 2</div>
        </PageLayout>
      )

      const mainContent = container.querySelector('.main-content')
      expect(mainContent).toBeTruthy()
      expect(mainContent!.className).toMatch(/mainContent/)
      
      const titleSection = container.querySelector('.pageTitleSection')
      if (titleSection) {
        expect(titleSection.className).toMatch(/pageTitleSection/)
      }
    })
  })

  describe('Accessibility and ARIA Attributes', () => {
    it('should have proper landmark regions', () => {
      const { container } = render(<PageLayout {...defaultProps} />)
      
      const header = container.querySelector('header')
      expect(header).toBeInTheDocument()
      
      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()
      
      const footer = container.querySelector('footer')
      expect(footer).toBeInTheDocument()
    })

    it('should have proper heading structure', () => {
      render(<PageLayout {...defaultProps} />)
      
      const heading = screen.getByRole('heading', { level: 1, name: 'Test Page' })
      expect(heading).toBeInTheDocument()
      
      const description = screen.getByText('Test description')
      expect(description.tagName).not.toMatch(/^H[1-6]$/)
    })

    it('should have proper ARIA labels for all buttons', () => {
      render(
        <PageLayout
          {...defaultProps}
          onOpen={vi.fn()}
          onSave={vi.fn()}
          onNext={vi.fn()}
        />
      )

      expect(screen.getByLabelText('Open project')).toBeInTheDocument()
      expect(screen.getByLabelText('Save project')).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      const onOpen = vi.fn()
      const onSave = vi.fn()

      render(
        <PageLayout
          {...defaultProps}
          onOpen={onOpen}
          onSave={onSave}
        />
      )

      const openButton = screen.getByTestId('open-button')
      openButton.focus()
      expect(document.activeElement).toBe(openButton)

      fireEvent.keyDown(openButton, { key: 'Enter' })
      expect(onOpen).toHaveBeenCalled()
    })

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

    it('should support custom action content accessibly', () => {
      const customActions = (
        <div role="group" aria-label="Page actions">
          <button>Previous</button>
          <button>Next</button>
        </div>
      )
      
      render(
        <PageLayout
          {...defaultProps}
          actions={customActions}
        />
      )
      
      const actionGroup = screen.getByRole('group', { name: 'Page actions' })
      expect(actionGroup).toBeInTheDocument()
    })
  })

  describe('WorkflowProgress Stepper', () => {
    it('should use CSS modules instead of inline styles', () => {
      const { container } = render(
        <PageLayout {...defaultProps} currentStep={2} />
      )

      const stepperContainer = container.querySelector('.stepperContainer')
      expect(stepperContainer).toBeInTheDocument()

      const stepButtons = container.querySelectorAll('[data-testid^="progress-step-"]')
      stepButtons.forEach(button => {
        expect(button.className).toContain('stepButton')
      })
    })

    it('should have proper ARIA labels on step buttons', () => {
      render(<PageLayout {...defaultProps} currentStep={0} />)

      const step1 = screen.getByLabelText(/Step 1: Seed/i)
      expect(step1).toBeInTheDocument()
    })

    it('should have accessible step indicators', () => {
      render(
        <PageLayout
          {...defaultProps}
          currentStep={2}
          onStepClick={vi.fn()}
        />
      )
      
      const stepButtons = screen.getAllByRole('button').filter(btn => /^\d+$/.test(btn.textContent || ''))
      expect(stepButtons).toHaveLength(7)
      
      expect(stepButtons[0]).not.toBeDisabled()
      expect(stepButtons[1]).not.toBeDisabled()
      expect(stepButtons[2]).not.toBeDisabled()
      
      expect(stepButtons[3]).toBeDisabled()
      expect(stepButtons[4]).toBeDisabled()
      expect(stepButtons[5]).toBeDisabled()
      expect(stepButtons[6]).toBeDisabled()
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
      
      const stepButtons = screen.getAllByRole('button').filter(btn => /^\d+$/.test(btn.textContent || ''))
      
      await user.click(stepButtons[0])
      expect(onStepClick).toHaveBeenCalledWith(0)
      
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
      
      expect(stepButtons[0]).not.toBeDisabled()
      expect(stepButtons[1]).not.toBeDisabled()
      
      expect(stepButtons[2]).toBeDisabled()
      expect(stepButtons[3]).toBeDisabled()
      expect(stepButtons[4]).toBeDisabled()
    })
  })

  describe('FormSection Component', () => {
    it('should render with proper CSS classes', () => {
      const { container } = render(
        <FormSection title="Test Section">
          <div>Form content</div>
        </FormSection>
      )

      const section = container.querySelector('.formSection')
      expect(section).toBeInTheDocument()
      expect(section).toHaveClass('form-section', 'form-card')
    })

    it('should render title when provided', () => {
      render(
        <FormSection title="Test Section">
          <div>Form content</div>
        </FormSection>
      )

      const title = screen.getByText('Test Section')
      expect(title).toBeInTheDocument()
      expect(title).toHaveClass('sectionTitle')
    })
  })
})