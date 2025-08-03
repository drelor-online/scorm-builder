import { render, screen } from '../../test/testProviders'
import { describe, it, expect } from 'vitest'
import { AutoSaveIndicator } from '../AutoSaveIndicator'

describe('AutoSaveIndicator', () => {
  it('should render saving state', () => {
    render(
      <AutoSaveIndicator
        isSaving={true}
        hasDraft={false}
        timeSinceLastSave="Never"
      />
    )

    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Auto-save status')
  })

  it('should render saved state with time', () => {
    render(
      <AutoSaveIndicator
        isSaving={false}
        hasDraft={true}
        timeSinceLastSave="2 minutes ago"
      />
    )

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('• Last saved 2 minutes ago')).toBeInTheDocument()
  })

  it('should render saved state without time when Never', () => {
    render(
      <AutoSaveIndicator
        isSaving={false}
        hasDraft={true}
        timeSinceLastSave="Never"
      />
    )

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.queryByText(/Last saved/)).not.toBeInTheDocument()
  })

  it('should render no draft state', () => {
    render(
      <AutoSaveIndicator
        isSaving={false}
        hasDraft={false}
        timeSinceLastSave="Never"
      />
    )

    expect(screen.getByText('No draft')).toBeInTheDocument()
  })

  it('should have proper ARIA attributes', () => {
    render(
      <AutoSaveIndicator
        isSaving={true}
        hasDraft={false}
        timeSinceLastSave="Never"
      />
    )

    const indicator = screen.getByRole('status')
    expect(indicator).toHaveAttribute('aria-label', 'Auto-save status')
  })

  it('should show yellow dot when saving', () => {
    render(
      <AutoSaveIndicator
        isSaving={true}
        hasDraft={false}
        timeSinceLastSave="Never"
      />
    )

    const dot = screen.getByText('Saving...').previousElementSibling
    expect(dot).toHaveStyle('background-color: rgb(251, 191, 36)')
  })

  it('should show green dot when saved', () => {
    render(
      <AutoSaveIndicator
        isSaving={false}
        hasDraft={true}
        timeSinceLastSave="1 minute ago"
      />
    )

    const dot = screen.getByText('Saved').previousElementSibling
    expect(dot).toHaveStyle('background-color: rgb(34, 197, 94)')
  })
})