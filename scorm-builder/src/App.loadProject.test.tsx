import { describe, it, expect, beforeEach } from 'vitest'

// Mock console to track load calls
const loadProjectCalls: string[] = []
const originalConsoleLog = console.log

beforeEach(() => {
  loadProjectCalls.length = 0
  console.log = (...args: any[]) => {
    const message = args[0]
    if (typeof message === 'string' && message.includes('[App.loadProject]')) {
      loadProjectCalls.push(message)
    }
    originalConsoleLog(...args)
  }
})

describe('App.loadProject - Performance Issue', () => {
  it('should detect multiple loadProject calls', () => {
    // Simulate what happens in the actual app
    const projectId = 'test-project-123'
    let lastLoadedProjectId: string | null = null
    const courseSeedData = null // Initial state
    
    // Simulate the useEffect trigger
    const runLoadCheck = () => {
      // This is the check from App.tsx line 301
      if (lastLoadedProjectId === projectId && courseSeedData) {
        console.log('[App.loadProject] Skipping load - already loaded this project')
        return
      }
      
      console.log('[App.loadProject] Starting to load project data')
      lastLoadedProjectId = projectId
    }
    
    // Simulate multiple re-renders triggering the effect
    runLoadCheck() // First render
    runLoadCheck() // Second render
    runLoadCheck() // Third render
    runLoadCheck() // Fourth render
    runLoadCheck() // Fifth render
    
    // Count how many times we started loading
    const startLoadCalls = loadProjectCalls.filter(msg => 
      msg.includes('Starting to load project data')
    ).length
    
    // FAILING TEST: Currently this loads multiple times
    expect(startLoadCalls).toBe(1) // Should only load once
  })
  
  it('should need a loading flag to prevent concurrent loads', () => {
    // Test that we need a loading flag
    const projectId = 'test-project-123'
    let lastLoadedProjectId: string | null = null
    let isLoading = false // This is what we need to add
    const courseSeedData = null
    
    const runLoadCheckWithFlag = () => {
      // Check if already loading
      if (isLoading) {
        console.log('[App.loadProject] Already loading, skipping')
        return
      }
      
      if (lastLoadedProjectId === projectId && courseSeedData) {
        console.log('[App.loadProject] Skipping load - already loaded this project')
        return
      }
      
      isLoading = true
      console.log('[App.loadProject] Starting to load project data')
      lastLoadedProjectId = projectId
      
      // Simulate async completion
      setTimeout(() => {
        isLoading = false
      }, 100)
    }
    
    // Simulate rapid re-renders
    runLoadCheckWithFlag()
    runLoadCheckWithFlag()
    runLoadCheckWithFlag()
    runLoadCheckWithFlag()
    
    const startLoadCalls = loadProjectCalls.filter(msg => 
      msg.includes('Starting to load project data')
    ).length
    
    // With loading flag, should only load once
    expect(startLoadCalls).toBe(1)
  })
})