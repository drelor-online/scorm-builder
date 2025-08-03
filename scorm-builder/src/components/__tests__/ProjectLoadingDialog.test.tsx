// Removed unused React import
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/testProviders'
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
  )
}))

describe('ProjectLoadingDialog', () => {
  const defaultProgress = {
    phase: 'loading' as const,
    percent: 0,
    message: 'Starting...'
  }

  it('should not render when not open', () => {
    render(
      <ProjectLoadingDialog isOpen={false} progress={defaultProgress} />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('should render when open', () => {
    render(
      <ProjectLoadingDialog isOpen={true} progress={defaultProgress} />
    )
    
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByText('Opening Project')).toBeInTheDocument()
  })

  it('should not show close button', () => {
    render(
      <ProjectLoadingDialog isOpen={true} progress={defaultProgress} />
    )
    
    const modal = screen.getByTestId('modal')
    expect(modal).toHaveAttribute('data-show-close', 'false')
  })

  describe('Phase messages', () => {
    it('should show loading phase message', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 25, message: 'Test' }} 
        />
      )
      
      expect(screen.getByText('Loading project file...')).toBeInTheDocument()
    })

    it('should show media phase message', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'media', percent: 50, message: 'Test' }} 
        />
      )
      
      expect(screen.getByText('Loading media files...')).toBeInTheDocument()
    })

    it('should show content phase message', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'content', percent: 75, message: 'Test' }} 
        />
      )
      
      expect(screen.getByText('Loading course content...')).toBeInTheDocument()
    })

    it('should show finalizing phase message', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'finalizing', percent: 90, message: 'Test' }} 
        />
      )
      
      expect(screen.getByText('Finalizing project...')).toBeInTheDocument()
    })

    it('should show default message for unknown phase', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'unknown' as any, percent: 50, message: 'Test' }} 
        />
      )
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Progress display', () => {
    it('should show progress message', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 30, message: 'Loading configuration...' }} 
        />
      )
      
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument()
    })

    it('should not show message paragraph when message is empty', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 30, message: '' }} 
        />
      )
      
      const messageElements = screen.queryAllByText('')
      const messageParagraph = messageElements.find(el => 
        el.tagName === 'P' && el.style.fontSize === '0.875rem'
      )
      expect(messageParagraph).toBeUndefined()
    })

    it('should show progress bar with correct value', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 65, message: 'Test' }} 
        />
      )
      
      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('data-value', '65')
      expect(screen.getByText('65%')).toBeInTheDocument()
    })

    it('should show items loaded when provided', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'media', 
            percent: 40, 
            message: 'Loading images...', 
            itemsLoaded: 8, 
            totalItems: 20 
          }} 
        />
      )
      
      expect(screen.getByText('8 of 20 items loaded')).toBeInTheDocument()
    })

    it('should not show items loaded when not provided', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'media', percent: 40, message: 'Loading...' }} 
        />
      )
      
      expect(screen.queryByText(/items loaded/)).not.toBeInTheDocument()
    })

    it('should not show items loaded when only itemsLoaded is provided', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'media', 
            percent: 40, 
            message: 'Loading...', 
            itemsLoaded: 5 
          }} 
        />
      )
      
      expect(screen.queryByText(/items loaded/)).not.toBeInTheDocument()
    })

    it('should not show items loaded when only totalItems is provided', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'media', 
            percent: 40, 
            message: 'Loading...', 
            totalItems: 10 
          }} 
        />
      )
      
      expect(screen.queryByText(/items loaded/)).not.toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('should apply correct styles to container', () => {
      render(
        <ProjectLoadingDialog isOpen={true} progress={defaultProgress} />
      )
      
      const container = screen.getByTestId('modal').querySelector('div')
      expect(container).toHaveStyle({ padding: '1.5rem' })
    })

    it('should apply correct styles to phase heading', () => {
      render(
        <ProjectLoadingDialog isOpen={true} progress={defaultProgress} />
      )
      
      const heading = screen.getByText('Loading project file...')
      expect(heading.tagName).toBe('H3')
      expect(heading).toHaveStyle({ 
        fontSize: '1.125rem',
        marginBottom: '0.5rem' 
      })
    })

    it('should apply correct styles to progress message', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ phase: 'loading', percent: 30, message: 'Test message' }} 
        />
      )
      
      const message = screen.getByText('Test message')
      expect(message).toHaveStyle({ 
        fontSize: '0.875rem',
        color: '#64748b',
        marginBottom: '1rem'
      })
    })

    it('should apply correct styles to items loaded text', () => {
      render(
        <ProjectLoadingDialog 
          isOpen={true} 
          progress={{ 
            phase: 'media', 
            percent: 40, 
            message: 'Loading...', 
            itemsLoaded: 5,
            totalItems: 10
          }} 
        />
      )
      
      const itemsText = screen.getByText('5 of 10 items loaded')
      expect(itemsText).toHaveStyle({ 
        fontSize: '0.75rem',
        color: '#94a3b8',
        textAlign: 'center'
      })
    })
  })
})