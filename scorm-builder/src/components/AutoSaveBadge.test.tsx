import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AutoSaveBadge } from './AutoSaveBadge'
import { AutoSaveProvider } from '../contexts/AutoSaveContext'

describe('AutoSaveBadge', () => {
  it('shows "Saving..." when manual save is active', () => {
    render(
      <AutoSaveProvider
        isSaving={true}
        lastSaved={null}
        hasUnsavedChanges={true}
        isManualSave={true}
      >
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('shows "Saving..." when auto save is active', () => {
    render(
      <AutoSaveProvider
        isSaving={true}
        lastSaved={null}
        hasUnsavedChanges={true}
        isManualSave={false}
      >
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('shows "Unsaved changes" when not saving but has changes', () => {
    render(
      <AutoSaveProvider
        isSaving={false}
        lastSaved={null}
        hasUnsavedChanges={true}
        isManualSave={false}
      >
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('returns null when no unsaved changes and not saving', () => {
    const { container } = render(
      <AutoSaveProvider
        isSaving={false}
        lastSaved={null}
        hasUnsavedChanges={false}
        isManualSave={false}
      >
        <AutoSaveBadge />
      </AutoSaveProvider>
    )

    expect(container.firstChild).toBeNull()
  })
})