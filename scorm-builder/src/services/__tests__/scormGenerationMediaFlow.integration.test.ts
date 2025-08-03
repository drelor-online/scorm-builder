import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertToEnhancedCourseContent } from '../courseContentConverter';
import { CourseContent } from '../../types/course';
import { CourseMetadata } from '../../types/metadata';

describe('SCORM Generation Media Flow Integration', () => {
  const mockMetadata: CourseMetadata = {
    title: 'Test Course',
    identifier: 'test-course-123',
    version: '1.0',
    scormVersion: '1.2',
    duration: 60,
    passMark: 80
  };

  it('should properly convert media URLs through the entire flow', () => {
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
            id: 'welcome-image',
            type: 'image',
            url: 'blob:http://localhost:3000/welcome-blob',
            title: 'Welcome Image',
            storageId: 'stored-welcome-image-123'
          },
          {
            id: 'welcome-video',
            type: 'video',
            url: 'https://www.youtube.com/embed/abc123',
            title: 'Welcome Video',
            embedUrl: 'https://www.youtube.com/embed/abc123'
          }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li><li>Objective 2</li></ul>',
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
                options: ['Option A', 'Option B', 'Option C'],
                correctAnswer: 1,
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
              id: 'topic-image',
              type: 'image',
              url: 'blob:http://localhost:3000/topic-blob',
              title: 'Topic Image',
              storageId: 'stored-topic-image-456'
            }
          ]
        },
        {
          id: 'topic-2',
          title: 'Topic 2',
          content: 'Topic 2 content',
          narration: { script: 'Topic 2 script' },
          knowledgeCheck: {
            questions: []
          },
          audioFile: 'audio-3.bin',
          captionFile: 'caption-3.bin',
          imagePrompts: ['Generate an image'],
          imageKeywords: ['safety'],
          videoPrompts: [],
          videoKeywords: [],
          media: [] // No media but has image prompts
        }
      ],
      assessmentSettings: {
        id: 'assessment',
        randomizeQuestions: false
      },
      assessment: {
        questions: [
          {
            id: 'q1',
            question: 'Assessment question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 0
          }
        ]
      }
    };

    const projectId = 'test-project';
    const converted = convertToEnhancedCourseContent(courseContent, mockMetadata, projectId);

    // Check welcome page
    expect(converted.welcome.imageUrl).toBe('scorm-media://test-project/stored-welcome-image-123');
    expect(converted.welcome.media).toHaveLength(2);
    expect(converted.welcome.media![0]).toMatchObject({
      id: 'welcome-image',
      type: 'image',
      url: 'blob:http://localhost:3000/welcome-blob', // Original URL in media array
      storageId: 'stored-welcome-image-123'
    });
    expect(converted.welcome.media![1]).toMatchObject({
      id: 'welcome-video',
      type: 'video',
      url: 'https://www.youtube.com/embed/abc123', // External URL unchanged
      embedUrl: 'https://www.youtube.com/embed/abc123'
    });

    // Check topic 1 - has blob URL with storageId
    expect(converted.topics[0].imageUrl).toBe('scorm-media://test-project/stored-topic-image-456');
    expect(converted.topics[0].media).toHaveLength(1);
    expect(converted.topics[0].media![0]).toMatchObject({
      id: 'topic-image',
      type: 'image',
      url: 'blob:http://localhost:3000/topic-blob',
      storageId: 'stored-topic-image-456'
    });

    // Check topic 2 - no media but has image prompts
    expect(converted.topics[1].imageUrl).toBe('image-1.jpg'); // Fallback to generated name
    expect(converted.topics[1].media).toHaveLength(0);

    // Check knowledge checks are preserved
    expect(converted.topics[0].knowledgeCheck).toBeDefined();
    expect(converted.topics[0].knowledgeCheck?.questions).toHaveLength(1);
    expect(converted.topics[0].knowledgeCheck?.questions[0]).toMatchObject({
      question: 'Test question?',
      options: ['Option A', 'Option B', 'Option C'],
      correctAnswer: 1,
      feedback: 'Correct!'
    });

    // Check assessment
    expect(converted.assessment.questions).toHaveLength(1);
    expect(converted.assessment.questions[0]).toMatchObject({
      id: 'q1',
      question: 'Assessment question?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0
    });

    // Check audio/caption files are preserved
    expect(converted.welcome.audioFile).toBe('audio-0.bin');
    expect(converted.welcome.captionFile).toBe('caption-0.bin');
    expect(converted.topics[0].audioFile).toBe('audio-2.bin');
    expect(converted.topics[0].captionFile).toBe('caption-2.bin');
  });

  it('should handle missing media gracefully', () => {
    const courseContent: CourseContent = {
      title: 'Test Course',
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: { script: 'Welcome script' },
        media: [
          {
            id: 'broken-image',
            type: 'image',
            url: 'blob:http://localhost:3000/broken-blob',
            title: 'Broken Image'
            // No storageId - should be ignored
          }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li></ul>',
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

    // Blob URL without storageId should result in undefined imageUrl
    expect(converted.welcome.imageUrl).toBeUndefined();
    
    // Media array should still contain the original item
    expect(converted.welcome.media).toHaveLength(1);
    expect(converted.welcome.media![0]).toMatchObject({
      id: 'broken-image',
      type: 'image',
      url: 'blob:http://localhost:3000/broken-blob',
      title: 'Broken Image'
    });
  });
});