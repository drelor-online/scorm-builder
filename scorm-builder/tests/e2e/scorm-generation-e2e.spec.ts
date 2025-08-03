import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

// Helper to create test files
const createTestFile = (filename: string, content: Buffer | string) => {
  const testDir = path.join(__dirname, 'test-scorm-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const filePath = path.join(testDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

// Helper to create valid media files
const createTestMedia = () => {
  // Valid PNG image
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
    0x01, 0x01, 0x01, 0x00, 0x1B, 0x7C, 0x73, 0x4D,
    0x0A, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  createTestFile('scorm-test-image.png', pngData);

  // Valid MP3 audio
  const mp3Data = Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // ID3v2
    Buffer.from([0xFF, 0xFB, 0x90, 0x00]), // MP3 frame header
    Buffer.alloc(100, 0x00) // Silent frame
  ]);
  createTestFile('welcome-narration.mp3', mp3Data);
  createTestFile('objectives-narration.mp3', mp3Data);
  createTestFile('topic1-narration.mp3', mp3Data);
  createTestFile('topic2-narration.mp3', mp3Data);
};

// Helper to find and extract SCORM package
const extractScormPackage = async (downloadPath: string): Promise<string> => {
  const files = fs.readdirSync(downloadPath);
  const scormFile = files.find(f => f.endsWith('.zip'));
  
  if (!scormFile) {
    throw new Error('No SCORM package found in download directory');
  }

  const extractPath = path.join(downloadPath, 'extracted');
  fs.mkdirSync(extractPath, { recursive: true });

  // Extract using native tools based on platform
  if (process.platform === 'win32') {
    // Use PowerShell on Windows
    await new Promise((resolve, reject) => {
      const ps = spawn('powershell', [
        '-Command',
        `Expand-Archive -Path "${path.join(downloadPath, scormFile)}" -DestinationPath "${extractPath}" -Force`
      ]);
      ps.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`Extract failed with code ${code}`)));
    });
  } else {
    // Use unzip on Unix-like systems
    await new Promise((resolve, reject) => {
      const unzip = spawn('unzip', ['-o', path.join(downloadPath, scormFile), '-d', extractPath]);
      unzip.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`Extract failed with code ${code}`)));
    });
  }

  return extractPath;
};

test.beforeAll(async () => {
  createTestMedia();
});

test.describe('SCORM Generation E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test('1. Generate SCORM package with all media types', async ({ page, context }) => {
    // Set up download handling
    const downloadPromise = page.waitForEvent('download');

    // Create a new project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'SCORM Generation Test');
    await page.click('button:has-text("Create")');

    // Configure course
    await page.fill('input[placeholder*="course title"]', 'Complete SCORM Test Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Introduction to Testing\nAdvanced Testing Techniques');
    await page.click('button:has-text("Medium")'); // Select difficulty

    // Navigate to Media Enhancement
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');

    // Upload welcome image
    const welcomeImageInput = page.locator('[data-testid="welcome-image-input"]');
    await welcomeImageInput.setInputFiles(path.join(__dirname, 'test-scorm-files', 'scorm-test-image.png'));
    await page.waitForSelector('[data-testid="upload-progress-complete"]');

    // Add YouTube video for topic 1
    const youtubeInput = page.locator('input[placeholder*="YouTube URL"]');
    await youtubeInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Add YouTube Video")');
    await page.waitForSelector('iframe[src*="youtube.com/embed"]');

    // Navigate to Content Review
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Content Review")');

    // Navigate to Audio Narration
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Audio Narration")');

    // Upload audio files for different pages
    const audioFiles = [
      { selector: '[data-testid="welcome-audio-input"]', file: 'welcome-narration.mp3' },
      { selector: '[data-testid="objectives-audio-input"]', file: 'objectives-narration.mp3' },
      { selector: '[data-testid="topic-0-audio-input"]', file: 'topic1-narration.mp3' },
      { selector: '[data-testid="topic-1-audio-input"]', file: 'topic2-narration.mp3' }
    ];

    for (const { selector, file } of audioFiles) {
      const input = page.locator(selector);
      if (await input.isVisible()) {
        await input.setInputFiles(path.join(__dirname, 'test-scorm-files', file));
        await page.waitForTimeout(500); // Allow time for processing
      }
    }

    // Navigate to Activities Editor
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Activities")');

    // Add a simple knowledge check
    await page.click('button:has-text("Add Knowledge Check")');
    await page.fill('[data-testid="question-input"]', 'What is the main topic of this course?');
    await page.fill('[data-testid="correct-answer-input"]', 'Testing');
    await page.fill('[data-testid="incorrect-answer-1-input"]', 'Development');
    await page.fill('[data-testid="incorrect-answer-2-input"]', 'Design');

    // Navigate to SCORM Package Builder
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Export SCORM Package")');

    // Generate SCORM package
    await page.click('button:has-text("Generate SCORM Package")');

    // Wait for download
    const download = await downloadPromise;
    const downloadPath = await download.path();
    
    expect(downloadPath).toBeTruthy();

    // Extract and verify package contents
    const extractPath = await extractScormPackage(path.dirname(downloadPath!));
    
    // Verify manifest file exists
    const manifestPath = path.join(extractPath, 'imsmanifest.xml');
    expect(fs.existsSync(manifestPath)).toBe(true);

    // Verify index.html exists
    const indexPath = path.join(extractPath, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);

    // Read and verify index.html content
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    
    // Verify media references
    expect(indexContent).toContain('welcome-narration.mp3');
    expect(indexContent).toContain('objectives-narration.mp3');
    expect(indexContent).toContain('topic1-narration.mp3');
    expect(indexContent).toContain('topic2-narration.mp3');
    
    // Verify YouTube iframe is properly embedded
    expect(indexContent).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(indexContent).not.toContain('asset.localhost'); // Should not be converted

    // Verify knowledge check is included
    expect(indexContent).toContain('What is the main topic of this course?');

    // Verify audio files exist in media folder
    const mediaPath = path.join(extractPath, 'media');
    expect(fs.existsSync(path.join(mediaPath, 'welcome-narration.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(mediaPath, 'objectives-narration.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(mediaPath, 'topic1-narration.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(mediaPath, 'topic2-narration.mp3'))).toBe(true);

    // Cleanup
    fs.rmSync(path.dirname(downloadPath!), { recursive: true, force: true });
  });

  test('2. Audio files maintain correct page associations', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    // Create project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Audio ID Test');
    await page.click('button:has-text("Create")');

    // Configure with multiple topics
    await page.fill('input[placeholder*="course title"]', 'Audio ID Test Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic One\nTopic Two\nTopic Three');

    // Skip to Audio Narration
    await page.click('button:has-text("Next")'); // Media
    await page.click('button:has-text("Next")'); // Content Review
    await page.click('button:has-text("Next")'); // Audio

    // Upload audio files and track their assignments
    const audioMappings = [
      { page: 'welcome', file: 'welcome-narration.mp3', expectedId: 'audio-0' },
      { page: 'objectives', file: 'objectives-narration.mp3', expectedId: 'audio-1' },
      { page: 'topic-0', file: 'topic1-narration.mp3', expectedId: 'audio-2' },
      { page: 'topic-1', file: 'topic2-narration.mp3', expectedId: 'audio-3' }
    ];

    for (const { page: pageType, file } of audioMappings) {
      const input = page.locator(`[data-testid="${pageType}-audio-input"]`);
      if (await input.isVisible()) {
        await input.setInputFiles(path.join(__dirname, 'test-scorm-files', file));
        await page.waitForTimeout(500);
      }
    }

    // Skip to SCORM generation
    await page.click('button:has-text("Next")'); // Activities
    await page.click('button:has-text("Next")'); // SCORM Builder

    // Generate package
    await page.click('button:has-text("Generate SCORM Package")');
    const download = await downloadPromise;
    const downloadPath = await download.path();

    // Extract and verify
    const extractPath = await extractScormPackage(path.dirname(downloadPath!));
    const indexContent = fs.readFileSync(path.join(extractPath, 'index.html'), 'utf-8');

    // Verify audio IDs are correctly mapped to pages
    // Welcome page should have audio-0
    const welcomeMatch = indexContent.match(/page-welcome[\s\S]*?audio[^"]*"([^"]+)"/);
    expect(welcomeMatch?.[1]).toContain('welcome-narration.mp3');

    // Objectives page should have audio-1
    const objectivesMatch = indexContent.match(/page-objectives[\s\S]*?audio[^"]*"([^"]+)"/);
    expect(objectivesMatch?.[1]).toContain('objectives-narration.mp3');

    // Topics should have sequential IDs starting from audio-2
    const topic1Match = indexContent.match(/page-topic-0[\s\S]*?audio[^"]*"([^"]+)"/);
    expect(topic1Match?.[1]).toContain('topic1-narration.mp3');

    // Cleanup
    fs.rmSync(path.dirname(downloadPath!), { recursive: true, force: true });
  });

  test('3. YouTube videos generate proper iframes', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    // Create project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'YouTube Iframe Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'YouTube Test Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Video Topic 1\nVideo Topic 2');

    // Navigate to Media Enhancement
    await page.click('button:has-text("Next")');

    // Add multiple YouTube videos
    const youtubeUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=9bZkp7q19f0',
      'https://youtu.be/kJQP7kiw5Fk' // Short URL format
    ];

    for (const url of youtubeUrls) {
      const input = page.locator('input[placeholder*="YouTube URL"]');
      await input.fill(url);
      await page.click('button:has-text("Add YouTube Video")');
      await page.waitForTimeout(500);
    }

    // Navigate to SCORM generation
    await page.click('button:has-text("Next")'); // Content Review
    await page.click('button:has-text("Next")'); // Audio
    await page.click('button:has-text("Next")'); // Activities
    await page.click('button:has-text("Next")'); // SCORM Builder

    // Generate package
    await page.click('button:has-text("Generate SCORM Package")');
    const download = await downloadPromise;
    const downloadPath = await download.path();

    // Extract and verify
    const extractPath = await extractScormPackage(path.dirname(downloadPath!));
    const indexContent = fs.readFileSync(path.join(extractPath, 'index.html'), 'utf-8');

    // Verify YouTube iframes are properly generated
    expect(indexContent).toContain('<iframe');
    expect(indexContent).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(indexContent).toContain('youtube.com/embed/9bZkp7q19f0');
    expect(indexContent).toContain('youtube.com/embed/kJQP7kiw5Fk'); // Short URL should be converted

    // Verify iframe attributes
    const iframeMatch = indexContent.match(/<iframe[^>]+youtube\.com\/embed[^>]+>/);
    expect(iframeMatch?.[0]).toContain('allowfullscreen');
    expect(iframeMatch?.[0]).toContain('frameborder="0"');

    // Verify no asset.localhost URLs
    expect(indexContent).not.toContain('asset.localhost');

    // Cleanup
    fs.rmSync(path.dirname(downloadPath!), { recursive: true, force: true });
  });

  test('4. SCORM package includes all required files', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    // Create minimal project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'SCORM Structure Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Structure Test Course');

    // Navigate to SCORM generation (minimal path)
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    // Generate package
    await page.click('button:has-text("Generate SCORM Package")');
    const download = await downloadPromise;
    const downloadPath = await download.path();

    // Extract and verify structure
    const extractPath = await extractScormPackage(path.dirname(downloadPath!));

    // Required SCORM files
    const requiredFiles = [
      'imsmanifest.xml',
      'index.html',
      'scorm_api.js',
      'media/' // Media directory should exist even if empty
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(extractPath, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }

    // Verify manifest structure
    const manifestContent = fs.readFileSync(path.join(extractPath, 'imsmanifest.xml'), 'utf-8');
    expect(manifestContent).toContain('<manifest');
    expect(manifestContent).toContain('<organizations');
    expect(manifestContent).toContain('<resources');
    expect(manifestContent).toContain('index.html');

    // Verify SCORM API is properly included
    const apiContent = fs.readFileSync(path.join(extractPath, 'scorm_api.js'), 'utf-8');
    expect(apiContent).toContain('API');
    expect(apiContent).toContain('LMSInitialize');
    expect(apiContent).toContain('LMSCommit');
    expect(apiContent).toContain('LMSFinish');

    // Cleanup
    fs.rmSync(path.dirname(downloadPath!), { recursive: true, force: true });
  });

  test('5. Large media files are handled correctly', async ({ page }) => {
    // Create a larger test file (1MB)
    const largeMp3 = Buffer.concat([
      Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      Buffer.alloc(1024 * 1024, 0xFF) // 1MB of data
    ]);
    createTestFile('large-audio.mp3', largeMp3);

    const downloadPromise = page.waitForEvent('download');

    // Create project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Large Media Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Large Media Course');

    // Navigate to Audio
    await page.click('button:has-text("Next")'); // Media
    await page.click('button:has-text("Next")'); // Content Review
    await page.click('button:has-text("Next")'); // Audio

    // Upload large file with progress tracking
    const audioInput = page.locator('[data-testid="welcome-audio-input"]');
    await audioInput.setInputFiles(path.join(__dirname, 'test-scorm-files', 'large-audio.mp3'));

    // Wait for upload with timeout
    await page.waitForSelector('[data-testid="audio-upload-complete"]', { timeout: 30000 });

    // Navigate to SCORM generation
    await page.click('button:has-text("Next")'); // Activities
    await page.click('button:has-text("Next")'); // SCORM Builder

    // Generate package
    await page.click('button:has-text("Generate SCORM Package")');

    // Wait for download with extended timeout
    const download = await downloadPromise;
    const downloadPath = await download.path();

    // Verify large file is included
    const extractPath = await extractScormPackage(path.dirname(downloadPath!));
    const largeAudioPath = path.join(extractPath, 'media', 'large-audio.mp3');
    
    expect(fs.existsSync(largeAudioPath)).toBe(true);
    
    const stats = fs.statSync(largeAudioPath);
    expect(stats.size).toBeGreaterThan(1024 * 1024); // Should be > 1MB

    // Cleanup
    fs.rmSync(path.dirname(downloadPath!), { recursive: true, force: true });
    fs.unlinkSync(path.join(__dirname, 'test-scorm-files', 'large-audio.mp3'));
  });
});

// Cleanup
test.afterAll(async () => {
  const testDir = path.join(__dirname, 'test-scorm-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});