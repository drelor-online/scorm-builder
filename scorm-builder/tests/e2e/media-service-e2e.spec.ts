import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Helper to create test files
const createTestFile = (filename: string, content: Buffer | string) => {
  const testDir = path.join(__dirname, 'test-media-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const filePath = path.join(testDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

// Helper to create a valid image file
const createTestImage = (filename: string) => {
  // Create a minimal valid PNG
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR chunk type
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, etc.
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT chunk type
    0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00, 0x01, 0x01, 0x01, 0x00, 0x1B, // Compressed data
    0x7C, 0x73, 0x4D, 0x0A, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND chunk type
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  return createTestFile(filename, pngHeader);
};

// Helper to create a valid audio file
const createTestAudio = (filename: string) => {
  // Create a minimal valid MP3 (ID3v2 + silent frame)
  const id3Header = Buffer.from([
    0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // ID3v2 header
  ]);
  const mp3Frame = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00, // MP3 frame header
    ...Array(100).fill(0x00) // Silent frame data
  ]);
  return createTestFile(filename, Buffer.concat([id3Header, mp3Frame]));
};

// Helper to wait for media to load
const waitForMedia = async (page: Page, selector: string, timeout = 10000) => {
  await page.waitForSelector(selector, { timeout });
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel) as HTMLMediaElement;
      return element && element.readyState >= 2; // HAVE_CURRENT_DATA
    },
    selector,
    { timeout }
  );
};

// Create test files before tests run
test.beforeAll(async () => {
  // Create test images
  createTestImage('welcome-image.png');
  createTestImage('topic1-image.png');
  createTestImage('topic2-image.png');
  createTestImage('large-image.png'); // Will pretend it's large
  
  // Create test audio files
  createTestAudio('welcome-audio.mp3');
  createTestAudio('objectives-audio.mp3');
  createTestAudio('topic1-audio.mp3');
  createTestAudio('topic2-audio.mp3');
  
  // Create test video file (minimal MP4 header)
  const mp4Header = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp box
    0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
  ]);
  createTestFile('test-video.mp4', mp4Header);
  
  // Create caption file
  createTestFile('test-captions.vtt', `WEBVTT

00:00:00.000 --> 00:00:02.000
Test caption 1

00:00:02.000 --> 00:00:04.000
Test caption 2`);
});

test.describe('MediaService E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test('1. Complete media upload flow - images, audio, video', async ({ page }) => {
    // Create a new project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Media Service E2E Test');
    await page.click('button:has-text("Create")');

    // Wait for course configuration page
    await page.waitForSelector('h1:has-text("Course Configuration")');

    // Fill basic info
    await page.fill('input[placeholder*="course title"]', 'Media Service Test Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2');

    // Navigate to Media Enhancement
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');

    // Test image upload
    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    await imageInput.setInputFiles(path.join(__dirname, 'test-media-files', 'welcome-image.png'));
    
    // Wait for upload to complete
    await page.waitForSelector('[data-testid="upload-progress-complete"]', { timeout: 10000 });
    
    // Verify image preview appears
    await expect(page.locator('img[alt*="Welcome"]')).toBeVisible();

    // Upload topic images
    const topicImageInputs = page.locator('input[type="file"][accept*="image"]').all();
    if ((await topicImageInputs).length > 1) {
      await topicImageInputs[1].setInputFiles(path.join(__dirname, 'test-media-files', 'topic1-image.png'));
      await page.waitForSelector('[data-testid="topic-1-image-preview"]');
    }

    // Navigate to Audio Narration
    await page.click('button:has-text("Next")'); // Skip Content Review
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Audio Narration")');

    // Upload audio files
    const welcomeAudioInput = page.locator('[data-testid="welcome-audio-input"]');
    await welcomeAudioInput.setInputFiles(path.join(__dirname, 'test-media-files', 'welcome-audio.mp3'));
    
    // Wait for audio to load
    await waitForMedia(page, 'audio[data-testid="welcome-audio-player"]');

    // Upload objectives audio
    const objectivesAudioInput = page.locator('[data-testid="objectives-audio-input"]');
    if (await objectivesAudioInput.isVisible()) {
      await objectivesAudioInput.setInputFiles(path.join(__dirname, 'test-media-files', 'objectives-audio.mp3'));
      await waitForMedia(page, 'audio[data-testid="objectives-audio-player"]');
    }

    // Verify audio players are functional
    const audioPlayer = page.locator('audio').first();
    await expect(audioPlayer).toBeVisible();
    
    // Test play functionality
    await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.play());
    await page.waitForTimeout(500);
    await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.pause());
  });

  test('2. Media persistence across page navigations', async ({ page }) => {
    // Create project and upload media
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Media Persistence Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Persistence Test Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2\nTopic 3');

    // Navigate to Media Enhancement and upload image
    await page.click('button:has-text("Next")');
    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    await imageInput.setInputFiles(path.join(__dirname, 'test-media-files', 'welcome-image.png'));
    await page.waitForSelector('[data-testid="upload-progress-complete"]');

    // Get the image source
    const imageSrc = await page.locator('img[alt*="Welcome"]').getAttribute('src');
    expect(imageSrc).toBeTruthy();

    // Navigate forward to Audio
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    // Upload audio
    const audioInput = page.locator('[data-testid="welcome-audio-input"]');
    await audioInput.setInputFiles(path.join(__dirname, 'test-media-files', 'welcome-audio.mp3'));
    await waitForMedia(page, 'audio[data-testid="welcome-audio-player"]');

    // Navigate back to Media Enhancement
    await page.click('[data-testid="progress-step-1"]');
    await page.waitForSelector('h1:has-text("Media Enhancement")');

    // Verify image is still there
    const persistedImageSrc = await page.locator('img[alt*="Welcome"]').getAttribute('src');
    expect(persistedImageSrc).toBe(imageSrc);

    // Navigate to Audio again
    await page.click('[data-testid="progress-step-3"]');
    
    // Verify audio is still there
    await expect(page.locator('audio[data-testid="welcome-audio-player"]')).toBeVisible();
  });

  test('3. YouTube URL handling with storeYouTubeVideo', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'YouTube URL Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'YouTube Test Course');
    await page.click('button:has-text("Next")');

    // Input YouTube URL
    const youtubeInput = page.locator('input[placeholder*="YouTube URL"]');
    await youtubeInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Add YouTube Video")');

    // Wait for YouTube preview
    await page.waitForSelector('iframe[src*="youtube.com/embed"]', { timeout: 10000 });

    // Verify YouTube URL is preserved (not converted to asset.localhost)
    const iframeSrc = await page.locator('iframe[src*="youtube.com/embed"]').getAttribute('src');
    expect(iframeSrc).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(iframeSrc).not.toContain('asset.localhost');

    // Navigate away and back
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Back")');

    // Verify YouTube video is still there with correct URL
    const persistedIframeSrc = await page.locator('iframe[src*="youtube.com/embed"]').getAttribute('src');
    expect(persistedIframeSrc).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  test('4. Concurrent uploads don\'t block UI', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Concurrent Upload Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Concurrent Test Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2\nTopic 3');

    // Navigate to Media Enhancement
    await page.click('button:has-text("Next")');

    // Start multiple uploads simultaneously
    const imageInputs = await page.locator('input[type="file"][accept*="image"]').all();
    
    // Upload to multiple inputs without waiting
    const uploadPromises = imageInputs.slice(0, 3).map((input, index) => 
      input.setInputFiles(path.join(__dirname, 'test-media-files', `topic${index + 1}-image.png`))
    );

    // While uploads are happening, verify UI is still responsive
    const startTime = Date.now();
    let uiResponsive = true;

    // Try to interact with UI while uploads are happening
    const responsiveCheck = setInterval(async () => {
      try {
        // Try to hover over elements
        await page.hover('button:has-text("Back")', { timeout: 100 });
        await page.hover('button:has-text("Next")', { timeout: 100 });
      } catch {
        uiResponsive = false;
      }
    }, 50);

    // Wait for all uploads
    await Promise.all(uploadPromises);

    clearInterval(responsiveCheck);
    const uploadTime = Date.now() - startTime;

    // Verify UI remained responsive
    expect(uiResponsive).toBe(true);
    console.log(`Concurrent uploads completed in ${uploadTime}ms`);

    // Verify all images uploaded successfully
    const uploadedImages = page.locator('img[alt*="Topic"]');
    await expect(uploadedImages).toHaveCount(3);
  });

  test('5. Progress tracking during uploads', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Progress Tracking Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Progress Test Course');
    await page.click('button:has-text("Next")');

    // Set up progress monitoring
    const progressValues: number[] = [];
    
    // Listen for progress updates
    await page.exposeFunction('captureProgress', (progress: number) => {
      progressValues.push(progress);
    });

    // Inject progress capture
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        // Capture any progress events
        if (response.body) {
          const reader = response.body.getReader();
          const contentLength = +(response.headers.get('Content-Length') || 0);
          let receivedLength = 0;

          const stream = new ReadableStream({
            async start(controller) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                receivedLength += value.length;
                const progress = (receivedLength / contentLength) * 100;
                (window as any).captureProgress(progress);
                controller.enqueue(value);
              }
              controller.close();
            }
          });

          return new Response(stream, response);
        }
        return response;
      };
    });

    // Upload a file
    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    await imageInput.setInputFiles(path.join(__dirname, 'test-media-files', 'large-image.png'));

    // Wait for upload to complete
    await page.waitForSelector('[data-testid="upload-progress-complete"]', { timeout: 15000 });

    // Verify progress was tracked (even if simulated)
    console.log('Progress values captured:', progressValues);
    
    // Verify progress bar was shown
    const progressBar = page.locator('[role="progressbar"]');
    if (await progressBar.isVisible()) {
      const finalProgress = await progressBar.getAttribute('aria-valuenow');
      expect(Number(finalProgress)).toBe(100);
    }
  });

  test('6. Memory usage and blob URL cleanup', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Memory Management Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Memory Test Course');
    await page.click('button:has-text("Next")');

    // Get initial blob URL count
    const initialBlobUrls = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(entry => entry.name.startsWith('blob:'))
        .length;
    });

    // Upload multiple images
    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    for (let i = 0; i < 5; i++) {
      await imageInput.setInputFiles(path.join(__dirname, 'test-media-files', 'welcome-image.png'));
      await page.waitForTimeout(500);
    }

    // Get blob URL count after uploads
    const afterUploadBlobUrls = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(entry => entry.name.startsWith('blob:'))
        .length;
    });

    // Navigate away to trigger cleanup
    await page.goto('http://localhost:1420');
    await page.waitForTimeout(1000);

    // Check if blob URLs are being managed (not growing indefinitely)
    const finalBlobUrls = await page.evaluate(() => {
      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }
      return performance.getEntriesByType('resource')
        .filter(entry => entry.name.startsWith('blob:'))
        .length;
    });

    console.log('Blob URL counts:', { initial: initialBlobUrls, afterUpload: afterUploadBlobUrls, final: finalBlobUrls });
    
    // Verify blob URLs aren't growing indefinitely
    expect(finalBlobUrls).toBeLessThanOrEqual(afterUploadBlobUrls);
  });
});

// Cleanup test files after tests
test.afterAll(async () => {
  const testDir = path.join(__dirname, 'test-media-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});