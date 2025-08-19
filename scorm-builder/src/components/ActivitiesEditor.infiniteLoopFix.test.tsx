import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { ActivitiesEditor } from './ActivitiesEditor'
import { CourseContent } from '../types/aiPrompt'

// Mock all the dependencies
vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    getContent: vi.fn().mockResolvedValue(null),
    saveContent: vi.fn().mockResolvedValue(undefined),
  })
}))

vi.mock('../contexts/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    markDirty: vi.fn(),
    resetDirty: vi.fn(),
  })
}))

vi.mock('@/utils/ultraSimpleLogger', () => ({
  debugLogger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))

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

describe('ActivitiesEditor Infinite Loop Fix', () => {
  test('should not trigger infinite loop on initial mount', () => {
    let onSaveCallCount = 0
    let onUpdateContentCallCount = 0
    
    const mockOnSave = vi.fn(() => {
      onSaveCallCount++
      // Simulate what parent component might do - but should not trigger loop
    })
    
    const mockOnUpdateContent = vi.fn(() => {
      onUpdateContentCallCount++
    })
    
    // Render component - this should NOT trigger infinite calls
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onUpdateContent={mockOnUpdateContent}
        onSave={mockOnSave}
      />
    )
    
    // After initial render, there should be no auto-save calls
    // because user hasn't interacted yet
    expect(onSaveCallCount).toBe(0)
    expect(onUpdateContentCallCount).toBe(0)
    
    // Verify the component rendered without crashing
    expect(true).toBe(true)
  })
  
  test('should handle prop changes without infinite loop', () => {
    let callCount = 0
    const mockOnSave = vi.fn(() => { callCount++ })
    const mockOnUpdateContent = vi.fn(() => { callCount++ })
    
    const { rerender } = render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onUpdateContent={mockOnUpdateContent}
        onSave={mockOnSave}
      />
    )
    
    // Change props - this should sync internal state but not trigger saves
    const updatedContent = {
      ...mockCourseContent,
      topics: [
        {
          ...mockCourseContent.topics[0],
          title: 'Updated Topic 1',
        }
      ]
    }
    
    rerender(
      <ActivitiesEditor
        courseContent={updatedContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onUpdateContent={mockOnUpdateContent}
        onSave={mockOnSave}
      />
    )
    
    // Should not trigger any save/update calls since no user interaction
    expect(callCount).toBe(0)
  })
})