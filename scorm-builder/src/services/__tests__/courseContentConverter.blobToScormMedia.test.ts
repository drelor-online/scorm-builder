import { describe, it, expect } from 'vitest';
import { convertToEnhancedCourseContent } from '../courseContentConverter';
import { CourseContent } from '../../types/course';
import { CourseMetadata } from '../../types/metadata';

describe('courseContentConverter - blob URL to scorm-media conversion', () => {
  const mockMetadata: CourseMetadata = {
    title: 'Test Course',
    identifier: 'test-course-123',
    version: '1.0',
    scormVersion: '1.2',
    duration: 60,
    passMark: 80
  };

  it('should convert blob URLs to scorm-media URLs when storageId is present', () => {
    const courseContent: CourseContent = {
      title: 'Test Course',
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        audioFile: 'audio-0.bin',
        captionFile: 'caption-0.bin',
        narration: { script: 'Welcome script' },
        media: [
          {
            id: 'media-1',
            type: 'image',
            url: 'blob:http://localhost:3000/12345-67890',
            title: 'Welcome Image',
            storageId: 'image-welcome-123'
          }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        audioFile: 'audio-1.bin',
        captionFile: 'caption-1.bin',
        narration: { script: 'Objectives script' },
        media: []
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic content',
          narration: { script: 'Topic script' },
          knowledgeCheck: {
            questions: [
              {
                question: 'Test question?',
                options: ['A', 'B', 'C'],
                correctAnswer: 0,
                feedback: 'Correct!'
              }
            ]
          },
          audioFile: 'audio-2.bin',
          captionFile: 'caption-2.bin',
          imagePrompts: [],
          imageKeywords: [],
          videoPrompts: [],
          videoKeywords: [],
          media: [
            {
              id: 'media-2',
              type: 'image',
              url: 'blob:http://localhost:3000/abcdef-123456',
              title: 'Topic Image',
              storageId: 'image-topic-1-456'
            }
          ]
        }
      ],
      assessmentSettings: {
        id: 'assessment',
        randomizeQuestions: false
      },
      assessment: {
        questions: []
      }
    };

    const converted = convertToEnhancedCourseContent(courseContent, mockMetadata, 'test-project');

    // Check welcome page image
    expect(converted.welcome.imageUrl).toBe('scorm-media://test-project/image-welcome-123');
    
    // Check topic image
    expect(converted.topics[0].imageUrl).toBe('scorm-media://test-project/image-topic-1-456');
  });

  it('should keep external URLs unchanged', () => {
    const courseContent: CourseContent = {
      title: 'Test Course',
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        audioFile: 'audio-0.bin',
        captionFile: 'caption-0.bin',
        narration: { script: 'Welcome script' },
        media: [
          {
            id: 'media-1',
            type: 'image',
            url: 'https://example.com/image.jpg',
            title: 'External Image'
          }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        audioFile: 'audio-1.bin',
        captionFile: 'caption-1.bin',
        narration: { script: 'Objectives script' },
        media: []
      },
      topics: [],
      assessmentSettings: {
        id: 'assessment',
        randomizeQuestions: false
      },
      assessment: {
        questions: []
      }
    };

    const converted = convertToEnhancedCourseContent(courseContent, mockMetadata, 'test-project');

    // External URLs should remain unchanged
    expect(converted.welcome.imageUrl).toBe('https://example.com/image.jpg');
  });

  it('should handle media without storageId by ignoring blob URLs', () => {
    const courseContent: CourseContent = {
      title: 'Test Course',
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        audioFile: 'audio-0.bin',
        captionFile: 'caption-0.bin',
        narration: { script: 'Welcome script' },
        media: [
          {
            id: 'media-1',
            type: 'image',
            url: 'blob:http://localhost:3000/12345-67890',
            title: 'Welcome Image'
            // No storageId
          }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        audioFile: 'audio-1.bin',
        captionFile: 'caption-1.bin',
        narration: { script: 'Objectives script' },
        media: []
      },
      topics: [],
      assessmentSettings: {
        id: 'assessment',
        randomizeQuestions: false
      },
      assessment: {
        questions: []
      }
    };

    const converted = convertToEnhancedCourseContent(courseContent, mockMetadata, 'test-project');

    // Blob URLs without storageId should be undefined
    expect(converted.welcome.imageUrl).toBeUndefined();
  });
});