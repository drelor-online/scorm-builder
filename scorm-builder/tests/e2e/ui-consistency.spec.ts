import { test, expect } from '@playwright/test';

test.describe('UI Consistency and Visual Issues', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test('All text should be visible on dark background', async ({ page }) => {
    // Check dashboard text visibility
    const h1 = page.locator('h1:has-text("SCORM Builder Projects")');
    await expect(h1).toBeVisible();
    
    // Get computed styles
    const h1Color = await h1.evaluate(el => window.getComputedStyle(el).color);
    const h1BgColor = await h1.evaluate(el => {
      let bgColor = window.getComputedStyle(el).backgroundColor;
      let parent = el.parentElement;
      while (parent && (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)')) {
        bgColor = window.getComputedStyle(parent).backgroundColor;
        parent = parent.parentElement;
      }
      return bgColor;
    });

    // Convert to RGB values for contrast check
    const getRGB = (color: string) => {
      const match = color.match(/\d+/g);
      return match ? match.map(Number) : [0, 0, 0];
    };

    const textRGB = getRGB(h1Color);
    const bgRGB = getRGB(h1BgColor);

    // Simple contrast check - text should be significantly lighter than background
    const textLuminance = (textRGB[0] + textRGB[1] + textRGB[2]) / 3;
    const bgLuminance = (bgRGB[0] + bgRGB[1] + bgRGB[2]) / 3;
    
    expect(textLuminance).toBeGreaterThan(bgLuminance + 50); // At least 50 points difference

    // Check project cards when they exist
    const projectCards = page.locator('[data-testid="project-card"]');
    const cardCount = await projectCards.count();
    
    if (cardCount > 0) {
      const firstCard = projectCards.first();
      const cardTitle = firstCard.locator('h3');
      const cardDate = firstCard.locator('.project-date');
      
      await expect(cardTitle).toBeVisible();
      await expect(cardDate).toBeVisible();
      
      // Check text is readable
      const titleColor = await cardTitle.evaluate(el => window.getComputedStyle(el).color);
      expect(getRGB(titleColor)[0]).toBeGreaterThan(180); // Should be light colored
    }

    // Create a new project to test form visibility
    await page.click('text=Create New Project');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    const input = modal.locator('input[placeholder="Enter project name"]');
    await expect(input).toBeVisible();
    
    // Check input has proper contrast
    const inputBg = await input.evaluate(el => window.getComputedStyle(el).backgroundColor);
    const inputColor = await input.evaluate(el => window.getComputedStyle(el).color);
    
    expect(getRGB(inputColor)[0]).toBeGreaterThan(180); // Light text
    expect(getRGB(inputBg)[0]).toBeLessThan(100); // Dark background
  });

  test('Progress indicator should show correct visual states', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'UI Test Project');
    await page.click('button:has-text("Create")');

    // Check initial progress indicator
    const progressSteps = page.locator('[data-testid^="progress-step-"]');
    await expect(progressSteps).toHaveCount(7); // Total steps

    // First step should be active/visited
    const firstStep = progressSteps.first();
    await expect(firstStep).toHaveAttribute('data-visited', 'true');
    
    // Get visual properties
    const firstStepBg = await firstStep.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(getRGB(firstStepBg)[2]).toBeGreaterThan(200); // Should be blue-ish

    // Other steps should be unvisited
    const secondStep = progressSteps.nth(1);
    await expect(secondStep).toHaveAttribute('data-visited', 'false');
    
    const secondStepBg = await secondStep.evaluate(el => window.getComputedStyle(el).backgroundColor);
    const secondStepRGB = getRGB(secondStepBg);
    expect(secondStepRGB[0]).toBe(secondStepRGB[1]); // Should be gray (equal RGB values)

    // Navigate to next step
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');

    // Both steps should now be visited
    await expect(firstStep).toHaveAttribute('data-visited', 'true');
    await expect(secondStep).toHaveAttribute('data-visited', 'true');
  });

  test('Buttons should have proper hover and active states', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Button Test');
    await page.click('button:has-text("Create")');

    // Test primary button (Next)
    const nextButton = page.locator('button:has-text("Next")');
    const initialBg = await nextButton.evaluate(el => window.getComputedStyle(el).backgroundColor);

    // Hover over button
    await nextButton.hover();
    await page.waitForTimeout(100); // Wait for transition
    
    const hoverBg = await nextButton.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(hoverBg).not.toBe(initialBg); // Should change on hover

    // Test difficulty buttons
    const difficultyButtons = page.locator('button[data-testid^="difficulty-"]');
    await expect(difficultyButtons).toHaveCount(5);

    // Click a difficulty button
    const hardButton = page.locator('button:has-text("Hard")');
    await hardButton.click();
    
    // Should have pressed state
    await expect(hardButton).toHaveAttribute('aria-pressed', 'true');
    
    // Visual feedback
    const pressedBg = await hardButton.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(getRGB(pressedBg)[2]).toBeGreaterThan(200); // Should be blue when selected
  });

  test('Modals should not have scrolling issues', async ({ page }) => {
    // Create multiple projects to test scrolling
    for (let i = 1; i <= 10; i++) {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', `Project ${i}`);
      await page.click('button:has-text("Create")');
      await page.goto('http://localhost:1420');
    }

    // Open a project
    await page.click('[data-testid="project-card"]:first-child');
    
    // Open template editor modal
    await page.click('button:has-text("Manage Templates")');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Check if modal content is scrollable when needed
    const modalContent = modal.locator('[data-testid="modal-content"]');
    const contentHeight = await modalContent.evaluate(el => el.scrollHeight);
    const visibleHeight = await modalContent.evaluate(el => el.clientHeight);

    if (contentHeight > visibleHeight) {
      // Content should be scrollable
      const overflow = await modalContent.evaluate(el => window.getComputedStyle(el).overflowY);
      expect(['auto', 'scroll']).toContain(overflow);
    }

    // Body should not scroll when modal is open
    const bodyOverflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
    expect(bodyOverflow).toBe('hidden');
  });

  test('Loading states should be visually clear', async ({ page }) => {
    // Navigate to a page that loads data
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Loading Test');
    await page.click('button:has-text("Create")');

    // Go to media page and search
    await page.click('button:has-text("Next")');
    
    // Trigger a search
    await page.fill('input[placeholder*="Search for images"]', 'test images');
    
    // Intercept the search request to delay it
    await page.route('**/search/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay 1 second
      await route.continue();
    });

    await page.click('button:has-text("Search Images")');

    // Check for loading indicator
    const spinner = page.locator('[data-testid="loading-spinner"]');
    await expect(spinner).toBeVisible();

    // Spinner should be animated
    const animation = await spinner.evaluate(el => window.getComputedStyle(el).animation);
    expect(animation).toContain('spin'); // Should have spinning animation

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
    
    // Spinner should be gone
    await expect(spinner).not.toBeVisible();
  });

  test('Form inputs should have consistent styling', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Form Consistency Test');
    await page.click('button:has-text("Create")');

    // Collect all input elements
    const textInputs = page.locator('input[type="text"], input:not([type])');
    const textareas = page.locator('textarea');
    const selects = page.locator('select');

    // Check text inputs
    const inputCount = await textInputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = textInputs.nth(i);
      if (await input.isVisible()) {
        const borderColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);
        const padding = await input.evaluate(el => window.getComputedStyle(el).padding);
        
        // Should have consistent border color
        expect(borderColor).toMatch(/rgb/); // Should be defined
        expect(padding).not.toBe('0px'); // Should have padding
      }
    }

    // Check textareas
    const textareaCount = await textareas.count();
    for (let i = 0; i < textareaCount; i++) {
      const textarea = textareas.nth(i);
      if (await textarea.isVisible()) {
        const borderRadius = await textarea.evaluate(el => window.getComputedStyle(el).borderRadius);
        expect(borderRadius).not.toBe('0px'); // Should have rounded corners
      }
    }

    // Check selects
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      if (await select.isVisible()) {
        const appearance = await select.evaluate(el => window.getComputedStyle(el).appearance);
        expect(appearance).toBe('none'); // Custom styled
      }
    }
  });

  // Helper function to convert color string to RGB array
  function getRGB(color: string): number[] {
    const match = color.match(/\d+/g);
    return match ? match.map(Number) : [0, 0, 0];
  }
});