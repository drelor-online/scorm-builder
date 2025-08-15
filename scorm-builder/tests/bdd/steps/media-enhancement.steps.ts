import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import path from 'path';

// Media Enhancement Wizard Navigation
Given('I am on the Media Enhancement Wizard step', async function () {
  await this.navigateToStep('Media Enhancement Wizard');
  await this.page.waitForSelector('h2:has-text("Media Enhancement Wizard")', { timeout: 10000 });
});

When('I navigate to the Media Enhancement Wizard', async function () {
  await this.navigateToStep('Media Enhancement Wizard');
});

// Image Upload and Management
When('I upload an image file {string}', async function (fileName) {
  const fileInput = await this.page.locator('input[type="file"][accept*="image"]');
  const filePath = path.join(__dirname, '..', 'fixtures', 'images', fileName);
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(1000); // Wait for upload processing
});

When('I upload an image larger than {int}MB', async function (this, sizeMB) {
  // For testing, we'll use a predefined large image
  const fileInput = await this.page.locator('input[type="file"][accept*="image"]');
  const filePath = path.join(__dirname, '..', 'fixtures', 'images', 'large-image.jpg');
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(2000); // Wait for upload processing
});

Then('the image should be uploaded successfully', async function (this) {
  // Check for success message or uploaded image preview
  const successMessage = await this.page.locator('.success-message, .upload-success').first();
  await expect(successMessage).toBeVisible({ timeout: 5000 });
});

Then('I should see a preview of the image', async function (this) {
  const imagePreview = await this.page.locator('img.preview-image, .image-preview img').first();
  await expect(imagePreview).toBeVisible({ timeout: 5000 });
});

Then('I should see the uploaded image in the media gallery', async function (this) {
  const mediaGallery = await this.page.locator('.media-gallery, .uploaded-images');
  await expect(mediaGallery).toBeVisible();
  const uploadedImage = await mediaGallery.locator('img').first();
  await expect(uploadedImage).toBeVisible();
});

// Image Search Functionality
When('I search for images with keyword {string}', async function (this, keyword) {
  const searchInput = await this.page.locator('input[placeholder*="Search"], input[type="search"]').first();
  await searchInput.fill(keyword);
  await searchInput.press('Enter');
  await this.page.waitForTimeout(2000); // Wait for search results
});

When('I select the first image from search results', async function (this) {
  const firstResult = await this.page.locator('.search-results img, .image-result').first();
  await firstResult.click();
  await this.page.waitForTimeout(500);
});

Then('I should see search results for {string}', async function (this, keyword) {
  const searchResults = await this.page.locator('.search-results, .image-search-results');
  await expect(searchResults).toBeVisible({ timeout: 10000 });
  const resultImages = await searchResults.locator('img');
  const count = await resultImages.count();
  expect(count).toBeGreaterThan(0);
});

// Video Embedding
When('I embed a YouTube video with URL {string}', async function (this, videoUrl) {
  const videoInput = await this.page.locator('input[placeholder*="YouTube"], input[placeholder*="video"]').first();
  await videoInput.fill(videoUrl);
  
  // Look for an "Add" or "Embed" button
  const embedButton = await this.page.locator('button:has-text("Add"), button:has-text("Embed")').first();
  await embedButton.click();
  await this.page.waitForTimeout(1000);
});

Then('the video should be embedded successfully', async function (this) {
  // Check for iframe or video preview
  const videoEmbed = await this.page.locator('iframe[src*="youtube"], .youtube-embed, .video-preview').first();
  await expect(videoEmbed).toBeVisible({ timeout: 5000 });
});

Then('I should see a preview of the YouTube video', async function (this) {
  const videoPreview = await this.page.locator('.video-preview, .youtube-preview, iframe[src*="youtube"]').first();
  await expect(videoPreview).toBeVisible({ timeout: 5000 });
});

// Page Media Assignment
When('I assign the image to page {string}', async function (this, pageName) {
  // Find page selector dropdown or radio buttons
  const pageSelector = await this.page.locator(`select option:has-text("${pageName}"), label:has-text("${pageName}") input`).first();
  
  if (await pageSelector.isVisible()) {
    await pageSelector.click();
  } else {
    // Try dropdown
    const dropdown = await this.page.locator('select').first();
    await dropdown.selectOption({ label: pageName });
  }
  
  await this.page.waitForTimeout(500);
});

When('I remove the image from page {string}', async function (this, pageName) {
  // Find the remove button for the specific page
  const pageSection = await this.page.locator(`.page-media:has-text("${pageName}")`);
  const removeButton = await pageSection.locator('button:has-text("Remove"), button.remove-media').first();
  await removeButton.click();
  await this.page.waitForTimeout(500);
});

Then('page {string} should have the media assigned', async function (this, pageName) {
  const pageMediaIndicator = await this.page.locator(`.page-media:has-text("${pageName}") .media-assigned, .page-${pageName.toLowerCase()} .has-media`).first();
  await expect(pageMediaIndicator).toBeVisible({ timeout: 5000 });
});

// Media Library Management
When('I open the media library', async function (this) {
  const libraryButton = await this.page.locator('button:has-text("Media Library"), button:has-text("View All Media")').first();
  await libraryButton.click();
  await this.page.waitForTimeout(1000);
});

When('I delete the media item {string}', async function (this, mediaName) {
  const mediaItem = await this.page.locator(`.media-item:has-text("${mediaName}")`);
  const deleteButton = await mediaItem.locator('button:has-text("Delete"), button.delete').first();
  await deleteButton.click();
  
  // Confirm deletion if there's a confirmation dialog
  const confirmButton = await this.page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
  if (await confirmButton.isVisible({ timeout: 1000 })) {
    await confirmButton.click();
  }
  
  await this.page.waitForTimeout(500);
});

Then('the media library should be empty', async function (this) {
  const emptyMessage = await this.page.locator(':has-text("No media"), :has-text("Empty")').first();
  await expect(emptyMessage).toBeVisible({ timeout: 5000 });
});

Then('I should see {int} media items in the library', async function (this, count) {
  const mediaItems = await this.page.locator('.media-item, .media-card');
  await expect(mediaItems).toHaveCount(count, { timeout: 5000 });
});

// Error Handling
Then('I should see an error message about file size', async function (this) {
  const errorMessage = await this.page.locator('.error-message:has-text("size"), .error:has-text("large")').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

Then('I should see an error message about unsupported format', async function (this) {
  const errorMessage = await this.page.locator('.error-message:has-text("format"), .error:has-text("supported")').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

// Progress and Status
When('I wait for media processing to complete', async function (this) {
  // Wait for any loading indicators to disappear
  const loader = await this.page.locator('.loading, .processing, .spinner').first();
  if (await loader.isVisible({ timeout: 1000 })) {
    await loader.waitFor({ state: 'hidden', timeout: 30000 });
  }
});

Then('I should see media enhancement options', async function (this) {
  const enhancementOptions = await this.page.locator('.enhancement-options, .media-tools, .edit-tools').first();
  await expect(enhancementOptions).toBeVisible({ timeout: 5000 });
});

// Alt Text and Metadata
When('I add alt text {string} to the image', async function (this, altText) {
  const altTextInput = await this.page.locator('input[placeholder*="alt"], input[name*="alt"], textarea[placeholder*="description"]').first();
  await altTextInput.fill(altText);
  await this.page.waitForTimeout(500);
});

Then('the image should have alt text {string}', async function (this, expectedAltText) {
  const imageWithAlt = await this.page.locator(`img[alt="${expectedAltText}"]`).first();
  await expect(imageWithAlt).toBeVisible({ timeout: 5000 });
});

// Media Type Selection
When('I select media type {string}', async function (this, mediaType) {
  const typeSelector = await this.page.locator(`input[value="${mediaType}"], label:has-text("${mediaType}") input`).first();
  await typeSelector.click();
  await this.page.waitForTimeout(500);
});

Then('the {string} upload options should be visible', async function (this, mediaType) {
  const uploadSection = await this.page.locator(`.${mediaType.toLowerCase()}-upload, .upload-${mediaType.toLowerCase()}`).first();
  await expect(uploadSection).toBeVisible({ timeout: 5000 });
});