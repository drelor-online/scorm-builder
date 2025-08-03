import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import '@testing-library/jest-dom'
import { ProjectLoadingDialog } from '../ProjectLoadingDialog'
import { describe, it, expect } from 'vitest'

describe('ProjectLoadingDialog - Media Loading Progress', () => {
  it('should display detailed progress during media loading phase', () => {
    const progress = {
      phase: 'media' as const,
      percent: 60,
      message: 'Loading media file 12 of 20...',
      itemsLoaded: 12,
      totalItems: 20
    }
    
    render(<ProjectLoadingDialog isOpen={true} progress={progress} />)
    
    // Check phase message
    expect(screen.getByText('Loading Media')).toBeInTheDocument()
    
    // Check detailed message
    expect(screen.getByText('Loading media file 12 of 20...')).toBeInTheDocument()
    
    // Check progress bar
    expect(screen.getByText('60%')).toBeInTheDocument()
    
    // Check items loaded indicator
    expect(screen.getByText('12 of 20 items loaded')).toBeInTheDocument()
  })
  
  it('should show phase indicator dots correctly', () => {
    const phases = ['loading', 'media', 'content', 'finalizing'] as const
    
    phases.forEach((currentPhase, index) => {
      const { container } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{
            phase: currentPhase,
            percent: index * 25,
            message: `${currentPhase} phase`
          }} 
        />
      )
      
      // Check that dots are rendered
      const dots = container.querySelectorAll('[style*="border-radius: 50%"]')
      expect(dots).toHaveLength(4)
      
      // Current phase should be blue
      const currentDot = dots[index]
      expect(currentDot).toHaveStyle({ backgroundColor: '#3b82f6' })
      
      // Completed phases should be green
      for (let i = 0; i < index; i++) {
        expect(dots[i]).toHaveStyle({ backgroundColor: '#22c55e' })
      }
      
      // Future phases should be gray
      for (let i = index + 1; i < 4; i++) {
        expect(dots[i]).toHaveStyle({ backgroundColor: '#374151' })
      }
    })
  })
  
  it('should update smoothly as media loads', async () => {
    const { rerender } = render(
      <ProjectLoadingDialog 
        isOpen={true} 
        progress={{
          phase: 'media',
          percent: 0,
          message: 'Starting media load...',
          itemsLoaded: 0,
          totalItems: 10
        }} 
      />
    )
    
    // Initial state
    expect(screen.getByText('0 of 10 items loaded')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    
    // Update progress
    for (let i = 1; i <= 10; i++) {
      rerender(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{
            phase: 'media',
            percent: i * 10,
            message: `Loading media file ${i} of 10...`,
            itemsLoaded: i,
            totalItems: 10
          }} 
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText(`${i} of 10 items loaded`)).toBeInTheDocument()
        expect(screen.getByText(`${i * 10}%`)).toBeInTheDocument()
      })
    }
  })
  
  it('should transition to finalizing phase', () => {
    render(
      <ProjectLoadingDialog 
        isOpen={true} 
        progress={{
          phase: 'finalizing',
          percent: 95,
          message: 'Almost ready...'
        }} 
      />
    )
    
    expect(screen.getByText('Almost Ready')).toBeInTheDocument()
    expect(screen.getByText('Almost ready...')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
    
    // Items loaded should not be shown in finalizing phase
    expect(screen.queryByText(/items loaded/)).not.toBeInTheDocument()
  })
  
  it('should display different messages for each phase', () => {
    const phaseMessages = {
      loading: 'Opening Project',
      media: 'Loading Media', 
      content: 'Loading Content',
      finalizing: 'Almost Ready'
    }
    
    Object.entries(phaseMessages).forEach(([phase, expectedMessage]) => {
      const { container, unmount } = render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{
            phase: phase as any,
            percent: 50,
            message: 'Test message'
          }} 
        />
      )
      
      // Look for the h3 element specifically to avoid duplicate modal title
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent(expectedMessage)
      
      // Clean up before next iteration
      unmount()
    })
  })
})