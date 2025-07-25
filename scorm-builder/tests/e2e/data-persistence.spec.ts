import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('Data Persistence and Storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
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
});