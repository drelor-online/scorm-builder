/**
 * Complete User Journey Test for SCORM Builder
 * Tests the full workflow from project creation to SCORM package generation
 */

import { test, expect, Page } from '@playwright/test';
import { TestFileManager } from './helpers/file-helpers';
import { generateTestProject, generateCourseData } from './helpers/test-data-generator';

test.describe('Complete SCORM Builder User Journey', () => {
  let fileManager: TestFileManager;
  let testProject: ReturnType<typeof generateTestProject>;

  test.beforeEach(async ({ page }) => {
    fileManager = new TestFileManager();
    testProject = generateTestProject('technical');
    
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    fileManager.cleanup();
  });

  test('Complete workflow: Create project → Course seed → Media → Activities → SCORM generation', async ({ page }) => {
    // Step 1: Project Creation
    await test.step('Create new project', async () => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', testProject.name);
      await page.click('button:has-text("Create")');
      
      // Verify we're on the course seed page
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
    });

    // Step 2: Course Seed Data Entry
    await test.step('Fill course seed information', async () => {
      // Basic course information
      await page.fill('input[placeholder*="course title"]', testProject.course.title);
      await page.fill('textarea[placeholder*="brief description"]', testProject.course.description);
      
      // Set difficulty level
      await page.click(`button:has-text("${testProject.course.difficulty}")`);
      await expect(page.locator(`button[aria-pressed="true"]:has-text("${testProject.course.difficulty}")`)).toBeVisible();
      
      // Set template
      await page.selectOption('select', testProject.course.template);
      
      // Add topics
      const topicsText = testProject.course.topics.join('\n');
      await page.fill('textarea[placeholder*="List your course topics"]', topicsText);
      
      // Add objectives
      const objectivesText = testProject.course.objectives.join('\n');
      await page.fill('textarea[placeholder*="learning objectives"]', objectivesText);
      
      // Verify auto-save indicator
      await expect(page.locator('text=Saving...')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });
      
      // Proceed to next step
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible();
    });

    // Step 3: Media Enhancement
    await test.step('Upload and manage media files', async () => {
      // Create test media files
      const imageFile = fileManager.createImageFile('test-banner.jpg', 250);
      const videoFile = fileManager.createVideoFile('demo-video.mp4', 300);
      const audioFile = fileManager.createAudioFile('narration.mp3', 120);
      
      // Upload image
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', imageFile);
        await expect(page.locator('text=test-banner.jpg')).toBeVisible({ timeout: 10000 });
      }
      
      // Upload video
      const videoInput = page.locator('input[type="file"][accept*="video"]').first();
      if (await videoInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="video"]', videoFile);
        await expect(page.locator('text=demo-video.mp4')).toBeVisible({ timeout: 15000 });
      }
      
      // Add YouTube video
      const youtubeInput = page.locator('input[placeholder*="YouTube"]');
      if (await youtubeInput.isVisible()) {
        await youtubeInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        await page.click('button:has-text("Add YouTube Video")');
        await expect(page.locator('text=YouTube Video Added')).toBeVisible({ timeout: 5000 });
      }
      
      // Proceed to next step
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Content Review")')).toBeVisible();
    });

    // Step 4: Content Review and JSON Import
    await test.step('Review and validate generated content', async () => {
      // Wait for content generation
      await expect(page.locator('text=Generating content...')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Content generated successfully')).toBeVisible({ timeout: 30000 });
      
      // Verify generated JSON structure
      const jsonContent = await page.locator('pre, .json-display').textContent();
      expect(jsonContent).toBeTruthy();
      
      // Parse and validate JSON
      const parsedJson = JSON.parse(jsonContent!);
      expect(parsedJson.metadata.title).toBe(testProject.course.title);
      expect(parsedJson.metadata.difficulty).toBe(testProject.course.difficulty);
      expect(parsedJson.pages).toBeDefined();
      expect(Array.isArray(parsedJson.pages)).toBe(true);
      
      // Test JSON editing
      const editButton = page.locator('button:has-text("Edit JSON")');
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Make a small modification
        const jsonEditor = page.locator('textarea[data-testid="json-editor"]');
        const currentJson = await jsonEditor.inputValue();
        const modifiedJson = currentJson.replace(
          testProject.course.title,
          `${testProject.course.title} - Modified`
        );
        await jsonEditor.fill(modifiedJson);
        
        // Validate modified JSON
        await page.click('button:has-text("Validate JSON")');
        await expect(page.locator('text=JSON is valid')).toBeVisible({ timeout: 5000 });
        
        await page.click('button:has-text("Save Changes")');
      }
      
      // Proceed to next step
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Audio Narration")')).toBeVisible();
    });

    // Step 5: Audio Narration
    await test.step('Add audio narration and captions', async () => {
      // Add welcome narration
      const welcomeTextarea = page.locator('textarea[placeholder*="welcome"]').first();
      await welcomeTextarea.fill('Welcome to our comprehensive TypeScript development course. In this course, you will learn advanced concepts and best practices.');
      
      // Generate audio if available
      const generateButton = page.locator('button:has-text("Generate Audio")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await expect(page.locator('text=Audio generated successfully')).toBeVisible({ timeout: 20000 });
      }
      
      // Upload custom audio file
      const audioFile = fileManager.createAudioFile('custom-narration.mp3', 180);
      const audioInput = page.locator('input[type="file"][accept*="audio"]');
      if (await audioInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="audio"]', audioFile);
        await fileManager.waitForFileProcessing(page);
      }
      
      // Add captions if available
      const captionFiles = [
        { name: 'welcome.vtt', content: 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nWelcome to our course\n\n2\n00:00:05.000 --> 00:00:10.000\nLet\'s begin learning together' }
      ];
      
      const captionZip = fileManager.createCaptionZip('captions.zip', captionFiles);
      const captionInput = page.locator('input[type="file"][accept*="zip"]');
      if (await captionInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="zip"]', captionZip);
        await expect(page.locator('text=Captions uploaded successfully')).toBeVisible({ timeout: 10000 });
      }
      
      // Proceed to next step
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Activities Editor")')).toBeVisible();
    });

    // Step 6: Activities Creation
    await test.step('Create interactive activities and assessments', async () => {
      // Add multiple choice question
      await page.click('button:has-text("Add Question")');
      await page.selectOption('select[data-testid="question-type"]', 'multiple-choice');
      
      await page.fill('textarea[placeholder*="question"]', testProject.activities[0].question);
      
      // Add options
      for (let i = 0; i < testProject.activities[0].options!.length; i++) {
        const optionInput = page.locator(`input[data-testid="option-${i}"]`);
        await optionInput.fill(testProject.activities[0].options![i]);
      }
      
      // Set correct answer
      await page.click(`input[data-testid="correct-${testProject.activities[0].correctAnswer}"]`);
      
      // Set points
      await page.fill('input[data-testid="points"]', testProject.activities[0].points.toString());
      
      // Save question
      await page.click('button:has-text("Save Question")');
      await expect(page.locator('text=Question saved successfully')).toBeVisible();
      
      // Add true/false question
      await page.click('button:has-text("Add Question")');
      await page.selectOption('select[data-testid="question-type"]', 'true-false');
      await page.fill('textarea[placeholder*="question"]', testProject.activities[1].question);
      await page.click(`input[value="${testProject.activities[1].correctAnswer}"]`);
      await page.click('button:has-text("Save Question")');
      
      // Verify activities are saved
      await expect(page.locator('text=2 questions created')).toBeVisible();
      
      // Proceed to final step
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("SCORM Package Builder")')).toBeVisible();
    });

    // Step 7: SCORM Package Generation
    await test.step('Generate and download SCORM package', async () => {
      // Configure SCORM settings
      await page.fill('input[placeholder*="package name"]', `${testProject.name} - SCORM Package`);
      await page.selectOption('select[data-testid="scorm-version"]', '2004');
      
      // Set completion criteria
      await page.check('input[data-testid="track-completion"]');
      await page.check('input[data-testid="track-score"]');
      await page.fill('input[data-testid="passing-score"]', '80');
      
      // Generate package
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Generate SCORM Package")');
      
      // Wait for generation to complete
      await expect(page.locator('text=Generating SCORM package...')).toBeVisible();
      await expect(page.locator('text=Package generated successfully')).toBeVisible({ timeout: 60000 });
      
      // Verify download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/.*\.zip$/);
      
      // Verify package contents preview
      await expect(page.locator('text=manifest.xml')).toBeVisible();
      await expect(page.locator('text=index.html')).toBeVisible();
      await expect(page.locator('text=Course files included')).toBeVisible();
    });

    // Step 8: Course Preview
    await test.step('Preview completed course', async () => {
      await page.click('button:has-text("Preview Course")');
      await page.waitForSelector('[data-testid="course-preview-modal"]');
      
      // Switch to preview iframe
      const previewFrame = page.frameLocator('iframe[title*="preview"]');
      
      // Verify course loads correctly
      await expect(previewFrame.locator(`text=${testProject.course.title}`)).toBeVisible({ timeout: 10000 });
      
      // Navigate through course content
      await previewFrame.locator('button:has-text("Start Course")').click();
      await expect(previewFrame.locator('text=Welcome to our comprehensive')).toBeVisible();
      
      // Test navigation
      await previewFrame.locator('button:has-text("Next")').click();
      await expect(previewFrame.locator('text=TypeScript Fundamentals')).toBeVisible();
      
      // Test activity
      const activityFrame = previewFrame.frameLocator('iframe[title*="activity"]');
      if (await activityFrame.locator('input[type="radio"]').first().isVisible()) {
        await activityFrame.locator('input[type="radio"]').first().click();
        await activityFrame.locator('button:has-text("Submit")').click();
        await expect(activityFrame.locator('text=Correct')).toBeVisible();
      }
      
      // Close preview
      await page.click('[data-testid="close-preview"]');
    });

    // Step 9: Project Management
    await test.step('Verify project is saved and accessible', async () => {
      // Go back to dashboard
      await page.goto('http://localhost:1420');
      
      // Verify project appears in dashboard
      await expect(page.locator(`text=${testProject.name}`)).toBeVisible();
      
      // Open project to verify data persistence
      await page.click(`[data-testid="project-card"]:has-text("${testProject.name}")`);
      
      // Verify all data is still there
      await expect(page.locator(`input[value*="${testProject.course.title}"]`)).toBeVisible();
      await expect(page.locator(`button[aria-pressed="true"]:has-text("${testProject.course.difficulty}")`)).toBeVisible();
      
      // Quick verification of other steps
      await page.click('[data-testid="progress-step-1"]'); // Media
      await expect(page.locator('text=test-banner.jpg')).toBeVisible();
      
      await page.click('[data-testid="progress-step-3"]'); // Audio
      await expect(page.locator('textarea')).toHaveValue(/Welcome to our comprehensive/);
    });
  });

  test('Error recovery: Resume interrupted workflow', async ({ page }) => {
    // Simulate interrupted workflow
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Interrupted Project');
    await page.click('button:has-text("Create")');
    
    // Fill some data
    await page.fill('input[placeholder*="course title"]', 'Interrupted Course');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2');
    
    // Simulate browser crash/refresh
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should show recovery option
    await expect(page.locator('text=Recovery Available')).toBeVisible();
    await page.click('button:has-text("Recover Project")');
    
    // Verify data is recovered
    await expect(page.locator('input[value="Interrupted Course"]')).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue('Topic 1\nTopic 2');
  });

  test('Accessibility: Complete workflow using keyboard navigation', async ({ page }) => {
    // Start workflow with keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); // Create New Project
    
    await page.keyboard.type('Keyboard Navigation Test');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); // Create
    
    // Navigate form with keyboard
    await page.keyboard.press('Tab'); // Title field
    await page.keyboard.type('Keyboard Accessible Course');
    
    await page.keyboard.press('Tab'); // Description
    await page.keyboard.type('Testing keyboard accessibility');
    
    // Test difficulty selection with arrows
    await page.keyboard.press('Tab'); // Difficulty buttons
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight'); // Select "Advanced"
    await page.keyboard.press('Space');
    
    // Verify selection worked
    await expect(page.locator('button[aria-pressed="true"]:has-text("Advanced")')).toBeVisible();
    
    // Navigate to next with keyboard
    await page.keyboard.press('Tab'); // Template
    await page.keyboard.press('Tab'); // Topics
    await page.keyboard.type('Keyboard Topic 1\nKeyboard Topic 2');
    
    await page.keyboard.press('Tab'); // Objectives
    await page.keyboard.type('Learn keyboard navigation\nTest accessibility');
    
    // Navigate to next step
    while (!(await page.locator('button:has-text("Next")').isVisible())) {
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    
    // Verify we moved to next step
    await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible();
  });
});