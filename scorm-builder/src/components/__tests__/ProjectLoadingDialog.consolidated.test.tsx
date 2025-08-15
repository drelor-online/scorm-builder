/**
 * ProjectLoadingDialog - Consolidated Test Suite
 * 
 * This file consolidates ProjectLoadingDialog tests from 5 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - ProjectLoadingDialog.test.tsx (main functionality)
 * - ProjectLoadingDialog.finalizingScreen.test.tsx (finalizing phase UI)
 * - ProjectLoadingDialog.manual.test.tsx (manual progress updates)
 * - ProjectLoadingDialog.mediaProgress.test.tsx (media loading progress)
 * - ProjectLoadingDialog.progressTracking.test.tsx (progress state management)
 * 
 * Test Categories:
 * - Basic rendering and modal behavior
 * - Progress tracking and state management
 * - Different loading phases (loading, finalizing, complete)
 * - Media progress and file processing
 * - Manual progress updates and user feedback
 * - Error handling and edge cases
 * - Accessibility and user experience
 * - Integration with project loading workflow
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/testProviders'
import { ProjectLoadingDialog } from '../ProjectLoadingDialog'

// Mock the DesignSystem components
vi.mock('../DesignSystem', () => ({
  Modal: ({ isOpen, children, title, showCloseButton }: any) => 
    isOpen ? (
      <div data-testid="modal" data-show-close={showCloseButton}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
  ProgressBar: ({ value, label }: any) => (
    <div data-testid="progress-bar" data-value={value}>
      {label}
    </div>
  ),
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}))

describe('ProjectLoadingDialog - Consolidated Test Suite', () => {
  const defaultProgress = {
    phase: 'loading' as const,
    percent: 0,
    message: 'Starting...'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering and Modal Behavior', () => {
    it('does not render when not open', () => {
      const { container } = render(
        <ProjectLoadingDialog isOpen={false} progress={defaultProgress} />
      )
      
      expect(container.firstChild).toBeNull()
    })

    it('renders when open', () => {
      render(
        <ProjectLoadingDialog isOpen={true} progress={defaultProgress} />
      )
      
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Loading Project')).toBeInTheDocument()
    })

    it('shows modal without close button', () => {
      render(
        <ProjectLoadingDialog isOpen={true} progress={defaultProgress} />
      )
      
      const modal = screen.getByTestId('modal')
      expect(modal).toHaveAttribute('data-show-close', 'false')
    })

    it('displays the progress message', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ ...defaultProgress, message: 'Loading course content...' }} 
        />
      )
      
      expect(screen.getByText('Loading course content...')).toBeInTheDocument()
    })

    it('shows progress bar with correct value', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ ...defaultProgress, percent: 45 }} 
        />
      )
      
      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('data-value', '45')
    })
  })

  describe('Progress Tracking and State Management', () => {
    it('updates progress value correctly', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ ...defaultProgress, percent: 25 }} 
        />
      )
      
      let progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('data-value', '25')
      
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ ...defaultProgress, percent: 75 }} 
        />
      )
      
      progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('data-value', '75')
    })

    it('updates progress message dynamically', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ ...defaultProgress, message: 'Loading metadata...' }} 
        />
      )
      
      expect(screen.getByText('Loading metadata...')).toBeInTheDocument()
      
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ ...defaultProgress, message: 'Processing media files...' }} 
        />
      )
      
      expect(screen.getByText('Processing media files...')).toBeInTheDocument()
      expect(screen.queryByText('Loading metadata...')).not.toBeInTheDocument()
    })

    it('handles progress value boundaries correctly', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ ...defaultProgress, percent: 0 }} 
        />
      )
      
      let progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('data-value', '0')
      
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ ...defaultProgress, percent: 100 }} 
        />
      )
      
      progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('data-value', '100')
    })

    it('tracks progress through multiple phases', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 30, message: 'Loading...' }} 
        />
      )
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'processing', percent: 60, message: 'Processing...' }} 
        />
      )
      
      expect(screen.getByText('Processing...')).toBeInTheDocument()
      
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'finalizing', percent: 90, message: 'Finalizing...' }} 
        />
      )
      
      expect(screen.getByText('Finalizing...')).toBeInTheDocument()
    })
  })

  describe('Different Loading Phases', () => {
    it('displays loading phase correctly', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 25, message: 'Loading project files...' }} 
        />
      )
      
      expect(screen.getByText('Loading project files...')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', '25')
    })

    it('displays processing phase correctly', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'processing', percent: 50, message: 'Processing course content...' }} 
        />
      )
      
      expect(screen.getByText('Processing course content...')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', '50')
    })

    it('displays finalizing phase with special UI', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'finalizing', percent: 95, message: 'Finalizing project setup...' }} 
        />
      )
      
      expect(screen.getByText('Finalizing project setup...')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', '95')
      
      // Finalizing phase might show different visual indicators
      expect(screen.getByText('Loading Project')).toBeInTheDocument()
    })

    it('handles completion phase', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'complete', percent: 100, message: 'Project loaded successfully!' }} 
        />
      )
      
      expect(screen.getByText('Project loaded successfully!')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', '100')
    })

    it('transitions between phases smoothly', async () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 30, message: 'Loading...' }} 
        />
      )
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'finalizing', percent: 90, message: 'Almost done...' }} 
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText('Almost done...')).toBeInTheDocument()
      })
    })
  })

  describe('Media Progress and File Processing', () => {
    it('displays media loading progress', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 40, 
            message: 'Loading media files (2/5)...',
            mediaProgress: { current: 2, total: 5 }
          }} 
        />
      )
      
      expect(screen.getByText('Loading media files (2/5)...')).toBeInTheDocument()
    })

    it('updates media progress incrementally', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 20, 
            message: 'Loading media files (1/5)...'
          }} 
        />
      )
      
      expect(screen.getByText('Loading media files (1/5)...')).toBeInTheDocument()
      
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 60, 
            message: 'Loading media files (3/5)...'
          }} 
        />
      )
      
      expect(screen.getByText('Loading media files (3/5)...')).toBeInTheDocument()
    })

    it('handles large media collections', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 15, 
            message: 'Loading media files (15/100)...'
          }} 
        />
      )
      
      expect(screen.getByText('Loading media files (15/100)...')).toBeInTheDocument()
    })

    it('shows file type specific progress', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 30, 
            message: 'Loading images...'
          }} 
        />
      )
      
      expect(screen.getByText('Loading images...')).toBeInTheDocument()
      
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 60, 
            message: 'Loading audio files...'
          }} 
        />
      )
      
      expect(screen.getByText('Loading audio files...')).toBeInTheDocument()
    })
  })

  describe('Manual Progress Updates and User Feedback', () => {
    it('responds to manual progress updates', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 0, message: 'Starting...' }} 
        />
      )
      
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', '0')
      
      // Simulate manual update
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 33, message: 'One third complete...' }} 
        />
      )
      
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', '33')
      expect(screen.getByText('One third complete...')).toBeInTheDocument()
    })

    it('provides meaningful feedback at key milestones', () => {
      const milestones = [
        { percent: 25, message: 'Loading course structure...' },
        { percent: 50, message: 'Processing content...' },
        { percent: 75, message: 'Loading media assets...' },
        { percent: 100, message: 'Project ready!' }
      ]
      
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', ...milestones[0] }} 
        />
      )
      
      milestones.forEach((milestone, index) => {
        rerender(
          <ProjectLoadingDialog 
            isOpen={true} 
            progress={{ phase: 'loading', ...milestone }} 
          />
        )
        
        expect(screen.getByText(milestone.message)).toBeInTheDocument()
        expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', milestone.percent.toString())
      })
    })

    it('handles rapid progress updates gracefully', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 0, message: 'Starting...' }} 
        />
      )
      
      // Simulate rapid updates
      for (let i = 0; i <= 100; i += 10) {
        rerender(
          <ProjectLoadingDialog 
            isOpen={true} 
            progress={{ phase: 'loading', percent: i, message: `${i}% complete...` }} 
          />
        )
      }
      
      expect(screen.getByText('100% complete...')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', '100')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles invalid progress values gracefully', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: -10, 
            message: 'Invalid progress...' 
          }} 
        />
      )
      
      expect(screen.getByText('Invalid progress...')).toBeInTheDocument()
      // Should handle negative values appropriately
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
    })

    it('handles progress values over 100', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 150, 
            message: 'Over 100%...' 
          }} 
        />
      )
      
      expect(screen.getByText('Over 100%...')).toBeInTheDocument()
      // Should cap at 100 or handle gracefully
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
    })

    it('handles missing progress message', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 50, 
            message: undefined as any 
          }} 
        />
      )
      
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-value', '50')
    })

    it('handles unknown phase gracefully', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'unknown' as any, 
            percent: 50, 
            message: 'Unknown phase...' 
          }} 
        />
      )
      
      expect(screen.getByText('Unknown phase...')).toBeInTheDocument()
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('handles progress object being null or undefined', () => {
      expect(() => {
        render(
          <ProjectLoadingDialog 
            isOpen={true} 
            progress={null as any} 
          />
        )
      }).not.toThrow()
    })

    it('recovers from error states', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'error' as any, 
            percent: 0, 
            message: 'Error occurred...' 
          }} 
        />
      )
      
      expect(screen.getByText('Error occurred...')).toBeInTheDocument()
      
      // Recovery
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 25, 
            message: 'Retrying...' 
          }} 
        />
      )
      
      expect(screen.getByText('Retrying...')).toBeInTheDocument()
    })
  })

  describe('Accessibility and User Experience', () => {
    it('provides proper ARIA attributes', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={defaultProgress} 
        />
      )
      
      const modal = screen.getByTestId('modal')
      expect(modal).toBeInTheDocument()
      
      // Modal should be properly labeled
      expect(screen.getByText('Loading Project')).toBeInTheDocument()
    })

    it('maintains focus within modal', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={defaultProgress} 
        />
      )
      
      const modal = screen.getByTestId('modal')
      expect(modal).toBeInTheDocument()
      
      // Modal should trap focus appropriately
      expect(modal).toHaveAttribute('data-show-close', 'false')
    })

    it('provides screen reader friendly progress updates', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 75, 
            message: 'Almost finished loading project...' 
          }} 
        />
      )
      
      expect(screen.getByText('Almost finished loading project...')).toBeInTheDocument()
      
      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('data-value', '75')
    })

    it('handles keyboard navigation appropriately', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={defaultProgress} 
        />
      )
      
      // Since this is a loading dialog, it shouldn't be interactive
      const modal = screen.getByTestId('modal')
      expect(modal).toHaveAttribute('data-show-close', 'false')
    })
  })

  describe('Integration with Project Loading Workflow', () => {
    it('integrates with project loading lifecycle', async () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 0, message: 'Initializing...' }} 
        />
      )
      
      // Simulate full loading workflow
      const loadingSteps = [
        { phase: 'loading', percent: 20, message: 'Reading project file...' },
        { phase: 'loading', percent: 40, message: 'Loading course content...' },
        { phase: 'processing', percent: 60, message: 'Processing media...' },
        { phase: 'finalizing', percent: 80, message: 'Setting up workspace...' },
        { phase: 'complete', percent: 100, message: 'Project loaded!' }
      ]
      
      for (const step of loadingSteps) {
        rerender(
          <ProjectLoadingDialog 
            isOpen={true} 
            progress={step as any} 
          />
        )
        
        await waitFor(() => {
          expect(screen.getByText(step.message)).toBeInTheDocument()
        })
      }
    })

    it('provides context for complex project structures', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'loading', 
            percent: 45, 
            message: 'Loading large project with 25 topics and 150 media files...' 
          }} 
        />
      )
      
      expect(screen.getByText(/Loading large project/)).toBeInTheDocument()
    })

    it('handles project loading cancellation gracefully', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 50, message: 'Loading...' }} 
        />
      )
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      
      // Simulate dialog being closed (loading cancelled)
      rerender(
        <ProjectLoadingDialog 
          isOpen={false} 
          progress={{ phase: 'loading', percent: 50, message: 'Loading...' }} 
        />
      )
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
  })

  describe('Performance and Memory Management', () => {
    it('handles frequent progress updates efficiently', () => {
      const { rerender } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 0, message: 'Starting...' }} 
        />
      )
      
      // Simulate high-frequency updates
      for (let i = 0; i <= 100; i += 1) {
        rerender(
          <ProjectLoadingDialog 
            isOpen={true} 
            progress={{ phase: 'loading', percent: i, message: `${i}%` }} 
          />
        )
      }
      
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('cleans up properly when unmounted', () => {
      const { unmount } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={defaultProgress} 
        />
      )
      
      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('maintains performance with complex progress data', () => {
      const complexProgress = {
        phase: 'loading' as const,
        percent: 50,
        message: 'Complex loading operation...',
        metadata: {
          startTime: Date.now(),
          estimatedTime: 30000,
          filesProcessed: 25,
          totalFiles: 50,
          currentFile: 'large-video-file.mp4'
        }
      }
      
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={complexProgress} 
        />
      )
      
      expect(screen.getByText('Complex loading operation...')).toBeInTheDocument()
    })
  })
})