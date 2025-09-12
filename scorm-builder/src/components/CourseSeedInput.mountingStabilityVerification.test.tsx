/**
 * Simple verification test that the CourseSeedInput mounting stability fix is in place
 */

import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('CourseSeedInput Mounting Stability Fix Verification', () => {
  test('should have callback stability fix implemented in source code', () => {
    console.log('[VERIFICATION] 🔍 Checking that mounting stability fix is present in source code...')
    
    // Read the CourseSeedInput source file
    const filePath = resolve(__dirname, 'CourseSeedInput.tsx')
    const sourceCode = readFileSync(filePath, 'utf-8')
    
    // Verify the fix components are present
    const hasCallbackRefs = sourceCode.includes('const onSaveRef = useRef(onSave)')
    const hasMarkDirtyRef = sourceCode.includes('const markDirtyRef = useRef(markDirty)')
    const hasRefUpdates = sourceCode.includes('onSaveRef.current = onSave')
    const hasCleanedDependencyArray = sourceCode.includes('// 🚀 REMOVED callback dependencies to prevent excessive re-renders')
    const usesCallbackRefs = sourceCode.includes('onSaveRef.current') && sourceCode.includes('markDirtyRef.current')
    
    // Verify the original problematic dependencies are removed
    const hasRemovedCallbackDeps = !sourceCode.includes('onSave, markDirty])')
    
    console.log('[VERIFICATION] Fix components found:')
    console.log('  - Callback refs declared:', hasCallbackRefs)
    console.log('  - Mark dirty ref declared:', hasMarkDirtyRef)
    console.log('  - Ref update effects:', hasRefUpdates)
    console.log('  - Cleaned dependency array:', hasCleanedDependencyArray)
    console.log('  - Uses callback refs:', usesCallbackRefs)
    console.log('  - Removed problematic deps:', hasRemovedCallbackDeps)
    
    // Assert all components of the fix are present
    expect(hasCallbackRefs).toBe(true)
    expect(hasMarkDirtyRef).toBe(true)
    expect(hasRefUpdates).toBe(true)
    expect(hasCleanedDependencyArray).toBe(true)
    expect(usesCallbackRefs).toBe(true)
    expect(hasRemovedCallbackDeps).toBe(true)
    
    console.log('[VERIFICATION] ✅ CourseSeedInput mounting stability fix is properly implemented')
  })

  test('should not have the original problematic useEffect dependency pattern', () => {
    const filePath = resolve(__dirname, 'CourseSeedInput.tsx')
    const sourceCode = readFileSync(filePath, 'utf-8')
    
    // The original problematic pattern should no longer exist
    const hasProblematicPattern = sourceCode.includes('[courseTitle, difficulty, customTopics, template, storage?.currentProjectId, storage?.isInitialized, onSave, markDirty]')
    
    expect(hasProblematicPattern).toBe(false)
    
    console.log('[VERIFICATION] ✅ Original problematic dependency pattern has been removed')
  })
})