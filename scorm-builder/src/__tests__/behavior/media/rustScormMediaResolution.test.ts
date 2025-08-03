import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock MediaStore
const mockMediaStore = {
  getMedia: vi.fn(),
  getFileContent: vi.fn()
};

describe('Rust SCORM Generator - Media Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show current issue: media URLs are passed without file content', () => {
    // This is how media is currently passed to Rust
    const rustRequest = {
      course_title: 'Test Course',
      welcome_page: {
        title: 'Welcome',
        content: 'Welcome content',
        media: [{
          id: 'image-123',
          type: 'image',
          url: 'blob:http://localhost:1420/123-456', // Blob URL passed directly
          title: 'Welcome Image'
        }]
      },
      topics: []
    };
    
    // Current issue: No media_files property with binary content
    expect(rustRequest.media_files).toBeUndefined();
    
    // Blob URLs are passed as-is
    expect(rustRequest.welcome_page.media[0].url).toContain('blob:');
  });

  it('should demonstrate what we need to add for media resolution', () => {
    // What the Rust generator needs to receive
    const enhancedRustRequest = {
      course_title: 'Test Course',
      welcome_page: {
        title: 'Welcome',
        content: 'Welcome content',
        media: [{
          id: 'image-123',
          type: 'image',
          url: 'media/welcome-image.jpg', // Resolved path
          title: 'Welcome Image'
        }]
      },
      topics: [],
      // NEW: Media files with binary content
      media_files: [{
        id: 'image-123',
        filename: 'welcome-image.jpg',
        content: [255, 216, 255, 224], // JPEG binary data as array
        mime_type: 'image/jpeg'
      }]
    };
    
    // Media files should be included
    expect(enhancedRustRequest.media_files).toBeDefined();
    expect(enhancedRustRequest.media_files).toHaveLength(1);
    
    // URLs should be resolved to relative paths
    expect(enhancedRustRequest.welcome_page.media[0].url).toBe('media/welcome-image.jpg');
    expect(enhancedRustRequest.welcome_page.media[0].url).not.toContain('blob:');
  });

  it('should test media resolution in convertToRustFormat', async () => {
    // Mock media data
    mockMediaStore.getMedia.mockResolvedValue({
      id: 'media-456',
      filename: 'topic-diagram.png',
      type: 'image/png',
      content: new Uint8Array([137, 80, 78, 71]) // PNG header
    });
    
    const courseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        media: [{
          id: 'media-456',
          type: 'image',
          url: 'blob:http://localhost/456',
          title: 'Diagram'
        }]
      }]
    };
    
    // What convertToRustFormat should do:
    // 1. Detect blob URLs
    // 2. Look up media in MediaStore
    // 3. Include media files with content
    // 4. Update URLs to relative paths
    
    const expectedOutput = {
      topics: [{
        media: [{
          id: 'media-456',
          type: 'image',
          url: 'media/topic-diagram.png', // Resolved
          title: 'Diagram'
        }]
      }],
      media_files: [{
        id: 'media-456',
        filename: 'topic-diagram.png',
        content: [137, 80, 78, 71],
        mime_type: 'image/png'
      }]
    };
    
    // Currently this functionality doesn't exist
    // We need to implement it
  });

  it('should handle multiple media files across pages', () => {
    const courseWithMultipleMedia = {
      welcome_page: {
        media: [
          { id: 'img-1', type: 'image', url: 'blob:1', title: 'Welcome' }
        ]
      },
      learning_objectives_page: {
        media: [
          { id: 'img-2', type: 'image', url: 'blob:2', title: 'Objectives' }
        ]
      },
      topics: [
        {
          media: [
            { id: 'img-3', type: 'image', url: 'blob:3', title: 'Topic 1 Image' },
            { id: 'vid-1', type: 'video', url: 'blob:4', title: 'Topic 1 Video' }
          ]
        }
      ]
    };
    
    // Should collect all media files
    const expectedMediaFiles = [
      { id: 'img-1', filename: 'welcome.jpg', content: [], mime_type: 'image/jpeg' },
      { id: 'img-2', filename: 'objectives.jpg', content: [], mime_type: 'image/jpeg' },
      { id: 'img-3', filename: 'topic-1-image.jpg', content: [], mime_type: 'image/jpeg' },
      { id: 'vid-1', filename: 'topic-1-video.mp4', content: [], mime_type: 'video/mp4' }
    ];
    
    // Currently no media collection happens
    // This needs to be implemented
  });
});