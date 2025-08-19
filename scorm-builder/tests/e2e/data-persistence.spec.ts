import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { TestFileManager } from './helpers/file-helpers';
import { generateTestProject } from './helpers/test-data-generator';

test.describe('Data Persistence and Storage', () => {
  let fileManager: TestFileManager;

  test.beforeEach(async ({ page }) => {
    fileManager = new TestFileManager();
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    fileManager.cleanup();
  });

  test('Data should persist in IndexedDB when navigating', async ({ page }) => {
    // Create project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'IndexedDB Test Project');
    await page.click('button:has-text("Create")');

    // Fill course data
    await page.fill('input[placeholder*="course title"]', 'Persistence Test Course');
    const topics = `Database Fundamentals
SQL Basics
NoSQL Concepts
Data Modeling
Performance Optimization`;
    await page.fill('textarea[placeholder*="List your course topics"]', topics);

    // Navigate forward
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');

    // Check IndexedDB has saved the data
    const savedData = await page.evaluate(async () => {
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) return null;

      // Open IndexedDB
      const dbName = 'SCORMBuilderDB';
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Get course metadata
      const transaction = db.transaction(['courseMetadata'], 'readonly');
      const store = transaction.objectStore('courseMetadata');
      const metadata = await new Promise((resolve) => {
        const request = store.get(projectId);
        request.onsuccess = () => resolve(request.result);
      });

      db.close();
      return metadata;
    });

    expect(savedData).toBeTruthy();
    expect(savedData.courseTitle).toBe('Persistence Test Course');
  });

  test('Course preview should load all saved media and content', async ({ page }) => {
    // Create and populate a project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Preview Test Project');
    await page.click('button:has-text("Create")');

    // Add course content
    await page.fill('input[placeholder*="course title"]', 'Complete Course Preview Test');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic One\nTopic Two');
    
    // Go to media enhancement
    await page.click('button:has-text("Next")');
    
    // Upload a local image
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    if (await fileInput.isVisible()) {
      // Create a simple test image
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, 100, 100);
        canvas.toBlob(blob => {
          const file = new File([blob], 'test-image.png', { type: 'image/png' });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          const input = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement;
          input.files = dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    }

    // Continue to content review
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Content Review")');

    // Continue to audio
    await page.click('button:has-text("Next")');
    
    // Add narration text
    const narrationInput = page.locator('textarea').first();
    await narrationInput.fill('This is the welcome narration for our test course.');

    // Open course preview
    await page.click('button:has-text("Preview Course")');
    await page.waitForSelector('[data-testid="course-preview-modal"]');

    // Switch to preview iframe
    const previewFrame = page.frameLocator('iframe[title*="preview"]');
    
    // Verify content is loaded
    await expect(previewFrame.locator('text=Complete Course Preview Test')).toBeVisible();
    await expect(previewFrame.locator('text=Topic One')).toBeVisible();
    await expect(previewFrame.locator('text=This is the welcome narration')).toBeVisible();
    
    // Verify media is loaded
    const images = previewFrame.locator('img');
    await expect(images).toHaveCount(1); // At least one image should be present
  });

  test('Autosave should work without blocking UI', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Autosave Test');
    await page.click('button:has-text("Create")');

    // Type content that should trigger autosave
    const titleInput = page.locator('input[placeholder*="course title"]');
    await titleInput.fill('Initial Title');
    
    // Wait for autosave indicator
    await expect(page.locator('text=Saving...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

    // Continue typing while autosave is happening
    await titleInput.fill('Updated Title While Saving');
    
    // UI should remain responsive
    await page.click('button:has-text("Hard")'); // Change difficulty
    await expect(page.locator('button[aria-pressed="true"]:has-text("Hard")')).toBeVisible();

    // Navigate away and back
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Back")');

    // Data should be persisted
    await expect(titleInput).toHaveValue('Updated Title While Saving');
    await expect(page.locator('button[aria-pressed="true"]:has-text("Hard")')).toBeVisible();
  });

  test('Deleting a project should clean up all associated data', async ({ page }) => {
    // Create a project with data
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Project to Delete');
    await page.click('button:has-text("Create")');

    // Add some data
    await page.fill('input[placeholder*="course title"]', 'This will be deleted');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2');

    // Go back to dashboard
    await page.goto('http://localhost:1420');

    // Delete the project
    const projectCard = page.locator('[data-testid="project-card"]:has-text("Project to Delete")');
    await projectCard.locator('button[aria-label="Delete project"]').click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Project should be gone
    await expect(projectCard).not.toBeVisible();

    // Create a new project with same name
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Project to Delete');
    await page.click('button:has-text("Create")');

    // Should be completely empty
    const titleInput = page.locator('input[placeholder*="course title"]');
    await expect(titleInput).toHaveValue('Project to Delete'); // Only project name
    
    const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
    await expect(topicsTextarea).toHaveValue('');
  });

  test('Opening an existing project should load all data correctly', async ({ page }) => {
    // Create first project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Project Alpha');
    await page.click('button:has-text("Create")');

    // Add comprehensive data
    await page.fill('input[placeholder*="course title"]', 'Alpha Course Complete');
    await page.click('button:has-text("Expert")');
    await page.selectOption('select', 'Safety');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Safety Rules\nHazard Identification\nEmergency Procedures');

    // Navigate through all steps adding data
    await page.click('button:has-text("Next")'); // Media
    await page.click('button:has-text("Next")'); // Content Review
    await page.click('button:has-text("Next")'); // Audio

    // Add narration
    await page.fill('textarea', 'Welcome to the safety training course');

    // Go back to dashboard
    await page.goto('http://localhost:1420');

    // Create second project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Project Beta');
    await page.click('button:has-text("Create")');
    
    // Add different data
    await page.fill('input[placeholder*="course title"]', 'Beta Course Different');
    await page.click('button:has-text("Basic")');

    // Go back to dashboard again
    await page.goto('http://localhost:1420');

    // Open first project
    await page.click('[data-testid="project-card"]:has-text("Project Alpha")');
    
    // Verify all data is loaded correctly
    await expect(page.locator('input[value="Alpha Course Complete"]')).toBeVisible();
    await expect(page.locator('button[aria-pressed="true"]:has-text("Expert")')).toBeVisible();
    await expect(page.locator('select')).toHaveValue('Safety');
    
    const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
    await expect(topicsTextarea).toHaveValue('Safety Rules\nHazard Identification\nEmergency Procedures');

    // Navigate to audio page
    await page.click('[data-testid="progress-step-3"]'); // Should be able to click since it was visited
    
    // Narration should be loaded
    await expect(page.locator('textarea')).toHaveValue('Welcome to the safety training course');
  });

  test.describe('Advanced Autosave and Recovery Tests', () => {
    test('Autosave should handle rapid successive changes without conflicts', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Rapid Changes Test');
      await page.click('button:has-text("Create")');

      const titleInput = page.locator('input[placeholder*="course title"]');
      const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');

      // Make rapid changes across multiple fields
      for (let i = 0; i < 10; i++) {
        await titleInput.fill(`Title ${i}`);
        await topicsTextarea.fill(`Topic ${i}-1\nTopic ${i}-2\nTopic ${i}-3`);
        await page.waitForTimeout(200); // Fast but not instant
      }

      // Wait for all autosaves to complete
      await page.waitForTimeout(3000);

      // Navigate away and back
      await page.goto('http://localhost:1420');
      await page.click('[data-testid="project-card"]:has-text("Rapid Changes Test")');

      // Should have the latest values
      await expect(titleInput).toHaveValue('Title 9');
      await expect(topicsTextarea).toHaveValue('Topic 9-1\nTopic 9-2\nTopic 9-3');
    });

    test('Recovery should work after browser crash simulation', async ({ page }) => {
      const testProject = generateTestProject('healthcare');
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', testProject.name);
      await page.click('button:has-text("Create")');

      // Fill comprehensive data
      await page.fill('input[placeholder*="course title"]', testProject.course.title);
      await page.click(`button:has-text("${testProject.course.difficulty}")`);
      await page.selectOption('select', testProject.course.template);
      await page.fill('textarea[placeholder*="List your course topics"]', testProject.course.topics.join('\n'));
      await page.fill('textarea[placeholder*="learning objectives"]', testProject.course.objectives.join('\n'));

      // Wait for autosave
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });

      // Simulate browser crash by closing context and creating new one
      const context = page.context();
      await context.close();
      
      // Create new context and page (simulating restart)
      const newContext = await context.browser().newContext();
      const newPage = await newContext.newPage();
      await newPage.goto('http://localhost:1420');

      // Should show recovery option or auto-recover
      const recoveryOption = newPage.locator('text=Recovery Available, text=Unsaved changes detected');
      if (await recoveryOption.isVisible()) {
        await newPage.click('button:has-text("Recover")');
      }

      // Open the project
      await newPage.click(`[data-testid="project-card"]:has-text("${testProject.name}")`);

      // Verify all data is recovered
      await expect(newPage.locator(`input[value="${testProject.course.title}"]`)).toBeVisible();
      await expect(newPage.locator(`button[aria-pressed="true"]:has-text("${testProject.course.difficulty}")`)).toBeVisible();
      
      const topicsTextarea = newPage.locator('textarea[placeholder*="List your course topics"]');
      await expect(topicsTextarea).toHaveValue(testProject.course.topics.join('\n'));

      await newContext.close();
    });

    test('Autosave should work during media uploads', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Upload Autosave Test');
      await page.click('button:has-text("Create")');

      // Fill initial data
      await page.fill('input[placeholder*="course title"]', 'Upload Test Course');
      await page.click('button:has-text("Next")'); // Go to media

      // Start file upload
      const testImage = fileManager.createImageFile('autosave-test.jpg', 200);
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', testImage);
        
        // While upload is processing, change other data
        await page.click('button:has-text("Back")');
        await page.fill('textarea[placeholder*="List your course topics"]', 'Upload Topic 1\nUpload Topic 2');
        
        // Go back to media page
        await page.click('button:has-text("Next")');
        
        // Upload should still be there or completed
        await expect(page.locator('text=autosave-test.jpg')).toBeVisible({ timeout: 15000 });
      }

      // Navigate away and back to verify persistence
      await page.goto('http://localhost:1420');
      await page.click('[data-testid="project-card"]:has-text("Upload Autosave Test")');

      // Verify all data persisted
      await expect(page.locator('input[value="Upload Test Course"]')).toBeVisible();
      
      const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
      await expect(topicsTextarea).toHaveValue('Upload Topic 1\nUpload Topic 2');
      
      // Check media is still there
      await page.click('button:has-text("Next")');
      await expect(page.locator('text=autosave-test.jpg')).toBeVisible();
    });

    test('Autosave should handle network interruptions gracefully', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Network Test');
      await page.click('button:has-text("Create")');

      // Fill data
      const titleInput = page.locator('input[placeholder*="course title"]');
      await titleInput.fill('Network Interruption Course');

      // Wait for initial save
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

      // Simulate network failure
      await page.route('**/api/save/**', route => route.abort());
      await page.route('**/api/projects/**', route => route.abort());

      // Make changes during network failure
      await titleInput.fill('Network Interruption Course - Modified Offline');
      await page.fill('textarea[placeholder*="List your course topics"]', 'Offline Topic 1\nOffline Topic 2');

      // Should show offline/retry indicators
      await expect(page.locator('text=Saving..., text=Retry, text=Offline')).toBeVisible({ timeout: 10000 });

      // Restore network
      await page.unroute('**/api/save/**');
      await page.unroute('**/api/projects/**');

      // Should automatically retry and succeed
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 15000 });

      // Verify data by navigation
      await page.goto('http://localhost:1420');
      await page.click('[data-testid="project-card"]:has-text("Network Test")');

      await expect(page.locator('input[value="Network Interruption Course - Modified Offline"]')).toBeVisible();
      
      const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
      await expect(topicsTextarea).toHaveValue('Offline Topic 1\nOffline Topic 2');
    });

    test('Autosave should preserve data across multiple browser tabs', async ({ page, context }) => {
      // Create project in first tab
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Multi Tab Test');
      await page.click('button:has-text("Create")');

      await page.fill('input[placeholder*="course title"]', 'Multi Tab Course');
      await page.fill('textarea[placeholder*="List your course topics"]', 'Tab Topic 1\nTab Topic 2');

      // Wait for autosave
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

      // Open second tab with same project
      const secondTab = await context.newPage();
      await secondTab.goto('http://localhost:1420');
      await secondTab.click('[data-testid="project-card"]:has-text("Multi Tab Test")');

      // Verify data is loaded in second tab
      await expect(secondTab.locator('input[value="Multi Tab Course"]')).toBeVisible();
      
      const secondTabTopics = secondTab.locator('textarea[placeholder*="List your course topics"]');
      await expect(secondTabTopics).toHaveValue('Tab Topic 1\nTab Topic 2');

      // Make changes in second tab
      await secondTab.fill('input[placeholder*="course title"]', 'Multi Tab Course - Modified in Tab 2');
      await secondTabTopics.fill('Tab Topic 1\nTab Topic 2\nTab Topic 3 - Added in Tab 2');

      // Wait for autosave in second tab
      await expect(secondTab.locator('text=Saved')).toBeVisible({ timeout: 5000 });

      // Refresh first tab and verify changes are reflected
      await page.reload();
      await page.click('[data-testid="project-card"]:has-text("Multi Tab Test")');

      await expect(page.locator('input[value="Multi Tab Course - Modified in Tab 2"]')).toBeVisible();
      
      const firstTabTopics = page.locator('textarea[placeholder*="List your course topics"]');
      await expect(firstTabTopics).toHaveValue('Tab Topic 1\nTab Topic 2\nTab Topic 3 - Added in Tab 2');

      await secondTab.close();
    });

    test('Autosave should handle very large datasets efficiently', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Large Data Test');
      await page.click('button:has-text("Create")');

      // Generate large amounts of realistic data
      const largeCourseTitle = 'Comprehensive Advanced Course on Large-Scale System Architecture and Design Patterns for Enterprise Applications';
      const largeTopicsList = Array(100).fill(0).map((_, i) => `Advanced Topic ${i + 1}: In-depth coverage of complex concepts and methodologies`).join('\n');
      const largeObjectivesList = Array(50).fill(0).map((_, i) => `Learning Objective ${i + 1}: Students will be able to demonstrate mastery of advanced concepts and apply them in real-world scenarios`).join('\n');

      // Fill large data
      await page.fill('input[placeholder*="course title"]', largeCourseTitle);
      await page.fill('textarea[placeholder*="List your course topics"]', largeTopicsList);
      await page.fill('textarea[placeholder*="learning objectives"]', largeObjectivesList);

      // Monitor autosave performance
      const startTime = Date.now();
      await expect(page.locator('text=Saving...')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 15000 });
      const saveTime = Date.now() - startTime;

      // Autosave should complete within reasonable time (under 10 seconds)
      expect(saveTime).toBeLessThan(10000);

      // Verify data persistence with large dataset
      await page.goto('http://localhost:1420');
      await page.click('[data-testid="project-card"]:has-text("Large Data Test")');

      await expect(page.locator(`input[value="${largeCourseTitle}"]`)).toBeVisible();
      
      const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
      const loadedTopics = await topicsTextarea.inputValue();
      expect(loadedTopics.split('\n')).toHaveLength(100);
      expect(loadedTopics).toContain('Advanced Topic 1:');
      expect(loadedTopics).toContain('Advanced Topic 100:');
    });

    test('Autosave conflict resolution with simultaneous edits', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Conflict Resolution Test');
      await page.click('button:has-text("Create")');

      // Simulate conflicting changes by making rapid edits
      const titleInput = page.locator('input[placeholder*="course title"]');
      
      // Make overlapping changes
      await titleInput.fill('Conflict Course Version 1');
      await page.waitForTimeout(500);
      
      await titleInput.fill('Conflict Course Version 2');
      await page.waitForTimeout(300);
      
      await titleInput.fill('Conflict Course Final Version');
      
      // Wait for all autosaves to resolve
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });

      // Navigate away and back to verify final state
      await page.goto('http://localhost:1420');
      await page.click('[data-testid="project-card"]:has-text("Conflict Resolution Test")');

      // Should have the final version (last write wins)
      await expect(page.locator('input[value="Conflict Course Final Version"]')).toBeVisible();
    });
  });
});