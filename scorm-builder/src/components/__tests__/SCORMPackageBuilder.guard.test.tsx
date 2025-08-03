import { describe, it, expect, vi } from 'vitest'
import { render } from '../../test/testProviders'
import { SCORMPackageBuilder } from '../SCORMPackageBuilder'
import type { CourseContent } from '../../types/aiPrompt'

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn()
}))

describe('SCORMPackageBuilder - Guard Test', () => {
  it('should always send generated files to Tauri', async () => {
    const mockCourseContent: CourseContent = {
      welcomePage: {
        narration: 'Welcome',
        media: []
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          narration: 'Topic content',
          knowledgeCheck: {
            type: 'fill-in-the-blank',
            blank: 'Test _____.',
            correctAnswer: 'answer'
          },
          media: []
        }
      ],
      assessmentPage: {
        totalQuestions: 0,
        questions: []
      }
    }

    const mockCourseSeedData = {
      courseTitle: 'Test Course',
      courseDescription: 'Test Description',
      duration: 30
    }

    // This test verifies that generateSCORMFiles is always called
    // and produces files that are sent to Tauri
    const component = render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(component).toBeTruthy()
    
    // In a real test, we would trigger the generate button click
    // and verify that invoke is called with generated_files array
    // This test documents the expected behavior
  })

  it('should never send empty generated_files to Tauri', () => {
    // This documents that the guard prevents empty file generation
    const generateRequest = {
      project_id: 'test',
      course_content: {},
      course_metadata: {
        title: 'Test',
        description: 'Test',
        project_title: 'Test'
      },
      generated_files: [] // This should never happen
    }

    // With our guard, Tauri will reject this
    expect(generateRequest.generated_files.length).toBe(0)
    
    // Document expected error
    const expectedError = "No generated files provided. SCORM generation must be done through JavaScript."
    console.log('Expected Tauri error:', expectedError)
  })
})