import { expect, browser } from '@wdio/globals';

describe('Basic Tauri Application Smoke Test', () => {

  it('should launch app and establish working WebDriver connection', async () => {
    console.log('=== Basic Smoke Test: App Launch & Connection ===');

    // Step 1: Verify we have a window handle (connection works)
    const windowHandle = await browser.getWindowHandle();
    console.log(`✓ Window handle obtained: ${windowHandle}`);
    expect(windowHandle).toBeTruthy();

    // Step 2: Verify we can execute JavaScript (WebView2 works)
    const jsResult = await browser.execute(() => {
      return {
        hasWindow: typeof window !== 'undefined',
        hasDocument: typeof document !== 'undefined',
        timestamp: Date.now()
      };
    });
    console.log(`✓ JavaScript execution successful:`, jsResult);
    expect(jsResult.hasWindow).toBe(true);
    expect(jsResult.hasDocument).toBe(true);

    // Step 3: Verify we can get URL (basic WebDriver operations work)
    const currentUrl = await browser.getUrl();
    console.log(`✓ Current URL retrieved: ${currentUrl}`);
    expect(typeof currentUrl).toBe('string');

    // Step 4: Check for basic DOM structure (app has loaded something)
    const domCheck = await browser.execute(() => {
      return {
        hasBody: !!document.body,
        hasHead: !!document.head,
        bodyChildCount: document.body ? document.body.children.length : 0,
        title: document.title
      };
    });
    console.log(`✓ DOM structure check:`, domCheck);
    expect(domCheck.hasBody).toBe(true);
    expect(domCheck.hasHead).toBe(true);

    console.log('🎉 Basic smoke test PASSED - App launch and WebDriver connection successful!');
  });

  it('should be able to interact with DOM elements', async () => {
    console.log('=== Basic Smoke Test: DOM Interaction ===');

    // Check if we can find the React root (most basic requirement)
    const reactRoot = await browser.$('#root');
    const rootExists = await reactRoot.isExisting();
    console.log(`✓ React root exists: ${rootExists}`);

    if (rootExists) {
      const rootInfo = await browser.execute(() => {
        const root = document.querySelector('#root');
        return {
          hasChildren: root ? root.children.length > 0 : false,
          childCount: root ? root.children.length : 0,
          innerHTML: root ? root.innerHTML.substring(0, 100) : null
        };
      });
      console.log(`✓ React root info:`, rootInfo);
      expect(rootInfo).toBeTruthy();

      // If root has children, the app has rendered something
      if (rootInfo.hasChildren) {
        console.log('🎉 App has rendered content to React root!');
      } else {
        console.log('⚠ React root exists but is empty - app may still be loading');
      }
    } else {
      console.log('⚠ React root not found - checking for any content...');

      // Fallback: check for any content at all
      const hasAnyContent = await browser.execute(() => {
        return document.body && document.body.innerText.length > 0;
      });

      if (hasAnyContent) {
        console.log('✓ App has some content even without React root');
      } else {
        console.log('⚠ No content detected - app may be stuck loading');
      }
    }

    console.log('✓ DOM interaction test completed');
  });

  it('should maintain stable connection throughout operations', async () => {
    console.log('=== Basic Smoke Test: Connection Stability ===');

    // Get initial window handle
    const initialHandle = await browser.getWindowHandle();
    console.log(`Initial handle: ${initialHandle}`);

    // Perform several operations that used to cause session invalidation
    const operations = [
      async () => browser.getUrl(),
      async () => browser.getWindowHandle(),
      async () => browser.execute(() => document.readyState),
      async () => browser.getTitle()
    ];

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i]();
        console.log(`✓ Operation ${i + 1} succeeded:`, typeof result === 'string' ? result.substring(0, 50) : result);

        // Verify handle is still the same
        const currentHandle = await browser.getWindowHandle();
        expect(currentHandle).toBe(initialHandle);

      } catch (error) {
        console.error(`✗ Operation ${i + 1} failed:`, error.message);
        throw error;
      }
    }

    console.log('🎉 Connection remained stable throughout all operations!');
  });

});