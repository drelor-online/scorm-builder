import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import path from 'path';
import { promises as fs } from 'fs';

// SCORM Package Builder Navigation
Given('I am on the SCORM Package Builder step', async function (this) {
  await this.navigateToStep('SCORM Package Builder');
  await this.page.waitForSelector('h2:has-text("SCORM Package Builder")', { timeout: 10000 });
});

When('I navigate to the SCORM Package Builder', async function (this) {
  await this.navigateToStep('SCORM Package Builder');
});

// Package Configuration
When('I set the package title to {string}', async function (this, title) {
  const titleInput = await this.page.locator('input[placeholder*="title"], input[name="title"]').first();
  await titleInput.clear();
  await titleInput.fill(title);
  await this.page.waitForTimeout(300);
});

When('I set the package identifier to {string}', async function (this, identifier) {
  const idInput = await this.page.locator('input[placeholder*="identifier"], input[name="identifier"]').first();
  await idInput.clear();
  await idInput.fill(identifier);
  await this.page.waitForTimeout(300);
});

When('I set the package description to {string}', async function (this, description) {
  const descInput = await this.page.locator('textarea[placeholder*="description"], textarea[name="description"]').first();
  await descInput.clear();
  await descInput.fill(description);
  await this.page.waitForTimeout(300);
});

When('I select SCORM version {string}', async function (this, version) {
  const versionSelect = await this.page.locator('select[name*="version"], .scorm-version-select').first();
  await versionSelect.selectOption(version);
  await this.page.waitForTimeout(300);
});

// Manifest Settings
When('I enable completion tracking', async function (this) {
  const trackingCheckbox = await this.page.locator('input[type="checkbox"][name*="completion"], label:has-text("Track Completion") input').first();
  await trackingCheckbox.check();
  await this.page.waitForTimeout(300);
});

When('I enable score tracking', async function (this) {
  const scoreCheckbox = await this.page.locator('input[type="checkbox"][name*="score"], label:has-text("Track Score") input').first();
  await scoreCheckbox.check();
  await this.page.waitForTimeout(300);
});

When('I set the mastery score to {int}%', async function (this, score) {
  const scoreInput = await this.page.locator('input[placeholder*="mastery"], input[name*="mastery"]').first();
  await scoreInput.fill(String(score));
  await this.page.waitForTimeout(300);
});

When('I set the maximum time allowed to {string}', async function (this, time) {
  const timeInput = await this.page.locator('input[placeholder*="time"], input[name*="max_time"]').first();
  await timeInput.fill(time);
  await this.page.waitForTimeout(300);
});

// Launch Settings
When('I set the launch behavior to {string}', async function (this, behavior) {
  const behaviorSelect = await this.page.locator('select[name*="launch"], .launch-behavior-select').first();
  await behaviorSelect.selectOption(behavior);
  await this.page.waitForTimeout(300);
});

When('I enable resume capability', async function (this) {
  const resumeCheckbox = await this.page.locator('input[type="checkbox"][name*="resume"], label:has-text("Allow Resume") input').first();
  await resumeCheckbox.check();
  await this.page.waitForTimeout(300);
});

// Content Selection
When('I select pages to include in the package', async function (this) {
  // Select all pages by default
  const selectAllButton = await this.page.locator('button:has-text("Select All"), button:has-text("Include All")').first();
  await selectAllButton.click();
  await this.page.waitForTimeout(300);
});

When('I exclude page {string} from the package', async function (this, pageName) {
  const pageCheckbox = await this.page.locator(`label:has-text("${pageName}") input[type="checkbox"]`).first();
  await pageCheckbox.uncheck();
  await this.page.waitForTimeout(300);
});

// Preview
When('I preview the SCORM package', async function (this) {
  const previewButton = await this.page.locator('button:has-text("Preview"), button:has-text("Test Package")').first();
  await previewButton.click();
  await this.page.waitForTimeout(2000);
});

Then('I should see the SCORM package preview', async function (this) {
  // Check if preview iframe or new window opened
  const previewFrame = await this.page.locator('iframe.scorm-preview, .preview-container').first();
  if (await previewFrame.isVisible({ timeout: 1000 })) {
    await expect(previewFrame).toBeVisible();
  } else {
    // Check for new tab/window
    const pages = this.page.context().pages();
    expect(pages.length).toBeGreaterThan(1);
  }
});

When('I navigate through the preview course', async function (this) {
  // If preview is in iframe
  const previewFrame = await this.page.frameLocator('iframe.scorm-preview').first();
  if (previewFrame) {
    const nextButton = await previewFrame.locator('button:has-text("Next"), .next-button').first();
    await nextButton.click();
  } else {
    // If preview is in new window
    const pages = this.page.context().pages();
    const previewPage = pages[pages.length - 1];
    const nextButton = await previewPage.locator('button:has-text("Next"), .next-button').first();
    await nextButton.click();
  }
  await this.page.waitForTimeout(1000);
});

// Package Generation
When('I generate the SCORM package', async function (this) {
  const generateButton = await this.page.locator('button:has-text("Generate"), button:has-text("Create Package"), button:has-text("Build")').first();
  await generateButton.click();
  await this.page.waitForTimeout(3000);
});

Then('the SCORM package should be generated successfully', async function (this) {
  const successMessage = await this.page.locator('.success-message:has-text("generated"), .success:has-text("complete")').first();
  await expect(successMessage).toBeVisible({ timeout: 10000 });
});

Then('I should see a download link for the package', async function (this) {
  const downloadLink = await this.page.locator('a[href*=".zip"], button:has-text("Download"), .download-link').first();
  await expect(downloadLink).toBeVisible({ timeout: 5000 });
});

// Export Options
When('I export the package as SCORM 1.2', async function (this) {
  const exportButton = await this.page.locator('button:has-text("Export as SCORM 1.2")').first();
  await exportButton.click();
  await this.page.waitForTimeout(3000);
});

When('I export the package as SCORM 2004', async function (this) {
  const exportButton = await this.page.locator('button:has-text("Export as SCORM 2004")').first();
  await exportButton.click();
  await this.page.waitForTimeout(3000);
});

When('I export the package as xAPI', async function (this) {
  const exportButton = await this.page.locator('button:has-text("Export as xAPI"), button:has-text("Tin Can")').first();
  await exportButton.click();
  await this.page.waitForTimeout(3000);
});

// Validation
Then('I should see validation errors for the package', async function (this) {
  const validationErrors = await this.page.locator('.validation-error, .error-list').first();
  await expect(validationErrors).toBeVisible({ timeout: 5000 });
});

Then('the manifest should be valid', async function (this) {
  const validIndicator = await this.page.locator('.manifest-valid, .validation-success, :has-text("Valid manifest")').first();
  await expect(validIndicator).toBeVisible({ timeout: 5000 });
});

// Advanced Settings
When('I add custom metadata {string} with value {string}', async function (this, key, value) {
  const addMetadataButton = await this.page.locator('button:has-text("Add Metadata"), button:has-text("Custom Field")').first();
  await addMetadataButton.click();
  
  const keyInput = await this.page.locator('input[placeholder*="key"], input[placeholder*="name"]').last();
  await keyInput.fill(key);
  
  const valueInput = await this.page.locator('input[placeholder*="value"]').last();
  await valueInput.fill(value);
  
  await this.page.waitForTimeout(300);
});

When('I set the package language to {string}', async function (this, language) {
  const languageSelect = await this.page.locator('select[name*="language"], .language-select').first();
  await languageSelect.selectOption(language);
  await this.page.waitForTimeout(300);
});

// File Management
Then('the package size should be less than {int}MB', async function (this, maxSize) {
  const sizeDisplay = await this.page.locator('.package-size, .file-size').first();
  const sizeText = await sizeDisplay.textContent();
  
  // Extract number from text like "2.5 MB" or "2500 KB"
  const match = sizeText?.match(/(\d+\.?\d*)\s*(MB|KB)/i);
  if (match) {
    let size = parseFloat(match[1]);
    if (match[2].toUpperCase() === 'KB') {
      size = size / 1024; // Convert KB to MB
    }
    expect(size).toBeLessThan(maxSize);
  }
});

// Template Selection
When('I select the {string} template', async function (this, templateName) {
  const templateOption = await this.page.locator(`.template-option:has-text("${templateName}"), label:has-text("${templateName}") input`).first();
  await templateOption.click();
  await this.page.waitForTimeout(500);
});

Then('the package should use the {string} template', async function (this, templateName) {
  const selectedTemplate = await this.page.locator('.selected-template, .active-template').first();
  const text = await selectedTemplate.textContent();
  expect(text).toContain(templateName);
});

// Navigation Settings
When('I enable the navigation menu', async function (this) {
  const navCheckbox = await this.page.locator('input[type="checkbox"][name*="navigation"], label:has-text("Show Navigation") input').first();
  await navCheckbox.check();
  await this.page.waitForTimeout(300);
});

When('I set navigation to {string} mode', async function (this, mode) {
  const modeSelect = await this.page.locator('select[name*="nav_mode"], .navigation-mode-select').first();
  await modeSelect.selectOption(mode);
  await this.page.waitForTimeout(300);
});

// Resources
When('I add external resource {string}', async function (this, resourceUrl) {
  const addResourceButton = await this.page.locator('button:has-text("Add Resource"), button:has-text("External Resource")').first();
  await addResourceButton.click();
  
  const urlInput = await this.page.locator('input[placeholder*="URL"], input[type="url"]').last();
  await urlInput.fill(resourceUrl);
  
  await this.page.waitForTimeout(300);
});

When('I upload additional files to the package', async function (this) {
  const fileInput = await this.page.locator('input[type="file"][multiple]').first();
  const filePaths = [
    path.join(__dirname, '..', 'fixtures', 'resources', 'document.pdf'),
    path.join(__dirname, '..', 'fixtures', 'resources', 'stylesheet.css')
  ];
  await fileInput.setInputFiles(filePaths);
  await this.page.waitForTimeout(1000);
});

// Testing and Validation
When('I run SCORM conformance test', async function (this) {
  const testButton = await this.page.locator('button:has-text("Test Conformance"), button:has-text("Validate SCORM")').first();
  await testButton.click();
  await this.page.waitForTimeout(2000);
});

Then('the package should pass SCORM conformance', async function (this) {
  const passIndicator = await this.page.locator('.conformance-pass, .test-success, :has-text("Conformant")').first();
  await expect(passIndicator).toBeVisible({ timeout: 10000 });
});

// Progress Tracking
Then('I should see the package generation progress', async function (this) {
  const progressBar = await this.page.locator('.progress-bar, progress, .generation-progress').first();
  await expect(progressBar).toBeVisible({ timeout: 5000 });
});

When('I cancel the package generation', async function (this) {
  const cancelButton = await this.page.locator('button:has-text("Cancel"), button:has-text("Stop")').first();
  await cancelButton.click();
  await this.page.waitForTimeout(500);
});

// Error Handling
Then('I should see an error about missing required fields', async function (this) {
  const errorMessage = await this.page.locator('.error:has-text("required"), .validation-error:has-text("missing")').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

Then('I should see an error about invalid manifest', async function (this) {
  const errorMessage = await this.page.locator('.error:has-text("manifest"), .validation-error:has-text("invalid")').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

// Deployment
When('I deploy the package to LMS', async function (this) {
  const deployButton = await this.page.locator('button:has-text("Deploy"), button:has-text("Upload to LMS")').first();
  await deployButton.click();
  await this.page.waitForTimeout(1000);
});

When('I enter LMS credentials', async function (this) {
  const urlInput = await this.page.locator('input[placeholder*="LMS URL"]').first();
  await urlInput.fill('https://example-lms.com');
  
  const usernameInput = await this.page.locator('input[placeholder*="username"]').first();
  await usernameInput.fill('testuser');
  
  const passwordInput = await this.page.locator('input[type="password"]').first();
  await passwordInput.fill('testpass');
  
  await this.page.waitForTimeout(300);
});

Then('the package should be deployed successfully', async function (this) {
  const successMessage = await this.page.locator('.deploy-success, :has-text("deployed successfully")').first();
  await expect(successMessage).toBeVisible({ timeout: 10000 });
});