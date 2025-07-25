import { test, expect } from '@playwright/test';

test.describe('Basic Smoke Test', () => {
  test('Complete workflow should work without errors', async ({ page }) => {
    // Start at dashboard
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'test-results/01-dashboard.png', fullPage: true });
    
    // Check that main title is visible
    const title = page.locator('h1:has-text("SCORM Builder Projects")');
    await expect(title).toBeVisible();
    
    // Verify text is actually visible (not dark on dark)
    const titleColor = await title.evaluate(el => 
      window.getComputedStyle(el).color
    );
    console.log('Title color:', titleColor);
    
    // Create new project
    await page.click('button:has-text("Create New Project")');
    await page.waitForSelector('[role="dialog"]');
    
    // Fill project name
    await page.fill('input[placeholder="Enter project name"]', 'Smoke Test Project');
    await page.screenshot({ path: 'test-results/02-new-project-dialog.png' });
    
    await page.click('button:has-text("Create")');
    
    // Wait for navigation to course configuration
    await page.waitForSelector('h1:has-text("Course Configuration")');
    await page.screenshot({ path: 'test-results/03-course-config.png', fullPage: true });
    
    // Fill course configuration
    const courseTitleInput = page.locator('input[placeholder*="course title" i]');
    await expect(courseTitleInput).toHaveValue('Smoke Test Project'); // Should auto-populate
    
    // Change the title
    await courseTitleInput.fill('Updated Course Title');
    
    // Select difficulty
    await page.click('button:has-text("Hard")');
    
    // Add topics
    const topicsTextarea = page.locator('textarea[placeholder*="topics" i]');
    await topicsTextarea.fill('Topic One\nTopic Two\nTopic Three');
    
    // Navigate to Media Enhancement
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');
    await page.screenshot({ path: 'test-results/04-media-enhancement.png', fullPage: true });
    
    // Navigate to Content Review
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Content Review")');
    await page.screenshot({ path: 'test-results/05-content-review.png', fullPage: true });
    
    // Navigate to Audio Narration
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Audio Narration")');
    await page.screenshot({ path: 'test-results/06-audio-narration.png', fullPage: true });
    
    // Go back to Course Configuration using progress indicator
    const firstStep = page.locator('[data-testid="progress-step-0"]');
    await expect(firstStep).toHaveAttribute('data-visited', 'true');
    await firstStep.click();
    
    await page.waitForSelector('h1:has-text("Course Configuration")');
    
    // Verify data persisted
    await expect(courseTitleInput).toHaveValue('Updated Course Title');
    await expect(topicsTextarea).toHaveValue('Topic One\nTopic Two\nTopic Three');
    await expect(page.locator('button[aria-pressed="true"]:has-text("Hard")')).toBeVisible();
    
    // Navigate directly to Audio (should work since it was visited)
    const audioStep = page.locator('[data-testid="progress-step-3"]');
    await expect(audioStep).toHaveAttribute('data-visited', 'true');
    await audioStep.click();
    
    await page.waitForSelector('h1:has-text("Audio Narration")');
    
    // Try to navigate to unvisited step (should not work)
    const lastStep = page.locator('[data-testid="progress-step-6"]');
    await expect(lastStep).toHaveAttribute('data-visited', 'false');
    await lastStep.click();
    
    // Should still be on Audio page
    await expect(page.locator('h1:has-text("Audio Narration")')).toBeVisible();
    
    // Go back to dashboard
    await page.goto('http://localhost:1420');
    
    // Verify project appears
    const projectCard = page.locator('[data-testid="project-card"]:has-text("Smoke Test Project")');
    await expect(projectCard).toBeVisible();
    await page.screenshot({ path: 'test-results/07-dashboard-with-project.png', fullPage: true });
    
    // Create another project to test clean start
    await page.click('button:has-text("Create New Project")');
    await page.fill('input[placeholder="Enter project name"]', 'Second Clean Project');
    await page.click('button:has-text("Create")');
    
    await page.waitForSelector('h1:has-text("Course Configuration")');
    
    // Verify it starts clean
    const newCourseTitleInput = page.locator('input[placeholder*="course title" i]');
    await expect(newCourseTitleInput).toHaveValue('Second Clean Project'); // Only project name
    
    const newTopicsTextarea = page.locator('textarea[placeholder*="topics" i]');
    await expect(newTopicsTextarea).toHaveValue(''); // Should be empty
    
    // Verify difficulty is default (Medium)
    await expect(page.locator('button[aria-pressed="true"]:has-text("Medium")')).toBeVisible();
    
    console.log('✅ Smoke test passed!');
  });
  
  test('UI elements should be visible and interactive', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Check contrast of empty state text
    const emptyStateText = page.locator('h2:has-text("Welcome to SCORM Builder")');
    if (await emptyStateText.isVisible()) {
      const textColor = await emptyStateText.evaluate(el => 
        window.getComputedStyle(el).color
      );
      const bgColor = await emptyStateText.evaluate(el => {
        let bg = window.getComputedStyle(el).backgroundColor;
        let parent = el.parentElement;
        while (parent && (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)')) {
          bg = window.getComputedStyle(parent).backgroundColor;
          parent = parent.parentElement;
        }
        return bg;
      });
      
      console.log('Empty state text color:', textColor);
      console.log('Background color:', bgColor);
      
      // Simple check - text should be light
      const rgb = textColor.match(/\d+/g);
      if (rgb) {
        const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
        expect(brightness).toBeGreaterThan(150); // Should be light colored
      }
    }
    
    // Test button hover states
    const createButton = page.locator('button:has-text("Create New Project")').first();
    const initialBg = await createButton.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    await createButton.hover();
    await page.waitForTimeout(200); // Wait for transition
    
    const hoverBg = await createButton.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    expect(hoverBg).not.toBe(initialBg); // Should change on hover
  });
});