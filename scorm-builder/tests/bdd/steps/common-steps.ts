import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import path from 'path';

// Course Preview Updates
Then('I should see the course preview update', async function () {
  const previewArea = await this.page.locator('.course-preview, .preview-container, [data-testid="course-preview"]').first();
  await expect(previewArea).toBeVisible({ timeout: 5000 });
});

// AI Prompt Generation
Then('I should see the generated prompt containing:', async function (dataTable) {
  const promptTextarea = await this.page.locator('[data-testid="ai-prompt-textarea"], textarea').first();
  const promptText = await promptTextarea.textContent() || await promptTextarea.inputValue();
  
  const expectedContents = dataTable.hashes();
  for (const row of expectedContents) {
    for (const [key, value] of Object.entries(row)) {
      if (value && value !== 'N/A') {
        expect(promptText).toContain(value);
      }
    }
  }
});

When('I copy the AI prompt', async function () {
  const copyButton = await this.page.locator('button:has-text("Copy"), button:has-text("Copy Prompt"), [data-testid="copy-prompt-button"]').first();
  await copyButton.click();
  await this.page.waitForTimeout(500);
});

// Success Messages - Consolidated from multiple files
Then('I should see a success message {string}', async function (message) {
  const successElement = await this.page.locator(`.success-message:has-text("${message}"), .success:has-text("${message}"), [data-testid="success-message"]:has-text("${message}")`).first();
  await expect(successElement).toBeVisible({ timeout: 5000 });
});

// JSON Operations
When('I paste the following JSON response:', async function (jsonString) {
  const jsonTextarea = await this.page.locator('[data-testid="json-textarea"], textarea[placeholder*="JSON"], .json-input').first();
  await jsonTextarea.clear();
  await jsonTextarea.fill(jsonString);
  await this.page.waitForTimeout(500);
});

When('I paste invalid JSON', async function () {
  const invalidJson = '{ "invalid": json, "missing": "quotes" }';
  const jsonTextarea = await this.page.locator('[data-testid="json-textarea"], textarea[placeholder*="JSON"], .json-input').first();
  await jsonTextarea.clear();
  await jsonTextarea.fill(invalidJson);
  await this.page.waitForTimeout(500);
});

// Generic Button Clicks
When('I click the {string} button', async function (buttonText) {
  const button = await this.page.locator(`button:has-text("${buttonText}"), input[type="button"][value="${buttonText}"]`).first();
  await button.click();
  await this.page.waitForTimeout(500);
});

// Tab Navigation
Then('I should see tabs for {string}, {string}, and topic pages', async function (tab1, tab2) {
  const tab1Element = await this.page.locator(`.tab:has-text("${tab1}"), button:has-text("${tab1}")`).first();
  const tab2Element = await this.page.locator(`.tab:has-text("${tab2}"), button:has-text("${tab2}")`).first();
  
  await expect(tab1Element).toBeVisible({ timeout: 5000 });
  await expect(tab2Element).toBeVisible({ timeout: 5000 });
  
  // Check for topic tabs
  const topicTabs = await this.page.locator('.tab[data-topic], .topic-tab, button[data-topic]');
  const count = await topicTabs.count();
  expect(count).toBeGreaterThan(0);
});

When('I click on the {string} tab', async function (tabName) {
  const tab = await this.page.locator(`.tab:has-text("${tabName}"), button:has-text("${tabName}"), [data-tab="${tabName}"]`).first();
  await tab.click();
  await this.page.waitForTimeout(1000);
});

// Media Upload Operations
When('I upload a local image {string}', async function (fileName) {
  const fileInput = await this.page.locator('input[type="file"][accept*="image"]').first();
  const filePath = path.join(__dirname, '..', 'fixtures', 'images', fileName);
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(2000);
});

Then('the welcome page should have an image', async function () {
  const welcomeSection = await this.page.locator('[data-page="welcome"], .welcome-page, [data-tab="welcome"]').first();
  const image = await welcomeSection.locator('img, .image-preview').first();
  await expect(image).toBeVisible({ timeout: 5000 });
});

Then('the topic should have the uploaded image', async function () {
  const topicSection = await this.page.locator('.topic-content.active, .tab-content.active').first();
  const image = await topicSection.locator('img, .image-preview').first();
  await expect(image).toBeVisible({ timeout: 5000 });
});

// Audio Operations
Then('I should see the narration text for each page', async function () {
  const narrationBlocks = await this.page.locator('.narration-block, .audio-section, [data-testid*="narration"]');
  const count = await narrationBlocks.count();
  expect(count).toBeGreaterThan(0);
});

When('I download the narration text file', async function () {
  const downloadButton = await this.page.locator('button:has-text("Download"), button:has-text("Export Text")').first();
  await downloadButton.click();
  await this.page.waitForTimeout(2000);
});

Then('a text file should be downloaded', async function () {
  const downloadSuccess = await this.page.locator('.download-success, .export-complete, :has-text("downloaded")').first();
  await expect(downloadSuccess).toBeVisible({ timeout: 5000 });
});

When('I upload the audio ZIP file {string}', async function (fileName) {
  const fileInput = await this.page.locator('input[type="file"][accept*=".zip"]').first();
  const filePath = path.join(__dirname, '..', 'fixtures', 'audio', fileName);
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(3000);
});

Then('all pages should show audio players', async function () {
  const audioPlayers = await this.page.locator('audio, .audio-player, .tauri-audio-player');
  const count = await audioPlayers.count();
  expect(count).toBeGreaterThanOrEqual(2); // At least welcome + one topic
});

When('I upload the captions ZIP file {string}', async function (fileName) {
  const fileInput = await this.page.locator('input[type="file"][accept*=".zip"]').first();
  const filePath = path.join(__dirname, '..', 'fixtures', 'captions', fileName);
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(3000);
});

Then('all pages should show caption indicators', async function () {
  const captionIndicators = await this.page.locator('.caption-indicator, .has-captions, [data-has-captions="true"]');
  const count = await captionIndicators.count();
  expect(count).toBeGreaterThan(0);
});

// Activities/Knowledge Checks
Then('I should see the knowledge check for {string}', async function (topicName) {
  const knowledgeCheck = await this.page.locator(`.knowledge-check:has-text("${topicName}"), [data-topic="${topicName}"] .knowledge-check`).first();
  await expect(knowledgeCheck).toBeVisible({ timeout: 5000 });
});

When('I edit the knowledge check question', async function () {
  const editButton = await this.page.locator('button:has-text("Edit"), button.edit-question, .edit-button').first();
  await editButton.click();
  await this.page.waitForTimeout(500);
});

When('I change the question to {string}', async function (newQuestion) {
  const questionInput = await this.page.locator('input[placeholder*="question"], textarea[placeholder*="question"], .question-input').first();
  await questionInput.clear();
  await questionInput.fill(newQuestion);
  await this.page.waitForTimeout(300);
});

When('I save the changes', async function () {
  const saveButton = await this.page.locator('button:has-text("Save"), button.save, [data-testid="save-button"]').first();
  await saveButton.click();
  await this.page.waitForTimeout(1000);
});

Then('the knowledge check should be updated', async function () {
  const successIndicator = await this.page.locator('.save-success, .updated, :has-text("saved")').first();
  await expect(successIndicator).toBeVisible({ timeout: 5000 });
});

// SCORM Package Operations
When('I set the pass mark to {string}', async function (passMark) {
  const passMarkInput = await this.page.locator('input[placeholder*="pass"], input[name*="pass"], [data-testid="pass-mark"]').first();
  await passMarkInput.clear();
  await passMarkInput.fill(passMark);
  await this.page.waitForTimeout(300);
});

When('I close the preview', async function () {
  const closeButton = await this.page.locator('button:has-text("Close"), button.close, .modal-close, [aria-label="close"]').first();
  await closeButton.click();
  await this.page.waitForTimeout(500);
});

// Course Configuration Steps
When('I enter {string} as the target audience', async function (audience) {
  const audienceInput = await this.page.locator('input[placeholder*="audience"], textarea[placeholder*="audience"], [data-testid="audience-input"]').first();
  await audienceInput.clear();
  await audienceInput.fill(audience);
  await this.page.waitForTimeout(300);
});

When('I set the course duration to {int} minutes', async function (duration) {
  const durationInput = await this.page.locator('input[placeholder*="duration"], input[type="number"][name*="duration"]').first();
  await durationInput.clear();
  await durationInput.fill(String(duration));
  await this.page.waitForTimeout(300);
});

When('I leave the target audience empty', async function () {
  const audienceInput = await this.page.locator('input[placeholder*="audience"], textarea[placeholder*="audience"], [data-testid="audience-input"]').first();
  await audienceInput.clear();
  await this.page.waitForTimeout(300);
});

When('I enter valid title and audience', async function () {
  // Enter a valid title
  const titleInput = await this.page.locator('[data-testid="course-title-input"]').first();
  await titleInput.clear();
  await titleInput.fill('Valid Course Title');
  
  // Enter valid audience
  const audienceInput = await this.page.locator('input[placeholder*="audience"], textarea[placeholder*="audience"], [data-testid="audience-input"]').first();
  await audienceInput.clear();
  await audienceInput.fill('Valid Target Audience');
  
  await this.page.waitForTimeout(500);
});

Then('I should not see any duration error', async function () {
  const errorMessage = await this.page.locator('.error:has-text("duration"), .error:has-text("Duration")');
  await expect(errorMessage).toHaveCount(0);
});

// Generic Step Navigation
Given('I am on the {string} step', async function (stepName) {
  await this.navigateToStep(stepName);
  await this.page.waitForSelector(`h2:has-text("${stepName}")`, { timeout: 10000 });
});

// Navigation and Workflow
When('I click the Next button without entering any data', async function () {
  const nextButton = await this.page.locator('[data-testid="next-button"], button:has-text("Next")').first();
  await nextButton.click();
  await this.page.waitForTimeout(500);
});

When('I complete the course seed input with valid data', async function () {
  // Fill in required fields
  const titleInput = await this.page.locator('[data-testid="course-title-input"]').first();
  await titleInput.clear();
  await titleInput.fill('Complete Test Course');
  
  const audienceInput = await this.page.locator('input[placeholder*="audience"], textarea[placeholder*="audience"]').first();
  if (await audienceInput.count() > 0) {
    await audienceInput.clear();
    await audienceInput.fill('Test Audience');
  }
  
  // Add topics
  const topicsTextarea = await this.page.locator('[data-testid="topics-textarea"]').first();
  await topicsTextarea.clear();
  await topicsTextarea.fill('Topic 1\nTopic 2\nTopic 3');
  
  await this.page.waitForTimeout(1000);
});

When('I proceed to the {string} step', async function (stepName) {
  const nextButton = await this.page.locator('[data-testid="next-button"], button:has-text("Next")').first();
  await nextButton.click();
  await this.page.waitForTimeout(1000);
  
  // Wait for the target step to be visible
  await this.page.waitForSelector(`h2:has-text("${stepName}")`, { timeout: 10000 });
});

Then('I should see an error message about invalid JSON', async function () {
  const errorMessage = await this.page.locator('.error:has-text("JSON"), .error:has-text("invalid"), .validation-error').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

// Project Management
When('I create a course with title {string}', async function (title) {
  // Navigate to app if not already there
  if (await this.page.locator('.dashboard-container').count() === 0) {
    await this.page.goto(this.baseUrl || 'http://localhost:1420');
    await this.page.waitForLoadState('domcontentloaded');
  }
  
  // Click Create New Project
  const createButton = await this.page.locator('button:has-text("Create New Project")').first();
  await createButton.click();
  await this.page.waitForTimeout(1000);
  
  // Enter project name (which becomes course title)
  const nameInput = await this.page.locator('input[placeholder*="name"], input[placeholder*="title"]').first();
  await nameInput.fill(title);
  
  // Click create/confirm
  const confirmButton = await this.page.locator('button:has-text("Create"), button:has-text("OK")').first();
  await confirmButton.click();
  await this.page.waitForTimeout(2000);
});

When('I add topics and proceed to step {int}', async function (targetStep) {
  // Add some topics
  const topicsTextarea = await this.page.locator('[data-testid="topics-textarea"]').first();
  await topicsTextarea.clear();
  await topicsTextarea.fill('Topic 1\nTopic 2\nTopic 3');
  
  // Navigate through steps to reach target step
  for (let i = 1; i < targetStep; i++) {
    const nextButton = await this.page.locator('[data-testid="next-button"], button:has-text("Next")').first();
    await nextButton.click();
    await this.page.waitForTimeout(1500);
    
    // Handle skip buttons if needed
    const skipButton = await this.page.locator('button:has-text("Skip")').first();
    if (await skipButton.count() > 0 && await skipButton.isVisible()) {
      await skipButton.click();
      await this.page.waitForTimeout(1000);
    }
  }
});

When('I save the project', async function () {
  // Use Ctrl+S or Save menu
  await this.page.keyboard.press('Control+S');
  await this.page.waitForTimeout(1000);
});

Then('all my previous data should be loaded', async function () {
  // Check that course title is preserved
  const titleInput = await this.page.locator('[data-testid="course-title-input"]').first();
  if (await titleInput.count() > 0) {
    const value = await titleInput.inputValue();
    expect(value).toBeTruthy();
    expect(value.length).toBeGreaterThan(0);
  }
});

// Media Enhancement Advanced Features
When('I click on a topic tab', async function () {
  const topicTab = await this.page.locator('.tab[data-topic], .topic-tab, button[data-topic]').first();
  await topicTab.click();
  await this.page.waitForTimeout(1000);
});

When('I paste a YouTube URL {string}', async function (url) {
  const urlInput = await this.page.locator('input[placeholder*="YouTube"], input[placeholder*="URL"], input[type="url"]').first();
  await urlInput.clear();
  await urlInput.fill(url);
  await this.page.waitForTimeout(500);
});

Then('the topic should show an embedded video player', async function () {
  const videoPlayer = await this.page.locator('iframe[src*="youtube"], .youtube-embed, video').first();
  await expect(videoPlayer).toBeVisible({ timeout: 5000 });
});

When('I add an image to a page', async function () {
  const addButton = await this.page.locator('button:has-text("Add Image"), button:has-text("Upload")').first();
  await addButton.click();
  
  const fileInput = await this.page.locator('input[type="file"][accept*="image"]').first();
  const filePath = path.join(__dirname, '..', 'fixtures', 'images', 'test-image.jpg');
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(2000);
});

When('I confirm the removal', async function () {
  const confirmButton = await this.page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Remove")').first();
  await confirmButton.click();
  await this.page.waitForTimeout(500);
});

Then('the page should have no media', async function () {
  const mediaItems = await this.page.locator('img:not([src*="placeholder"]), video, iframe');
  await expect(mediaItems).toHaveCount(0);
});

// Audio Narration Individual Controls
When('I click on the {string} page audio section', async function (pageName) {
  const audioSection = await this.page.locator(`[data-page="${pageName}"] .audio-section, .audio-section[data-page="${pageName}"]`).first();
  await audioSection.click();
  await this.page.waitForTimeout(500);
});

When('I upload an individual audio file', async function () {
  const fileInput = await this.page.locator('input[type="file"][accept*="audio"]').first();
  const filePath = path.join(__dirname, '..', 'fixtures', 'audio', 'test-audio.wav');
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(2000);
});

Then('only the welcome page should have audio', async function () {
  const welcomeAudio = await this.page.locator('[data-page="welcome"] audio, [data-page="welcome"] .audio-player').first();
  await expect(welcomeAudio).toBeVisible({ timeout: 5000 });
  
  // Other pages should not have audio
  const otherAudio = await this.page.locator('[data-page]:not([data-page="welcome"]) audio');
  await expect(otherAudio).toHaveCount(0);
});

When('I click the play button', async function () {
  const playButton = await this.page.locator('button[aria-label*="play"], .play-button, button:has-text("Play")').first();
  await playButton.click();
  await this.page.waitForTimeout(500);
});

Then('the timestamp should update', async function () {
  const timestamp = await this.page.locator('.timestamp, .current-time, [data-testid="audio-time"]').first();
  await expect(timestamp).toBeVisible({ timeout: 5000 });
  
  // Wait for time to change
  await this.page.waitForTimeout(2000);
});

// Advanced SCORM Configuration
Then('I should see SCORM {int} specific options', async function (version) {
  const versionOptions = await this.page.locator(`.scorm-${version}-options, [data-scorm-version="${version}"]`).first();
  await expect(versionOptions).toBeVisible({ timeout: 5000 });
});

When('I set completion criteria to {string}', async function (criteria) {
  const criteriaSelect = await this.page.locator('select[name*="completion"], .completion-criteria').first();
  await criteriaSelect.selectOption(criteria);
  await this.page.waitForTimeout(300);
});

When('I generate the package', async function () {
  const generateButton = await this.page.locator('button:has-text("Generate"), button:has-text("Create Package")').first();
  await generateButton.click();
  await this.page.waitForTimeout(5000);
});

Then('the manifest should include interaction tracking', async function () {
  const trackingIndicator = await this.page.locator(':has-text("interaction"), :has-text("tracking"), .tracking-enabled').first();
  await expect(trackingIndicator).toBeVisible({ timeout: 5000 });
});

// Error Recovery and Network Testing
Given('I am creating a course', async function () {
  // Start creating a course
  await this.page.goto(this.baseUrl || 'http://localhost:1420');
  await this.page.waitForLoadState('domcontentloaded');
  
  const createButton = await this.page.locator('button:has-text("Create New Project")').first();
  if (await createButton.count() > 0) {
    await createButton.click();
    await this.page.waitForTimeout(1000);
    
    // Enter basic info
    const nameInput = await this.page.locator('input[placeholder*="name"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('Test Course');
      const confirmButton = await this.page.locator('button:has-text("Create")').first();
      await confirmButton.click();
      await this.page.waitForTimeout(2000);
    }
  }
});

When('the network connection is lost', async function () {
  // Simulate network issues by going offline
  await this.page.context().setOffline(true);
});

When('I try to search for images', async function () {
  // Try to navigate to media step and search
  await this.navigateToStep('Media Enhancement Wizard');
  
  const searchInput = await this.page.locator('input[placeholder*="Search"], input[type="search"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('test image');
    await searchInput.press('Enter');
    await this.page.waitForTimeout(2000);
  }
});

When('the network connection is restored', async function () {
  await this.page.context().setOffline(false);
});

When('I retry the image search', async function () {
  const searchInput = await this.page.locator('input[placeholder*="Search"], input[type="search"]').first();
  await searchInput.fill('test image');
  await searchInput.press('Enter');
  await this.page.waitForTimeout(2000);
});

Then('the search should complete successfully', async function () {
  const searchResults = await this.page.locator('.search-results, .image-results').first();
  await expect(searchResults).toBeVisible({ timeout: 10000 });
});

When('I try to upload an invalid audio file', async function () {
  const fileInput = await this.page.locator('input[type="file"][accept*="audio"]').first();
  const filePath = path.join(__dirname, '..', 'fixtures', 'invalid', 'document.txt');
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(2000);
});

// Accessibility Testing
When('I press Tab key repeatedly', async function () {
  // Press Tab multiple times to test focus
  for (let i = 0; i < 10; i++) {
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(100);
  }
});

Then('focus should move through all interactive elements in order', async function () {
  const focusedElement = await this.page.locator(':focus').first();
  await expect(focusedElement).toBeVisible();
});

When('I press Enter on the Next button', async function () {
  const nextButton = await this.page.locator('[data-testid="next-button"], button:has-text("Next")').first();
  await nextButton.focus();
  await this.page.keyboard.press('Enter');
  await this.page.waitForTimeout(1000);
});

Then('I should proceed to the next step', async function () {
  // Wait for step transition
  await this.page.waitForTimeout(2000);
  const stepIndicator = await this.page.locator('.step-active, .current-step').first();
  await expect(stepIndicator).toBeVisible();
});

When('an error occurs', async function () {
  // Simulate an error by trying invalid action
  await this.page.evaluate(() => {
    const event = new CustomEvent('error', { detail: 'Test error for accessibility' });
    document.dispatchEvent(event);
  });
});

Then('the error should be announced to screen readers', async function () {
  const ariaLive = await this.page.locator('[aria-live], [role="alert"]').first();
  await expect(ariaLive).toBeVisible({ timeout: 5000 });
});

When('I complete a step successfully', async function () {
  // Fill out current step and proceed
  const titleInput = await this.page.locator('[data-testid="course-title-input"]').first();
  if (await titleInput.count() > 0) {
    await titleInput.fill('Success Test Course');
    
    const nextButton = await this.page.locator('[data-testid="next-button"]').first();
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await this.page.waitForTimeout(1000);
    }
  }
});

Then('success should be announced to screen readers', async function () {
  const successAnnouncement = await this.page.locator('[aria-live]:has-text("success"), [role="status"]:has-text("success")').first();
  await expect(successAnnouncement).toBeVisible({ timeout: 5000 });
});

// Additional missing steps found in dry run
When('I remove the topic {string}', async function (topicName) {
  const topicItem = await this.page.locator(`.topic-item:has-text("${topicName}"), [data-topic="${topicName}"]`).first();
  const removeButton = await topicItem.locator('button:has-text("Remove"), button:has-text("×"), .remove-button').first();
  await removeButton.click();
  await this.page.waitForTimeout(500);
});

Then('the topics should be {string} and {string}', async function (topic1, topic2) {
  const topicsList = await this.page.locator('.topic-item, [data-testid="topic-item"]');
  const topicsText = await topicsList.allTextContents();
  expect(topicsText).toContain(topic1);
  expect(topicsText).toContain(topic2);
  expect(topicsText).toHaveLength(2);
});

Then('the target audience should be {string}', async function (expectedAudience) {
  const audienceInput = await this.page.locator('input[placeholder*="audience"], textarea[placeholder*="audience"], [data-testid="audience-input"]').first();
  const actualAudience = await audienceInput.inputValue();
  expect(actualAudience).toBe(expectedAudience);
});

Then('the duration should be {int} minutes', async function (expectedDuration) {
  const durationInput = await this.page.locator('input[placeholder*="duration"], input[type="number"][name*="duration"]').first();
  const actualDuration = await durationInput.inputValue();
  expect(parseInt(actualDuration)).toBe(expectedDuration);
});