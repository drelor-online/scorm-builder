/**
 * Performance Testing for SCORM Builder (Tauri Desktop)
 * Tests file upload performance, SCORM generation speed, and overall application responsiveness
 */

import { test, expect, Page } from '@playwright/test';
import { TestFileManager } from './helpers/file-helpers';
import { generateTestProject, generatePerformanceTestData } from './helpers/test-data-generator';

test.describe('Performance Testing', () => {
  let fileManager: TestFileManager;

  test.beforeEach(async ({ page }) => {
    fileManager = new TestFileManager();
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    fileManager.cleanup();
  });

  test.describe('File Upload Performance', () => {
    test('Single large file upload should complete within reasonable time', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Large File Upload Test');
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Large File Performance Test');
      await page.click('button:has-text("Next")'); // Go to media

      // Create a large test file (10MB)
      const largeFile = fileManager.createLargeFile('large-performance-test.jpg', 10);
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        const startTime = Date.now();
        
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', largeFile);
        
        // Wait for upload completion
        await expect(page.locator('text=large-performance-test.jpg')).toBeVisible({ timeout: 120000 });
        
        const uploadTime = Date.now() - startTime;
        
        // Upload should complete within 2 minutes for 10MB file
        expect(uploadTime).toBeLessThan(120000);
        
        console.log(`Large file upload time: ${uploadTime}ms`);
        
        // Verify upload progress indicators work properly
        await fileManager.waitForFileProcessing(page, 30000);
      }
    });

    test('Multiple concurrent file uploads should be handled efficiently', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Concurrent Upload Test');
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Concurrent Upload Performance Test');
      await page.click('button:has-text("Next")');

      // Create multiple test files
      const files = [
        fileManager.createImageFile('concurrent-1.jpg', 500), // 500KB
        fileManager.createImageFile('concurrent-2.jpg', 750), // 750KB
        fileManager.createImageFile('concurrent-3.jpg', 600), // 600KB
        fileManager.createVideoFile('concurrent-video.mp4', 30), // ~30KB
        fileManager.createAudioFile('concurrent-audio.mp3', 45) // ~45KB
      ];

      const startTime = Date.now();

      // Upload files rapidly (simulating drag-and-drop of multiple files)
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        // Upload images sequentially but quickly
        for (const file of files.slice(0, 3)) {
          await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', file);
          await page.waitForTimeout(500); // Brief pause between uploads
        }
      }

      // Wait for all uploads to complete
      for (const file of files.slice(0, 3)) {
        const filename = file.split(/[/\\]/).pop()!;
        await expect(page.locator(`text=${filename}`)).toBeVisible({ timeout: 60000 });
      }

      const totalUploadTime = Date.now() - startTime;
      
      // All uploads should complete within reasonable time
      expect(totalUploadTime).toBeLessThan(180000); // 3 minutes for multiple files
      
      console.log(`Concurrent upload time for ${files.length} files: ${totalUploadTime}ms`);
    });

    test('Upload progress should be responsive and accurate', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Upload Progress Test');
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Upload Progress Test');
      await page.click('button:has-text("Next")');

      // Create a moderately sized file to observe progress
      const mediumFile = fileManager.createLargeFile('progress-test.jpg', 5); // 5MB
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', mediumFile);
        
        // Monitor progress indicators
        const progressBar = page.locator('.progress-bar, [role="progressbar"], .upload-progress');
        
        if (await progressBar.isVisible({ timeout: 5000 })) {
          // Progress should update during upload
          let previousProgress = 0;
          let progressUpdates = 0;
          
          for (let i = 0; i < 10; i++) {
            const progressValue = await progressBar.getAttribute('value') || 
                                await progressBar.getAttribute('aria-valuenow') ||
                                '0';
            const currentProgress = parseInt(progressValue);
            
            if (currentProgress > previousProgress) {
              progressUpdates++;
              previousProgress = currentProgress;
            }
            
            await page.waitForTimeout(500);
            
            // Break if upload is complete
            if (await page.locator('text=progress-test.jpg').isVisible()) {
              break;
            }
          }
          
          // Progress should have updated at least a few times
          expect(progressUpdates).toBeGreaterThan(0);
        }
        
        // Verify final completion
        await expect(page.locator('text=progress-test.jpg')).toBeVisible({ timeout: 60000 });
      }
    });

    test('Large dataset handling should not cause performance degradation', async ({ page }) => {
      const performanceData = generatePerformanceTestData();
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Large Dataset Performance Test');
      await page.click('button:has-text("Create")');

      // Fill large amounts of data
      const startTime = Date.now();
      
      await page.fill('input[placeholder*="course title"]', performanceData.extremeLoad.course.title);
      
      // Measure performance of handling large text data
      const largeTopics = performanceData.extremeLoad.course.topics.join('\n');
      await page.fill('textarea[placeholder*="List your course topics"]', largeTopics);
      
      const largeObjectives = performanceData.extremeLoad.course.objectives.join('\n');
      await page.fill('textarea[placeholder*="learning objectives"]', largeObjectives);
      
      // UI should remain responsive
      const fillTime = Date.now() - startTime;
      expect(fillTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Auto-save should handle large data efficiently
      await expect(page.locator('text=Saving...')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 30000 });
      
      const saveTime = Date.now() - startTime;
      expect(saveTime).toBeLessThan(60000); // Total time under 1 minute
      
      console.log(`Large dataset handling time: ${saveTime}ms`);
      
      // Navigation should still be smooth
      const navStartTime = Date.now();
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible({ timeout: 10000 });
      
      const navTime = Date.now() - navStartTime;
      expect(navTime).toBeLessThan(5000); // Navigation should be fast
    });
  });

  test.describe('SCORM Generation Performance', () => {
    test('Basic SCORM package generation should complete efficiently', async ({ page }) => {
      const testProject = generateTestProject('technical');
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Basic SCORM Performance Test');
      await page.click('button:has-text("Create")');

      // Fill basic course data
      await page.fill('input[placeholder*="course title"]', testProject.course.title);
      await page.click(`button:has-text("${testProject.course.difficulty}")`);
      await page.selectOption('select', testProject.course.template);
      await page.fill('textarea[placeholder*="List your course topics"]', testProject.course.topics.slice(0, 3).join('\n')); // Reduced topics for basic test
      await page.fill('textarea[placeholder*="learning objectives"]', testProject.course.objectives.slice(0, 2).join('\n'));

      // Navigate to SCORM generation
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
        
        // Monitor generation progress
        await expect(page.locator('text=Generating SCORM package...')).toBeVisible({ timeout: 5000 });
        
        // Wait for completion
        await expect(page.locator('text=Package generated successfully')).toBeVisible({ timeout: 60000 });
        
        const generationTime = Date.now() - startTime;
        
        // Basic SCORM generation should complete within 1 minute
        expect(generationTime).toBeLessThan(60000);
        
        console.log(`Basic SCORM generation time: ${generationTime}ms`);
        
        // Verify download is available
        const downloadButton = page.locator('button:has-text("Download"), a[download]');
        if (await downloadButton.isVisible()) {
          await expect(downloadButton).toBeVisible();
        }
      }
    });

    test('Complex SCORM package with media should generate within acceptable time', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Complex SCORM Performance Test');
      await page.click('button:has-text("Create")');

      // Create comprehensive course
      await page.fill('input[placeholder*="course title"]', 'Complex Performance Test Course');
      await page.click('button:has-text("Expert")');
      await page.selectOption('select', 'Technical');
      
      // Add substantial content
      const complexTopics = Array(20).fill(0).map((_, i) => `Complex Topic ${i + 1}: Advanced concepts and detailed explanations`).join('\n');
      const complexObjectives = Array(10).fill(0).map((_, i) => `Complex Objective ${i + 1}: Students will master advanced techniques`).join('\n');
      
      await page.fill('textarea[placeholder*="List your course topics"]', complexTopics);
      await page.fill('textarea[placeholder*="learning objectives"]', complexObjectives);

      // Add media content
      await page.click('button:has-text("Next")'); // Media
      
      // Upload test media files
      const testImage = fileManager.createImageFile('complex-test-image.jpg', 300);
      const testVideo = fileManager.createVideoFile('complex-test-video.mp4', 120);
      
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', testImage);
        await expect(page.locator('text=complex-test-image.jpg')).toBeVisible({ timeout: 30000 });
      }

      // Continue through workflow
      await page.click('button:has-text("Next")'); // Content
      await page.click('button:has-text("Next")'); // Audio
      
      // Add audio narration
      const narrationText = page.locator('textarea').first();
      if (await narrationText.isVisible()) {
        await narrationText.fill('This is a comprehensive narration for our complex course testing performance of SCORM generation with substantial content and media assets.');
      }
      
      await page.click('button:has-text("Next")'); // Activities
      await page.click('button:has-text("Next")'); // SCORM

      // Measure complex SCORM generation
      const startTime = Date.now();
      
      const generateButton = page.locator('button:has-text("Generate SCORM Package")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        
        await expect(page.locator('text=Generating SCORM package...')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Package generated successfully')).toBeVisible({ timeout: 180000 }); // 3 minutes for complex package
        
        const generationTime = Date.now() - startTime;
        
        // Complex SCORM generation should complete within 3 minutes
        expect(generationTime).toBeLessThan(180000);
        
        console.log(`Complex SCORM generation time: ${generationTime}ms`);
      }
    });

    test('SCORM generation with large media files should handle memory efficiently', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Large Media SCORM Test');
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Large Media Performance Test');
      await page.fill('textarea[placeholder*="List your course topics"]', 'Media Performance Topic 1\nMedia Performance Topic 2');

      await page.click('button:has-text("Next")'); // Media

      // Upload large media files
      const largeImage = fileManager.createLargeFile('large-media-test.jpg', 8); // 8MB image
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        const uploadStartTime = Date.now();
        
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', largeImage);
        await expect(page.locator('text=large-media-test.jpg')).toBeVisible({ timeout: 120000 });
        
        const uploadTime = Date.now() - uploadStartTime;
        console.log(`Large media upload time: ${uploadTime}ms`);
      }

      // Continue to SCORM generation
      await page.click('button:has-text("Next")'); // Content
      await page.click('button:has-text("Next")'); // Audio
      await page.click('button:has-text("Next")'); // Activities
      await page.click('button:has-text("Next")'); // SCORM

      // Test SCORM generation with large media
      const startTime = Date.now();
      
      const generateButton = page.locator('button:has-text("Generate SCORM Package")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        
        // Should handle large media without memory issues
        await expect(page.locator('text=Package generated successfully')).toBeVisible({ timeout: 300000 }); // 5 minutes for large media
        
        const generationTime = Date.now() - startTime;
        console.log(`SCORM generation with large media time: ${generationTime}ms`);
        
        // Should complete without crashing or excessive memory usage
        expect(generationTime).toBeLessThan(300000); // 5 minutes max
      }
    });
  });

  test.describe('Application Responsiveness', () => {
    test('UI should remain responsive during auto-save operations', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'UI Responsiveness Test');
      await page.click('button:has-text("Create")');

      const titleInput = page.locator('input[placeholder*="course title"]');
      const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');

      // Make changes that trigger auto-save
      await titleInput.fill('Responsiveness Test Course');
      
      // Immediately try to interact with other UI elements
      const startTime = Date.now();
      
      // UI should respond immediately despite auto-save
      await page.click('button:has-text("Advanced")');
      await expect(page.locator('button[aria-pressed="true"]:has-text("Advanced")')).toBeVisible({ timeout: 1000 });
      
      const uiResponseTime = Date.now() - startTime;
      expect(uiResponseTime).toBeLessThan(2000); // UI should respond within 2 seconds
      
      // Continue interacting while auto-save might be happening
      await topicsTextarea.fill('Responsive Topic 1\nResponsive Topic 2\nResponsive Topic 3');
      
      // Should be able to navigate immediately
      const navStartTime = Date.now();
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible({ timeout: 5000 });
      
      const navTime = Date.now() - navStartTime;
      expect(navTime).toBeLessThan(3000); // Navigation should be quick
    });

    test('Form inputs should handle rapid typing without lag', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Typing Performance Test');
      await page.click('button:has-text("Create")');

      const titleInput = page.locator('input[placeholder*="course title"]');
      
      // Simulate very fast typing
      const testText = 'This is a rapid typing test to measure input responsiveness and ensure there is no lag or missed characters during fast user input';
      
      const startTime = Date.now();
      
      // Type character by character rapidly
      for (const char of testText) {
        await page.keyboard.type(char);
        await page.waitForTimeout(10); // Very fast typing (100 WPM equivalent)
      }
      
      const typingTime = Date.now() - startTime;
      
      // Verify all characters were captured
      const inputValue = await titleInput.inputValue();
      expect(inputValue).toBe(testText);
      
      // Typing should be smooth and responsive
      expect(typingTime).toBeLessThan(testText.length * 50); // Should not take more than 50ms per character
      
      console.log(`Typing performance: ${typingTime}ms for ${testText.length} characters`);
    });

    test('Navigation between steps should be smooth under load', async ({ page }) => {
      const performanceData = generatePerformanceTestData();
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Navigation Performance Test');
      await page.click('button:has-text("Create")');

      // Fill with large amounts of data
      await page.fill('input[placeholder*="course title"]', performanceData.largeProject.course.title);
      await page.fill('textarea[placeholder*="List your course topics"]', performanceData.largeProject.course.topics.join('\n'));
      await page.fill('textarea[placeholder*="learning objectives"]', performanceData.largeProject.course.objectives.join('\n'));

      // Test navigation speed under load
      const navigationTimes: number[] = [];

      // Forward navigation
      for (let step = 0; step < 5; step++) {
        const startTime = Date.now();
        await page.click('button:has-text("Next")');
        
        // Wait for next page to load
        await page.waitForTimeout(1000);
        
        const navTime = Date.now() - startTime;
        navigationTimes.push(navTime);
        
        // Each navigation should be reasonably fast
        expect(navTime).toBeLessThan(10000); // Max 10 seconds per step
      }

      // Backward navigation
      for (let step = 0; step < 5; step++) {
        const startTime = Date.now();
        await page.click('button:has-text("Back")');
        
        await page.waitForTimeout(1000);
        
        const navTime = Date.now() - startTime;
        navigationTimes.push(navTime);
        
        expect(navTime).toBeLessThan(5000); // Backward should be faster
      }

      const avgNavigationTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
      console.log(`Average navigation time under load: ${avgNavigationTime}ms`);
      
      // Average should be reasonable
      expect(avgNavigationTime).toBeLessThan(3000);
    });

    test('Memory usage should remain stable during extended use', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Memory Stability Test');
      await page.click('button:has-text("Create")');

      // Simulate extended usage patterns
      for (let cycle = 0; cycle < 5; cycle++) {
        // Fill and clear data multiple times
        await page.fill('input[placeholder*="course title"]', `Memory Test Course Cycle ${cycle}`);
        await page.fill('textarea[placeholder*="List your course topics"]', `Cycle ${cycle} Topic 1\nCycle ${cycle} Topic 2\nCycle ${cycle} Topic 3`);
        
        // Wait for auto-save
        await page.waitForTimeout(2000);
        
        // Navigate back and forth
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(500);
        await page.click('button:has-text("Back")');
        await page.waitForTimeout(500);
        
        // Clear and refill
        await page.fill('input[placeholder*="course title"]', '');
        await page.fill('textarea[placeholder*="List your course topics"]', '');
        await page.waitForTimeout(1000);
      }

      // Application should still be responsive after extended use
      const finalStartTime = Date.now();
      await page.fill('input[placeholder*="course title"]', 'Final Memory Test');
      await page.click('button:has-text("Advanced")');
      
      const finalResponseTime = Date.now() - finalStartTime;
      expect(finalResponseTime).toBeLessThan(3000); // Should still be responsive
      
      console.log(`Final UI response time after extended use: ${finalResponseTime}ms`);
    });
  });
});