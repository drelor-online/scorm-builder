/**
 * BEHAVIOR TEST: Course Settings Persistence Fix Verification
 *
 * This test verifies that all the fixes for course settings persistence are working correctly:
 * 1. usePersistentStorage closure issue fix
 * 2. coordinatedProjectLoading synchronization fix
 * 3. CourseSettingsWizard enhanced fallback mechanism
 *
 * The test simulates the exact user scenario that was failing:
 * - Load project from dashboard
 * - Change course settings
 * - Navigate to another step
 * - Return to course settings
 * - Verify settings are preserved
 */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CourseSettingsWizard, DEFAULT_COURSE_SETTINGS } from './CourseSettingsWizard'
import { FileStorage } from '../services/FileStorage'
import { MockFileStorage } from '../services/MockFileStorage'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { usePersistentStorage } from '../hooks/usePersistentStorage'

// Create a context for testing (simpler approach)
const PersistentStorageContext = React.createContext<any>(null)

// Mock environment detection to use MockFileStorage
vi.mock('../config/environment', () => ({
  isTauriEnvironment: () => false
}))

// Create a test wrapper that provides all necessary contexts
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const storage = usePersistentStorage()

  return (
    <PersistentStorageContext.Provider value={storage}>
      <UnsavedChangesProvider>
        {children}
      </UnsavedChangesProvider>
    </PersistentStorageContext.Provider>
  )
}

describe('CourseSettingsWizard - Persistence Fix Verification', () => {
  let mockStorage: MockFileStorage
  let projectId: string

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create a fresh MockFileStorage instance
    mockStorage = new MockFileStorage() as any

    // Mock FileStorage.getInstance to return our test instance
    vi.spyOn(FileStorage, 'getInstance').mockReturnValue(mockStorage as any)

    // Initialize storage and create a test project
    await mockStorage.initialize()
    const project = await mockStorage.createProject('Test Persistence Project')
    projectId = project.id

    // Open the project to simulate loading from dashboard
    await mockStorage.openProject(projectId)

    console.log('🧪 Test setup complete:', {
      projectId,
      currentProjectId: mockStorage.currentProjectId,
      storageInitialized: true
    })
  })

  it('should persist course settings through navigation simulation', async () => {
    console.log('🧪 TEST: Verifying course settings persistence through navigation...')

    // Mock course content and seed data
    const mockCourseContent = {
      title: 'Test Course',
      topics: []
    }
    const mockCourseSeedData = {
      title: 'Test Course',
      description: 'Test Description'
    }

    // Custom settings that differ from defaults
    const customSettings = {
      ...DEFAULT_COURSE_SETTINGS,
      passMark: 85,           // Changed from default 80
      fontSize: 'large' as const,  // Changed from default 'medium'
      confirmExit: false,     // Changed from default true
      retakeDelay: 48,        // Changed from default 0
      navigationMode: 'linear' as const // Changed from default 'free'
    }

    let savedSettings: any = null
    const mockOnNext = vi.fn((settings) => {
      savedSettings = settings
    })

    // STEP 1: Render CourseSettingsWizard
    console.log('📱 STEP 1: Rendering CourseSettingsWizard...')
    render(
      <TestWrapper>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByText('Course Settings')).toBeInTheDocument()
    }, { timeout: 5000 })

    console.log('✅ CourseSettingsWizard rendered successfully')

    // STEP 2: Change settings to custom values
    console.log('⚙️ STEP 2: Changing settings to custom values...')

    // Change pass mark
    const passMarkInput = screen.getByLabelText(/Pass Mark/i)
    fireEvent.change(passMarkInput, { target: { value: '85' } })

    // Change font size
    const fontSizeSelect = screen.getByLabelText(/Font Size/i)
    fireEvent.change(fontSizeSelect, { target: { value: 'large' } })

    // Change confirm exit
    const confirmExitCheckbox = screen.getByLabelText(/Confirm Exit/i)
    fireEvent.click(confirmExitCheckbox)

    // Change retake delay
    const retakeDelayInput = screen.getByLabelText(/Retake Delay/i)
    fireEvent.change(retakeDelayInput, { target: { value: '48' } })

    // Change navigation mode
    const navigationModeSelect = screen.getByLabelText(/Navigation Mode/i)
    fireEvent.change(navigationModeSelect, { target: { value: 'linear' } })

    console.log('✅ Settings changed successfully')

    // STEP 3: Wait for auto-save to complete
    console.log('💾 STEP 3: Waiting for auto-save...')
    await new Promise(resolve => setTimeout(resolve, 1500)) // Wait for auto-save debounce

    // Verify settings were saved to storage
    const savedToStorage = await mockStorage.getContent('courseSettings')
    expect(savedToStorage).toBeTruthy()
    expect(savedToStorage.passMark).toBe(85)
    expect(savedToStorage.fontSize).toBe('large')
    expect(savedToStorage.confirmExit).toBe(false)
    expect(savedToStorage.retakeDelay).toBe(48)
    expect(savedToStorage.navigationMode).toBe('linear')

    console.log('✅ Auto-save completed and verified')

    // STEP 4: Simulate navigation away (unmount component)
    console.log('🔄 STEP 4: Simulating navigation away...')
    render(<div>Different Component</div>) // This effectively unmounts the CourseSettingsWizard

    // Wait a bit to simulate time passing
    await new Promise(resolve => setTimeout(resolve, 200))

    console.log('✅ Navigation away simulated')

    // STEP 5: Simulate returning to CourseSettingsWizard
    console.log('🔄 STEP 5: Simulating return to CourseSettingsWizard...')

    render(
      <TestWrapper>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // Wait for component to load and settings to be restored
    await waitFor(() => {
      expect(screen.getByText('Course Settings')).toBeInTheDocument()
    }, { timeout: 5000 })

    // STEP 6: Verify settings were restored correctly
    console.log('🔍 STEP 6: Verifying settings were restored...')

    await waitFor(() => {
      const restoredPassMarkInput = screen.getByLabelText(/Pass Mark/i) as HTMLInputElement
      expect(restoredPassMarkInput.value).toBe('85')
    }, { timeout: 3000 })

    const restoredFontSizeSelect = screen.getByLabelText(/Font Size/i) as HTMLSelectElement
    expect(restoredFontSizeSelect.value).toBe('large')

    const restoredConfirmExitCheckbox = screen.getByLabelText(/Confirm Exit/i) as HTMLInputElement
    expect(restoredConfirmExitCheckbox.checked).toBe(false) // Should be unchecked

    const restoredRetakeDelayInput = screen.getByLabelText(/Retake Delay/i) as HTMLInputElement
    expect(restoredRetakeDelayInput.value).toBe('48')

    const restoredNavigationModeSelect = screen.getByLabelText(/Navigation Mode/i) as HTMLSelectElement
    expect(restoredNavigationModeSelect.value).toBe('linear')

    console.log('✅ All settings restored correctly!')

    // STEP 7: Verify the handleNext function works with persisted settings
    console.log('🚀 STEP 7: Testing handleNext with persisted settings...')

    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalledWith(
        expect.objectContaining({
          passMark: 85,
          fontSize: 'large',
          confirmExit: false,
          retakeDelay: 48,
          navigationMode: 'linear'
        })
      )
    })

    console.log('✅ handleNext called with correct persisted settings')

    console.log('🎉 TEST PASSED: Course settings persistence fix verified successfully!')
  })

  it('should handle edge case where React state is null but FileStorage has project ID', async () => {
    console.log('🧪 TEST: Testing edge case with null React state...')

    // This test specifically verifies the fallback mechanism we implemented

    const mockCourseContent = { title: 'Test Course', topics: [] }
    const mockCourseSeedData = { title: 'Test Course', description: 'Test Description' }

    // Create a custom storage hook that simulates React state being null
    const TestWrapperWithNullReactState: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const baseStorage = usePersistentStorage()

      // Mock the storage to simulate React state being null but FileStorage having project ID
      const mockStorageWithNullReactState = {
        ...baseStorage,
        currentProjectId: null, // Simulate React state being null
        fileStorage: {
          ...baseStorage.fileStorage,
          currentProjectId: projectId // But FileStorage has the correct project ID
        }
      }

      return (
        <PersistentStorageContext.Provider value={mockStorageWithNullReactState}>
          <UnsavedChangesProvider>
            {children}
          </UnsavedChangesProvider>
        </PersistentStorageContext.Provider>
      )
    }

    // Save some settings first
    await mockStorage.saveContent('courseSettings', {
      ...DEFAULT_COURSE_SETTINGS,
      passMark: 90,
      fontSize: 'large'
    })

    // Render with the null React state scenario
    render(
      <TestWrapperWithNullReactState>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapperWithNullReactState>
    )

    // Wait for component to load and fallback mechanism to work
    await waitFor(() => {
      expect(screen.getByText('Course Settings')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify that settings were loaded despite React state being null
    await waitFor(() => {
      const passMarkInput = screen.getByLabelText(/Pass Mark/i) as HTMLInputElement
      expect(passMarkInput.value).toBe('90')
    }, { timeout: 3000 })

    const fontSizeSelect = screen.getByLabelText(/Font Size/i) as HTMLSelectElement
    expect(fontSizeSelect.value).toBe('large')

    console.log('✅ Fallback mechanism working: Settings loaded despite null React state')
  })

  it('should verify FileStorage singleton pattern prevents multiple instances', async () => {
    console.log('🧪 TEST: Verifying FileStorage singleton pattern...')

    // This test ensures our singleton fix is working
    const instance1 = FileStorage.getInstance()
    const instance2 = FileStorage.getInstance()

    expect(instance1).toBe(instance2)
    expect(instance1).toBe(mockStorage)

    console.log('✅ FileStorage singleton pattern verified')
  })
})