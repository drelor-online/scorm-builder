import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../test/testProviders'
import { ProjectLoadingDialog } from '../ProjectLoadingDialog'

describe('ProjectLoadingDialog - Progress Tracking', () => {
  it('should display detailed progress messages for each phase', () => {
    const { rerender } = render(
      <ProjectLoadingDialog
        isOpen={true}
        progress={{
          phase: 'loading',
          percent: 10,
          message: 'Opening project file...'
        }}
      />
    )

    // Check loading phase
    expect(screen.getByText('Loading project file...')).toBeInTheDocument()
    expect(screen.getByText('Opening project file...')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()

    // Update to media phase
    rerender(
      <ProjectLoadingDialog
        isOpen={true}
        progress={{
          phase: 'media',
          percent: 40,
          message: 'Loading audio files...',
          itemsLoaded: 5,
          totalItems: 25
        }}
      />
    )

    expect(screen.getByText('Loading media files...')).toBeInTheDocument()
    expect(screen.getByText('Loading audio files...')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('5 of 25 items loaded')).toBeInTheDocument()

    // Update to content phase
    rerender(
      <ProjectLoadingDialog
        isOpen={true}
        progress={{
          phase: 'content',
          percent: 70,
          message: 'Parsing course structure...'
        }}
      />
    )

    expect(screen.getByText('Loading course content...')).toBeInTheDocument()
    expect(screen.getByText('Parsing course structure...')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()

    // Update to finalizing phase
    rerender(
      <ProjectLoadingDialog
        isOpen={true}
        progress={{
          phase: 'finalizing',
          percent: 95,
          message: 'Setting up workspace...'
        }}
      />
    )

    expect(screen.getByText('Finalizing project...')).toBeInTheDocument()
    expect(screen.getByText('Setting up workspace...')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
  })

  it('should handle media loading with specific file types', () => {
    render(
      <ProjectLoadingDialog
        isOpen={true}
        progress={{
          phase: 'media',
          percent: 60,
          message: 'Loading image files (12/15)...',
          itemsLoaded: 12,
          totalItems: 15
        }}
      />
    )

    expect(screen.getByText('Loading media files...')).toBeInTheDocument()
    expect(screen.getByText('Loading image files (12/15)...')).toBeInTheDocument()
    expect(screen.getByText('12 of 15 items loaded')).toBeInTheDocument()
  })
})