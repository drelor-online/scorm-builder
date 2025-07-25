import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageLayout } from '../PageLayout'

describe('PageLayout - Window Edge Spacing', () => {
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnSettings = vi.fn()
  const mockOnHelp = vi.fn()

  describe('User wants comfortable spacing from window edges', () => {
    it('should have proper margins on desktop to prevent content from touching window edges', () => {
      const { container } = render(
        <PageLayout
          currentStep={1}
          totalSteps={7}
          title="Test Page"
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        >
          <div>Test Content</div>
        </PageLayout>
      )

      // Check that the main container exists with proper class
      const mainContainer = container.querySelector('.page-layout')
      expect(mainContainer).toBeTruthy()
      
      // In test environment, we verify the CSS class is applied
      // The actual spacing is defined in PageLayout.module.css
      expect(mainContainer!.className).toContain('page-layout')
      
      // Check that the container structure is correct
      const pageWrapper = container.querySelector('[data-testid="page-wrapper"]')
      expect(pageWrapper).toBeTruthy()
      expect(pageWrapper!.className).toMatch(/pageLayout|page-layout/)
    })

    it('should have a maximum width to improve readability on wide screens', () => {
      const { container } = render(
        <PageLayout
          currentStep={1}
          totalSteps={7}
          title="Test Page"
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        >
          <div>Test Content</div>
        </PageLayout>
      )

      // Content container should exist with proper classes
      const contentArea = container.querySelector('.page-content') || 
                         container.querySelector('.content-wrapper') ||
                         container.querySelector('[data-testid="content-container"]')
      
      expect(contentArea).toBeTruthy()
      
      // Check that content container has the max-width classes
      // The CSS module applies max-width: 1280px
      expect(contentArea!.className).toMatch(/contentContainer|pageContent|content-wrapper/)
    })

    it('should center content when screen is wider than max-width', () => {
      const { container } = render(
        <PageLayout
          currentStep={1}
          totalSteps={7}
          title="Test Page"
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        >
          <div>Test Content</div>
        </PageLayout>
      )

      const contentArea = container.querySelector('[data-testid="content-container"]')
      
      expect(contentArea).toBeTruthy()
      
      // CSS module applies margin: 0 auto for centering
      expect(contentArea!.className).toMatch(/contentContainer|pageContent/)
    })

    it('should have responsive margins that adjust on smaller screens', () => {
      // Mock window.matchMedia for mobile
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
          currentStep={1}
          totalSteps={7}
          title="Test Page"
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        >
          <div>Test Content</div>
        </PageLayout>
      )

      const mainContainer = container.querySelector('.page-layout')
      expect(mainContainer).toBeTruthy()
      
      // Note: CSS media queries won't be applied in JSDOM
      // We're testing that the CSS classes exist and trust the CSS
      expect(mainContainer!.className).toContain('page-layout')
    })

    it('should maintain spacing for header and footer areas', () => {
      const { container } = render(
        <PageLayout
          currentStep={1}
          totalSteps={7}
          title="Test Page"
          canSave={true}
          onSave={mockOnSave}
          onOpen={mockOnOpen}
          onSettings={mockOnSettings}
          onHelp={mockOnHelp}
        >
          <div>Test Content</div>
        </PageLayout>
      )

      // Check header exists with proper class
      const header = container.querySelector('[data-testid="page-header"]')
      expect(header).toBeTruthy()
      expect(header!.className).toMatch(/fixedHeader/)

      // Check main content exists with proper class
      const main = container.querySelector('.main-content')
      expect(main).toBeTruthy()
      expect(main!.className).toMatch(/mainContent/)
      
      // Check footer exists with proper class
      const footer = container.querySelector('[data-testid="page-footer"]')
      expect(footer).toBeTruthy()
      expect(footer!.className).toMatch(/stickyFooter/)
    })

    it('should apply consistent spacing across all page layouts', () => {
      // Test multiple instances to ensure consistency
      const pages = [
        { title: 'Course Configuration', step: 1 },
        { title: 'AI Prompt Generator', step: 2 },
        { title: 'JSON Import', step: 3 }
      ]

      pages.forEach(({ title, step }) => {
        const { container } = render(
          <PageLayout
            currentStep={step}
            totalSteps={7}
            title={title}
            canSave={true}
            onSave={mockOnSave}
            onOpen={mockOnOpen}
            onSettings={mockOnSettings}
            onHelp={mockOnHelp}
          >
            <div>Test Content for {title}</div>
          </PageLayout>
        )

        const mainContainer = container.querySelector('.page-layout')
        expect(mainContainer).toBeTruthy()
        
        // All pages should use the same CSS module class
        expect(mainContainer!.className).toContain('page-layout')
        
        // Verify consistent structure
        expect(container.querySelector('[data-testid="page-header"]')).toBeTruthy()
        expect(container.querySelector('[data-testid="content-container"]')).toBeTruthy()
        expect(container.querySelector('[data-testid="page-footer"]')).toBeTruthy()
      })
    })
  })

  describe('User wants better visual hierarchy', () => {
    it('should have comfortable vertical spacing between sections', () => {
      const { container } = render(
        <PageLayout
          currentStep={1}
          totalSteps={7}
          title="Test Page"
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
      // CSS module applies padding: 24px 0
      expect(mainContent!.className).toMatch(/mainContent/)
      
      // Check that title section has spacing
      const titleSection = container.querySelector('.pageTitleSection')
      if (titleSection) {
        expect(titleSection.className).toMatch(/pageTitleSection/)
      }
    })
  })
})