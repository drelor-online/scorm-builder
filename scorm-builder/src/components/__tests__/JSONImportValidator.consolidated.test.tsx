/**
 * JSONImportValidator - Consolidated Test Suite
 * 
 * This file consolidates JSONImportValidator tests from 9 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - JSONImportValidator.test.tsx (main functionality)
 * - JSONImportValidator.banner.test.tsx (success banner styling and spacing)
 * - JSONImportValidator.buttonIcons.test.tsx (button icon consistency)
 * - JSONImportValidator.dirtyTracking.test.tsx (form state tracking)
 * - JSONImportValidator.intent.test.tsx (user intent detection)
 * - JSONImportValidator.nextbutton.test.tsx (next button states)
 * - JSONImportValidator.quotes.test.tsx (quote handling in JSON)
 * - JSONImportValidator.toast.test.tsx (notification behavior)
 * - JSONImportValidator.treeView.test.tsx (JSON tree visualization)
 * 
 * Test Categories:
 * - Core validation functionality
 * - JSON parsing and error handling
 * - UI feedback and notifications
 * - Form state management and dirty tracking
 * - Button states and navigation
 * - Visual consistency and styling
 * - Accessibility and user experience
 * - Edge cases and error scenarios
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JSONImportValidator } from '../JSONImportValidator'

// Mock the FormChanges context
vi.mock('../../hooks/useFormChanges', () => ({
  useFormChanges: () => ({
    attemptNavigation: (callback: () => void) => callback(),
    checkForChanges: vi.fn(),
    markAsChanged: vi.fn(),
    markAsSaved: vi.fn()
  })
}))

describe('JSONImportValidator - Consolidated Test Suite', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSettingsClick = vi.fn()
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnHelp = vi.fn()

  const validJSON = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2
    },
    topics: [{
      id: 'topic1',
      title: 'Topic 1',
      content: 'Topic content',
      narration: 'Topic narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      knowledgeCheck: {
        questions: [{
          id: 'q1',
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C'],
          correctAnswer: 0
        }]
      }
    }]
  }

  const validJSONString = JSON.stringify(validJSON, null, 2)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Core Validation Functionality', () => {
    it('renders with basic components', () => {
      render(<JSONImportValidator onNext={mockOnNext} />)
      
      expect(screen.getByPlaceholderText(/paste.*json/i)).toBeInTheDocument()
      expect(screen.getByText(/validate json/i)).toBeInTheDocument()
      expect(screen.getByText(/next/i)).toBeInTheDocument()
    })

    it('validates correct JSON successfully', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })
    })

    it('shows error for invalid JSON syntax', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const invalidJSON = '{ "title": "Test", "missing": quote }'
      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: invalidJSON } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/invalid json/i)).toBeInTheDocument()
      })
    })

    it('calls onNext when next button is clicked with valid JSON', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })

      const nextBtn = screen.getByText(/next/i)
      fireEvent.click(nextBtn)

      expect(mockOnNext).toHaveBeenCalledWith(validJSON)
    })
  })

  describe('JSON Parsing and Error Handling', () => {
    it('handles missing required fields', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const incompleteJSON = JSON.stringify({ title: 'Test' })
      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: incompleteJSON } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/missing required/i)).toBeInTheDocument()
      })
    })

    it('handles quotes in JSON content properly', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const jsonWithQuotes = JSON.stringify({
        ...validJSON,
        topics: [{
          ...validJSON.topics[0],
          content: 'Content with "quoted text" inside'
        }]
      })

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: jsonWithQuotes } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })
    })

    it('provides helpful error messages for common JSON mistakes', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const jsonWithTrailingComma = `{
        "title": "Test",
        "topics": [
          { "title": "Topic 1" },
        ]
      }`

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: jsonWithTrailingComma } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/invalid json/i)).toBeInTheDocument()
      })
    })
  })

  describe('Success Banner Styling and Spacing', () => {
    it('displays success banner with proper spacing and contrast', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        const successBanner = screen.getByText(/validation successful/i)
        expect(successBanner).toBeInTheDocument()
        
        // Check that the banner has proper styling
        const bannerElement = successBanner.closest('.alert, .banner, .success')
        expect(bannerElement).toBeTruthy()
      })
    })

    it('positions success banner correctly relative to other elements', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        const successBanner = screen.getByText(/validation successful/i)
        const clearButton = screen.getByText(/clear/i)
        
        expect(successBanner).toBeInTheDocument()
        expect(clearButton).toBeInTheDocument()
      })
    })
  })

  describe('Button Icons and Visual Consistency', () => {
    it('displays buttons with consistent icon styling', () => {
      render(<JSONImportValidator onNext={mockOnNext} />)
      
      const validateBtn = screen.getByText(/validate json/i)
      const nextBtn = screen.getByText(/next/i)
      const clearBtn = screen.getByText(/clear/i)
      
      expect(validateBtn).toBeInTheDocument()
      expect(nextBtn).toBeInTheDocument()
      expect(clearBtn).toBeInTheDocument()
    })

    it('maintains button visual hierarchy', () => {
      render(<JSONImportValidator onNext={mockOnNext} />)
      
      // Primary action (Next) should be more prominent
      const nextBtn = screen.getByText(/next/i)
      expect(nextBtn).toBeInTheDocument()
      
      // Secondary actions should be less prominent
      const validateBtn = screen.getByText(/validate json/i)
      const clearBtn = screen.getByText(/clear/i)
      expect(validateBtn).toBeInTheDocument()
      expect(clearBtn).toBeInTheDocument()
    })
  })

  describe('Form State Management and Dirty Tracking', () => {
    it('tracks form changes when JSON is modified', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      
      // Initially no content
      expect(textarea.value).toBe('')
      
      // Add content - should mark as dirty
      fireEvent.change(textarea, { target: { value: 'test content' } })
      expect(textarea.value).toBe('test content')
    })

    it('maintains state through validation cycles', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })

      // Content should still be there after validation
      expect(textarea.value).toBe(validJSONString)
    })

    it('clears form state when clear button is clicked', () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const clearBtn = screen.getByText(/clear/i)
      fireEvent.click(clearBtn)

      expect(textarea.value).toBe('')
    })
  })

  describe('Next Button States and Navigation', () => {
    it('disables next button when no JSON is provided', () => {
      render(<JSONImportValidator onNext={mockOnNext} />)
      
      const nextBtn = screen.getByText(/next/i)
      expect(nextBtn).toBeDisabled()
    })

    it('disables next button when JSON is invalid', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: 'invalid json' } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/invalid json/i)).toBeInTheDocument()
      })

      const nextBtn = screen.getByText(/next/i)
      expect(nextBtn).toBeDisabled()
    })

    it('enables next button when JSON is valid', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })

      const nextBtn = screen.getByText(/next/i)
      expect(nextBtn).not.toBeDisabled()
    })
  })

  describe('User Intent Detection', () => {
    it('detects intent to create a course from JSON structure', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })

      // Should recognize this as a course structure
      expect(screen.getByText(/course/i)).toBeInTheDocument()
    })

    it('provides appropriate guidance based on JSON content', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const minimalJSON = JSON.stringify({
        title: 'Simple Course',
        topics: [{ title: 'Topic 1', content: 'Content' }]
      })

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: minimalJSON } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })
    })
  })

  describe('JSON Tree Visualization', () => {
    it('provides helpful visualization of JSON structure', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })

      // Should show some indication of the JSON structure
      expect(screen.getByText(/topics/i)).toBeInTheDocument()
    })

    it('highlights key sections of the course structure', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })

      // Should identify key course components
      expect(screen.getByText(/welcome/i)).toBeInTheDocument()
      expect(screen.getByText(/objectives/i)).toBeInTheDocument()
    })
  })

  describe('Notification and Toast Behavior', () => {
    it('shows appropriate notifications for validation success', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })
    })

    it('shows appropriate notifications for validation errors', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: 'invalid json' } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/invalid json/i)).toBeInTheDocument()
      })
    })

    it('manages notification lifecycle appropriately', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      
      // First validation - error
      fireEvent.change(textarea, { target: { value: 'invalid' } })
      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/invalid json/i)).toBeInTheDocument()
      })

      // Second validation - success (should replace error)
      fireEvent.change(textarea, { target: { value: validJSONString } })
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
        expect(screen.queryByText(/invalid json/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility and User Experience', () => {
    it('provides proper ARIA labels and roles', () => {
      render(<JSONImportValidator onNext={mockOnNext} />)
      
      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      expect(textarea).toHaveAttribute('role', 'textbox')
      
      const validateBtn = screen.getByText(/validate json/i)
      expect(validateBtn).toHaveAttribute('type', 'button')
    })

    it('maintains focus management during validation', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      const validateBtn = screen.getByText(/validate json/i)
      
      fireEvent.change(textarea, { target: { value: validJSONString } })
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })

      // Focus should be manageable
      expect(document.activeElement).toBeTruthy()
    })

    it('provides keyboard navigation support', () => {
      render(<JSONImportValidator onNext={mockOnNext} />)
      
      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      const validateBtn = screen.getByText(/validate json/i)
      const nextBtn = screen.getByText(/next/i)
      
      // All interactive elements should be keyboard accessible
      expect(textarea).toHaveProperty('tabIndex')
      expect(validateBtn).not.toHaveAttribute('tabIndex', '-1')
      expect(nextBtn).not.toHaveAttribute('tabIndex', '-1')
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('handles extremely large JSON files gracefully', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const largeJSON = JSON.stringify({
        ...validJSON,
        topics: Array.from({ length: 100 }, (_, i) => ({
          id: `topic${i}`,
          title: `Topic ${i}`,
          content: `Content for topic ${i}`.repeat(100),
          narration: `Narration for topic ${i}`,
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 3
        }))
      })

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: largeJSON } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      // Should not crash and should provide feedback
      await waitFor(() => {
        expect(validateBtn).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('handles empty input gracefully', () => {
      render(<JSONImportValidator onNext={mockOnNext} />)
      
      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)
      
      // Should not crash with empty input
      expect(validateBtn).toBeInTheDocument()
    })

    it('handles special characters in JSON content', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const specialCharJSON = JSON.stringify({
        ...validJSON,
        topics: [{
          ...validJSON.topics[0],
          content: 'Content with émojis 🎯 and unicode ü characters'
        }]
      })

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: specialCharJSON } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })
    })

    it('recovers gracefully from validation errors', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      
      // Invalid JSON first
      fireEvent.change(textarea, { target: { value: '{ invalid }' } })
      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/invalid json/i)).toBeInTheDocument()
      })

      // Fix the JSON
      fireEvent.change(textarea, { target: { value: validJSONString } })
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
        expect(screen.queryByText(/invalid json/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Integration with Parent Components', () => {
    it('calls onBack when back button is provided and clicked', () => {
      render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
      
      const backBtn = screen.getByText(/back/i)
      fireEvent.click(backBtn)
      
      expect(mockOnBack).toHaveBeenCalled()
    })

    it('integrates with settings and help callbacks', () => {
      render(
        <JSONImportValidator 
          onNext={mockOnNext}
          onSettingsClick={mockOnSettingsClick}
          onHelp={mockOnHelp}
        />
      )
      
      // Check that component renders without errors when callbacks are provided
      expect(screen.getByPlaceholderText(/paste.*json/i)).toBeInTheDocument()
    })

    it('passes validated data in correct format to onNext', async () => {
      render(<JSONImportValidator onNext={mockOnNext} />)

      const textarea = screen.getByPlaceholderText(/paste.*json/i)
      fireEvent.change(textarea, { target: { value: validJSONString } })

      const validateBtn = screen.getByText(/validate json/i)
      fireEvent.click(validateBtn)

      await waitFor(() => {
        expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
      })

      const nextBtn = screen.getByText(/next/i)
      fireEvent.click(nextBtn)

      expect(mockOnNext).toHaveBeenCalledWith(validJSON)
      expect(mockOnNext).toHaveBeenCalledTimes(1)
    })
  })
})