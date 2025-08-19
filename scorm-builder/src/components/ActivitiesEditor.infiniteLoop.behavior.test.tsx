import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { ActivitiesEditor } from './ActivitiesEditor'
import { CourseContent } from '../types/aiPrompt'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest'

// Mock all problematic imports that cause path resolution issues
vi.mock('@/utils/ultraSimpleLogger', () => ({
  debugLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

// Mock console.error to catch infinite loop errors
const originalError = console.error
let errorMessages: string[] = []

beforeEach(() => {
  errorMessages = []
  console.error = vi.fn((message) => {
    errorMessages.push(message)
    originalError(message)
  })
})

afterEach(() => {
  console.error = originalError
})

// Mock storage that simulates the real behavior
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
}

// Mock the storage hook
vi.mock('../contexts/PersistentStorageContext', () => ({
  ...vi.importActual('../contexts/PersistentStorageContext'),
  useStorage: () => mockStorage,
  PersistentStorageProvider: ({ children }: any) => children,
}))

const mockCourseContent: CourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    narration: 'Welcome narration',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 5,
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Learning Objectives',
    content: 'Objectives content',
    narration: 'Objectives narration',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 3,
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Topic 1',
      content: 'Topic content',
      narration: 'Topic narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 10,
    }
  ],
  assessment: {
    questions: [],
    passMark: 80,
    narration: null,
  },
}

describe('ActivitiesEditor Infinite Loop Behavior', () => {
  test('should reproduce infinite loop when navigating to activities page', async () => {
    // Mock storage returning saved content that differs from props
    const savedActivitiesContent = {
      ...mockCourseContent,
      topics: [
        {
          ...mockCourseContent.topics[0],
          title: 'Modified Topic 1', // Different from prop content
        }
      ]
    }
    
    mockStorage.getContent.mockResolvedValue(savedActivitiesContent)
    mockStorage.saveContent.mockResolvedValue(undefined)
    
    let onSaveCalls = 0
    let onUpdateContentCalls = 0
    
    const mockOnSave = vi.fn(() => {
      onSaveCalls++
      console.log(`onSave called ${onSaveCalls} times`)
      
      // Simulate parent updating courseContent prop in response to onSave
      // This would normally happen in the parent component
      if (onSaveCalls < 5) { // Prevent truly infinite loop in test
        // Force a re-render with updated props to simulate parent behavior
        setTimeout(() => {
          // This would normally be handled by parent component state update
        }, 0)
      }
    })
    
    const mockOnUpdateContent = vi.fn(() => {
      onUpdateContentCalls++
      console.log(`onUpdateContent called ${onUpdateContentCalls} times`)
    })
    
    // Render the component
    render(
      <PersistentStorageProvider>
        <UnsavedChangesProvider>
          <ActivitiesEditor
            courseContent={mockCourseContent}
            onNext={vi.fn()}
            onBack={vi.fn()}
            onUpdateContent={mockOnUpdateContent}
            onSave={mockOnSave}
          />
        </UnsavedChangesProvider>
      </PersistentStorageProvider>
    )
    
    // Wait for initial load and expect the infinite loop error
    await waitFor(
      () => {
        // Check if the "Maximum update depth exceeded" error occurred
        const hasInfiniteLoopError = errorMessages.some(error => 
          typeof error === 'string' && 
          error.includes('Maximum update depth exceeded')
        )
        
        expect(hasInfiniteLoopError).toBe(true)
      },
      { timeout: 5000 }
    )
    
    // Verify that multiple save calls occurred (indicating the loop)
    expect(onSaveCalls).toBeGreaterThan(3)
    expect(onUpdateContentCalls).toBeGreaterThan(3)
    
    // Verify storage interactions happened multiple times
    expect(mockStorage.saveContent).toHaveBeenCalledTimes(onSaveCalls)
  })
  
  test('should trigger infinite loop through the circular update pattern', async () => {
    // Set up the exact scenario from the logs
    let contentUpdates = 0
    
    const mockOnSave = vi.fn((content, silent) => {
      contentUpdates++
      console.log(`Content update ${contentUpdates}, silent: ${silent}`)
      
      // This simulates how the parent component responds to onSave calls
      // In the real app, this would trigger a prop update that causes re-render
    })
    
    mockStorage.getContent.mockResolvedValue(mockCourseContent)
    
    render(
      <PersistentStorageProvider>
        <UnsavedChangesProvider>
          <ActivitiesEditor
            courseContent={mockCourseContent}
            onNext={vi.fn()}
            onBack={vi.fn()}
            onUpdateContent={vi.fn()}
            onSave={mockOnSave}
          />
        </UnsavedChangesProvider>
      </PersistentStorageProvider>
    )
    
    // Wait for the circular update pattern to manifest
    await waitFor(
      () => {
        // Look for the specific error pattern from the console logs
        const hasReactError = errorMessages.some(error =>
          typeof error === 'string' && 
          (error.includes('Maximum update depth exceeded') || 
           error.includes('useEffect'))
        )
        
        expect(hasReactError).toBe(true)
      },
      { timeout: 3000 }
    )
    
    // The component should have triggered multiple auto-save cycles
    expect(contentUpdates).toBeGreaterThanOrEqual(1)
  })
})