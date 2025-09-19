/**
 * UnsavedChangesDialog Loading Spinner Behavior Test
 * 
 * Tests the issue where the save project button takes a long time and feels like it crashed.
 * User needs to see a spinner and indication that it is saving the project for better UX.
 * 
 * User Report: "When you are asked to save the project or discard changes, if you click 
 * save project it can take a long time and feels like it crashed. It might be nice to see 
 * a spinner and some indication that it is saving the project in that dialog so it is a 
 * better user experience."
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'

describe('UnsavedChangesDialog - Loading Spinner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultProps = {
    isOpen: true,
    currentProjectName: 'Test Project',
    onSave: vi.fn(),
    onDiscard: vi.fn(),
    onCancel: vi.fn()
  }

  test('FAILING TEST: Should show loading spinner when Save Project button is clicked', async () => {
    console.log('🧪 [TEST] Testing save dialog loading spinner...')
    
    // Mock a slow save operation (takes 2 seconds)
    const mockSave = vi.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 2000))
    })
    
    const { rerender } = render(
      <UnsavedChangesDialog 
        {...defaultProps} 
        onSave={mockSave}
        isSaving={false} // Initially not saving
      />
    )

    console.log('🔍 [TEST] Looking for Save Project button...')
    
    // Find the Save Project button
    const saveButton = screen.getByText('Save Project')
    expect(saveButton).toBeInTheDocument()
    
    // Initially should not show loading state
    expect(screen.queryByTestId('save-loading-spinner')).not.toBeInTheDocument()
    expect(saveButton).not.toBeDisabled()
    expect(saveButton.textContent).toBe('Save Project')

    console.log('🔄 [TEST] Clicking Save Project button...')
    
    // Click the save button
    fireEvent.click(saveButton)
    
    // Simulate the parent component setting isSaving=true
    rerender(
      <UnsavedChangesDialog 
        {...defaultProps} 
        onSave={mockSave}
        isSaving={true} // Now saving
      />
    )
    
    // Should immediately show loading state
    await waitFor(() => {
      // Button should show loading spinner
      const loadingSpinner = screen.getByTestId('save-loading-spinner')
      expect(loadingSpinner).toBeInTheDocument()
      
      // Button should be disabled during save
      expect(saveButton).toBeDisabled()
      
      // Button text should change to indicate saving
      expect(saveButton.textContent).toContain('Saving')
      
      console.log('✅ [TEST] Loading spinner and disabled state found')
    })

    console.log('🔍 [TEST] Verifying save operation was called...')
    
    // Verify the save function was called
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  test('FAILING TEST: Should hide loading spinner after save completes', async () => {
    console.log('🧪 [TEST] Testing loading spinner disappears after save...')
    
    // Mock a fast save operation (resolves immediately)
    const mockSave = vi.fn().mockResolvedValue(undefined)
    
    const { rerender } = render(
      <UnsavedChangesDialog 
        {...defaultProps} 
        onSave={mockSave}
        isSaving={false}
      />
    )

    const saveButton = screen.getByText('Save Project')
    
    // Click save button
    fireEvent.click(saveButton)
    
    // Initially should show loading
    await waitFor(() => {
      expect(screen.getByTestId('save-loading-spinner')).toBeInTheDocument()
      expect(saveButton).toBeDisabled()
    })

    // Simulate save completion by updating isSaving prop
    rerender(
      <UnsavedChangesDialog 
        {...defaultProps} 
        onSave={mockSave}
        isSaving={false} // Save completed
      />
    )

    // Loading state should be gone
    await waitFor(() => {
      expect(screen.queryByTestId('save-loading-spinner')).not.toBeInTheDocument()
      expect(saveButton).not.toBeDisabled()
      expect(saveButton.textContent).toBe('Save Project')
      
      console.log('✅ [TEST] Loading spinner correctly removed after save')
    })
  })

  test('FAILING TEST: Should disable other buttons during save operation', async () => {
    console.log('🧪 [TEST] Testing all buttons disabled during save...')
    
    const mockSave = vi.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 1000))
    })
    
    const { rerender } = render(
      <UnsavedChangesDialog 
        {...defaultProps} 
        onSave={mockSave}
        isSaving={false}
      />
    )

    const saveButton = screen.getByText('Save Project')
    const discardButton = screen.getByText('Discard Changes')
    const cancelButton = screen.getByText('Cancel')
    
    // All buttons should be enabled initially
    expect(saveButton).not.toBeDisabled()
    expect(discardButton).not.toBeDisabled()
    expect(cancelButton).not.toBeDisabled()

    // Click save button
    fireEvent.click(saveButton)
    
    // Simulate the parent component setting isSaving=true
    rerender(
      <UnsavedChangesDialog 
        {...defaultProps} 
        onSave={mockSave}
        isSaving={true} // Now saving
      />
    )
    
    // All buttons should be disabled during save
    await waitFor(() => {
      expect(saveButton).toBeDisabled()
      expect(discardButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()
      
      console.log('✅ [TEST] All buttons correctly disabled during save')
    })
  })

  test('DIAGNOSTIC: Check current component structure without loading state', async () => {
    console.log('🔍 [DIAGNOSTIC] Checking current component without loading state...')
    
    render(<UnsavedChangesDialog {...defaultProps} />)
    
    // Check what's currently rendered
    const saveButton = screen.getByText('Save Project')
    const discardButton = screen.getByText('Discard Changes') 
    const cancelButton = screen.getByText('Cancel')
    
    console.log('🔍 [DIAGNOSTIC] Found buttons:', {
      saveButton: saveButton.textContent,
      discardButton: discardButton.textContent,
      cancelButton: cancelButton.textContent,
      saveButtonDisabled: saveButton.hasAttribute('disabled'),
      hasLoadingSpinner: !!screen.queryByTestId('save-loading-spinner')
    })
    
    // Click save to see current behavior
    fireEvent.click(saveButton)
    
    // Check state after click
    console.log('🔍 [DIAGNOSTIC] After save click:', {
      saveButtonDisabled: saveButton.hasAttribute('disabled'),
      hasLoadingSpinner: !!screen.queryByTestId('save-loading-spinner'),
      saveButtonText: saveButton.textContent
    })
    
    // The diagnostic should pass - we're just checking current state
    expect(true).toBe(true)
  })
})