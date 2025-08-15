import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import path from 'path';

// Audio Narration Wizard Navigation
Given('I am on the Audio Narration Wizard step', async function (this) {
  await this.navigateToStep('Audio Narration Wizard');
  await this.page.waitForSelector('h2:has-text("Audio Narration Wizard")', { timeout: 10000 });
});

When('I navigate to the Audio Narration Wizard', async function (this) {
  await this.navigateToStep('Audio Narration Wizard');
});

// Audio File Upload
When('I upload an audio file {string}', async function (this, fileName) {
  const fileInput = await this.page.locator('input[type="file"][accept*="audio"]');
  const filePath = path.join(__dirname, '..', 'fixtures', 'audio', fileName);
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(1000); // Wait for upload processing
});

When('I upload audio file {string} for block {string}', async function (this, fileName, blockId) {
  // Find the specific block's upload input
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const fileInput = await blockSection.locator('input[type="file"][accept*="audio"]');
  const filePath = path.join(__dirname, '..', 'fixtures', 'audio', fileName);
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(1000);
});

Then('the audio file should be uploaded successfully', async function (this) {
  const successIndicator = await this.page.locator('.audio-uploaded, .upload-success, .audio-file-name').first();
  await expect(successIndicator).toBeVisible({ timeout: 5000 });
});

Then('I should see the audio player for block {string}', async function (this, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const audioPlayer = await blockSection.locator('audio, .audio-player, .tauri-audio-player').first();
  await expect(audioPlayer).toBeVisible({ timeout: 5000 });
});

// Caption Management
When('I upload caption file {string}', async function (this, fileName) {
  const fileInput = await this.page.locator('input[type="file"][accept*=".vtt,.srt,.txt"]');
  const filePath = path.join(__dirname, '..', 'fixtures', 'captions', fileName);
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(1000);
});

When('I upload caption file {string} for block {string}', async function (this, fileName, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const fileInput = await blockSection.locator('input[type="file"][accept*=".vtt,.srt,.txt"]');
  const filePath = path.join(__dirname, '..', 'fixtures', 'captions', fileName);
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(1000);
});

When('I enter caption text {string} for block {string}', async function (this, captionText, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const captionInput = await blockSection.locator('textarea[placeholder*="caption"], .caption-input').first();
  await captionInput.fill(captionText);
  await this.page.waitForTimeout(500);
});

Then('the caption should be displayed for block {string}', async function (this, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const captionDisplay = await blockSection.locator('.caption-text, .caption-display, .caption-content').first();
  await expect(captionDisplay).toBeVisible({ timeout: 5000 });
});

// Narration Text Management
When('I edit the narration text for block {string} to {string}', async function (this, blockId, newText) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const textArea = await blockSection.locator('textarea[placeholder*="narration"], .narration-text').first();
  await textArea.clear();
  await textArea.fill(newText);
  await this.page.waitForTimeout(500);
});

Then('the narration text for block {string} should be {string}', async function (this, blockId, expectedText) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const textArea = await blockSection.locator('textarea[placeholder*="narration"], .narration-text').first();
  const actualText = await textArea.inputValue();
  expect(actualText).toBe(expectedText);
});

// Audio Recording
When('I start recording audio for block {string}', async function (this, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const recordButton = await blockSection.locator('button:has-text("Record"), button.record-button, button[aria-label*="record"]').first();
  await recordButton.click();
  await this.page.waitForTimeout(500);
});

When('I stop recording audio', async function (this) {
  const stopButton = await this.page.locator('button:has-text("Stop"), button.stop-recording, button[aria-label*="stop"]').first();
  await stopButton.click();
  await this.page.waitForTimeout(1000);
});

Then('I should see the recording in progress', async function (this) {
  const recordingIndicator = await this.page.locator('.recording-indicator, .recording-active, .is-recording').first();
  await expect(recordingIndicator).toBeVisible({ timeout: 5000 });
});

Then('the recorded audio should be saved for block {string}', async function (this, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const audioSaved = await blockSection.locator('.audio-saved, .recording-complete, audio').first();
  await expect(audioSaved).toBeVisible({ timeout: 5000 });
});

// Bulk Operations
When('I upload a ZIP file containing audio files', async function (this) {
  const fileInput = await this.page.locator('input[type="file"][accept*=".zip"]');
  const filePath = path.join(__dirname, '..', 'fixtures', 'audio', 'audio-bundle.zip');
  await fileInput.setInputFiles(filePath);
  await this.page.waitForTimeout(3000); // Wait for ZIP extraction
});

Then('all audio files should be matched to their respective blocks', async function (this) {
  // Check that multiple blocks have audio
  const audioPlayers = await this.page.locator('audio, .audio-player, .tauri-audio-player');
  const count = await audioPlayers.count();
  expect(count).toBeGreaterThan(1);
});

// Preview and Validation
When('I preview the audio narration', async function (this) {
  const previewButton = await this.page.locator('button:has-text("Preview"), button:has-text("Play All")').first();
  await previewButton.click();
  await this.page.waitForTimeout(1000);
});

When('I play the audio for block {string}', async function (this, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const playButton = await blockSection.locator('button[aria-label*="play"], .play-button, audio').first();
  
  if (await playButton.getAttribute('tagName') === 'AUDIO') {
    // If it's an audio element, trigger play via JavaScript
    await playButton.evaluate((audio: HTMLAudioElement) => audio.play());
  } else {
    await playButton.click();
  }
  
  await this.page.waitForTimeout(500);
});

Then('the audio should start playing', async function (this) {
  // Check for playing state in audio element or player controls
  const playingIndicator = await this.page.locator('audio[data-playing="true"], .is-playing, button[aria-label*="pause"]').first();
  await expect(playingIndicator).toBeVisible({ timeout: 5000 });
});

// Error Handling
Then('I should see an error about unsupported audio format', async function (this) {
  const errorMessage = await this.page.locator('.error-message:has-text("format"), .error:has-text("audio")').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

Then('I should see an error about file size limit', async function (this) {
  const errorMessage = await this.page.locator('.error-message:has-text("size"), .error:has-text("MB")').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

// Page Navigation in Audio Wizard
When('I navigate to the {string} audio section', async function (this, sectionName) {
  const sectionTab = await this.page.locator(`button:has-text("${sectionName}"), .tab:has-text("${sectionName}")`).first();
  await sectionTab.click();
  await this.page.waitForTimeout(500);
});

Then('I should see {int} narration blocks', async function (this, expectedCount) {
  const narrationBlocks = await this.page.locator('.narration-block, .audio-block, .narration-item');
  await expect(narrationBlocks).toHaveCount(expectedCount, { timeout: 5000 });
});

// Audio Settings
When('I adjust the audio volume to {int}%', async function (this, volume) {
  const volumeSlider = await this.page.locator('input[type="range"][aria-label*="volume"], .volume-slider').first();
  await volumeSlider.fill(String(volume));
  await this.page.waitForTimeout(300);
});

When('I enable captions display', async function (this) {
  const captionToggle = await this.page.locator('input[type="checkbox"][aria-label*="caption"], .caption-toggle').first();
  await captionToggle.check();
  await this.page.waitForTimeout(300);
});

// Export/Import
When('I export all audio files', async function (this) {
  const exportButton = await this.page.locator('button:has-text("Export Audio"), button:has-text("Download All")').first();
  await exportButton.click();
  await this.page.waitForTimeout(2000);
});

Then('a ZIP file with all audio should be downloaded', async function (this) {
  // Check for download event or success message
  const downloadSuccess = await this.page.locator('.download-success, .export-complete').first();
  await expect(downloadSuccess).toBeVisible({ timeout: 10000 });
});

// Synchronization
When('I sync audio timing with page content', async function (this) {
  const syncButton = await this.page.locator('button:has-text("Sync"), button:has-text("Synchronize")').first();
  await syncButton.click();
  await this.page.waitForTimeout(1000);
});

Then('the audio timing should match the content duration', async function (this) {
  const timingDisplay = await this.page.locator('.timing-info, .duration-display').first();
  await expect(timingDisplay).toBeVisible({ timeout: 5000 });
});

// Accessibility
Then('the audio player should have keyboard controls', async function (this) {
  const audioPlayer = await this.page.locator('audio, .audio-player').first();
  const hasAriaLabel = await audioPlayer.getAttribute('aria-label');
  expect(hasAriaLabel).toBeTruthy();
});

Then('the narration text should be screen reader accessible', async function (this) {
  const narrationText = await this.page.locator('[role="article"], .narration-text[aria-label]').first();
  await expect(narrationText).toBeVisible();
});

// Block-specific validation
Then('block {string} should have both audio and captions', async function (this, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  
  const hasAudio = await blockSection.locator('audio, .audio-player').first();
  await expect(hasAudio).toBeVisible({ timeout: 5000 });
  
  const hasCaption = await blockSection.locator('.caption-text, .caption-display').first();
  await expect(hasCaption).toBeVisible({ timeout: 5000 });
});

// Clear/Remove operations
When('I remove the audio from block {string}', async function (this, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const removeButton = await blockSection.locator('button:has-text("Remove"), button:has-text("Clear"), button.remove-audio').first();
  await removeButton.click();
  await this.page.waitForTimeout(500);
});

Then('block {string} should not have audio', async function (this, blockId) {
  const blockSection = await this.page.locator(`.narration-block:has-text("${blockId}"), [data-block="${blockId}"]`).first();
  const audioPlayer = await blockSection.locator('audio, .audio-player');
  await expect(audioPlayer).toHaveCount(0);
});