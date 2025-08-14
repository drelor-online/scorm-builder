/**
 * Tests for autosave notification behavior
 * 
 * This verifies that autosave operations properly show notifications
 * instead of persistent UI indicators that can block navigation
 */

import { vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React from 'react'
import { NotificationProvider } from '../contexts/NotificationContext'
import { NotificationPanel } from '../components/NotificationPanel'
import { useAutoSave } from '../hooks/useAutoSave'
import { AutoSaveBadge } from '../components/AutoSaveBadge'
import { AutoSaveProvider } from '../contexts/AutoSaveContext'

// Mock component to test useAutoSave hook with notifications
const TestComponent = ({ 
  data, 
  isDirty, 
  onSave, 
  onError 
}: { 
  data: any; 
  isDirty: boolean; 
  onSave: (data: any) => Promise<void>;
  onError?: (error: Error) => void;
}) => {
  const { isSaving, lastSaved, forceSave } = useAutoSave({
    data,
    isDirty,
    onSave,
    onError,
    delay: 100 // Short delay for testing
  })

  return (
    <div>
      <div data-testid="saving-status">{isSaving ? 'saving' : 'idle'}</div>
      <div data-testid="last-saved">{lastSaved ? lastSaved.toISOString() : 'never'}</div>
      <button onClick={forceSave} data-testid="force-save">Force Save</button>
    </div>
  )
}

describe('Autosave Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should show notification when autosave starts', async () => {
    // ARRANGE
    const mockSave = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)))
    
    render(
      <NotificationProvider>
        <TestComponent 
          data={{ content: 'test' }}
          isDirty={true}
          onSave={mockSave}
        />
        <NotificationPanel />
      </NotificationProvider>
    )

    // ACT - Force save to trigger autosave
    const forceSaveButton = screen.getByTestId('force-save')
    await act(async () => {
      forceSaveButton.click()
    })

    // ASSERT - Should show saving notification
    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument()
    })

    // Should show success notification after save completes
    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  test('should show error notification when autosave fails', async () => {
    // ARRANGE
    const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'))
    
    render(
      <NotificationProvider>
        <TestComponent 
          data={{ content: 'test' }}
          isDirty={true}
          onSave={mockSave}
        />
        <NotificationPanel />
      </NotificationProvider>
    )

    // ACT
    const forceSaveButton = screen.getByTestId('force-save')
    await act(async () => {
      forceSaveButton.click()
    })

    // ASSERT - Should show error notification
    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    })
  })

  test('should auto-dismiss success notifications after 3 seconds', async () => {
    // ARRANGE
    const mockSave = vi.fn().mockResolvedValue(undefined)
    
    render(
      <NotificationProvider>
        <TestComponent 
          data={{ content: 'test' }}
          isDirty={true}
          onSave={mockSave}
        />
        <NotificationPanel />
      </NotificationProvider>
    )

    // ACT
    const forceSaveButton = screen.getByTestId('force-save')
    await act(async () => {
      forceSaveButton.click()
    })

    // ASSERT - Success notification appears
    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument()
    })

    // Should auto-dismiss after 3 seconds
    await waitFor(() => {
      expect(screen.queryByText(/saved/i)).not.toBeInTheDocument()
    }, { timeout: 3500 })
  })

  test('should not show notification for manual saves', async () => {
    // ARRANGE
    const mockSave = vi.fn().mockResolvedValue(undefined)
    
    render(
      <NotificationProvider>
        <TestComponent 
          data={{ content: 'test' }}
          isDirty={false} // Not dirty, so no autosave
          onSave={mockSave}
        />
      </NotificationProvider>
    )

    // ACT - Force save (manual save)
    const forceSaveButton = screen.getByTestId('force-save')
    forceSaveButton.click()

    // ASSERT - Should not show autosave notification for manual saves
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled()
    })

    // Should not have autosave-specific notifications
    expect(screen.queryByText(/auto.*saved/i)).not.toBeInTheDocument()
  })
})

describe('AutoSave Badge', () => {
  test('should only show badge when there are unsaved changes', () => {
    // ARRANGE
    render(
      <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    // ASSERT - Badge should not be visible when no unsaved changes
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('should show badge when there are unsaved changes', () => {
    // ARRANGE
    render(
      <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={true}>
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    // ASSERT - Badge should be visible with unsaved changes text
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  test('should show saving indicator when autosave is in progress', () => {
    // ARRANGE
    render(
      <AutoSaveProvider isSaving={true} lastSaved={null} hasUnsavedChanges={true}>
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    // ASSERT - Badge should show saving status
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Auto-saving...')).toBeInTheDocument()
    expect(screen.getByLabelText('Auto-saving...')).toBeInTheDocument()
  })

  test('should hide badge when changes are saved', () => {
    // ARRANGE - Start with unsaved changes
    const { rerender } = render(
      <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={true}>
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    // Verify badge is shown
    expect(screen.getByRole('status')).toBeInTheDocument()

    // ACT - Simulate changes being saved
    rerender(
      <AutoSaveProvider isSaving={false} lastSaved={new Date()} hasUnsavedChanges={false}>
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    // ASSERT - Badge should disappear when clean
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('should show relative time when last saved', () => {
    // ARRANGE
    const oneMinuteAgo = new Date(Date.now() - 60000)
    
    render(
      <AutoSaveProvider isSaving={false} lastSaved={oneMinuteAgo} hasUnsavedChanges={true}>
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    // ASSERT - Should show relative time
    expect(screen.getByText('1m ago')).toBeInTheDocument()
  })
})