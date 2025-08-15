/**
 * Settings - Consolidated Test Suite
 * 
 * This file consolidates Settings tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - Settings.test.tsx (basic functionality)
 * - Settings.localStorage.test.tsx (localStorage persistence)
 * 
 * Test Categories:
 * - Component rendering and UI
 * - Settings form functionality
 * - LocalStorage persistence
 * - API key management
 * - Theme preferences
 * - Export/import settings
 * - Validation and error handling
 */

import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Settings } from '../Settings'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

describe('Settings - Consolidated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering and UI', () => {
    it('should render settings dialog with all sections', () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('API Configuration')).toBeInTheDocument()
      expect(screen.getByText('Theme Preferences')).toBeInTheDocument()
      expect(screen.getByText('Export/Import')).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(<Settings isOpen={false} onClose={vi.fn()} />)
      
      expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    })

    it('should call onClose when close button clicked', async () => {
      const mockOnClose = vi.fn()
      render(<Settings isOpen={true} onClose={mockOnClose} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      await userEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('API Key Management', () => {
    it('should display API key input field', () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      expect(apiKeyInput).toBeInTheDocument()
      expect(apiKeyInput).toHaveAttribute('type', 'password')
    })

    it('should load saved API key from localStorage', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'apiKey') return 'saved-api-key'
        return null
      })

      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      expect(apiKeyInput).toHaveValue('saved-api-key')
    })

    it('should save API key to localStorage when changed', async () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      await userEvent.clear(apiKeyInput)
      await userEvent.type(apiKeyInput, 'new-api-key')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('apiKey', 'new-api-key')
    })

    it('should validate API key format', async () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      await userEvent.clear(apiKeyInput)
      await userEvent.type(apiKeyInput, 'invalid-key')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument()
      })
    })

    it('should show/hide API key when toggle clicked', async () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      const toggleButton = screen.getByRole('button', { name: /show.*hide/i })

      expect(apiKeyInput).toHaveAttribute('type', 'password')

      await userEvent.click(toggleButton)
      expect(apiKeyInput).toHaveAttribute('type', 'text')

      await userEvent.click(toggleButton)
      expect(apiKeyInput).toHaveAttribute('type', 'password')
    })
  })

  describe('Theme Preferences', () => {
    it('should display theme selection options', () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Light')).toBeInTheDocument()
      expect(screen.getByText('Dark')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })

    it('should load saved theme preference from localStorage', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'theme') return 'dark'
        return null
      })

      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const darkOption = screen.getByLabelText('Dark')
      expect(darkOption).toBeChecked()
    })

    it('should save theme preference to localStorage when changed', async () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const darkOption = screen.getByLabelText('Dark')
      await userEvent.click(darkOption)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark')
    })

    it('should default to system theme when none saved', () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const systemOption = screen.getByLabelText('System')
      expect(systemOption).toBeChecked()
    })
  })

  describe('Export/Import Settings', () => {
    it('should display export and import buttons', () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByRole('button', { name: /export settings/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /import settings/i })).toBeInTheDocument()
    })

    it('should export current settings as JSON', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'apiKey') return 'test-api-key'
        if (key === 'theme') return 'dark'
        return null
      })

      // Mock URL.createObjectURL
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
      global.URL.createObjectURL = mockCreateObjectURL

      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const exportButton = screen.getByRole('button', { name: /export settings/i })
      await userEvent.click(exportButton)

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('should import settings from uploaded JSON file', async () => {
      const mockFile = new File(['{"apiKey":"imported-key","theme":"light"}'], 'settings.json', {
        type: 'application/json'
      })

      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const fileInput = screen.getByLabelText(/import settings/i)
      await userEvent.upload(fileInput, mockFile)

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('apiKey', 'imported-key')
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light')
      })
    })

    it('should show error for invalid JSON import', async () => {
      const mockFile = new File(['invalid json'], 'settings.json', {
        type: 'application/json'
      })

      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const fileInput = screen.getByLabelText(/import settings/i)
      await userEvent.upload(fileInput, mockFile)

      await waitFor(() => {
        expect(screen.getByText(/invalid settings file/i)).toBeInTheDocument()
      })
    })
  })

  describe('LocalStorage Integration', () => {
    it('should persist settings across component remounts', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'apiKey') return 'persistent-key'
        if (key === 'theme') return 'light'
        return null
      })

      const { unmount, rerender } = render(<Settings isOpen={true} onClose={vi.fn()} />)
      
      unmount()
      rerender(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      expect(apiKeyInput).toHaveValue('persistent-key')
      
      const lightOption = screen.getByLabelText('Light')
      expect(lightOption).toBeChecked()
    })

    it('should clear settings when reset button clicked', async () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      await userEvent.click(resetButton)

      // Confirm reset dialog
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await userEvent.click(confirmButton)

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('apiKey')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('theme')
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      
      // Should not throw error
      expect(() => {
        fireEvent.change(apiKeyInput, { target: { value: 'test-key' } })
      }).not.toThrow()
    })
  })

  describe('Validation and Error Handling', () => {
    it('should validate required fields before saving', async () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/api key is required/i)).toBeInTheDocument()
      })
    })

    it('should disable save button when form is invalid', async () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      await userEvent.clear(apiKeyInput)

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    })

    it('should show success message after successful save', async () => {
      render(<Settings isOpen={true} onClose={vi.fn()} />)

      const apiKeyInput = screen.getByLabelText(/api key/i)
      await userEvent.type(apiKeyInput, 'valid-api-key')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument()
      })
    })
  })
})