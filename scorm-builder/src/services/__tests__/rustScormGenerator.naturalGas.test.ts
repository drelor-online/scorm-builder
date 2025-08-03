import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { convertToRustFormat } from '../rustScormGenerator';

describe('rustScormGenerator - Natural Gas Safety project', () => {
  let projectData: any;
  let mediaFiles: any[];

  beforeAll(async () => {
    try {
      // Load the Natural Gas Safety project data we prepared
      const requestData = await fs.readFile(
        path.join(__dirname, '../../../test-output/rust-request.json'),
        'utf-8'
      );
      const parsed = JSON.parse(requestData);
      projectData = parsed.courseData;
      mediaFiles = parsed.mediaFiles;
    } catch (error) {
      console.error('Failed to load test data:', error);
      // Use mock data if the file doesn't exist
      projectData = {
        course_title: 'Natural Gas Safety',
        topics: [],
        welcome_page: { audio_file: 'audio-0', caption_file: 'caption-0' },
        assessment: { questions: [] }
      };
      mediaFiles = [];
    }
  });

  it('should have correct course structure', () => {
    expect(projectData.course_title).toBe('Natural Gas Safety');
    expect(projectData.topics).toHaveLength(10);
    expect(projectData.welcome_page).toBeTruthy();
    expect(projectData.assessment).toBeTruthy();
  });

  it('should have knowledge checks in all topics', () => {
    if (projectData.topics.length === 0) {
      console.warn('No topics loaded, skipping test');
      return;
    }
    
    projectData.topics.forEach((topic: any, index: number) => {
      expect(topic.knowledge_check).toBeTruthy();
      expect(topic.knowledge_check.enabled).toBe(true);
      expect(topic.knowledge_check.questions).toHaveLength(1);
      
      const question = topic.knowledge_check.questions[0];
      expect(question).toBeDefined();
      if (question) {
        expect(question.type).toBeTruthy();
        expect(question.text).toBeTruthy();
        expect(question.correct_answer).toBeTruthy();
      }
    });
  });

  it('should have audio and caption files for all content', () => {
    // Check welcome page
    expect(projectData.welcome_page.audio_file).toBe('audio-0');
    expect(projectData.welcome_page.caption_file).toBe('caption-0');

    // Check topics
    projectData.topics.forEach((topic: any, index: number) => {
      expect(topic.audio_file).toBe(`audio-${index + 2}`);
      expect(topic.caption_file).toBe(`caption-${index + 2}`);
    });
  });

  it('should have all required media files', () => {
    const audioFiles = mediaFiles.filter(f => f.filename.endsWith('.mp3'));
    const captionFiles = mediaFiles.filter(f => f.filename.endsWith('.vtt'));
    
    expect(audioFiles).toHaveLength(12);
    expect(captionFiles).toHaveLength(12);
    
    // Verify specific files exist
    expect(mediaFiles.find(f => f.filename === 'audio-0.mp3')).toBeTruthy();
    expect(mediaFiles.find(f => f.filename === 'caption-0.vtt')).toBeTruthy();
  });

  it('should have proper knowledge check question format', () => {
    const firstTopic = projectData.topics[0];
    const firstQuestion = firstTopic.knowledge_check.questions[0];
    
    expect(firstQuestion).toEqual({
      type: 'multiple-choice',
      text: 'Why is mercaptan added to natural gas?',
      options: [
        'To make it burn hotter',
        'To aid in leak detection by giving it a distinct odor',
        'To make it lighter than air',
        'To prevent pipes from corroding'
      ],
      correct_answer: 'To aid in leak detection by giving it a distinct odor',
      explanation: expect.stringContaining('The primary purpose of mercaptan')
    });
  });

  it('should have images for topics with image content', () => {
    // First topic should have an image URL
    expect(projectData.topics[0].image_url).toContain('methane-molecule');
    
    // Check that some topics have images
    const topicsWithImages = projectData.topics.filter((t: any) => t.image_url);
    expect(topicsWithImages.length).toBeGreaterThan(0);
  });

  it('should have proper media file naming without media/ prefix', () => {
    // Media files should not have media/ prefix in the array
    mediaFiles.forEach(file => {
      expect(file.filename).not.toMatch(/^media\//);
    });
  });
});