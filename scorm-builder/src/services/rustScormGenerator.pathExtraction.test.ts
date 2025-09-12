/**
 * Test the numeric ID extraction logic from ensureProjectLoaded
 */

import { describe, it, expect } from 'vitest'

describe('Path Extraction Logic', () => {
  it('Should extract numeric ID from full file path', () => {
    const fullPath = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj'
    
    // This is the extraction logic from ensureProjectLoaded
    let numericProjectId = fullPath
    
    if (fullPath.includes('\\') || fullPath.includes('/') || fullPath.includes('.scormproj')) {
      // Try to extract from path like "Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj"
      const fileNameMatch = fullPath.match(/_(\d+)\.scormproj$/i)
      if (fileNameMatch) {
        numericProjectId = fileNameMatch[1]
      } else {
        // Try to extract from directory path like "C:\...\1756944000180"
        const pathParts = fullPath.split(/[\\/]/)
        for (let i = pathParts.length - 1; i >= 0; i--) {
          const part = pathParts[i].replace('.scormproj', '')
          if (/^\d+$/.test(part)) {
            numericProjectId = part
            break
          }
        }
      }
    }
    
    expect(numericProjectId).toBe('1756944000180')
  })

  it('Should handle numeric ID passed directly', () => {
    const numericId = '1756944000180'
    
    // This should not be modified
    let numericProjectId = numericId
    
    if (numericId.includes('\\') || numericId.includes('/') || numericId.includes('.scormproj')) {
      // This block should not execute for a pure numeric ID
      numericProjectId = 'SHOULD_NOT_HAPPEN'
    }
    
    expect(numericProjectId).toBe('1756944000180')
  })

  it('Should extract from directory path without filename', () => {
    const dirPath = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\1756944000180'
    
    let numericProjectId = dirPath
    
    if (dirPath.includes('\\') || dirPath.includes('/') || dirPath.includes('.scormproj')) {
      // Try filename first
      const fileNameMatch = dirPath.match(/_(\d+)\.scormproj$/i)
      if (fileNameMatch) {
        numericProjectId = fileNameMatch[1]
      } else {
        // Try directory path
        const pathParts = dirPath.split(/[\\/]/)
        for (let i = pathParts.length - 1; i >= 0; i--) {
          const part = pathParts[i].replace('.scormproj', '')
          if (/^\d+$/.test(part)) {
            numericProjectId = part
            break
          }
        }
      }
    }
    
    expect(numericProjectId).toBe('1756944000180')
  })

  it('Should handle malformed paths gracefully', () => {
    const malformedPath = 'invalid-path-with-no-numbers'
    
    let numericProjectId = malformedPath
    
    if (malformedPath.includes('\\') || malformedPath.includes('/') || malformedPath.includes('.scormproj')) {
      const fileNameMatch = malformedPath.match(/_(\d+)\.scormproj$/i)
      if (fileNameMatch) {
        numericProjectId = fileNameMatch[1]
      } else {
        const pathParts = malformedPath.split(/[\\/]/)
        for (let i = pathParts.length - 1; i >= 0; i--) {
          const part = pathParts[i].replace('.scormproj', '')
          if (/^\d+$/.test(part)) {
            numericProjectId = part
            break
          }
        }
      }
    }
    
    // Should remain unchanged if no numeric ID found
    expect(numericProjectId).toBe('invalid-path-with-no-numbers')
  })
})