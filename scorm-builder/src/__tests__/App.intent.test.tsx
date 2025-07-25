import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

// Mock lazy loaded components to avoid async loading issues
vi.mock('../components/MediaEnhancementWizardRefactored', () => ({
  MediaEnhancementWizard: () => <div>Media Enhancement Wizard</div>
}))

vi.mock('../components/AudioNarrationWizardRefactored', () => ({
  AudioNarrationWizard: () => <div>Audio Narration Wizard</div>
}))

vi.mock('../components/ActivitiesEditorRefactored', () => ({
  ActivitiesEditor: () => <div>Activities Editor</div>
}))

vi.mock('../components/SCORMPackageBuilderRefactored', () => ({
  SCORMPackageBuilder: () => <div>SCORM Package Builder</div>
}))

vi.mock('../components/SettingsRefactored', () => ({
  Settings: ({ onSave, onClose }: any) => (
    <div>
      Settings
      <button onClick={() => {
        onSave({ googleImageApiKey: 'test', googleCseId: 'test', youtubeApiKey: 'test' })
      }}>
        Save Settings
      </button>
      <button onClick={onClose}>
        Close Settings
      </button>
    </div>
  )
}))

vi.mock('../components/HelpPageRefactored', () => ({
  HelpPage: ({ onBack }: any) => (
    <div>
      Help Page
      <button onClick={onBack}>Back</button>
    </div>
  )
}))

// OpenProjectDialog is no longer used in App.tsx

// Mock UnsavedChangesDialog
vi.mock('../components/UnsavedChangesDialog', () => ({
  UnsavedChangesDialog: ({ isOpen, currentProjectName, onSave, onDiscard, onCancel }: any) =>
    isOpen ? (
      <div>
        <div>Unsaved changes in {currentProjectName}</div>
        <button onClick={onSave}>Save Changes</button>
        <button onClick={onDiscard}>Discard Changes</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

// Mock FileStorage
vi.mock('../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: true,
    currentProjectId: null,
    createProject: vi.fn().mockResolvedValue({ id: 'test-id', name: 'Test Project', created: new Date().toISOString(), last_modified: new Date().toISOString() }),
    openProject: vi.fn().mockResolvedValue(undefined),
    saveProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    listProjects: vi.fn().mockResolvedValue([]),
    getRecentProjects: vi.fn().mockResolvedValue([]),
    getCurrentProjectId: vi.fn().mockReturnValue(null),
    clearCurrentProject: vi.fn(),
    saveContent: vi.fn().mockResolvedValue(undefined),
    getContent: vi.fn().mockResolvedValue(null),
    saveCourseMetadata: vi.fn().mockResolvedValue(undefined),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    addStateChangeListener: vi.fn().mockReturnValue(() => {})
  }
}))

describe('App - User Intent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })
  
  const renderApp = () => {
    return render(
      <PersistentStorageProvider>
        <App />
      </PersistentStorageProvider>
    )
  }

  describe('User wants to start creating a course', () => {
    it('should show course configuration page on initial load', () => {
      renderApp()
      
      expect(screen.getByRole('heading', { name: /course configuration/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
    })

    it('should show required field indicators', () => {
      renderApp()
      
      expect(screen.getByText(/indicates required field/i)).toBeInTheDocument()
    })
  })

  describe('User wants to access help', () => {
    it('should open help when help button is clicked', async () => {
      const user = userEvent.setup()
      renderApp()
      
      const helpButton = screen.getByRole('button', { name: /help/i })
      await user.click(helpButton)
      
      await waitFor(() => {
        expect(screen.getByText('Help Page')).toBeInTheDocument()
      })
    })

    it('should close help and return to main view', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Open help
      const helpButton = screen.getByRole('button', { name: /help/i })
      await user.click(helpButton)
      
      // Close help
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)
      
      // Should be back at course configuration
      expect(screen.getByRole('heading', { name: /course configuration/i })).toBeInTheDocument()
    })
  })

  describe('User wants to configure settings', () => {
    it('should open settings dialog', async () => {
      const user = userEvent.setup()
      renderApp()
      
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)
      
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })
    })

    it('should save settings and close dialog', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)
      
      // Save settings
      const saveButton = screen.getByRole('button', { name: /save settings/i })
      await user.click(saveButton)
      
      // Should close and return to main view
      await waitFor(() => {
        // Check that settings modal content is gone
        expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument()
        // The settings button in header should still be there
        expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
      })
    })

    it('should close settings without saving', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)
      
      // Settings should be open - check for save settings button which is only in modal
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument()
      })
      
      // Close without saving - click the X button (first one)
      const closeButtons = screen.getAllByRole('button', { name: 'Close Settings' })
      await user.click(closeButtons[0]) // The X button is the first one
      
      // Should close and return to main view - save settings button should be gone
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('User wants to save and open projects', () => {
    it('should save project when save button is clicked', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Enter course title
      const titleInput = screen.getByLabelText(/course title/i)
      await user.type(titleInput, 'Test Course')
      
      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)
      
      // Should show success toast
      await waitFor(() => {
        const toast = screen.getByTestId('toast-notification')
        expect(toast).toHaveTextContent('Project saved successfully')
      })
    })

    it('should open project dialog', async () => {
      const user = userEvent.setup()
      renderApp()
      
      const openButton = screen.getByRole('button', { name: /open/i })
      await user.click(openButton)
      
      await waitFor(() => {
        expect(screen.getByText('Open Project Dialog')).toBeInTheDocument()
      })
    })

    it('should show unsaved changes indicator after editing', async () => {
      const user = userEvent.setup()
      
      renderApp()
      
      // Make changes
      const titleInput = screen.getByLabelText(/course title/i)
      await user.type(titleInput, 'Unsaved Course')
      
      // The auto-save indicator should show since we have unsaved changes
      await waitFor(() => {
        const autoSaveIndicator = screen.getByRole('status', { name: /auto-save status/i })
        expect(autoSaveIndicator).toBeInTheDocument()
      })
    })
  })

  describe('User wants to navigate through steps', () => {
    it('should progress through wizard steps', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Fill required field
      const titleInput = screen.getByLabelText(/course title/i)
      await user.type(titleInput, 'Navigation Test')
      
      // Continue to AI Prompt
      const continueButton = screen.getByRole('button', { name: /continue to ai prompt/i })
      await user.click(continueButton)
      
      // Should be on AI Prompt step
      await waitFor(() => {
        expect(screen.getByText(/ai prompt generator/i)).toBeInTheDocument()
      })
    })

    it('should allow going back to previous steps', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Go to step 2
      const titleInput = screen.getByLabelText(/course title/i)
      await user.type(titleInput, 'Back Navigation Test')
      
      const continueButton = screen.getByRole('button', { name: /continue to ai prompt/i })
      await user.click(continueButton)
      
      // Go back
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)
      
      // Should preserve data
      await waitFor(() => {
        const input = screen.getByLabelText(/course title/i)
        expect(input).toHaveValue('Back Navigation Test')
      })
    })
  })

  describe('User wants to use keyboard shortcuts', () => {
    it('should save with Ctrl+S', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Enter some data
      const titleInput = screen.getByLabelText(/course title/i)
      await user.type(titleInput, 'Keyboard Test')
      
      // Press Ctrl+S
      await user.keyboard('{Control>}s{/Control}')
      
      // Should trigger save
      await waitFor(() => {
        const toast = screen.getByTestId('toast-notification')
        expect(toast).toHaveTextContent('Project saved successfully')
      })
    })

    it('should open with Ctrl+O', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Press Ctrl+O
      await user.keyboard('{Control>}o{/Control}')
      
      // Should open project dialog
      await waitFor(() => {
        expect(screen.getByText('Open Project Dialog')).toBeInTheDocument()
      })
    })

    it('should open help with F1', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Press F1
      await user.keyboard('{F1}')
      
      // Should open help
      await waitFor(() => {
        expect(screen.getByText('Help Page')).toBeInTheDocument()
      })
    })

    it('should open settings with Ctrl+,', async () => {
      const user = userEvent.setup()
      renderApp()
      
      // Press Ctrl+,
      await user.keyboard('{Control>},{/Control}')
      
      // Should open settings
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })
    })
  })

  describe('User sees toast notifications', () => {
    it('should show toast messages', async () => {
      const user = userEvent.setup()
      
      renderApp()
      
      // Trigger a save to show toast
      const titleInput = screen.getByLabelText(/course title/i)
      await user.type(titleInput, 'Toast Test')
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)
      
      // Toast should appear
      await waitFor(() => {
        const toast = screen.getByTestId('toast-notification')
        expect(toast).toHaveTextContent('Project saved successfully')
      })
    })
  })

  describe('User experience with network status', () => {
    it('should show network status when offline', () => {
      // Mock offline status
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false
      })
      
      renderApp()
      
      // Network status indicator should show when offline
      const statusIndicator = screen.getByText(/no internet connection/i)
      expect(statusIndicator).toBeInTheDocument()
    })
  })
})