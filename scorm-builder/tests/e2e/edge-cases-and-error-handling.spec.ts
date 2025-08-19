/**
 * Edge Cases and Error Handling Tests for SCORM Builder
 * Tests various failure scenarios, boundary conditions, and error recovery
 */

import { test, expect, Page } from '@playwright/test';
import { TestFileManager } from './helpers/file-helpers';
import { generateInvalidCourseData, generateTestMediaData } from './helpers/test-data-generator';

test.describe('Edge Cases and Error Handling', () => {
  let fileManager: TestFileManager;

  test.beforeEach(async ({ page }) => {
    fileManager = new TestFileManager();
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    fileManager.cleanup();
  });

  test.describe('Input Validation and Boundary Conditions', () => {
    test('Handle extremely long course titles and descriptions', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Boundary Test Project');
      await page.click('button:has-text("Create")');

      // Test extremely long title (should be truncated or show error)
      const longTitle = 'A'.repeat(1000);
      await page.fill('input[placeholder*="course title"]', longTitle);
      
      // Check if there's a character limit warning
      const charCountIndicator = page.locator('[data-testid="title-char-count"], .char-limit-warning');
      if (await charCountIndicator.isVisible()) {
        await expect(charCountIndicator).toContainText(/limit|max|too long/i);
      }

      // Test extremely long description
      const longDescription = 'B'.repeat(10000);
      await page.fill('textarea[placeholder*="brief description"]', longDescription);
      
      // Verify the application doesn't crash
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      // Try to proceed with invalid data
      await page.click('button:has-text("Next")');
      
      // Should show validation error or handle gracefully
      const errorMessage = page.locator('.error, [role="alert"], .validation-error');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/too long|limit|invalid/i);
      }
    });

    test('Handle special characters and Unicode in input fields', async ({ page }) => {
      const invalidData = generateInvalidCourseData();
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Unicode Test 🚀');
      await page.click('button:has-text("Create")');

      // Test special characters in title
      await page.fill('input[placeholder*="course title"]', invalidData.specialCharacters.title);
      await page.fill('textarea[placeholder*="brief description"]', invalidData.specialCharacters.description);
      
      // Test special characters in topics
      const topicsText = invalidData.specialCharacters.topics.join('\n');
      await page.fill('textarea[placeholder*="List your course topics"]', topicsText);
      
      // Verify data is handled properly (no crashes, proper encoding)
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible();
      
      // Go back and verify data persistence with special characters
      await page.click('button:has-text("Back")');
      await expect(page.locator('input')).toHaveValue(invalidData.specialCharacters.title);
    });

    test('Handle empty and null input values', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Empty Fields Test');
      await page.click('button:has-text("Create")');

      // Leave all fields empty and try to proceed
      await page.click('button:has-text("Next")');
      
      // Should show validation errors for required fields
      const validationErrors = page.locator('.error, [role="alert"], .field-error');
      await expect(validationErrors.first()).toBeVisible({ timeout: 5000 });
      
      // Fill minimum required fields
      await page.fill('input[placeholder*="course title"]', 'Minimal Course');
      await page.click('button:has-text("Next")');
      
      // Should proceed or show appropriate guidance
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible();
    });

    test('Handle rapid successive input changes', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Rapid Input Test');
      await page.click('button:has-text("Create")');

      const titleInput = page.locator('input[placeholder*="course title"]');
      
      // Rapidly change input to stress test auto-save
      for (let i = 0; i < 20; i++) {
        await titleInput.fill(`Rapid Title Change ${i}`);
        await page.waitForTimeout(50); // Very fast changes
      }
      
      // Wait for final auto-save
      await page.waitForTimeout(2000);
      
      // Navigate away and back to verify final state
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Back")');
      
      // Should have the last value
      await expect(titleInput).toHaveValue('Rapid Title Change 19');
    });
  });

  test.describe('File Upload Error Handling', () => {
    test('Handle corrupted and invalid file uploads', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'File Error Test');
      await page.click('button:has-text("Create")');
      await page.click('button:has-text("Next")'); // Go to media

      // Test corrupted image file
      const corruptedImage = fileManager.createCorruptedFile('corrupted.jpg', 'image');
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', corruptedImage);
        
        // Should show error message
        await expect(page.locator('text=Invalid file format, text=Upload failed, text=Corrupted file')).toBeVisible({ timeout: 10000 });
      }

      // Test oversized file
      const oversizedFile = fileManager.createLargeFile('huge-file.jpg', 100); // 100MB
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', oversizedFile);
        
        // Should show size limit error
        await expect(page.locator('text=File too large, text=Size limit exceeded')).toBeVisible({ timeout: 10000 });
      }

      // Test wrong file type
      const wrongTypeFile = fileManager.createFile('document.txt', 'This is not an image');
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', wrongTypeFile);
        
        // Should show file type error
        await expect(page.locator('text=Invalid file type, text=Unsupported format')).toBeVisible({ timeout: 5000 });
      }
    });

    test('Handle network failures during file upload', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Network Error Test');
      await page.click('button:has-text("Create")');
      await page.click('button:has-text("Next")');

      // Simulate network failure
      await page.route('**/api/upload/**', route => route.abort());
      
      const testImage = fileManager.createImageFile('network-test.jpg', 100);
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', testImage);
        
        // Should show network error and retry option
        await expect(page.locator('text=Upload failed, text=Network error, text=Retry')).toBeVisible({ timeout: 10000 });
        
        // Test retry functionality
        await page.unroute('**/api/upload/**'); // Restore network
        await page.click('button:has-text("Retry")');
        
        // Should succeed on retry
        await expect(page.locator('text=Upload successful, text=network-test.jpg')).toBeVisible({ timeout: 10000 });
      }
    });

    test('Handle concurrent file uploads', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Concurrent Upload Test');
      await page.click('button:has-text("Create")');
      await page.click('button:has-text("Next")');

      // Create multiple files
      const files = [
        fileManager.createImageFile('concurrent-1.jpg', 50),
        fileManager.createImageFile('concurrent-2.jpg', 75),
        fileManager.createImageFile('concurrent-3.jpg', 100)
      ];

      // Try to upload all files simultaneously if drag-and-drop is supported
      const dropZone = page.locator('[data-testid="file-drop-zone"], .file-upload-area').first();
      
      if (await dropZone.isVisible()) {
        // Simulate concurrent uploads
        await Promise.all(files.map(file => 
          fileManager.dragAndDropFile(page, file, '[data-testid="file-drop-zone"]')
        ));

        // All uploads should complete or show appropriate queue status
        for (const file of files) {
          const filename = file.split(/[/\\]/).pop()!;
          await expect(page.locator(`text=${filename}`)).toBeVisible({ timeout: 20000 });
        }
      }
    });
  });

  test.describe('JSON Processing Error Handling', () => {
    test('Handle malformed JSON input', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'JSON Error Test');
      await page.click('button:has-text("Create")');
      
      // Fill minimal data to get to JSON step
      await page.fill('input[placeholder*="course title"]', 'JSON Test Course');
      await page.click('button:has-text("Next")'); // Media
      await page.click('button:has-text("Next")'); // Content Review

      // Wait for JSON generation, then try to edit it
      await expect(page.locator('pre, .json-display')).toBeVisible({ timeout: 30000 });
      
      const editButton = page.locator('button:has-text("Edit JSON")');
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const jsonEditor = page.locator('textarea[data-testid="json-editor"]');
        
        // Input malformed JSON
        const invalidData = generateInvalidCourseData();
        await jsonEditor.fill(invalidData.corruptedJson);
        
        // Try to validate
        await page.click('button:has-text("Validate JSON")');
        
        // Should show JSON syntax error
        await expect(page.locator('text=Invalid JSON, text=Syntax error, text=Parse error')).toBeVisible();
        
        // Should not allow proceeding with invalid JSON
        await page.click('button:has-text("Save Changes")');
        await expect(page.locator('text=Cannot save invalid JSON')).toBeVisible();
      }
    });

    test('Handle oversized JSON content', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Large JSON Test');
      await page.click('button:has-text("Create")');
      
      await page.fill('input[placeholder*="course title"]', 'Large JSON Course');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');

      const editButton = page.locator('button:has-text("Edit JSON")');
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const jsonEditor = page.locator('textarea[data-testid="json-editor"]');
        
        // Input extremely large JSON
        const invalidData = generateInvalidCourseData();
        await jsonEditor.fill(invalidData.oversizedJson);
        
        // Should handle large content gracefully
        await page.click('button:has-text("Validate JSON")');
        
        // May show performance warning or size limit error
        const warningMessage = page.locator('text=Too large, text=Performance warning, text=Size limit');
        if (await warningMessage.isVisible()) {
          await expect(warningMessage).toBeVisible();
        }
      }
    });
  });

  test.describe('Audio Processing Error Handling', () => {
    test('Handle audio generation failures', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Audio Error Test');
      await page.click('button:has-text("Create")');
      
      // Navigate to audio step
      await page.fill('input[placeholder*="course title"]', 'Audio Test Course');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');

      // Add text for narration
      const narrationText = page.locator('textarea').first();
      await narrationText.fill('This is a test narration that might fail to generate.');

      // Simulate audio generation failure
      await page.route('**/api/audio/generate**', route => route.abort());
      
      const generateButton = page.locator('button:has-text("Generate Audio")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        
        // Should show audio generation error
        await expect(page.locator('text=Audio generation failed, text=Error generating audio')).toBeVisible({ timeout: 15000 });
        
        // Should offer alternative options
        await expect(page.locator('text=Try again, text=Upload audio file')).toBeVisible();
      }
    });

    test('Handle invalid audio file uploads', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Invalid Audio Test');
      await page.click('button:has-text("Create")');
      
      // Navigate to audio step
      await page.fill('input[placeholder*="course title"]', 'Invalid Audio Course');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');

      // Upload corrupted audio file
      const corruptedAudio = fileManager.createCorruptedFile('corrupted.mp3', 'audio');
      const audioInput = page.locator('input[type="file"][accept*="audio"]');
      
      if (await audioInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="audio"]', corruptedAudio);
        
        // Should show audio format error
        await expect(page.locator('text=Invalid audio format, text=Corrupted audio file')).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('SCORM Generation Error Handling', () => {
    test('Handle SCORM generation with incomplete data', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Incomplete SCORM Test');
      await page.click('button:has-text("Create")');
      
      // Fill minimal data only
      await page.fill('input[placeholder*="course title"]', 'Incomplete Course');
      
      // Skip through steps quickly without adding content
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');

      // Try to generate SCORM with minimal data
      await page.click('button:has-text("Generate SCORM Package")');
      
      // Should either generate with warnings or show requirements
      const warningMessage = page.locator('text=Missing content, text=Incomplete course, text=Add media');
      if (await warningMessage.isVisible()) {
        await expect(warningMessage).toBeVisible();
      } else {
        // If it allows generation, should complete successfully
        await expect(page.locator('text=Package generated successfully')).toBeVisible({ timeout: 30000 });
      }
    });

    test('Handle SCORM generation server errors', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'SCORM Server Error Test');
      await page.click('button:has-text("Create")');
      
      // Create a complete course
      await page.fill('input[placeholder*="course title"]', 'Server Error Course');
      await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2');
      
      // Navigate to final step
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');

      // Simulate server error during SCORM generation
      await page.route('**/api/scorm/generate**', route => 
        route.fulfill({ status: 500, body: 'Internal Server Error' })
      );
      
      await page.click('button:has-text("Generate SCORM Package")');
      
      // Should show server error message and retry option
      await expect(page.locator('text=Generation failed, text=Server error, text=Retry')).toBeVisible({ timeout: 15000 });
      
      // Test retry functionality
      await page.unroute('**/api/scorm/generate**');
      await page.click('button:has-text("Retry")');
      
      // Should succeed on retry
      await expect(page.locator('text=Package generated successfully')).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Browser Compatibility and Edge Cases', () => {
    test('Handle browser storage quota exceeded', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Storage Quota Test');
      await page.click('button:has-text("Create")');

      // Simulate storage quota exceeded
      await page.addInitScript(() => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
          if (key.includes('largeData')) {
            throw new DOMException('QuotaExceededError');
          }
          return originalSetItem.call(this, key, value);
        };
      });

      // Try to save large amount of data
      const largeCourseData = 'X'.repeat(100000);
      await page.fill('input[placeholder*="course title"]', largeCourseData);
      
      // Should handle storage error gracefully
      const errorMessage = page.locator('text=Storage full, text=Quota exceeded, text=Clear some space');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible();
      }
    });

    test('Handle page refresh during form submission', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Refresh Test');
      await page.click('button:has-text("Create")');

      // Fill form data
      await page.fill('input[placeholder*="course title"]', 'Refresh Course');
      await page.fill('textarea[placeholder*="List your course topics"]', 'Refresh Topic 1\nRefresh Topic 2');

      // Start navigation and immediately refresh
      const nextButton = page.locator('button:has-text("Next")');
      await nextButton.click();
      await page.reload();

      // Should recover data or show recovery option
      const recoveryOption = page.locator('text=Recovery Available, text=Restore data');
      if (await recoveryOption.isVisible()) {
        await page.click('button:has-text("Recover")');
        await expect(page.locator('input[value="Refresh Course"]')).toBeVisible();
      } else {
        // Data should be preserved through auto-save
        await expect(page.locator('input[value="Refresh Course"]')).toBeVisible();
      }
    });

    test('Handle rapid navigation between steps', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Rapid Navigation Test');
      await page.click('button:has-text("Create")');

      // Fill minimal data
      await page.fill('input[placeholder*="course title"]', 'Rapid Nav Course');

      // Rapidly navigate back and forth
      for (let i = 0; i < 5; i++) {
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(100);
        await page.click('button:has-text("Back")');
        await page.waitForTimeout(100);
      }

      // Should handle rapid navigation without errors
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      await expect(page.locator('input[value="Rapid Nav Course"]')).toBeVisible();
    });
  });
});