import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/testProviders'
import { CourseSettingsWizard } from './CourseSettingsWizard'
import { usePersistentStorage } from '../hooks/usePersistentStorage'

// Mock the persistent storage hook
const mockStorage = {
  currentProjectId: null as string | null,
  saveContent: vi.fn(),
  getContent: vi.fn(),
  openProjectFromPath: vi.fn(),
}

vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: vi.fn()
}))

const mockUsePersistentStorage = vi.mocked(usePersistentStorage)

describe('CourseSettingsWizard Full Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePersistentStorage.mockReturnValue(mockStorage as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should fail to save course settings when currentProjectId is null (reproducing the bug)', async () => {
    // STEP 1: Simulate the state that causes the bug
    mockStorage.currentProjectId = null // This causes the "No project open" error
    mockStorage.saveContent.mockRejectedValue(new Error('No project open'))

    const mockHandleNext = vi.fn()

    render(
      <CourseSettingsWizard
        onNext={mockHandleNext}
        onBack={vi.fn()}
      />
    )

    // STEP 2: User changes navigation mode from linear to free
    const freeRadio = screen.getByRole('radio', { name: /free/i })
    fireEvent.click(freeRadio)

    // STEP 3: User clicks Next
    const nextButton = screen.getByRole('button', { name: /next/i })
    fireEvent.click(nextButton)

    // STEP 4: Should fail with "No project open" error
    await waitFor(() => {
      expect(mockStorage.saveContent).toHaveBeenCalledWith('courseSettings', expect.any(Object))
    })

    // The save should have been attempted but failed
    expect(mockStorage.saveContent).toHaveBeenCalledTimes(1)
  })

  it('should successfully save and restore course settings when currentProjectId is properly set', async () => {
    // STEP 1: Simulate project properly opened with currentProjectId set
    mockStorage.currentProjectId = '1756944000180'
    mockStorage.saveContent.mockResolvedValue(undefined)

    // Mock loading saved settings - initially return null (no saved settings)
    mockStorage.getContent.mockResolvedValue(null)

    const mockHandleNext = vi.fn()

    const { rerender } = render(
      <CourseSettingsWizard
        onNext={mockHandleNext}
        onBack={vi.fn()}
      />
    )

    // STEP 2: Verify default navigation mode is 'free' (as required)
    const freeRadio = screen.getByRole('radio', { name: /free/i })
    expect(freeRadio).toBeChecked()

    // STEP 3: User changes some settings
    const linearRadio = screen.getByRole('radio', { name: /linear/i })
    fireEvent.click(linearRadio)

    const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
    fireEvent.click(showProgressCheckbox) // This should turn it from true (default) to false

    // STEP 4: User saves settings by clicking Next
    const nextButton = screen.getByRole('button', { name: /next/i })
    fireEvent.click(nextButton)

    // STEP 5: Verify settings were saved
    await waitFor(() => {
      expect(mockStorage.saveContent).toHaveBeenCalledWith('courseSettings', expect.objectContaining({
        navigationMode: 'linear',
        showProgress: false
      }))
    })

    expect(mockHandleNext).toHaveBeenCalled()

    // STEP 6: Simulate user navigating away and returning (component remount)
    // Mock the storage to return the saved settings (simplified structure)
    mockStorage.getContent.mockResolvedValue({
      navigationMode: 'linear',
      showProgress: false
    })

    // Re-render the component (simulating navigation back to settings)
    rerender(
      <CourseSettingsWizard
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // STEP 7: Verify settings were loaded and restored
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('courseSettings')
    })

    // STEP 8: Verify UI reflects the loaded settings
    await waitFor(() => {
      const linearRadioAfterLoad = screen.getByRole('radio', { name: /linear/i })
      const showProgressCheckboxAfterLoad = screen.getByRole('checkbox', { name: /show progress bar/i })

      expect(linearRadioAfterLoad).toBeChecked()
      expect(showProgressCheckboxAfterLoad).not.toBeChecked()
    })
  })

  it('should not load settings when currentProjectId is null', async () => {
    // STEP 1: Simulate no project open
    mockStorage.currentProjectId = null
    mockStorage.getContent.mockResolvedValue(null)

    render(
      <CourseSettingsWizard
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // STEP 2: Verify getContent was not called since no project is open
    await waitFor(() => {
      expect(mockStorage.getContent).not.toHaveBeenCalled()
    })

    // STEP 3: Verify defaults are used (navigationMode should be 'free')
    const freeRadio = screen.getByRole('radio', { name: /free/i })
    expect(freeRadio).toBeChecked()
  })

  it('should gracefully handle storage errors when loading settings', async () => {
    // STEP 1: Simulate project open but storage error
    mockStorage.currentProjectId = '1756944000180'
    mockStorage.getContent.mockRejectedValue(new Error('Storage error'))

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <CourseSettingsWizard
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // STEP 2: Verify error was logged but component still renders with defaults
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[CourseSettingsWizard] Failed to load course settings:',
        expect.any(Error)
      )
    })

    // STEP 3: Verify default settings are used
    const freeRadio = screen.getByRole('radio', { name: /free/i })
    expect(freeRadio).toBeChecked()

    consoleSpy.mockRestore()
  })
})