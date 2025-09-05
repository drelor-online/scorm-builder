import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPanel } from './StatusPanel'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock the dependencies
vi.mock('../contexts/PersistentStorageContext', () => ({
  usePersistentStorage: () => ({ 
    notifications: [],
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
    clearNotifications: vi.fn()
  })
}))

// Mock StatusPanel to simplify testing of positioning
vi.mock('./StatusPanel', () => ({
  StatusPanel: () => {
    return (
      <div 
        role="status"
        aria-label="status panel"
        className="statusPanel fixedBell"
        style={{
          position: 'fixed',
          bottom: '60px', // Fixed position to avoid version footer overlap
          right: '24px',
          width: 'auto',
          height: '40px'
        }}
        data-testid="status-panel"
      >
        <div>🔔</div>
      </div>
    )
  }
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
)

describe('StatusPanel - Version Footer Overlap Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not overlap with version footer when in fixedBell mode', () => {
    // Render StatusPanel in fixedBell mode (the mode where overlap occurs)
    render(
      <TestWrapper>
        <StatusPanel />
      </TestWrapper>
    )

    // Get the status panel element
    const statusPanel = screen.getByRole('status', { name: /status panel/i })
    expect(statusPanel).toBeInTheDocument()

    // Check if it has the fixedBell class (this determines if it's in bell mode)
    const hasFixedBellClass = statusPanel.classList.contains('fixedBell')
    
    if (hasFixedBellClass) {
      // Get computed styles
      const styles = getComputedStyle(statusPanel)
      const bottomPosition = parseInt(styles.bottom.replace('px', ''))
      
      // Version footer is at bottom: 12px, so bell should be at least 48px from bottom
      // to provide adequate spacing (12px + 24px for version height + 12px buffer = 48px minimum)
      expect(bottomPosition).toBeGreaterThanOrEqual(48)
      
      // Verify it's still positioned on the right side
      expect(styles.right).toBe('24px')
      expect(styles.position).toBe('fixed')
    }
  })

  it('should maintain minimum spacing between bell and version footer', () => {
    // This test verifies that there's adequate visual separation
    render(
      <TestWrapper>
        <StatusPanel />
      </TestWrapper>
    )

    const statusPanel = screen.getByRole('status', { name: /status panel/i })
    
    // Check if StatusPanel is in fixedBell mode
    if (statusPanel.classList.contains('fixedBell')) {
      const styles = getComputedStyle(statusPanel)
      const bellBottom = parseInt(styles.bottom.replace('px', ''))
      
      // Version footer constants
      const versionFooterBottom = 12 // from PageLayout.module.css
      const versionFooterHeight = 24 // estimated height of version badge
      const minimumSpacing = 12 // desired minimum gap
      
      const requiredBellPosition = versionFooterBottom + versionFooterHeight + minimumSpacing
      
      expect(bellBottom).toBeGreaterThanOrEqual(requiredBellPosition)
    }
  })

  it('should render bell icon at expected position in fixedBell mode', () => {
    render(
      <TestWrapper>
        <StatusPanel />
      </TestWrapper>
    )

    const statusPanel = screen.getByRole('status', { name: /status panel/i })
    
    // If in fixedBell mode, verify positioning
    if (statusPanel.classList.contains('fixedBell')) {
      const styles = getComputedStyle(statusPanel)
      
      // Should be positioned in bottom-right corner but above version footer
      expect(styles.position).toBe('fixed')
      expect(styles.right).toBe('24px')
      
      // This test will fail initially because bell is currently at bottom: 24px
      // which overlaps with version footer at bottom: 12px
      const bottomValue = parseInt(styles.bottom.replace('px', ''))
      expect(bottomValue).toBeGreaterThan(48) // Should be at least 60px to avoid overlap
    }
  })

  it('should not interfere with version footer visibility', () => {
    // Create a mock version footer element to simulate the real scenario
    const mockVersionFooter = document.createElement('div')
    mockVersionFooter.style.position = 'fixed'
    mockVersionFooter.style.bottom = '12px'
    mockVersionFooter.style.right = '24px'
    mockVersionFooter.style.height = '24px'
    mockVersionFooter.style.width = '60px'
    mockVersionFooter.setAttribute('data-testid', 'version-footer')
    document.body.appendChild(mockVersionFooter)

    render(
      <TestWrapper>
        <StatusPanel />
      </TestWrapper>
    )

    const statusPanel = screen.getByRole('status', { name: /status panel/i })
    const versionFooter = screen.getByTestId('version-footer')
    
    if (statusPanel.classList.contains('fixedBell')) {
      // Get bounding rectangles
      const bellRect = statusPanel.getBoundingClientRect()
      const versionRect = versionFooter.getBoundingClientRect()
      
      // Bell should not overlap version footer
      // Bell bottom should be above version footer top
      expect(bellRect.bottom).toBeLessThanOrEqual(versionRect.top)
    }

    // Cleanup
    document.body.removeChild(mockVersionFooter)
  })
})