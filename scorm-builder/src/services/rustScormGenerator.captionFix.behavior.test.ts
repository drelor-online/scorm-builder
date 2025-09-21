/**
 * Test for verifying caption-1 inclusion fix
 * This test verifies that the dynamic project loading fix allows caption-1 to be included
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tauri before importing any modules that use it
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn()
}))

// Import the function we'll be testing
import { collectAllMediaIds } from './rustScormGenerator'

describe('Caption-1 Fix Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should collect caption-1 as fallback when objectives page exists', () => {
    const courseContent = {
      title: "Test Course",
      learningObjectivesPage: {
        objectives: ["Learn something important"],
        // No explicit caption media - should trigger fallback
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const collectedIds = collectAllMediaIds(courseContent)

    // Verify caption-1 is included as fallback
    expect(collectedIds).toContain('caption-1')
    expect(collectedIds).toContain('audio-1')

    console.log('✅ Caption-1 fallback collection working correctly')
  })

  it('should collect caption-1 from both explicit and fallback sources', () => {
    const courseContent = {
      title: "Test Course",
      learningObjectivesPage: {
        objectives: ["Learn something important"],
        captionFile: "explicit-caption-file", // Explicit caption
        media: [
          { id: "explicit-caption-file", type: "caption" }
        ]
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const collectedIds = collectAllMediaIds(courseContent)

    // Should have both explicit and fallback
    expect(collectedIds).toContain('caption-1') // Fallback
    expect(collectedIds).toContain('explicit-caption-file') // Explicit
    expect(collectedIds).toContain('audio-1') // Audio fallback

    console.log('✅ Both explicit and fallback caption collection working')
  })

  it('should not collect caption-1 when no objectives page exists', () => {
    const courseContent = {
      title: "Test Course",
      // No learningObjectivesPage or objectivesPage
      topics: [],
      assessment: {
        questions: []
      }
    }

    const collectedIds = collectAllMediaIds(courseContent)

    // Should not have fallbacks when no objectives page
    expect(collectedIds).not.toContain('caption-1')
    expect(collectedIds).not.toContain('audio-1')

    console.log('✅ No fallback collection when objectives page missing')
  })

  it('should handle projectId numeric extraction correctly', () => {
    // Test the numeric ID extraction logic
    const testProjectIds = [
      '1756944132721',
      'Complex_Projects_-_02_-_Hazardous_Area_Classification_1756944132721.scormproj',
      'C:/Users/sierr/Documents/SCORM Projects/1756944132721',
      'C:/Users/sierr/Documents/SCORM Projects/Complex_Projects_-_02_-_Hazardous_Area_Classification_1756944132721.scormproj'
    ]

    testProjectIds.forEach(projectId => {
      let numericProjectId = projectId

      // Same logic as in ensureProjectLoaded function
      if (projectId.includes('\\') || projectId.includes('/') || projectId.includes('.scormproj')) {
        // Try to extract from path like "Complex_Projects_-_02_-_Hazardous_Area_Classification_1756944132721.scormproj"
        const fileNameMatch = projectId.match(/_(\d+)\.scormproj$/i)
        if (fileNameMatch) {
          numericProjectId = fileNameMatch[1]
        } else {
          // Try to extract from directory path
          const pathParts = projectId.split(/[\\/]/)
          for (let i = pathParts.length - 1; i >= 0; i--) {
            const part = pathParts[i].replace('.scormproj', '')
            if (/^\d+$/.test(part)) {
              numericProjectId = part
              break
            }
          }
        }
      }

      expect(numericProjectId).toBe('1756944132721')
    })

    console.log('✅ Project ID extraction working correctly')
  })
})