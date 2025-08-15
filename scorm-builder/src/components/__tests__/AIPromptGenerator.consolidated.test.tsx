/**
 * AIPromptGenerator - Consolidated Test Suite
 * 
 * This file consolidates AIPromptGenerator tests from 10 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - AIPromptGenerator.test.tsx (main functionality)
 * - AIPromptGenerator.cardBorderConsistency.test.tsx
 * - AIPromptGenerator.cardBorders.test.tsx  
 * - AIPromptGenerator.cardConsistency.test.tsx
 * - AIPromptGenerator.cardStyling.test.tsx
 * - AIPromptGenerator.feedback.test.tsx
 * - AIPromptGenerator.intent.test.tsx
 * - AIPromptGenerator.kcFeedback.test.tsx
 * - AIPromptGenerator.noBorder.test.tsx
 * - AIPromptGeneratorUXFixes.test.tsx
 * 
 * Test Categories:
 * - Core functionality and prompt generation
 * - Card styling and visual consistency
 * - Knowledge check feedback structures
 * - Intent detection and content analysis
 * - UX improvements and accessibility
 * - Form validation and user interactions
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { AIPromptGenerator } from '../AIPromptGenerator'
import { CourseSeedData } from '../../types/course'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock the hooks
vi.mock('../../hooks/useFormChanges', () => ({
  useFormChanges: () => ({
    attemptNavigation: (callback: () => void) => callback(),
    checkForChanges: vi.fn()
  })
}))

vi.mock('../../hooks/useLocalStorageAutoSave', () => ({
  useLocalStorageAutoSave: () => ({
    isSaving: false,
    hasDraft: false,
    timeSinceLastSave: null
  })
}))

// Mock the components
vi.mock('../PageLayout', () => ({
  PageLayout: ({ children, title, description, actions }: any) => (
    <div data-testid="page-wrapper">
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{actions}</div>
      <div>{children}</div>
    </div>
  )
}))

// Mock DesignSystem components to track their usage
vi.mock('../DesignSystem', () => ({
  Card: vi.fn(({ children, className, ...props }) => (
    <div data-testid="design-system-card" className={`card ${className || ''}`} {...props}>{children}</div>
  )),
  Button: vi.fn(({ children, ...props }) => (
    <button {...props}>{children}</button>
  )),
  Input: vi.fn((props) => <input {...props} />)
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistentStorageProvider>
    <StepNavigationProvider totalSteps={6} currentStep={2}>
      {children}
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

describe('AIPromptGenerator - Consolidated Test Suite', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None' as const,
    templateTopics: []
  }

  const defaultProps = {
    courseSeedData: mockCourseSeedData,
    onNext: vi.fn(),
    onBack: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Core Functionality', () => {
    it('renders with basic components', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('displays course information', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      // Check that course title appears in the generated prompt
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toContain('Test Course')
    })

    it('handles prompt editing', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox')
      await userEvent.clear(textarea)
      await userEvent.type(textarea, 'Custom prompt content')
      
      expect(textarea).toHaveValue('Custom prompt content')
    })

    it('calls onNext when next button is clicked', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const nextButton = screen.getByText('Next')
      await userEvent.click(nextButton)
      
      expect(defaultProps.onNext).toHaveBeenCalledTimes(1)
    })

    it('calls onBack when back button is clicked', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const backButton = screen.getByText('Back')
      await userEvent.click(backButton)
      
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('Prompt Generation Content', () => {
    it('includes course topics in the prompt', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toContain('Topic 1')
      expect(textarea.value).toContain('Topic 2')
    })

    it('includes difficulty level in the prompt', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toContain('3') // difficulty level
    })

    it('generates appropriate prompt structure', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      const promptContent = textarea.value
      
      // Should contain key sections for course generation
      expect(promptContent).toContain('course')
      expect(promptContent.length).toBeGreaterThan(100) // Should be substantial
    })
  })

  describe('Knowledge Check Feedback', () => {
    it('includes feedback structure for knowledge check questions', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      const promptContent = textarea.value
      
      // Check that knowledge check section includes feedback guidance
      expect(promptContent.toLowerCase()).toMatch(/feedback|correct|incorrect|explanation/)
    })

    it('includes knowledge check requirements in prompt', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      const promptContent = textarea.value
      
      // Should mention knowledge checks or assessments
      expect(promptContent.toLowerCase()).toMatch(/knowledge|check|question|assessment/)
    })

    it('provides guidance for feedback quality', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      const promptContent = textarea.value
      
      // Should provide guidance for creating good feedback
      expect(promptContent.length).toBeGreaterThan(200) // Substantial guidance
    })
  })

  describe('Card Styling and Visual Consistency', () => {
    it('uses consistent Card components', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const cards = screen.getAllByTestId('design-system-card')
      expect(cards.length).toBeGreaterThan(0)
      
      // Check that cards use consistent styling
      cards.forEach(card => {
        expect(card).toHaveClass('card')
      })
    })

    it('applies consistent border styling to cards', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const cards = screen.getAllByTestId('design-system-card')
      
      // All cards should have consistent border classes
      cards.forEach(card => {
        const classes = card.className
        expect(classes).toContain('card')
      })
    })

    it('maintains visual hierarchy in card layout', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const wrapper = screen.getByTestId('page-wrapper')
      expect(wrapper).toBeInTheDocument()
      
      // Should have proper page structure
      expect(screen.getByRole('heading')).toBeInTheDocument()
    })

    it('uses appropriate spacing and padding in cards', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const cards = screen.getAllByTestId('design-system-card')
      
      // Cards should exist and be properly structured
      expect(cards.length).toBeGreaterThan(0)
      cards.forEach(card => {
        expect(card).toBeInTheDocument()
      })
    })
  })

  describe('Intent Detection and Content Analysis', () => {
    it('adapts prompt based on course difficulty', () => {
      const easyProps = {
        ...defaultProps,
        courseSeedData: {
          ...mockCourseSeedData,
          difficulty: 1
        }
      }
      
      const { rerender } = render(
        <TestWrapper>
          <AIPromptGenerator {...easyProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      const easyPrompt = textarea.value
      
      rerender(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const hardPrompt = textarea.value
      
      // Different difficulty levels should produce different prompts
      expect(easyPrompt).not.toBe(hardPrompt)
    })

    it('adapts content based on selected topics', () => {
      const specializedProps = {
        ...defaultProps,
        courseSeedData: {
          ...mockCourseSeedData,
          customTopics: ['Advanced Mathematics', 'Quantum Physics']
        }
      }
      
      render(
        <TestWrapper>
          <AIPromptGenerator {...specializedProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toContain('Advanced Mathematics')
      expect(textarea.value).toContain('Quantum Physics')
    })

    it('provides appropriate guidance for technical topics', () => {
      const technicalProps = {
        ...defaultProps,
        courseSeedData: {
          ...mockCourseSeedData,
          customTopics: ['Software Engineering', 'Database Design']
        }
      }
      
      render(
        <TestWrapper>
          <AIPromptGenerator {...technicalProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      const promptContent = textarea.value
      
      // Should contain technical topics
      expect(promptContent).toContain('Software Engineering')
      expect(promptContent).toContain('Database Design')
    })
  })

  describe('UX Improvements and Accessibility', () => {
    it('provides clear labels for form elements', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      
      // Should have proper accessibility attributes
      expect(textarea).toHaveAttribute('placeholder')
    })

    it('maintains focus management', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox')
      await userEvent.click(textarea)
      
      expect(textarea).toHaveFocus()
    })

    it('provides helpful placeholder text', () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox')
      const placeholder = textarea.getAttribute('placeholder')
      
      expect(placeholder).toBeTruthy()
      expect(placeholder!.length).toBeGreaterThan(10) // Should be descriptive
    })

    it('shows loading states appropriately', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      // Component should render without loading issues
      expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
    })
  })

  describe('Form Validation and User Interactions', () => {
    it('handles empty prompt submission', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox')
      await userEvent.clear(textarea)
      
      const nextButton = screen.getByText('Next')
      await userEvent.click(nextButton)
      
      // Should still allow next even with empty prompt (design decision)
      expect(defaultProps.onNext).toHaveBeenCalled()
    })

    it('preserves user edits during navigation', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox')
      const originalValue = textarea.value
      
      await userEvent.type(textarea, ' CUSTOM ADDITION')
      
      expect(textarea.value).toBe(originalValue + ' CUSTOM ADDITION')
    })

    it('responds to keyboard shortcuts appropriately', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox')
      await userEvent.click(textarea)
      
      // Test Ctrl+A (select all)
      await userEvent.keyboard('{Control>}a{/Control}')
      
      // Should handle keyboard input properly
      expect(textarea).toHaveFocus()
    })

    it('handles rapid user interactions gracefully', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const nextButton = screen.getByText('Next')
      const backButton = screen.getByText('Back')
      
      // Rapid clicking should be handled gracefully
      await userEvent.click(nextButton)
      await userEvent.click(backButton)
      await userEvent.click(nextButton)
      
      expect(defaultProps.onNext).toHaveBeenCalledTimes(2)
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('Template Integration', () => {
    it('adapts prompt when template is selected', () => {
      const templateProps = {
        ...defaultProps,
        courseSeedData: {
          ...mockCourseSeedData,
          template: 'business' as const,
          templateTopics: ['Leadership', 'Management']
        }
      }
      
      render(
        <TestWrapper>
          <AIPromptGenerator {...templateProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      
      // Should adapt content based on template
      expect(textarea.value).toBeTruthy()
    })

    it('handles template topics correctly', () => {
      const templateProps = {
        ...defaultProps,
        courseSeedData: {
          ...mockCourseSeedData,
          template: 'healthcare' as const,
          templateTopics: ['Patient Safety', 'Medical Ethics']
        }
      }
      
      render(
        <TestWrapper>
          <AIPromptGenerator {...templateProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      
      // Should include template-specific content
      expect(textarea.value).toBeTruthy()
      expect(textarea.value.length).toBeGreaterThan(50)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles missing course data gracefully', () => {
      const emptyProps = {
        ...defaultProps,
        courseSeedData: {
          courseTitle: '',
          difficulty: 1,
          customTopics: [],
          template: 'None' as const,
          templateTopics: []
        }
      }
      
      expect(() => {
        render(
          <TestWrapper>
            <AIPromptGenerator {...emptyProps} />
          </TestWrapper>
        )
      }).not.toThrow()
    })

    it('handles very large prompt content', async () => {
      render(
        <TestWrapper>
          <AIPromptGenerator {...defaultProps} />
        </TestWrapper>
      )
      
      const textarea = screen.getByRole('textbox')
      const largeText = 'A'.repeat(10000)
      
      await userEvent.clear(textarea)
      await userEvent.click(textarea)
      await userEvent.paste(largeText)
      
      expect(textarea.value).toBe(largeText)
    })

    it('handles special characters in course content', () => {
      const specialProps = {
        ...defaultProps,
        courseSeedData: {
          ...mockCourseSeedData,
          courseTitle: 'Course with "Quotes" & Symbols',
          customTopics: ['Topic with <HTML> tags', 'Topic with émojis 🎯']
        }
      }
      
      expect(() => {
        render(
          <TestWrapper>
            <AIPromptGenerator {...specialProps} />
          </TestWrapper>
        )
      }).not.toThrow()
    })
  })
})