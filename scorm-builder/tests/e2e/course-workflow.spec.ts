import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Helper to create test files
const createTestFile = (filename: string, content: string) => {
  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const filePath = path.join(testDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

// Create test files before tests run
test.beforeAll(async () => {
  // Create test image
  createTestFile('test-image.jpg', Buffer.from('fake-jpg-data'));
  
  // Create test audio files
  createTestFile('welcome-audio.mp3', Buffer.from('fake-mp3-data'));
  createTestFile('topic1-audio.mp3', Buffer.from('fake-mp3-data'));
  createTestFile('topic2-audio.mp3', Buffer.from('fake-mp3-data'));
  
  // Create test video
  createTestFile('test-video.mp4', Buffer.from('fake-mp4-data'));
});

test.describe('Course Creation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test('1. Data should persist when navigating between pages', async ({ page }) => {
    // Create a new project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Test Course - Data Persistence');
    await page.click('button:has-text("Create")');

    // Wait for course configuration page
    await page.waitForSelector('h1:has-text("Course Configuration")');

    // Fill in course configuration
    await page.fill('input[placeholder*="course title"]', 'Advanced TypeScript Training');
    await page.click('button:has-text("Expert")'); // Set difficulty
    await page.selectOption('select', 'Technical'); // Select template
    
    // Add custom topics
    const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
    await topicsTextarea.fill(`Introduction to TypeScript
Advanced Type System
Generics and Type Inference
Decorators and Metadata
Building Real-world Applications`);

    // Navigate to next step
    await page.click('button:has-text("Next")');
    
    // Media Enhancement page - add images
    await page.waitForSelector('h1:has-text("Media Enhancement")');
    
    // Search and add an image
    await page.fill('input[placeholder*="Search for images"]', 'typescript programming');
    await page.click('button:has-text("Search Images")');
    await page.waitForSelector('[data-testid="search-results"]');
    await page.click('[data-testid="search-result-0"]'); // Select first result
    await page.click('button:has-text("Add to Welcome")');

    // Navigate to Content Review
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Content Review")');
    
    // Verify content is present
    await expect(page.locator('text=Advanced TypeScript Training')).toBeVisible();
    
    // Navigate back to Media Enhancement
    await page.click('button:has-text("Back")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');
    
    // Verify image selection is still there
    await expect(page.locator('[data-testid="selected-media"]')).toBeVisible();
    
    // Navigate back to Course Configuration
    await page.click('button:has-text("Back")');
    await page.waitForSelector('h1:has-text("Course Configuration")');
    
    // Verify all data is still present
    await expect(page.locator('input[value="Advanced TypeScript Training"]')).toBeVisible();
    await expect(page.locator('button[aria-pressed="true"]:has-text("Expert")')).toBeVisible();
    await expect(topicsTextarea).toHaveValue(`Introduction to TypeScript
Advanced Type System
Generics and Type Inference
Decorators and Metadata
Building Real-world Applications`);
  });

  test('2. Data changes should persist when navigating back and forth', async ({ page }) => {
    // Create a new project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Test Course - Data Changes');
    await page.click('button:has-text("Create")');

    // Initial course configuration
    await page.fill('input[placeholder*="course title"]', 'Initial Course Title');
    await page.click('button:has-text("Medium")');
    
    // Navigate forward to Media Enhancement
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');
    
    // Navigate forward to Content Review
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Content Review")');
    
    // Navigate forward to Audio Narration
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Audio Narration")');
    
    // Upload audio file
    const audioInput = page.locator('input[type="file"][accept*="audio"]').first();
    await audioInput.setInputFiles(path.join(__dirname, 'test-files', 'welcome-audio.mp3'));
    
    // Navigate back to Course Configuration
    await page.click('[data-testid="progress-step-0"]'); // Click first step in progress bar
    await page.waitForSelector('h1:has-text("Course Configuration")');
    
    // Change the title and difficulty
    await page.fill('input[placeholder*="course title"]', 'Updated Course Title - Changed');
    await page.click('button:has-text("Expert")');
    
    // Navigate forward to Audio Narration again
    await page.click('[data-testid="progress-step-3"]'); // Click audio step
    await page.waitForSelector('h1:has-text("Audio Narration")');
    
    // Verify audio file is still present
    await expect(page.locator('audio')).toBeVisible();
    
    // Navigate back to Course Configuration
    await page.click('[data-testid="progress-step-0"]');
    
    // Verify changes are persisted
    await expect(page.locator('input[value="Updated Course Title - Changed"]')).toBeVisible();
    await expect(page.locator('button[aria-pressed="true"]:has-text("Expert")')).toBeVisible();
  });

  test('3. New project should start completely clean', async ({ page }) => {
    // First project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'First Project');
    await page.click('button:has-text("Create")');
    
    // Fill with data
    await page.fill('input[placeholder*="course title"]', 'First Project Title');
    await page.click('button:has-text("Hard")');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2\nTopic 3');
    
    // Navigate through steps
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');
    
    // Go back to dashboard
    await page.goto('http://localhost:1420');
    
    // Create second project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Second Project - Should Be Clean');
    await page.click('button:has-text("Create")');
    
    // Verify everything is empty except project name in title
    await page.waitForSelector('h1:has-text("Course Configuration")');
    
    // Course title should have the project name
    await expect(page.locator('input[placeholder*="course title"]')).toHaveValue('Second Project - Should Be Clean');
    
    // Topics should be empty
    const topicsTextarea = page.locator('textarea[placeholder*="List your course topics"]');
    await expect(topicsTextarea).toHaveValue('');
    
    // Difficulty should be default (Medium - index 3)
    await expect(page.locator('button[aria-pressed="true"]:has-text("Medium")')).toBeVisible();
    
    // Navigate to other pages to ensure they're clean
    await page.click('button:has-text("Next")');
    await expect(page.locator('[data-testid="selected-media"]')).not.toBeVisible();
    
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    // Audio page should have no uploaded files
    await expect(page.locator('audio')).not.toBeVisible();
  });

  test('4. Multiple file uploads should not lock up the page', async ({ page }) => {
    // Create project and navigate to audio page
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Test Multiple Uploads');
    await page.click('button:has-text("Create")');
    
    // Navigate to Audio Narration
    await page.click('button:has-text("Next")'); // Media
    await page.click('button:has-text("Next")'); // Content Review
    await page.click('button:has-text("Next")'); // Audio
    
    await page.waitForSelector('h1:has-text("Audio Narration")');
    
    // Test 1: Try to upload multiple files simultaneously
    const audioInput = page.locator('input[type="file"][accept*="audio"]').first();
    
    // Set up promise to track if page becomes unresponsive
    let pageResponsive = true;
    const responsiveCheck = setInterval(async () => {
      try {
        // Try to interact with page
        await page.evaluate(() => document.body.style.cursor = 'pointer');
        await page.evaluate(() => document.body.style.cursor = 'default');
      } catch {
        pageResponsive = false;
      }
    }, 100);
    
    // Upload first file
    await audioInput.setInputFiles(path.join(__dirname, 'test-files', 'welcome-audio.mp3'));
    
    // Try to immediately upload another file to a different input
    const secondInput = page.locator('input[type="file"][accept*="audio"]').nth(1);
    await secondInput.setInputFiles(path.join(__dirname, 'test-files', 'topic1-audio.mp3'));
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Stop checking
    clearInterval(responsiveCheck);
    
    // Verify page didn't lock up
    expect(pageResponsive).toBe(true);
    
    // Verify both files were uploaded
    const audioElements = page.locator('audio');
    await expect(audioElements).toHaveCount(2);
    
    // Test 2: Upload multiple files via bulk upload if available
    const bulkInput = page.locator('input[type="file"][multiple]');
    if (await bulkInput.isVisible()) {
      await bulkInput.setInputFiles([
        path.join(__dirname, 'test-files', 'topic1-audio.mp3'),
        path.join(__dirname, 'test-files', 'topic2-audio.mp3')
      ]);
      
      // Verify files were processed
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Upload complete')).toBeVisible();
    }
    
    // Test 3: Verify UI remains interactive during upload
    await page.click('button:has-text("Back")');
    await page.waitForSelector('h1:has-text("Content Review")');
    
    // Can navigate back
    await page.click('button:has-text("Next")');
    await expect(page.locator('audio')).toHaveCount(2);
  });

  test('5. Progress indicator should correctly show visited steps', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Test Progress Indicator');
    await page.click('button:has-text("Create")');
    
    // Verify initial state - only step 0 is visited
    await expect(page.locator('[data-testid="progress-step-0"][data-visited="true"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-step-1"][data-visited="false"]')).toBeVisible();
    
    // Navigate to step 1
    await page.click('button:has-text("Next")');
    await page.waitForSelector('h1:has-text("Media Enhancement")');
    
    // Both steps should be visited
    await expect(page.locator('[data-testid="progress-step-0"][data-visited="true"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-step-1"][data-visited="true"]')).toBeVisible();
    
    // Should be able to click on visited steps
    await page.click('[data-testid="progress-step-0"]');
    await page.waitForSelector('h1:has-text("Course Configuration")');
    
    // Navigate to step 3 directly shouldn't work (not visited)
    const step3 = page.locator('[data-testid="progress-step-3"]');
    await expect(step3).toHaveAttribute('data-visited', 'false');
    await step3.click();
    
    // Should still be on Course Configuration
    await expect(page.locator('h1:has-text("Course Configuration")')).toBeVisible();
  });
});

// Cleanup test files after tests
test.afterAll(async () => {
  const testDir = path.join(__dirname, 'test-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});