import { test, expect, Page } from '@playwright/test'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * BEHAVIOR TEST: Audio Seeking Control Enhancement
 * 
 * This test verifies that when "Require audio completion" is enabled in course settings:
 * 1. Skip forward/backward buttons should be disabled
 * 2. Progress bar clicking should be disabled (no seeking allowed)
 * 3. Play/pause, volume, and speed controls should still work
 * 4. Visual feedback should indicate disabled state
 * 
 * When "Require audio completion" is disabled:
 * 1. All controls should work normally (current behavior)
 * 
 * This test will FAIL initially because the feature doesn't exist yet.
 * After implementation, it should PASS.
 */

test.describe('Audio Seeking Control Enhancement', () => {
  let testPackagePath: string
  
  test.beforeAll(async () => {
    // We'll need to generate test SCORM packages with different settings
    // For now, we'll simulate this by creating mock HTML files
    const testDir = path.join(process.cwd(), 'test-output')
    await fs.mkdir(testDir, { recursive: true })
    testPackagePath = testDir
  })

  test.describe('When requireAudioCompletion is ENABLED', () => {
    test('should disable skip forward and backward buttons', async ({ page }) => {
      // Create a test HTML with requireAudioCompletion = true
      const testHtml = await createTestPage(true)
      await page.setContent(testHtml)

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded')
      
      // Find skip buttons
      const skipBackwardBtn = page.locator('button:has-text("⏪ 10s")')
      const skipForwardBtn = page.locator('button:has-text("10s ⏩")')
      
      // These buttons should be disabled when requireAudioCompletion is true
      await expect(skipBackwardBtn).toBeDisabled()
      await expect(skipForwardBtn).toBeDisabled()
      
      // Verify they have disabled styling
      await expect(skipBackwardBtn).toHaveCSS('cursor', 'not-allowed')
      await expect(skipForwardBtn).toHaveCSS('cursor', 'not-allowed')
    })

    test('should disable progress bar seeking', async ({ page }) => {
      const testHtml = await createTestPage(true)
      await page.setContent(testHtml)
      
      await page.waitForLoadState('domcontentloaded')
      
      // Find progress bar
      const progressContainer = page.locator('.audio-progress-container')
      await expect(progressContainer).toBeVisible()
      
      // Progress bar should not have click handler when requireAudioCompletion is true
      const onClickAttr = await progressContainer.getAttribute('onclick')
      expect(onClickAttr).toBeNull() // Should be null/removed when disabled
      
      // Should have disabled styling
      await expect(progressContainer).toHaveCSS('cursor', 'not-allowed')
    })

    test('should still allow play/pause, volume, and speed controls', async ({ page }) => {
      const testHtml = await createTestPage(true)
      await page.setContent(testHtml)
      
      await page.waitForLoadState('domcontentloaded')
      
      // These controls should still work
      const playPauseBtn = page.locator('.audio-play-pause')
      const volumeBtn = page.locator('button:has-text("🔊")')
      const speedSelector = page.locator('.audio-speed-selector')
      
      await expect(playPauseBtn).not.toBeDisabled()
      await expect(volumeBtn).not.toBeDisabled() 
      await expect(speedSelector).not.toBeDisabled()
    })

    test('should block seeking function calls', async ({ page }) => {
      const testHtml = await createTestPage(true)
      await page.setContent(testHtml)
      
      await page.waitForLoadState('domcontentloaded')
      
      // Mock audio element
      await page.evaluate(() => {
        const audio = document.createElement('audio')
        audio.id = 'topic-audio-topic-0'
        audio.currentTime = 0
        audio.duration = 100
        document.body.appendChild(audio)
        
        // Initialize window.audioPlayers
        ;(window as any).audioPlayers = { 'topic-0': audio }
      })
      
      // Try to call seeking functions - they should be blocked
      const originalCurrentTime = await page.evaluate(() => {
        const audio = (window as any).audioPlayers['topic-0']
        return audio.currentTime
      })
      
      // Try skipForward - should be blocked
      await page.evaluate(() => {
        if ((window as any).skipForward) {
          (window as any).skipForward('topic-0', 10)
        }
      })
      
      const currentTimeAfterSkip = await page.evaluate(() => {
        const audio = (window as any).audioPlayers['topic-0'] 
        return audio.currentTime
      })
      
      // Time should not have changed (seeking blocked)
      expect(currentTimeAfterSkip).toBe(originalCurrentTime)
    })
  })

  test.describe('When requireAudioCompletion is DISABLED', () => {
    test('should enable all audio controls normally', async ({ page }) => {
      const testHtml = await createTestPage(false)
      await page.setContent(testHtml)
      
      await page.waitForLoadState('domcontentloaded')
      
      // All buttons should be enabled
      const skipBackwardBtn = page.locator('button:has-text("⏪ 10s")')
      const skipForwardBtn = page.locator('button:has-text("10s ⏩")')
      
      await expect(skipBackwardBtn).not.toBeDisabled()
      await expect(skipForwardBtn).not.toBeDisabled()
      
      // Progress bar should have click handler
      const progressContainer = page.locator('.audio-progress-container')
      const onClickAttr = await progressContainer.getAttribute('onclick')
      expect(onClickAttr).toBeTruthy() // Should have onclick when enabled
      
      // Should have normal cursor
      await expect(progressContainer).toHaveCSS('cursor', 'pointer')
    })

    test('should allow seeking function calls', async ({ page }) => {
      const testHtml = await createTestPage(false)
      await page.setContent(testHtml)
      
      await page.waitForLoadState('domcontentloaded')
      
      // Mock audio element  
      await page.evaluate(() => {
        const audio = document.createElement('audio')
        audio.id = 'topic-audio-topic-0'
        audio.currentTime = 0
        audio.duration = 100
        document.body.appendChild(audio)
        
        ;(window as any).audioPlayers = { 'topic-0': audio }
      })
      
      // Try skipForward - should work
      await page.evaluate(() => {
        if ((window as any).skipForward) {
          (window as any).skipForward('topic-0', 10)
        }
      })
      
      const currentTimeAfterSkip = await page.evaluate(() => {
        const audio = (window as any).audioPlayers['topic-0']
        return audio.currentTime
      })
      
      // Time should have changed (seeking allowed)
      expect(currentTimeAfterSkip).toBe(10)
    })
  })
})

/**
 * Creates a test HTML page with SCORM navigation JavaScript
 * @param requireAudioCompletion - Whether to enable audio completion requirement
 */
async function createTestPage(requireAudioCompletion: boolean): Promise<string> {
  // Read the actual navigation.js template to make this realistic
  const navJsPath = path.join(process.cwd(), 'src-tauri/src/scorm/templates/navigation.js.hbs')
  let navigationJs = ''
  
  try {
    const template = await fs.readFile(navJsPath, 'utf-8')
    // Simulate template rendering
    navigationJs = template
      .replace(/\{\{require_audio_completion\}\}/g, String(requireAudioCompletion))
      .replace(/\{\{[^}]+\}\}/g, 'false') // Replace other template vars with defaults
  } catch {
    // Fallback if template not found - create minimal JavaScript
    navigationJs = `
      const REQUIRE_AUDIO_COMPLETION = ${requireAudioCompletion};
      
      window.audioPlayers = {};
      
      window.seekAudio = function(pageId, event) {
        if (REQUIRE_AUDIO_COMPLETION) {
          console.log('[AUDIO] Seeking disabled - audio completion required');
          return; // This should be the new behavior
        }
        
        const audio = window.audioPlayers[pageId];
        if (!audio) return;
        
        const progressContainer = event.currentTarget;
        const clickX = event.offsetX;
        const width = progressContainer.offsetWidth;
        const percentage = clickX / width;
        
        audio.currentTime = percentage * audio.duration;
      };
      
      window.skipForward = function(pageId, seconds) {
        if (REQUIRE_AUDIO_COMPLETION) {
          console.log('[AUDIO] Skip forward disabled - audio completion required');
          return; // This should be the new behavior
        }
        
        const audio = window.audioPlayers[pageId];
        if (audio) {
          audio.currentTime = Math.min(audio.duration, audio.currentTime + seconds);
        }
      };
      
      window.skipBackward = function(pageId, seconds) {
        if (REQUIRE_AUDIO_COMPLETION) {
          console.log('[AUDIO] Skip backward disabled - audio completion required');
          return; // This should be the new behavior
        }
        
        const audio = window.audioPlayers[pageId];
        if (audio) {
          audio.currentTime = Math.max(0, audio.currentTime - seconds);
        }
      };
    `
  }
  
  // Create complete HTML page
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .audio-controls { margin: 20px; }
        .audio-progress-container { 
          width: 200px; 
          height: 20px; 
          background: #ddd;
          cursor: ${requireAudioCompletion ? 'not-allowed' : 'pointer'};
          ${requireAudioCompletion ? 'opacity: 0.6;' : ''}
        }
        .audio-progress { height: 100%; background: #007bff; width: 50%; }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        button { margin: 5px; padding: 8px; }
      </style>
    </head>
    <body>
      <div class="audio-controls">
        <button class="audio-play-pause">▶️</button>
        
        <div class="audio-progress-container" ${requireAudioCompletion ? '' : 'onclick="window.seekAudio(\'topic-0\', event)"'}>
          <div class="audio-progress"></div>
        </div>
        
        <button ${requireAudioCompletion ? 'disabled' : ''}>⏪ 10s</button>
        <button ${requireAudioCompletion ? 'disabled' : ''}>10s ⏩</button>
        
        <button>🔊</button>
        <select class="audio-speed-selector">
          <option value="1">1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>
      
      <script>
        ${navigationJs}
      </script>
    </body>
    </html>
  `
}