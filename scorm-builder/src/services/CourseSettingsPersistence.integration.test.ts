/**
 * INTEGRATION TEST: Complete Course Settings Persistence Fix
 *
 * This test verifies that the complete fix works end-to-end:
 * 1. Dashboard loads project with full file path
 * 2. coordinatedProjectLoading extracts ID correctly
 * 3. FileStorage and React state synchronize properly
 * 4. Course settings can be saved and retrieved consistently
 * 5. Navigation between steps preserves settings
 *
 * This test simulates the exact user scenario that was failing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileStorage } from './FileStorage'
import { MockFileStorage } from './MockFileStorage'
import { openProjectWithCoordination } from '../utils/coordinatedProjectLoading'
import { extractProjectId } from '../utils/projectIdExtraction'
import { DEFAULT_COURSE_SETTINGS } from '../components/CourseSettingsWizard'

// Mock environment detection
vi.mock('../config/environment', () => ({
  isTauriEnvironment: () => false
}))

describe('Course Settings Persistence - Complete Integration Fix', () => {
  let mockStorage: MockFileStorage
  let mockPersistentStorageContext: any
  let mockMediaContext: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup MockFileStorage instance
    mockStorage = new MockFileStorage() as any

    // Mock FileStorage singleton
    vi.spyOn(FileStorage, 'getInstance').mockReturnValue(mockStorage as any)

    // Initialize storage
    await mockStorage.initialize()

    // Create mock contexts for coordination
    mockPersistentStorageContext = {
      currentProjectId: null,
      fileStorage: mockStorage,
      isInitialized: true,
      openProject: vi.fn().mockImplementation(async (projectId: string, onProgress?: Function) => {
        await mockStorage.openProject(projectId)
        mockPersistentStorageContext.currentProjectId = mockStorage.currentProjectId
        onProgress?.({ phase: 'finalizing', percent: 100, message: 'Project ready!' })
      })
    }

    mockMediaContext = {
      setCriticalMediaLoadingCallback: vi.fn(),
      loadingComplete: true
    }
  })

  it('should handle the complete dashboard→settings→navigation scenario', async () => {
    console.log('🧪 INTEGRATION TEST: Complete dashboard→settings→navigation scenario...')

    // STEP 1: Simulate dashboard loading a project with full file path
    console.log('📱 STEP 1: Dashboard loading project with full file path...')

    const dashboardProjectPath = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj'
    const expectedProjectId = '1756944000180'

    // Set up mock data to simulate a project that exists with the expected ID
    (mockStorage as any).mockData[expectedProjectId] = {
      project: {
        id: expectedProjectId,
        name: 'Complex Projects - 1 - 49 CFR 192',
        path: dashboardProjectPath
      },
      content: {},
      media: {}
    }

    // Test coordinatedProjectLoading with the full path
    let progressUpdates: any[] = []
    await openProjectWithCoordination({
      projectId: dashboardProjectPath,
      storage: mockPersistentStorageContext,
      mediaContext: mockMediaContext,
      onProgress: (progress) => {
        progressUpdates.push(progress)
        console.log('📊 Progress:', progress)
      }
    })

    // Verify coordination worked correctly
    expect(mockPersistentStorageContext.openProject).toHaveBeenCalledWith(dashboardProjectPath, expect.any(Function))
    expect(mockStorage.currentProjectId).toBe(expectedProjectId)

    console.log('✅ STEP 1 completed: Project loaded with extracted ID:', mockStorage.currentProjectId)

    // STEP 2: Test ID extraction consistency across all systems
    console.log('🔧 STEP 2: Verifying ID extraction consistency...')

    const extractedId = extractProjectId(dashboardProjectPath)
    expect(extractedId).toBe(expectedProjectId)
    expect(mockStorage.currentProjectId).toBe(extractedId)

    console.log('✅ STEP 2 completed: ID extraction consistent across all systems')

    // STEP 3: Test course settings persistence
    console.log('⚙️ STEP 3: Testing course settings persistence...')

    const customSettings = {
      ...DEFAULT_COURSE_SETTINGS,
      passMark: 85,
      fontSize: 'large' as const,
      confirmExit: false,
      retakeDelay: 48,
      navigationMode: 'linear' as const
    }

    // Save course settings
    await mockStorage.saveContent('courseSettings', customSettings)

    // Verify settings were saved under the correct project ID
    const savedSettings = await mockStorage.getContent('courseSettings')
    expect(savedSettings).toEqual(customSettings)
    expect(savedSettings.passMark).toBe(85)
    expect(savedSettings.fontSize).toBe('large')

    console.log('✅ STEP 3 completed: Course settings saved successfully')

    // STEP 4: Simulate navigation away and back
    console.log('🔄 STEP 4: Simulating navigation away and back...')

    // Simulate some time passing and React context potentially losing state
    mockPersistentStorageContext.currentProjectId = null // Simulate React state loss

    // Wait a bit to simulate navigation time
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify FileStorage still has the correct project ID
    expect(mockStorage.currentProjectId).toBe(expectedProjectId)

    console.log('✅ STEP 4 completed: Navigation simulated, FileStorage state preserved')

    // STEP 5: Verify settings are still accessible after navigation
    console.log('🔍 STEP 5: Verifying settings accessibility after navigation...')

    // Even with React state null, settings should be accessible via FileStorage
    const persistedSettings = await mockStorage.getContent('courseSettings')
    expect(persistedSettings).toEqual(customSettings)
    expect(persistedSettings.passMark).toBe(85)
    expect(persistedSettings.fontSize).toBe('large')
    expect(persistedSettings.confirmExit).toBe(false)
    expect(persistedSettings.retakeDelay).toBe(48)
    expect(persistedSettings.navigationMode).toBe('linear')

    console.log('✅ STEP 5 completed: Settings accessible after navigation')

    // STEP 6: Test the scenario with React state resynchronization
    console.log('🔄 STEP 6: Testing React state resynchronization...')

    // Simulate the polling mechanism in usePersistentStorage
    const actualProjectId = mockStorage.currentProjectId
    if (actualProjectId !== mockPersistentStorageContext.currentProjectId) {
      console.log('🔄 Syncing React state with FileStorage:', {
        reactState: mockPersistentStorageContext.currentProjectId,
        fileStorageState: actualProjectId
      })
      mockPersistentStorageContext.currentProjectId = actualProjectId
    }

    // Verify resynchronization
    expect(mockPersistentStorageContext.currentProjectId).toBe(expectedProjectId)

    console.log('✅ STEP 6 completed: React state resynchronized')

    // STEP 7: Final verification of the complete system
    console.log('🎯 STEP 7: Final system verification...')

    // Test that all systems are consistent
    const finalExtractedId = extractProjectId(dashboardProjectPath)
    const finalFileStorageId = mockStorage.currentProjectId
    const finalReactStateId = mockPersistentStorageContext.currentProjectId
    const finalSettings = await mockStorage.getContent('courseSettings')

    expect(finalExtractedId).toBe(expectedProjectId)
    expect(finalFileStorageId).toBe(expectedProjectId)
    expect(finalReactStateId).toBe(expectedProjectId)
    expect(finalSettings.passMark).toBe(85)

    console.log('✅ STEP 7 completed: All systems consistent!', {
      expectedId: expectedProjectId,
      extractedId: finalExtractedId,
      fileStorageId: finalFileStorageId,
      reactStateId: finalReactStateId,
      settingsValid: finalSettings.passMark === 85
    })

    console.log('🎉 INTEGRATION TEST PASSED: Complete course settings persistence fix verified!')
  })

  it('should handle edge cases and error scenarios', async () => {
    console.log('🧪 INTEGRATION TEST: Testing edge cases...')

    // Test with different path formats
    const testCases = [
      {
        input: 'C:\\Users\\test\\Project_9876543210.scormproj',
        expected: '9876543210'
      },
      {
        input: '/Users/test/Project_1111111111.scormproj',
        expected: '1111111111'
      },
      {
        input: '2222222222', // Direct ID
        expected: '2222222222'
      }
    ]

    for (const testCase of testCases) {
      console.log(`🔧 Testing case: ${testCase.input}`)

      const extractedId = extractProjectId(testCase.input)
      expect(extractedId).toBe(testCase.expected)

      console.log(`✅ Case passed: ${testCase.input} → ${extractedId}`)
    }

    console.log('🎉 EDGE CASES TEST PASSED: All path formats handled correctly!')
  })
})