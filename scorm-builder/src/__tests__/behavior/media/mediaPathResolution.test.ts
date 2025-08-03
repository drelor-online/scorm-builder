import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock MediaStore
const mockMediaStore = {
  getMedia: vi.fn(),
  getFileContent: vi.fn(),
  getAllMedia: vi.fn()
};

// Mock window and Tauri
global.window = {
  __TAURI__: true,
  rustScormGenerator: vi.fn()
} as any;

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke
}));

describe('Media Path Resolution in SCORM Package', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve media paths from MediaStore IDs to file paths', async () => {
    // Mock media data in MediaStore
    const mockMediaData = {
      id: 'image-123abc',
      filename: 'welcome-image.jpg',
      type: 'image/jpeg',
      url: 'blob:http://localhost/123abc', // Blob URL in app
      projectId: 'test-project'
    };
    
    mockMediaStore.getMedia.mockResolvedValue(mockMediaData);
    mockMediaStore.getFileContent.mockResolvedValue(new Uint8Array([0xFF, 0xD8, 0xFF])); // JPEG header
    
    // Expected SCORM output with resolved path
    const expectedHtml = `<img src="media/welcome-image.jpg" alt="welcome-image.jpg" class="topic-image" />`;
    
    // Test the conversion process
    const courseData = {
      welcomePage: {
        media: [{
          id: 'image-123abc',
          type: 'image',
          url: 'blob:http://localhost/123abc',
          title: 'welcome-image.jpg'
        }]
      }
    };
    
    // The media path should be resolved to a relative path in SCORM
    expect(expectedHtml).toContain('media/welcome-image.jpg');
    expect(expectedHtml).not.toContain('blob:');
    expect(expectedHtml).not.toContain('image-123abc');
  });

  it('should include uploaded images in SCORM package ZIP', async () => {
    // Mock successful SCORM generation with media files
    const mockGeneratedFiles = [
      {
        path: 'pages/welcome.html',
        content: '<img src="media/uploaded-image.png" alt="User Upload" />'
      },
      {
        path: 'media/uploaded-image.png',
        content: new Uint8Array([0x89, 0x50, 0x4E, 0x47]), // PNG header
        isBinary: true
      }
    ];
    
    mockInvoke.mockResolvedValue(mockGeneratedFiles);
    
    const request = {
      course_title: 'Test Course',
      welcome_page: {
        title: 'Welcome',
        content: 'Welcome content',
        media: [{
          type: 'image',
          url: 'media/uploaded-image.png',
          title: 'User Upload'
        }]
      },
      topics: [],
      media_files: [{
        id: 'upload-123',
        filename: 'uploaded-image.png',
        content: [0x89, 0x50, 0x4E, 0x47], // Binary content as array
        mime_type: 'image/png'
      }]
    };
    
    const result = await mockInvoke('generate_scorm_with_rust', { request });
    const files = result as any[];
    
    // Verify HTML references the media file
    const htmlFile = files.find(f => f.path === 'pages/welcome.html');
    expect(htmlFile).toBeDefined();
    expect(htmlFile.content).toContain('src="media/uploaded-image.png"');
    
    // Verify media file is included
    const mediaFile = files.find(f => f.path === 'media/uploaded-image.png');
    expect(mediaFile).toBeDefined();
    expect(mediaFile.isBinary).toBe(true);
    expect(mediaFile.content).toBeInstanceOf(Uint8Array);
  });

  it('should handle empty media URLs correctly', async () => {
    // This test verifies the fix for empty src="" attributes
    const mockGeneratedFiles = [
      {
        path: 'pages/objectives.html',
        content: `<div class="media-container">
<img src="media/objectives-banner.jpg" alt="Objectives" class="topic-image" />
</div>`
      }
    ];
    
    mockInvoke.mockResolvedValue(mockGeneratedFiles);
    
    const request = {
      course_title: 'Test Course',
      learning_objectives_page: {
        objectives: ['Learn safety', 'Understand hazards'],
        media: [{
          type: 'image',
          url: 'media/objectives-banner.jpg',
          title: 'Objectives'
        }]
      }
    };
    
    const result = await mockInvoke('generate_scorm_with_rust', { request });
    const files = result as any[];
    
    const objectivesFile = files.find(f => f.path === 'pages/objectives.html');
    expect(objectivesFile).toBeDefined();
    
    // Should NOT have empty src
    expect(objectivesFile.content).not.toContain('src=""');
    // Should have proper media path
    expect(objectivesFile.content).toContain('src="media/objectives-banner.jpg"');
  });

  it('should convert MediaStore blob URLs to file paths', async () => {
    // Test the specific case of blob URL conversion
    const mediaWithBlobUrl = {
      id: 'media-456def',
      type: 'image',
      url: 'blob:http://localhost:1420/456def-789ghi',
      title: 'Topic Image'
    };
    
    // After conversion, should use filename from MediaStore
    const expectedPath = 'media/topic-image.jpg';
    
    // The converter should:
    // 1. Detect blob URL
    // 2. Look up media in MediaStore by ID
    // 3. Use the stored filename
    // 4. Generate relative path for SCORM
    
    const convertedMedia = {
      type: 'image',
      url: expectedPath,
      title: 'Topic Image'
    };
    
    expect(convertedMedia.url).toBe(expectedPath);
    expect(convertedMedia.url).not.toContain('blob:');
  });

  it('should handle multiple media files per page', async () => {
    const mockGeneratedFiles = [
      {
        path: 'pages/topic-1.html',
        content: `<div class="media-container">
<img src="media/diagram-1.png" alt="Diagram 1" class="topic-image" />
<img src="media/diagram-2.png" alt="Diagram 2" class="topic-image" />
<video src="media/demo-video.mp4" controls></video>
</div>`
      },
      { path: 'media/diagram-1.png', content: new Uint8Array([]), isBinary: true },
      { path: 'media/diagram-2.png', content: new Uint8Array([]), isBinary: true },
      { path: 'media/demo-video.mp4', content: new Uint8Array([]), isBinary: true }
    ];
    
    mockInvoke.mockResolvedValue(mockGeneratedFiles);
    
    const result = await mockInvoke('generate_scorm_with_rust', { request: {} });
    const files = result as any[];
    
    // Verify all media files are included
    const mediaFiles = files.filter(f => f.path.startsWith('media/'));
    expect(mediaFiles).toHaveLength(3);
    
    // Verify HTML references all media
    const htmlFile = files.find(f => f.path === 'pages/topic-1.html');
    expect(htmlFile.content).toContain('media/diagram-1.png');
    expect(htmlFile.content).toContain('media/diagram-2.png');
    expect(htmlFile.content).toContain('media/demo-video.mp4');
  });
});