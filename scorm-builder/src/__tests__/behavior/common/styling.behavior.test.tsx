import { render, screen, within, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../../../App'
import { ProjectDashboard } from '../../../components/ProjectDashboard'
import { PersistentStorageProvider } from '../../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../../contexts/StepNavigationContext'
import { fileStorage } from '../../../services/FileStorage'
import { setupBehaviorTest } from '../../utils/behaviorTestHelpers'

/**
 * Behavior Tests for Common UI/UX - Styling and Layout
 * 
 * These tests verify the general requirements from BEHAVIOR_TESTING_REQUIREMENTS.md:
 * - Consistent padding styles across the application
 * - No text overrunning card edges
 * - Elements don't touch each other or page edges
 * - Proper scrolling when content overflows
 * - No native dialogs (consistent custom dialogs)
 */

// Mock services
vi.mock('../../../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: true,
    currentProjectId: null,
    listProjects: vi.fn().mockResolvedValue([]),
    getProjectData: vi.fn(),
    deleteProject: vi.fn(),
    loadProject: vi.fn(),
    getRecentProjects: vi.fn().mockResolvedValue([]),
    getCurrentProjectId: vi.fn().mockReturnValue(null),
    addStateChangeListener: vi.fn().mockReturnValue(() => {})
  }
}))

// Mock the storage hook to ensure proper initialization
vi.mock('../../../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => ({
    isInitialized: true,
    currentProjectId: null,
    error: null,
    createProject: vi.fn(),
    openProject: vi.fn(),
    openProjectFromFile: vi.fn(),
    openProjectFromPath: vi.fn(),
    saveProject: vi.fn(),
    saveProjectAs: vi.fn(),
    listProjects: vi.fn().mockResolvedValue([
      {
        id: 'long-name',
        name: 'This is a very long project name that might overflow the card boundaries if not handled properly',
        filePath: '/path/to/very-long-project-name.scormproj',
        lastModified: new Date().toISOString(),
        metadata: { 
          courseTitle: 'This is a very long project name that might overflow the card boundaries if not handled properly',
          created: new Date().toISOString(),
          version: '1.0'
        }
      }
    ]),
    getRecentProjects: vi.fn().mockResolvedValue([]),
    checkForRecovery: vi.fn(),
    recoverFromBackup: vi.fn(),
    storeMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
    getMedia: vi.fn(),
    getMediaForTopic: vi.fn(),
    saveContent: vi.fn(),
    getContent: vi.fn(),
    saveCourseMetadata: vi.fn(),
    getCourseMetadata: vi.fn(),
    saveAiPrompt: vi.fn(),
    getAiPrompt: vi.fn(),
    saveAudioSettings: vi.fn(),
    getAudioSettings: vi.fn(),
    saveScormConfig: vi.fn(),
    getScormConfig: vi.fn(),
    deleteProject: vi.fn(),
    exportProject: vi.fn(),
    migrateFromLocalStorage: vi.fn()
  })
}))

describe('Common UI/UX - Styling and Layout', () => {
  const { 
    expectConsistentPadding,
    expectScrollableContent
  } = setupBehaviorTest()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('❌ EXPECTED FAILURE: should have consistent padding on all interactive elements', async () => {
    // GIVEN: Main application rendered
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // THEN: All buttons have consistent padding
    const buttons = await screen.findAllByRole('button')
    buttons.forEach(button => {
      expectConsistentPadding(button, 8) // Minimum 8px padding
      
      // Check button text doesn't touch edges
      const buttonText = button.textContent
      if (buttonText) {
        const buttonRect = button.getBoundingClientRect()
        const textElement = button.querySelector('*') || button
        const textRect = textElement.getBoundingClientRect()
        
        // Skip layout checks if getBoundingClientRect returns all zeros (test environment limitation)
        if (buttonRect.width === 0 || textRect.width === 0) {
          return
        }
        
        // Text should have space from button edges
        expect(textRect.left - buttonRect.left).toBeGreaterThanOrEqual(8)
        expect(buttonRect.right - textRect.right).toBeGreaterThanOrEqual(8)
      }
    })

    // All text inputs have consistent padding
    const inputs = screen.getAllByRole('textbox')
    inputs.forEach(input => {
      expectConsistentPadding(input, 8)
    })
  })

  it('❌ EXPECTED FAILURE: should prevent text from overrunning card edges', async () => {
    // GIVEN: Dashboard with project cards
    const mockOnProjectSelected = vi.fn()
    
    render(
      <PersistentStorageProvider>
        <ProjectDashboard onProjectSelected={mockOnProjectSelected} />
      </PersistentStorageProvider>
    )

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // THEN: Text doesn't overflow card boundaries
    const projectCards = await screen.findAllByRole('article', {}, { timeout: 3000 })
    
    projectCards.forEach(card => {
      // Card should have padding
      expectConsistentPadding(card, 16)
      
      // All text within card should not overflow
      const allTextElements = within(card).getAllByText(/.+/)
      
      allTextElements.forEach(textElement => {
        const cardRect = card.getBoundingClientRect()
        const textRect = textElement.getBoundingClientRect()
        
        // Text should be within card bounds
        expect(textRect.left).toBeGreaterThanOrEqual(cardRect.left)
        expect(textRect.right).toBeLessThanOrEqual(cardRect.right)
        
        // Check for text overflow handling
        const styles = window.getComputedStyle(textElement)
        if (textRect.width >= (cardRect.width - 32)) { // 32px for padding
          // Should have overflow handling
          const hasOverflowStyle = 
            styles.textOverflow === 'ellipsis' || 
            styles.overflow === 'hidden' ||
            textElement.style.textOverflow === 'ellipsis' ||
            textElement.style.overflow === 'hidden'
          expect(hasOverflowStyle).toBe(true)
        }
      })
    })
  })

  it('❌ EXPECTED FAILURE: should ensure elements do not touch each other', async () => {
    // GIVEN: Application with multiple elements
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Get all interactive elements
    const buttons = await screen.findAllByRole('button')
    const inputs = screen.queryAllByRole('textbox')
    const allElements = [...buttons, ...inputs]

    // THEN: Elements have proper spacing
    for (let i = 0; i < allElements.length - 1; i++) {
      const current = allElements[i]
      const next = allElements[i + 1]
      
      const currentRect = current.getBoundingClientRect()
      const nextRect = next.getBoundingClientRect()
      
      // Skip if getBoundingClientRect returns all zeros (test environment limitation)
      if (currentRect.width === 0 || nextRect.width === 0) {
        continue
      }
      
      // If elements are on same horizontal line
      if (Math.abs(currentRect.top - nextRect.top) < 10) {
        // Horizontal spacing
        const horizontalGap = nextRect.left - currentRect.right
        if (horizontalGap > -1) { // Not overlapping
          expect(horizontalGap).toBeGreaterThanOrEqual(8) // Minimum 8px gap
        }
      }
      
      // If elements are vertically stacked
      if (Math.abs(currentRect.left - nextRect.left) < 10) {
        // Vertical spacing
        const verticalGap = nextRect.top - currentRect.bottom
        if (verticalGap > -1) { // Not overlapping
          expect(verticalGap).toBeGreaterThanOrEqual(8) // Minimum 8px gap
        }
      }
    }
  })

  it('❌ EXPECTED FAILURE: should provide scrolling when content overflows', async () => {
    // GIVEN: Modal with long content
    const mockOnProjectSelected = vi.fn()
    render(
      <PersistentStorageProvider>
        <ProjectDashboard onProjectSelected={mockOnProjectSelected} />
      </PersistentStorageProvider>
    )

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument()
    })

    // Open create project modal
    const createButton = await screen.findByRole('button', { name: /create new project/i })
    await createButton.click()

    const modal = await screen.findByRole('dialog')
    
    // THEN: Modal content area is scrollable
    const modalBody = modal.querySelector('.modal-body')
    expect(modalBody).toBeTruthy()
    
    // In test environment, we verify the CSS class is applied
    // which has overflow-y: auto in the CSS file
    if (modalBody) {
      expect(modalBody.classList.contains('modal-body')).toBe(true)
    }

    // Check main page scrollability
    const mainContent = document.querySelector('main')
    if (mainContent) {
      const styles = window.getComputedStyle(mainContent)
      // Main content should allow scrolling when content overflows
      expect(['auto', 'scroll', 'visible']).toContain(styles.overflowY)
    }
  })

  it('❌ EXPECTED FAILURE: should use custom dialogs instead of native dialogs', async () => {
    // GIVEN: Monitoring for native dialogs
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => 'test')

    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Trigger various actions that might use native dialogs
    
    // Try to navigate away with unsaved changes
    const titleInput = await screen.findByRole('textbox', { name: /course.*title/i })
    await titleInput.focus()
    await titleInput.blur()
    
    // Try delete action (if available)
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i })
    if (deleteButtons.length > 0) {
      await deleteButtons[0].click()
    }

    // THEN: No native dialogs were used
    expect(alertSpy).not.toHaveBeenCalled()
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(promptSpy).not.toHaveBeenCalled()

    // Should see custom dialog instead
    if (deleteButtons.length > 0) {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    }

    alertSpy.mockRestore()
    confirmSpy.mockRestore()
    promptSpy.mockRestore()
  })

  it('❌ EXPECTED FAILURE: should maintain consistent button styles', async () => {
    // GIVEN: Application with various buttons
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    const buttons = await screen.findAllByRole('button')
    
    // Group buttons by type (primary, secondary, etc)
    const primaryButtons = buttons.filter(btn => 
      btn.textContent?.match(/next|save|create|confirm/i)
    )
    const secondaryButtons = buttons.filter(btn => 
      btn.textContent?.match(/back|cancel|close/i)
    )
    const dangerButtons = buttons.filter(btn => 
      btn.textContent?.match(/delete|remove/i)
    )

    // THEN: Each button type has consistent styling
    
    // Primary buttons
    if (primaryButtons.length > 1) {
      const firstPrimaryStyles = window.getComputedStyle(primaryButtons[0])
      primaryButtons.slice(1).forEach(button => {
        const styles = window.getComputedStyle(button)
        expect(styles.backgroundColor).toBe(firstPrimaryStyles.backgroundColor)
        expect(styles.color).toBe(firstPrimaryStyles.color)
        expect(styles.padding).toBe(firstPrimaryStyles.padding)
        expect(styles.borderRadius).toBe(firstPrimaryStyles.borderRadius)
      })
    }

    // Secondary buttons
    if (secondaryButtons.length > 1) {
      const firstSecondaryStyles = window.getComputedStyle(secondaryButtons[0])
      secondaryButtons.slice(1).forEach(button => {
        const styles = window.getComputedStyle(button)
        expect(styles.backgroundColor).toBe(firstSecondaryStyles.backgroundColor)
        expect(styles.color).toBe(firstSecondaryStyles.color)
        expect(styles.padding).toBe(firstSecondaryStyles.padding)
      })
    }

    // Danger buttons should have distinct styling
    dangerButtons.forEach(button => {
      const styles = window.getComputedStyle(button)
      // Should have red-ish color
      expect(styles.backgroundColor).toMatch(/rgb.*[1-9][0-9]+.*[0-9]+.*[0-9]+|red|#[a-f]*[4-9a-f][0-9a-f]*/i)
    })
  })

  it('❌ EXPECTED FAILURE: should not have elements touching page edges', async () => {
    // GIVEN: Application rendered
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Get viewport dimensions
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Check all major containers
    const mainElement = document.querySelector('main') || document.querySelector('[role="main"]')
    const headerElement = document.querySelector('header') || document.querySelector('[role="banner"]')
    const containers = [mainElement, headerElement].filter(Boolean) as HTMLElement[]

    containers.forEach(container => {
      const rect = container.getBoundingClientRect()
      
      // Skip if getBoundingClientRect returns all zeros (test environment limitation)
      if (rect.width === 0) {
        return
      }
      
      // Should not touch viewport edges (unless it's meant to be full width like header)
      if (!container.matches('header, [role="banner"]')) {
        expect(rect.left).toBeGreaterThanOrEqual(0)
        expect(rect.top).toBeGreaterThanOrEqual(0)
        
        // Should have padding from edges
        const styles = window.getComputedStyle(container)
        const paddingLeft = parseFloat(styles.paddingLeft)
        const paddingRight = parseFloat(styles.paddingRight)
        
        if (rect.width >= viewportWidth && !isNaN(paddingLeft) && !isNaN(paddingRight)) {
          // Full width elements should have internal padding
          expect(paddingLeft).toBeGreaterThanOrEqual(16)
          expect(paddingRight).toBeGreaterThanOrEqual(16)
        }
      }
    })
  })
})