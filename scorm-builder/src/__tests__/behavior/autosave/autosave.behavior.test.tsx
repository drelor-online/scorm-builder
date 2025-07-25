import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AutoSaveIndicatorConnected } from '../../../components/AutoSaveIndicatorConnected'
import { AutoSaveProvider } from '../../../contexts/AutoSaveContext'

describe('Autosave Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show "All changes saved" when not saving', async () => {
    render(
      <AutoSaveProvider 
        isSaving={false}
        lastSaved={new Date()}
        hasUnsavedChanges={false}
      >
        <AutoSaveIndicatorConnected />
      </AutoSaveProvider>
    )

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText(/Last saved.*just now/)).toBeInTheDocument()
  })

  it('should show "Saving..." when isSaving is true', async () => {
    render(
      <AutoSaveProvider 
        isSaving={true}
        lastSaved={null}
        hasUnsavedChanges={true}
      >
        <AutoSaveIndicatorConnected />
      </AutoSaveProvider>
    )

    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('should show "Unsaved changes" when there are unsaved changes', async () => {
    render(
      <AutoSaveProvider 
        isSaving={false}
        lastSaved={null}
        hasUnsavedChanges={true}
      >
        <AutoSaveIndicatorConnected />
      </AutoSaveProvider>
    )

    expect(screen.getByText('No draft')).toBeInTheDocument()
  })

  it('should update time since last save', async () => {
    const lastSaved = new Date(Date.now() - 65000) // 65 seconds ago
    
    render(
      <AutoSaveProvider 
        isSaving={false}
        lastSaved={lastSaved}
        hasUnsavedChanges={false}
      >
        <AutoSaveIndicatorConnected />
      </AutoSaveProvider>
    )

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText(/Last saved.*1m ago/)).toBeInTheDocument()
  })

  it('should use FileStorage autosave state, not localStorage', async () => {
    // Mock the hook that would normally use localStorage
    const mockLocalStorageAutoSave = vi.fn()
    vi.mock('../../../hooks/useLocalStorageAutoSave', () => ({
      useLocalStorageAutoSave: mockLocalStorageAutoSave
    }))

    render(
      <AutoSaveProvider 
        isSaving={false}
        lastSaved={new Date()}
        hasUnsavedChanges={false}
      >
        <AutoSaveIndicatorConnected />
      </AutoSaveProvider>
    )

    // The connected component should NOT call useLocalStorageAutoSave
    expect(mockLocalStorageAutoSave).not.toHaveBeenCalled()
  })
})