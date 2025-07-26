# Tauri WebDriver Setup for Automated Testing

## Overview

Tauri v2 supports WebDriver for automated testing, allowing us to connect testing tools like Playwright directly to the Tauri webview.

## Setup Steps

### 1. Enable WebDriver in Tauri

Tauri needs to be started with WebDriver support. There are two approaches:

#### Option A: Using Environment Variable (Recommended for Testing)
```bash
# Windows
set TAURI_WEBDRIVER=true
npm run tauri:dev

# Or in one line
TAURI_WEBDRIVER=true npm run tauri:dev
```

#### Option B: Add WebDriver Configuration to tauri.conf.json
```json
{
  "app": {
    "windows": [{
      // ... existing config
      "devtools": true
    }]
  }
}
```

### 2. Connect Playwright to Tauri WebDriver

When Tauri starts with WebDriver enabled, it will output the WebDriver endpoint URL. We need to capture this and use it in our tests.

#### Create a Tauri Test Runner
```typescript
// tests/bdd/support/tauriDriver.ts
import { spawn } from 'child_process';
import { chromium } from '@playwright/test';

export async function launchTauriWithWebDriver() {
  return new Promise((resolve, reject) => {
    const tauriProcess = spawn('npm', ['run', 'tauri:dev'], {
      env: {
        ...process.env,
        TAURI_WEBDRIVER: 'true'
      },
      shell: true
    });

    let webdriverUrl: string | null = null;

    tauriProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Tauri:', output);
      
      // Look for WebDriver URL in output
      const match = output.match(/WebDriver listening on (ws:\/\/[^\s]+)/);
      if (match) {
        webdriverUrl = match[1];
        resolve({ process: tauriProcess, webdriverUrl });
      }
    });

    tauriProcess.stderr.on('data', (data) => {
      console.error('Tauri Error:', data.toString());
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!webdriverUrl) {
        tauriProcess.kill();
        reject(new Error('Failed to start Tauri with WebDriver'));
      }
    }, 30000);
  });
}
```

### 3. Update Playwright Configuration

```typescript
// tests/bdd/support/hooks.ts
import { launchTauriWithWebDriver } from './tauriDriver';

let tauriProcess: any;
let browser: Browser;

BeforeAll(async () => {
  // Launch Tauri with WebDriver
  const { process, webdriverUrl } = await launchTauriWithWebDriver();
  tauriProcess = process;
  
  // Connect Playwright to Tauri WebDriver
  browser = await chromium.connectOverCDP(webdriverUrl);
});

AfterAll(async () => {
  if (browser) await browser.close();
  if (tauriProcess) tauriProcess.kill();
});
```

### 4. Alternative: Using Tauri's Native Testing

Tauri also provides native testing capabilities through the `tauri-driver` crate:

```toml
# In Cargo.toml
[dev-dependencies]
tauri-driver = "2"
```

Then in your tests:
```rust
use tauri_driver::{TauriDriver, WindowExt};

#[test]
fn test_app() {
    let driver = TauriDriver::new().expect("Failed to start driver");
    let window = driver.window("main").expect("Failed to get window");
    
    // Interact with the app
    window.eval("document.querySelector('#root')").expect("App not loaded");
}
```

## Challenges & Solutions

### Challenge 1: Window Handle Access
Tauri WebDriver might not expose all window handles immediately. Solution:
- Wait for the window to be fully loaded
- Use retry logic to find elements

### Challenge 2: Native Dialog Handling
Native dialogs (file pickers, etc.) can't be automated through WebDriver. Solutions:
- Mock the dialog responses
- Use Tauri's IPC to bypass dialogs in tests

### Challenge 3: Performance
WebDriver adds overhead. Solutions:
- Run tests in parallel where possible
- Use headless mode when applicable

## Recommended Approach

For our BDD tests with Cucumber + Playwright:

1. Create a test script that:
   - Starts Tauri with TAURI_WEBDRIVER=true
   - Waits for WebDriver URL
   - Launches Playwright tests with the URL
   
2. Update our existing tests to:
   - Remove mock Tauri implementations
   - Connect directly to Tauri WebDriver
   - Use real Tauri APIs

This provides true end-to-end testing of the actual Tauri application.

## Next Steps

1. Create `tauri:test` npm script
2. Implement WebDriver connection logic
3. Update BDD tests to use WebDriver
4. Run tests against real Tauri app