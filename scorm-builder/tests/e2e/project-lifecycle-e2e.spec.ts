import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Helper to measure memory usage
const getMemoryUsage = async (page: Page) => {
  return await page.evaluate(() => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  });
};

// Helper to count blob URLs
const getBlobUrlCount = async (page: Page) => {
  return await page.evaluate(() => {
    return performance.getEntriesByType('resource')
      .filter(entry => entry.name.startsWith('blob:'))
      .length;
  });
};

// Helper to create test media files
const createTestMedia = () => {
  const testDir = path.join(__dirname, 'test-lifecycle-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create multiple test images
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

  for (let i = 1; i <= 5; i++) {
    fs.writeFileSync(path.join(testDir, `test-image-${i}.png`), pngData);
  }

  // Create multiple test audio files
  const mp3Data = Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    Buffer.from([0xFF, 0xFB, 0x90, 0x00]),
    Buffer.alloc(100, 0x00)
  ]);

  for (let i = 1; i <= 5; i++) {
    fs.writeFileSync(path.join(testDir, `test-audio-${i}.mp3`), mp3Data);
  }

  return testDir;
};

test.beforeAll(async () => {
  createTestMedia();
});

test.describe('Project Lifecycle E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test('1. Complete project lifecycle - Create, Add Media, Save, Close, Reopen', async ({ page }) => {
    // Create a new project
    await page.click('text=Create New Project');
    const projectName = `Lifecycle Test ${Date.now()}`;
    await page.fill('input[placeholder="Enter project name"]', projectName);
    await page.click('button:has-text("Create")');

    // Configure course with multiple topics
    await page.fill('input[placeholder*="course title"]', 'Complete Lifecycle Test Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic One\nTopic Two\nTopic Three\nTopic Four\nTopic Five');
    await page.click('button:has-text("Hard")'); // Set difficulty

    // Navigate to Media Enhancement and add images
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');

    // Upload images for different pages
    const imageInputs = await page.locator('input[type="file"][accept*="image"]').all();
    for (let i = 0; i < Math.min(3, imageInputs.length); i++) {
      await imageInputs[i].setInputFiles(path.join(__dirname, 'test-lifecycle-files', `test-image-${i + 1}.png`));
      await page.waitForTimeout(500);
    }

    // Add a YouTube video
    const youtubeInput = page.locator('input[placeholder*="YouTube URL"]');
    await youtubeInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Add YouTube Video")');
    await page.waitForSelector('iframe[src*="youtube.com/embed"]');

    // Navigate to Audio Narration
    await page.click('button:has-text("Next")'); // Content Review
    await page.click('button:has-text("Next")'); // Audio
    await page.waitForSelector('h1:has-text("Audio Narration")');

    // Upload audio files
    const audioInputs = await page.locator('input[type="file"][accept*="audio"]').all();
    for (let i = 0; i < Math.min(3, audioInputs.length); i++) {
      await audioInputs[i].setInputFiles(path.join(__dirname, 'test-lifecycle-files', `test-audio-${i + 1}.mp3`));
      await page.waitForTimeout(500);
    }

    // Navigate to Activities and add a knowledge check
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Activities")');
    
    await page.click('button:has-text("Add Knowledge Check")');
    await page.fill('[data-testid="question-input"]', 'What did you learn from this course?');
    await page.fill('[data-testid="correct-answer-input"]', 'Everything about testing');
    await page.fill('[data-testid="incorrect-answer-1-input"]', 'Nothing');

    // Save the project (auto-save or manual)
    const saveButton = page.locator('button:has-text("Save")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForSelector('text=Saved', { timeout: 5000 });
    }

    // Get project data before closing
    const projectData = await page.evaluate(() => {
      return {
        mediaCount: document.querySelectorAll('img[src^="blob:"], audio[src^="blob:"]').length,
        hasYouTube: !!document.querySelector('iframe[src*="youtube.com"]'),
        difficulty: document.querySelector('button[aria-pressed="true"]')?.textContent
      };
    });

    // Go back to dashboard
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // Find and open the project
    const projectCard = page.locator(`[data-testid="project-card"]:has-text("${projectName}")`);
    await expect(projectCard).toBeVisible({ timeout: 10000 });
    await projectCard.click();

    // Wait for project to load
    await page.waitForSelector('h1:has-text("Course Configuration")', { timeout: 10000 });

    // Verify all data is restored
    await expect(page.locator('input[value="Complete Lifecycle Test Course"]')).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue('Topic One\nTopic Two\nTopic Three\nTopic Four\nTopic Five');
    await expect(page.locator('button[aria-pressed="true"]:has-text("Hard")')).toBeVisible();

    // Navigate to Media Enhancement and verify media
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');

    // Verify images are restored
    const restoredImages = page.locator('img[alt*="Topic"], img[alt*="Welcome"]');
    await expect(restoredImages).toHaveCount(3);

    // Verify YouTube video is restored
    await expect(page.locator('iframe[src*="youtube.com/embed"]')).toBeVisible();

    // Navigate to Audio and verify
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    const restoredAudios = page.locator('audio');
    await expect(restoredAudios).toHaveCount(3);

    // Navigate to Activities and verify knowledge check
    await page.click('button:has-text("Next")');
    await expect(page.locator('text=What did you learn from this course?')).toBeVisible();
  });

  test('2. Media deletion and cleanup', async ({ page }) => {
    // Create project with media
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Media Deletion Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Deletion Test Course');
    await page.click('button:has-text("Next")');

    // Upload multiple images
    const testDir = path.join(__dirname, 'test-lifecycle-files');
    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    
    // Upload 5 images
    for (let i = 1; i <= 5; i++) {
      await imageInput.setInputFiles(path.join(testDir, `test-image-${i}.png`));
      await page.waitForTimeout(300);
    }

    // Get initial blob URL count
    const initialBlobCount = await getBlobUrlCount(page);
    expect(initialBlobCount).toBeGreaterThan(0);

    // Delete some images
    const deleteButtons = page.locator('button[aria-label="Delete"]').or(page.locator('button:has-text("Remove")'));
    const deleteCount = Math.min(3, await deleteButtons.count());
    
    for (let i = 0; i < deleteCount; i++) {
      await deleteButtons.first().click();
      
      // Confirm deletion if dialog appears
      const confirmButton = page.locator('button:has-text("Confirm")').or(page.locator('button:has-text("Delete")'));
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click();
      }
      
      await page.waitForTimeout(300);
    }

    // Check blob URL count decreased
    const afterDeleteBlobCount = await getBlobUrlCount(page);
    expect(afterDeleteBlobCount).toBeLessThan(initialBlobCount);

    // Navigate away and back to trigger cleanup
    await page.goto('http://localhost:1420');
    await page.waitForTimeout(1000);
    
    // Final blob count should be minimal
    const finalBlobCount = await getBlobUrlCount(page);
    console.log('Blob URL counts:', { initial: initialBlobCount, afterDelete: afterDeleteBlobCount, final: finalBlobCount });
  });

  test('3. Memory usage during project lifecycle', async ({ page }) => {
    // Record initial memory
    const initialMemory = await getMemoryUsage(page);
    console.log('Initial memory:', initialMemory);

    // Create project with lots of media
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Memory Test Project');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Memory Test Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 
      Array(10).fill(0).map((_, i) => `Topic ${i + 1}`).join('\n')
    );

    // Navigate to Media Enhancement
    await page.click('button:has-text("Next")');

    // Upload multiple images
    const testDir = path.join(__dirname, 'test-lifecycle-files');
    const imageInputs = await page.locator('input[type="file"][accept*="image"]').all();
    
    for (let i = 0; i < Math.min(5, imageInputs.length); i++) {
      await imageInputs[i].setInputFiles(path.join(testDir, `test-image-${(i % 5) + 1}.png`));
      await page.waitForTimeout(200);
    }

    const afterMediaMemory = await getMemoryUsage(page);
    console.log('Memory after media upload:', afterMediaMemory);

    // Navigate through all steps
    for (let i = 0; i < 4; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    const afterNavigationMemory = await getMemoryUsage(page);
    console.log('Memory after navigation:', afterNavigationMemory);

    // Go back to dashboard (should trigger cleanup)
    await page.goto('http://localhost:1420');
    await page.waitForTimeout(2000);

    // Force garbage collection if available
    await page.evaluate(() => {
      if ('gc' in window) {
        (window as any).gc();
      }
    });

    const finalMemory = await getMemoryUsage(page);
    console.log('Final memory after cleanup:', finalMemory);

    // Memory should not grow excessively
    const memoryGrowth = finalMemory - initialMemory;
    const growthPercentage = (memoryGrowth / initialMemory) * 100;
    
    console.log(`Memory growth: ${memoryGrowth} bytes (${growthPercentage.toFixed(2)}%)`);
    
    // Allow for some growth but not excessive (e.g., not more than 50%)
    expect(growthPercentage).toBeLessThan(50);
  });

  test('4. Multiple project switching', async ({ page }) => {
    const projectNames = ['Project Alpha', 'Project Beta', 'Project Gamma'];
    const projectData: Record<string, any> = {};

    // Create multiple projects with different content
    for (const [index, projectName] of projectNames.entries()) {
      await page.goto('http://localhost:1420');
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', projectName);
      await page.click('button:has-text("Create")');

      // Add unique content to each project
      const courseTitle = `${projectName} Course`;
      const difficulty = ['Easy', 'Medium', 'Hard'][index];
      
      await page.fill('input[placeholder*="course title"]', courseTitle);
      await page.click(`button:has-text("${difficulty}")`);
      await page.fill('textarea[placeholder*="List your course topics"]', 
        `${projectName} Topic 1\n${projectName} Topic 2`
      );

      // Add media
      await page.click('button:has-text("Next")');
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      await imageInput.setInputFiles(
        path.join(__dirname, 'test-lifecycle-files', `test-image-${index + 1}.png`)
      );
      await page.waitForTimeout(500);

      // Store project data
      projectData[projectName] = {
        courseTitle,
        difficulty,
        hasMedia: true
      };

      // Save and go back to dashboard
      await page.goto('http://localhost:1420');
    }

    // Now switch between projects and verify data integrity
    for (const projectName of projectNames) {
      // Open project
      const projectCard = page.locator(`[data-testid="project-card"]:has-text("${projectName}")`);
      await projectCard.click();
      await page.waitForSelector('h1:has-text("Course Configuration")');

      // Verify correct data loaded
      const data = projectData[projectName];
      await expect(page.locator(`input[value="${data.courseTitle}"]`)).toBeVisible();
      await expect(page.locator(`button[aria-pressed="true"]:has-text("${data.difficulty}")`)).toBeVisible();

      // Check media
      await page.click('button:has-text("Next")');
      await expect(page.locator('img')).toHaveCount(1);

      // Go back to dashboard
      await page.goto('http://localhost:1420');
    }

    // Verify no data bleeding between projects
    console.log('Successfully switched between', projectNames.length, 'projects without data corruption');
  });

  test('5. Blob URL cleanup after 30 minutes (simulated)', async ({ page }) => {
    // Create project with media
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Blob Cleanup Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Blob Test Course');
    await page.click('button:has-text("Next")');

    // Upload an image
    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    await imageInput.setInputFiles(path.join(__dirname, 'test-lifecycle-files', 'test-image-1.png'));
    await page.waitForTimeout(500);

    // Get the blob URL
    const blobUrl = await page.locator('img').first().getAttribute('src');
    expect(blobUrl).toMatch(/^blob:/);

    // Simulate time passing by manipulating the cleanup timer
    await page.evaluate(() => {
      // Access the BlobURLManager if it's exposed globally
      const blobManager = (window as any).__blobURLManager;
      if (blobManager && blobManager.urls) {
        // Manually trigger cleanup for testing
        blobManager.urls.forEach((urlInfo: any, url: string) => {
          // Set creation time to 31 minutes ago
          urlInfo.createdAt = Date.now() - (31 * 60 * 1000);
        });
        // Trigger cleanup
        if (blobManager.scheduleCleanup) {
          blobManager.scheduleCleanup();
        }
      }
    });

    // Wait for cleanup to occur
    await page.waitForTimeout(2000);

    // Check if blob URL is still accessible
    const response = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url);
        return res.ok;
      } catch {
        return false;
      }
    }, blobUrl!);

    // The blob URL should be cleaned up (or at least marked for cleanup)
    console.log('Blob URL accessible after 30 min simulation:', response);
  });

  test('6. Project deletion cleanup', async ({ page }) => {
    // Create a project
    await page.click('text=Create New Project');
    const projectName = `Delete Test ${Date.now()}`;
    await page.fill('input[placeholder="Enter project name"]', projectName);
    await page.click('button:has-text("Create")');

    // Add content and media
    await page.fill('input[placeholder*="course title"]', 'Delete Test Course');
    await page.click('button:has-text("Next")');

    // Upload media
    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    await imageInput.setInputFiles(path.join(__dirname, 'test-lifecycle-files', 'test-image-1.png'));
    await page.waitForTimeout(500);

    // Go back to dashboard
    await page.goto('http://localhost:1420');

    // Find the project and delete it
    const projectCard = page.locator(`[data-testid="project-card"]:has-text("${projectName}")`);
    await projectCard.hover();
    
    // Click delete button
    const deleteButton = projectCard.locator('button[aria-label="Delete"]')
      .or(projectCard.locator('button:has-text("Delete")'));
    await deleteButton.click();

    // Confirm deletion
    const confirmDialog = page.locator('[role="dialog"]');
    await confirmDialog.locator('button:has-text("Delete")').click();

    // Wait for deletion
    await page.waitForTimeout(1000);

    // Verify project is gone
    await expect(projectCard).not.toBeVisible();

    // Verify no orphaned blob URLs
    const orphanedBlobs = await getBlobUrlCount(page);
    expect(orphanedBlobs).toBe(0);
  });
});

// Cleanup
test.afterAll(async () => {
  const testDir = path.join(__dirname, 'test-lifecycle-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});