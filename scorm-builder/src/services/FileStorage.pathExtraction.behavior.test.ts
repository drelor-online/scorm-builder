/**
 * BEHAVIOR TEST: FileStorage Path vs ID Extraction
 *
 * This test verifies that FileStorage.openProject correctly handles both:
 * 1. Full file paths (from dashboard loading)
 * 2. Numeric IDs (from direct usage)
 *
 * The test ensures consistent ID extraction that matches coordinatedProjectLoading
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { FileStorage } from './FileStorage'
import { extractProjectId } from '../utils/projectIdExtraction'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

describe('FileStorage - Path vs ID Extraction', () => {
  let storage: FileStorage
  const mockInvoke = invoke as any

  beforeEach(() => {
    vi.clearAllMocks()
    storage = FileStorage.getInstance()
  })

  it('should extract numeric ID from full file path correctly', async () => {
    console.log('🧪 TEST: Testing path-to-ID extraction...')

    // Mock successful project loading response
    const mockProjectFile = {
      project: {
        id: '1756944000180', // Backend should return numeric ID
        name: 'Complex Projects - 1 - 49 CFR 192'
      },
      metadata: { version: '1.0', created: '2024-01-01', lastModified: '2024-01-01' },
      course_content: {},
      course_seed_data: {}
    }

    mockInvoke.mockResolvedValue(mockProjectFile)

    // Test with full file path (what dashboard passes)
    const fullPath = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj'

    await storage.openProject(fullPath)

    // Should extract the numeric ID correctly
    expect(storage.currentProjectId).toBe('1756944000180')

    console.log('✅ Path extraction successful:', {
      inputPath: fullPath,
      extractedId: storage.currentProjectId
    })
  })

  it('should handle numeric ID input correctly', async () => {
    console.log('🧪 TEST: Testing direct numeric ID input...')

    const mockProjectFile = {
      project: {
        id: '1756944000180',
        name: 'Test Project'
      },
      metadata: { version: '1.0', created: '2024-01-01', lastModified: '2024-01-01' },
      course_content: {},
      course_seed_data: {}
    }

    mockInvoke.mockResolvedValue(mockProjectFile)

    // Test with direct numeric ID
    const numericId = '1756944000180'

    await storage.openProject(numericId)

    // Should preserve the numeric ID
    expect(storage.currentProjectId).toBe('1756944000180')

    console.log('✅ Numeric ID preserved:', {
      inputId: numericId,
      storedId: storage.currentProjectId
    })
  })

  it('should match coordinatedProjectLoading extractProjectId logic', async () => {
    console.log('🧪 TEST: Testing consistency with coordinatedProjectLoading...')

    const mockProjectFile = {
      project: {
        id: '1756944000180',
        name: 'Test Project'
      },
      metadata: { version: '1.0', created: '2024-01-01', lastModified: '2024-01-01' },
      course_content: {},
      course_seed_data: {}
    }

    mockInvoke.mockResolvedValue(mockProjectFile)

    // Test cases that should match between FileStorage and coordinatedProjectLoading
    const testCases = [
      {
        input: 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj',
        expected: '1756944000180'
      },
      {
        input: '/Users/test/Project_1234567890.scormproj',
        expected: '1234567890'
      },
      {
        input: '1756944000180',
        expected: '1756944000180'
      }
    ]

    for (const testCase of testCases) {
      // Reset the mock for each test case
      mockInvoke.mockResolvedValue(mockProjectFile)

      await storage.openProject(testCase.input)

      const fileStorageResult = storage.currentProjectId
      const coordinatedResult = extractProjectId(testCase.input)

      // They should produce the same result
      expect(fileStorageResult).toBe(coordinatedResult)
      expect(fileStorageResult).toBe(testCase.expected)

      console.log('✅ Consistency verified for:', {
        input: testCase.input,
        fileStorageResult,
        coordinatedResult,
        expected: testCase.expected
      })
    }
  })

  it('should fail when given malformed path', async () => {
    console.log('🧪 TEST: Testing malformed path handling...')

    // This test should fail initially if FileStorage doesn't handle edge cases correctly
    const mockProjectFile = {
      project: {
        id: 'invalid-id-from-backend', // Backend returns non-numeric ID
        name: 'Test Project'
      },
      metadata: { version: '1.0', created: '2024-01-01', lastModified: '2024-01-01' },
      course_content: {},
      course_seed_data: {}
    }

    mockInvoke.mockResolvedValue(mockProjectFile)

    // Malformed path that doesn't follow the expected pattern
    const malformedPath = 'C:\\Users\\test\\SomeFile.txt'

    await storage.openProject(malformedPath)

    // Should not extract a numeric ID from this malformed path
    // Current FileStorage logic might fail this test
    expect(storage.currentProjectId).not.toMatch(/^\d+$/)

    console.log('⚠️ Malformed path result:', {
      input: malformedPath,
      result: storage.currentProjectId
    })
  })
})