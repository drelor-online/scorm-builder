import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertToCourseContent } from '../../../services/courseContentConverter';

// Mock MediaStore
const _mockMediaStore = {
  getMedia: vi.fn(),
  getFileContent: vi.fn(),
  getAllMedia: vi.fn()
};

describe('Media Path Conversion - Current Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show current issue: blob URLs are passed through without conversion', () => {
    // Current behavior: blob URLs are passed directly
    const courseData = {
      courseTitle: 'Test Course',
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome to the course',
        media: [{
          id: 'image-123',
          type: 'image',
          url: 'blob:http://localhost:1420/123-456-789',
          title: 'Welcome Banner'
        }]
      },
      topics: []
    };
    
    const converted = convertToCourseContent(courseData);
    
    // This test shows the current broken behavior
    // The blob URL is passed through unchanged
    expect(converted.welcome_page.media[0].url).toBe('blob:http://localhost:1420/123-456-789');
    
    // What we want instead:
    // expect(converted.welcome_page.media[0].url).toBe('media/welcome-banner.jpg');
  });

  it('should show current issue: empty src attributes in generated HTML', () => {
    const courseData = {
      courseTitle: 'Test Course',
      objectivesPage: {
        objectives: ['Learn safety', 'Understand risks'],
        media: [{
          id: 'objectives-img',
          type: 'image',
          url: '', // Empty URL from MediaStore issue
          title: 'Objectives Image'
        }]
      },
      topics: []
    };
    
    const converted = convertToCourseContent(courseData);
    
    // This shows the empty URL issue
    if (converted.learning_objectives_page) {
      expect(converted.learning_objectives_page.media[0].url).toBe('');
    }
    
    // What we want:
    // expect(converted.learning_objectives_page.media[0].url).toBe('media/objectives-image.png');
  });

  it('should show current issue: MediaStore IDs not resolved to file paths', () => {
    const courseData = {
      courseTitle: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content here',
        media: [{
          id: 'media-abc123',
          type: 'image',
          url: 'media-abc123', // Just the ID, not a path
          title: 'Topic Image'
        }]
      }]
    };
    
    const converted = convertToCourseContent(courseData);
    
    // Current broken behavior: ID is passed as URL
    expect(converted.topics[0].media[0].url).toBe('media-abc123');
    
    // What we need:
    // expect(converted.topics[0].media[0].url).toBe('media/topic-image.jpg');
  });

  it('should demonstrate the need for media file content in conversion', () => {
    // Current converter doesn't handle binary content
    const courseData = {
      courseTitle: 'Test Course',
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome',
        media: [{
          id: 'upload-123',
          type: 'image',
          url: 'blob:http://localhost/upload-123',
          title: 'Uploaded Image'
        }]
      }
    };
    
    const converted = convertToCourseContent(courseData);
    
    // Currently no media_files property for binary content
    expect(converted.media_files).toBeUndefined();
    
    // What we need to add:
    // expect(converted.media_files).toBeDefined();
    // expect(converted.media_files[0]).toHaveProperty('content');
    // expect(converted.media_files[0]).toHaveProperty('filename');
    // expect(converted.media_files[0]).toHaveProperty('mime_type');
  });
});