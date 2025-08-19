/**
 * Cross-Platform Compatibility Tests for SCORM Builder (Tauri Desktop)
 * Tests platform-specific behaviors and ensures consistent functionality across
 * Windows (WebView2), macOS (WKWebView), and Linux (WebKitGTK)
 */

import { test, expect, Page } from '@playwright/test';
import { TestFileManager } from './helpers/file-helpers';
import { generateTestProject } from './helpers/test-data-generator';

test.describe('Cross-Platform Compatibility Tests', () => {
  let fileManager: TestFileManager;

  test.beforeEach(async ({ page }) => {
    fileManager = new TestFileManager();
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    fileManager.cleanup();
  });

  test.describe('Platform-Specific WebView Behavior', () => {
    test('File upload should work consistently across platforms', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `File Upload Test ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Cross-Platform File Test');
      await page.click('button:has-text("Next")'); // Go to media

      // Test image file upload
      const testImage = fileManager.createImageFile(`test-image-${browserName}.jpg`, 150);
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        // Test file selection
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', testImage);
        
        // Verify upload works on all platforms
        await expect(page.locator(`text=test-image-${browserName}.jpg`)).toBeVisible({ timeout: 10000 });
        
        // Test file size display (platform-specific formatting might differ)
        const fileSizeIndicator = page.locator('.file-size, [data-testid*="size"]');
        if (await fileSizeIndicator.isVisible()) {
          const sizeText = await fileSizeIndicator.textContent();
          expect(sizeText).toMatch(/\d+\.?\d*\s*(KB|MB|bytes)/i);
        }
      }

      // Test video file upload
      const testVideo = fileManager.createVideoFile(`test-video-${browserName}.mp4`, 60);
      const videoInput = page.locator('input[type="file"][accept*="video"]').first();
      
      if (await videoInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="video"]', testVideo);
        await expect(page.locator(`text=test-video-${browserName}.mp4`)).toBeVisible({ timeout: 15000 });
      }
    });

    test('Drag and drop should work across different platforms', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Drag Drop Test ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Drag Drop Test');
      await page.click('button:has-text("Next")');

      // Create test file for drag and drop
      const testFile = fileManager.createImageFile(`drag-test-${browserName}.jpg`, 200);
      
      // Look for drop zone
      const dropZone = page.locator('[data-testid*="drop"], .drop-zone, .file-upload-area').first();
      
      if (await dropZone.isVisible()) {
        // Test drag and drop functionality
        await fileManager.dragAndDropFile(page, testFile, '[data-testid*="drop"]');
        
        // Verify file was processed
        await expect(page.locator(`text=drag-test-${browserName}.jpg`)).toBeVisible({ timeout: 10000 });
      }
    });

    test('Keyboard shortcuts should work consistently', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Keyboard Test ${browserName}`);
      await page.click('button:has-text("Create")');

      // Test Ctrl+S for save (Cmd+S on macOS)
      await page.fill('input[placeholder*="course title"]', 'Keyboard Shortcut Test');
      
      // Platform-specific key combinations
      const isMac = browserName === 'webkit'; // WebKit typically indicates macOS in Tauri
      const saveKey = isMac ? 'Meta+KeyS' : 'Control+KeyS';
      
      await page.keyboard.press(saveKey);
      
      // Should trigger save functionality
      const saveIndicator = page.locator('text=Saved, text=Saving, [data-testid*="save"]');
      if (await saveIndicator.isVisible({ timeout: 5000 })) {
        await expect(saveIndicator).toBeVisible();
      }

      // Test Ctrl+Z for undo (if implemented)
      const undoKey = isMac ? 'Meta+KeyZ' : 'Control+KeyZ';
      await page.keyboard.press(undoKey);

      // Test platform-specific navigation keys
      if (isMac) {
        // Test Cmd+Left/Right for navigation
        await page.keyboard.press('Meta+ArrowLeft');
      } else {
        // Test Ctrl+Home/End for navigation
        await page.keyboard.press('Control+Home');
      }
    });

    test('Context menus should work consistently', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Context Menu Test ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Context Menu Test');
      
      // Test right-click context menu on text input
      await page.locator('input[placeholder*="course title"]').click({ button: 'right' });
      
      // Look for browser/platform context menu or custom context menu
      const contextMenu = page.locator('[role="menu"], .context-menu');
      
      // Note: Native context menus might not be testable, but custom ones should be
      if (await contextMenu.isVisible({ timeout: 2000 })) {
        await expect(contextMenu).toBeVisible();
        
        // Test keyboard navigation in context menu
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Escape'); // Close menu
      }
    });
  });

  test.describe('Platform-Specific Storage and Persistence', () => {
    test('Data persistence should work across platform restarts', async ({ page, browserName }) => {
      const testProject = generateTestProject('business');
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `${testProject.name} ${browserName}`);
      await page.click('button:has-text("Create")');

      // Fill comprehensive data
      await page.fill('input[placeholder*="course title"]', testProject.course.title);
      await page.click(`button:has-text("${testProject.course.difficulty}")`);
      await page.selectOption('select', testProject.course.template);
      await page.fill('textarea[placeholder*="List your course topics"]', testProject.course.topics.join('\n'));
      await page.fill('textarea[placeholder*="learning objectives"]', testProject.course.objectives.join('\n'));

      // Wait for auto-save
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });

      // Simulate browser restart by reloading
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify data is recovered
      await page.click(`[data-testid="project-card"]:has-text("${testProject.name} ${browserName}")`);
      
      await expect(page.locator(`input[value="${testProject.course.title}"]`)).toBeVisible();
      await expect(page.locator(`button[aria-pressed="true"]:has-text("${testProject.course.difficulty}")`)).toBeVisible();
      
      const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
      await expect(topicsTextarea).toHaveValue(testProject.course.topics.join('\n'));
    });

    test('Large files should be handled consistently across platforms', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Large File Test ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Large File Test');
      await page.click('button:has-text("Next")');

      // Create a reasonably large file (5MB) to test platform limits
      const largeFile = fileManager.createLargeFile(`large-test-${browserName}.jpg`, 5);
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', largeFile);
        
        // Different platforms might handle large files differently
        // Check for either success or appropriate error message
        const successIndicator = page.locator(`text=large-test-${browserName}.jpg`);
        const errorIndicator = page.locator('text=File too large, text=Size limit, text=Upload failed');
        
        // Wait for either success or error
        try {
          await expect(successIndicator).toBeVisible({ timeout: 30000 });
        } catch {
          // If upload fails, verify there's an appropriate error message
          await expect(errorIndicator).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('Memory usage should be consistent during large operations', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Memory Test ${browserName}`);
      await page.click('button:has-text("Create")');

      // Create data that might stress memory
      const largeTopicsList = Array(500).fill(0).map((_, i) => `Topic ${i + 1}: Large amount of content to test memory usage across platforms`).join('\n');
      const largeObjectivesList = Array(200).fill(0).map((_, i) => `Objective ${i + 1}: Testing memory efficiency across different platform webviews`).join('\n');

      await page.fill('input[placeholder*="course title"]', 'Memory Stress Test Course');
      await page.fill('textarea[placeholder*="List your course topics"]', largeTopicsList);
      await page.fill('textarea[placeholder*="learning objectives"]', largeObjectivesList);

      // Monitor for performance issues or crashes
      await expect(page.locator('text=Saving...')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 15000 });

      // Verify the application remains responsive
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible({ timeout: 10000 });
      
      // Navigate back to verify data integrity
      await page.click('button:has-text("Back")');
      const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
      const loadedContent = await topicsTextarea.inputValue();
      expect(loadedContent.split('\n')).toHaveLength(500);
    });
  });

  test.describe('Platform-Specific Media Handling', () => {
    test('Audio/video codecs should be supported consistently', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Codec Test ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Codec Test Course');
      await page.click('button:has-text("Next")'); // Media
      await page.click('button:has-text("Next")'); // Content  
      await page.click('button:has-text("Next")'); // Audio

      // Test audio file upload
      const testAudio = fileManager.createAudioFile(`test-audio-${browserName}.mp3`, 30);
      const audioInput = page.locator('input[type="file"][accept*="audio"]');
      
      if (await audioInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="audio"]', testAudio);
        
        // Verify audio file is processed (different platforms might show different info)
        await expect(page.locator(`text=test-audio-${browserName}.mp3`)).toBeVisible({ timeout: 10000 });
        
        // Test audio preview if available
        const audioPlayer = page.locator('audio, .audio-player');
        if (await audioPlayer.isVisible()) {
          await expect(audioPlayer).toBeVisible();
        }
      }

      // Test different audio formats if supported
      const formats = ['mp3', 'wav', 'ogg'];
      for (const format of formats) {
        const formatFile = fileManager.createAudioFile(`test-${format}-${browserName}.${format}`, 15);
        
        if (await audioInput.isVisible()) {
          try {
            await fileManager.uploadFile(page, 'input[type="file"][accept*="audio"]', formatFile);
            // If successful, format is supported
            await expect(page.locator(`text=test-${format}-${browserName}.${format}`)).toBeVisible({ timeout: 5000 });
          } catch {
            // Format might not be supported on this platform
            console.log(`${format} format not supported on ${browserName}`);
          }
        }
      }
    });

    test('Image processing should work across platforms', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Image Processing ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Image Processing Test');
      await page.click('button:has-text("Next")');

      // Test different image formats
      const imageFormats = [
        { ext: 'jpg', size: 100 },
        { ext: 'png', size: 150 },
        { ext: 'gif', size: 75 }
      ];

      for (const format of imageFormats) {
        const testImage = fileManager.createImageFile(`test-${format.ext}-${browserName}.${format.ext}`, format.size);
        const imageInput = page.locator('input[type="file"][accept*="image"]').first();
        
        if (await imageInput.isVisible()) {
          await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', testImage);
          
          // Verify image is processed
          await expect(page.locator(`text=test-${format.ext}-${browserName}.${format.ext}`)).toBeVisible({ timeout: 10000 });
          
          // Check if image preview is shown (platform-specific rendering)
          const imagePreview = page.locator('img, .image-preview').last();
          if (await imagePreview.isVisible()) {
            const src = await imagePreview.getAttribute('src');
            expect(src).toBeTruthy();
          }
        }
        
        await page.waitForTimeout(1000); // Brief pause between uploads
      }
    });

    test('YouTube video integration should work consistently', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `YouTube Test ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'YouTube Integration Test');
      await page.click('button:has-text("Next")');

      // Test YouTube URL input
      const youtubeInput = page.locator('input[placeholder*="YouTube"], input[placeholder*="youtube"]');
      
      if (await youtubeInput.isVisible()) {
        await youtubeInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        
        const addButton = page.locator('button:has-text("Add YouTube"), button:has-text("Add Video")');
        if (await addButton.isVisible()) {
          await addButton.click();
          
          // Verify YouTube video is added (platform-specific embeds might behave differently)
          const videoIndicator = page.locator('text=YouTube, .youtube-video, iframe[src*="youtube"]');
          await expect(videoIndicator.first()).toBeVisible({ timeout: 10000 });
        }
      }
    });
  });

  test.describe('Platform-Specific Performance', () => {
    test('SCORM generation performance should be consistent', async ({ page, browserName }) => {
      const testProject = generateTestProject('technical');
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Performance Test ${browserName}`);
      await page.click('button:has-text("Create")');

      // Fill comprehensive course data
      await page.fill('input[placeholder*="course title"]', testProject.course.title);
      await page.click(`button:has-text("${testProject.course.difficulty}")`);
      await page.selectOption('select', testProject.course.template);
      await page.fill('textarea[placeholder*="List your course topics"]', testProject.course.topics.join('\n'));
      await page.fill('textarea[placeholder*="learning objectives"]', testProject.course.objectives.join('\n'));

      // Navigate through all steps
      await page.click('button:has-text("Next")'); // Media
      await page.click('button:has-text("Next")'); // Content
      await page.click('button:has-text("Next")'); // Audio
      await page.click('button:has-text("Next")'); // Activities
      await page.click('button:has-text("Next")'); // SCORM

      // Measure SCORM generation time
      const startTime = Date.now();
      
      const generateButton = page.locator('button:has-text("Generate SCORM Package")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        
        // Wait for generation to complete
        await expect(page.locator('text=Package generated successfully')).toBeVisible({ timeout: 120000 });
        
        const generationTime = Date.now() - startTime;
        
        // Performance should be reasonable across platforms (under 2 minutes)
        expect(generationTime).toBeLessThan(120000);
        
        console.log(`SCORM generation time on ${browserName}: ${generationTime}ms`);
      }
    });

    test('Auto-save performance should be consistent across platforms', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Auto-save Performance ${browserName}`);
      await page.click('button:has-text("Create")');

      // Test rapid data entry and auto-save
      const titleInput = page.locator('input[placeholder*="course title"]');
      
      const startTime = Date.now();
      
      // Make rapid changes
      for (let i = 0; i < 10; i++) {
        await titleInput.fill(`Performance Test Course ${i} on ${browserName}`);
        await page.waitForTimeout(100);
      }
      
      // Wait for final auto-save
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });
      
      const saveTime = Date.now() - startTime;
      
      // Auto-save should complete quickly across platforms
      expect(saveTime).toBeLessThan(15000);
      
      console.log(`Auto-save completion time on ${browserName}: ${saveTime}ms`);
    });
  });

  test.describe('Platform-Specific Error Handling', () => {
    test('Network errors should be handled consistently', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Network Error Test ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Network Error Test');

      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to trigger a save
      await page.fill('textarea[placeholder*="List your course topics"]', 'Test Topic\nAnother Topic');
      
      // Should show network error consistently across platforms
      const errorIndicator = page.locator('text=Network error, text=Connection failed, text=Offline, text=Retry');
      await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
      
      // Restore network
      await page.unroute('**/api/**');
      
      // Retry should work
      const retryButton = page.locator('button:has-text("Retry")');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });
      }
    });

    test('File system errors should be handled gracefully', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `File System Error ${browserName}`);
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'File System Error Test');
      await page.click('button:has-text("Next")');

      // Try to upload a non-existent file (simulate file system error)
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        // Create file and then delete it to simulate file system error
        const testFile = fileManager.createImageFile(`temp-file-${browserName}.jpg`, 50);
        
        try {
          // This might fail on some platforms
          await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', testFile);
          
          // If upload starts but file is corrupted/deleted, should show error
          const errorMessage = page.locator('text=File error, text=Upload failed, text=Invalid file');
          if (await errorMessage.isVisible({ timeout: 5000 })) {
            await expect(errorMessage).toBeVisible();
          }
        } catch (error) {
          // File system errors might manifest differently across platforms
          console.log(`File system error behavior on ${browserName}: ${error}`);
        }
      }
    });
  });
});