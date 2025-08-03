import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRustSCORM } from '../rustScormGenerator';
import { EnhancedCourseContent } from '../../types/course';
import { CourseMetadata } from '../../types/metadata';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('rustScormGenerator - imageUrl Field Handling', () => {
  const mockMetadata: CourseMetadata = {
    title: 'Test Course',
    identifier: 'test-course-123',
    version: '1.0',
    scormVersion: '1.2',
    duration: 60,
    passMark: 80
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass imageUrl field to Rust for welcome page', async () => {
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      welcome: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        imageUrl: 'scorm-media://test-project/welcome-image-123'
      },
      objectives: {
        id: 'objectives',
        title: 'Objectives',
        content: '<ul><li>Objective 1</li></ul>'
      },
      topics: [],
      assessment: {
        questions: []
      },
      assessmentSettings: {
        randomizeQuestions: false
      }
    };

    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = invoke as any;
    
    mockInvoke.mockResolvedValueOnce({
      success: true,
      message: 'SCORM package generated successfully'
    });

    await generateRustSCORM(courseContent, 'test-project');

    // Check that imageUrl is passed in the welcome_page structure
    const callArgs = mockInvoke.mock.calls[0][1];
    expect(callArgs.courseData.welcome_page).toBeDefined();
    expect(callArgs.courseData.welcome_page.image_url).toBe('scorm-media://test-project/welcome-image-123');
  });

  it('should pass imageUrl field to Rust for topics', async () => {
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      welcome: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content'
      },
      objectives: {
        id: 'objectives',
        title: 'Objectives',
        content: '<ul><li>Objective 1</li></ul>'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic content',
          imageUrl: 'scorm-media://test-project/topic-image-456'
        },
        {
          id: 'topic-2',
          title: 'Topic 2',
          content: 'Topic 2 content',
          imageUrl: 'image-2.jpg' // Fallback image name
        }
      ],
      assessment: {
        questions: []
      },
      assessmentSettings: {
        randomizeQuestions: false
      }
    };

    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = invoke as any;
    
    mockInvoke.mockResolvedValueOnce({
      success: true,
      message: 'SCORM package generated successfully'
    });

    await generateRustSCORM(courseContent, 'test-project');

    // Check that imageUrl is passed in the topics structure
    const callArgs = mockInvoke.mock.calls[0][1];
    expect(callArgs.courseData.topics).toHaveLength(2);
    expect(callArgs.courseData.topics[0].image_url).toBe('scorm-media://test-project/topic-image-456');
    expect(callArgs.courseData.topics[1].image_url).toBe('image-2.jpg');
  });

  it('should handle missing imageUrl gracefully', async () => {
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      welcome: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content'
        // No imageUrl
      },
      objectives: {
        id: 'objectives',
        title: 'Objectives',
        content: '<ul><li>Objective 1</li></ul>'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic content'
          // No imageUrl
        }
      ],
      assessment: {
        questions: []
      },
      assessmentSettings: {
        randomizeQuestions: false
      }
    };

    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = invoke as any;
    
    mockInvoke.mockResolvedValueOnce({
      success: true,
      message: 'SCORM package generated successfully'
    });

    await generateRustSCORM(courseContent, 'test-project');

    // Check that missing imageUrl is handled (should be undefined or empty)
    const callArgs = mockInvoke.mock.calls[0][1];
    expect(callArgs.courseData.welcome_page.image_url).toBeUndefined();
    expect(callArgs.courseData.topics[0].image_url).toBeUndefined();
  });
});