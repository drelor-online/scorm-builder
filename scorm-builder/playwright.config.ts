import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Tauri desktop application testing
 * 
 * This configuration is specifically designed for testing a Tauri desktop app, which uses
 * platform-specific webviews rather than standalone browsers:
 * - Windows: WebView2 (Chromium-based)
 * - macOS: WKWebView (WebKit-based) 
 * - Linux: WebKitGTK (WebKit-based)
 * 
 * Mobile testing is excluded as this is a desktop-only application.
 * See docs/TAURI_TESTING.md for detailed testing strategy.
 * 
 * @see https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: false, // Run sequentially to avoid conflicts
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1, // Single worker to avoid IndexedDB conflicts
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html'], ['list']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:1420',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'on',
    
    /* Visual regression testing options */
    video: 'retain-on-failure',
    
    /* Default viewport for Tauri desktop testing */
    viewport: { width: 1280, height: 720 }, // Standard Tauri window size
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Test timeout */
    actionTimeout: 10000,
    
    /* Wait for animations */
    animations: 'allow',
  },

  /* Configure projects for Tauri desktop environments */
  projects: [
    {
      name: 'Windows-WebView2',
      use: { 
        ...devices['Desktop Chrome'], // WebView2 is Chromium-based
        viewport: { width: 1280, height: 720 }, // Standard desktop size
      },
    },

    {
      name: 'macOS-WKWebView',
      use: { 
        ...devices['Desktop Safari'], // WKWebView is WebKit-based
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: 'Linux-WebKitGTK',
      use: { 
        ...devices['Desktop Safari'], // WebKitGTK is also WebKit-based
        viewport: { width: 1280, height: 720 },
      },
    },

    // Additional common desktop window sizes for responsive testing
    {
      name: 'Desktop-Large',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    {
      name: 'Desktop-Small',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // 180 seconds
    stdout: 'pipe',
    stderr: 'pipe',
  },
});