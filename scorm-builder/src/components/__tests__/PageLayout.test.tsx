import { render, screen, fireEvent } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PageLayout, FormSection } from '../PageLayout'
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

describe('PageLayout Top Bar Standardization', () => {
  const defaultProps = {
    currentStep: 0,
    title: 'Test Page',
    description: 'Test description',
    children: <div>Test content</div>
  }

  describe('Standard Button Layout', () => {
    it('should show Open and Save buttons on the left side', () => {
      const mockOpen = vi.fn()
      const mockSave = vi.fn()
      
      render(
        <PageLayout
          {...defaultProps}
          onOpen={mockOpen}
          onSave={mockSave}
        />
      )

      const openBtn = screen.getByRole('button', { name: /open/i })
      const saveBtn = screen.getByRole('button', { name: /save/i })

      expect(openBtn).toBeInTheDocument()
      expect(saveBtn).toBeInTheDocument()

      // They should be in the left button group
      const leftGroup = openBtn.parentElement
      expect(leftGroup!.className).toMatch(/actionBarLeft|action-bar-left/)
      expect(leftGroup).toContainElement(saveBtn)
    })

    it('should show Help and Settings buttons on the right side', () => {
      const mockHelp = vi.fn()
      const mockSettings = vi.fn()
      
      render(
        <PageLayout
          {...defaultProps}
          onHelp={mockHelp}
          onSettingsClick={mockSettings}
        />
      )

      const helpBtn = screen.getByRole('button', { name: /help/i })
      const settingsBtn = screen.getByRole('button', { name: /settings/i })

      expect(helpBtn).toBeInTheDocument()
      expect(settingsBtn).toBeInTheDocument()

      // They should be in the right button group
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

      // Export and Import should not be in the header anymore
      const exportBtn = screen.queryByRole('button', { name: /export/i })
      const importBtn = screen.queryByRole('button', { name: /import/i })

      // If they exist, they should not be in the action-bar-left
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
      render(
        <PageLayout
          {...defaultProps}
        />
      )

      // Feature Discovery button should not exist at all
      expect(screen.queryByRole('button', { name: /discover/i })).not.toBeInTheDocument()
      expect(screen.queryByText('✨')).not.toBeInTheDocument()
    })
  })

  describe('Custom Actions Area', () => {
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

      // Should be between left and right groups
      const actionBar = customActionsEl.closest('[data-testid="action-bar"]')
      expect(actionBar).toBeTruthy()
      expect(actionBar!.className).toMatch(/actionBar|action-bar/)
    })
  })

  describe('Modal Scrolling', () => {
    it('should ensure modals have proper scrolling setup', () => {
      // This will be tested in Modal component tests
      // Just a placeholder to track this requirement
      expect(true).toBe(true)
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

      // Check that buttons have design system attributes
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

  describe('Accessibility', () => {
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
  })
})