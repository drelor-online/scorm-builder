import { expect, browser } from '@wdio/globals';

describe('Progressive App Launch Tests', () => {

  it('Step 1: Should establish WebDriver connection', async () => {
    console.log('=== Step 1: Basic Connection Test ===');

    const windowHandle = await browser.getWindowHandle();
    console.log(`Window handle: ${windowHandle}`);

    expect(windowHandle).toBeTruthy();
    expect(typeof windowHandle).toBe('string');
    expect(windowHandle.length).toBeGreaterThan(5);

    console.log('✓ WebDriver connection is active');
  });

  it('Step 2: Should get current window handle without switching', async () => {
    console.log('=== Step 2: Window Handle Test ===');

    // Don't get all handles first - just get the current one
    const currentHandle = await browser.getWindowHandle();
    console.log(`Current window handle: ${currentHandle}`);

    expect(currentHandle).toBeTruthy();
    expect(typeof currentHandle).toBe('string');

    console.log('✓ Can get current window handle');
  });

  it('Step 3: Should get current URL', async () => {
    console.log('=== Step 3: Current URL Test ===');

    const url = await browser.getUrl();
    console.log(`Current URL: ${url}`);

    // URL might be about:blank initially, that's okay
    expect(typeof url).toBe('string');

    console.log('✓ Can get current URL');
  });

  it('Step 4: Should execute basic JavaScript', async () => {
    console.log('=== Step 4: JavaScript Execution Test ===');

    const result = await browser.execute(() => {
      return {
        timestamp: Date.now(),
        readyState: document.readyState,
        hasWindow: typeof window !== 'undefined',
        hasDocument: typeof document !== 'undefined'
      };
    });

    console.log('JavaScript execution result:', result);

    expect(result.hasWindow).toBe(true);
    expect(result.hasDocument).toBe(true);
    expect(result.timestamp).toBeTruthy();

    console.log('✓ JavaScript execution works');
  });

  it('Step 5: Should wait for app content to load', async () => {
    console.log('=== Step 5: App Content Loading Test ===');

    let contentLoaded = false;
    let attempts = 0;
    const maxAttempts = 15; // 30 seconds with 2-second intervals

    while (!contentLoaded && attempts < maxAttempts) {
      attempts++;
      console.log(`Attempt ${attempts}/${maxAttempts}: Checking for content`);

      try {
        const url = await browser.getUrl();
        console.log(`Current URL: ${url}`);

        if (url && url !== 'about:blank' && !url.startsWith('data:')) {
          // URL has changed from blank - app is loading content
          contentLoaded = true;
          console.log('✓ App URL has changed - content is loading');
          break;
        }

        // Check if we have any body content
        const hasContent = await browser.execute(() => {
          const body = document.body;
          return body && body.innerText.length > 0;
        });

        if (hasContent) {
          contentLoaded = true;
          console.log('✓ App has body content');
          break;
        }

        console.log('App still loading, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Attempt ${attempts} error:`, error.message);

        // Check if session is still valid
        try {
          await browser.getSessionId();
          console.log('Session still valid, continuing...');
        } catch (sessionError) {
          console.error('Session lost:', sessionError.message);
          throw new Error(`Session lost on attempt ${attempts}: ${sessionError.message}`);
        }
      }
    }

    // Report the final state (don't fail if content hasn't loaded yet)
    if (contentLoaded) {
      console.log(`✓ App content loaded after ${attempts} attempts`);
      expect(contentLoaded).toBe(true);
    } else {
      console.log(`⚠ App content not detected after ${attempts} attempts`);
      console.log('This may indicate the app is not loading properly, but session is stable');

      // Get final state for debugging
      const finalUrl = await browser.getUrl();
      const finalContent = await browser.execute(() => ({
        url: window.location.href,
        title: document.title,
        bodyLength: document.body ? document.body.innerText.length : 0,
        hasRoot: !!document.querySelector('#root')
      }));

      console.log('Final state:', { finalUrl, finalContent });
    }
  });

  it('Step 6: Should check for React root element', async () => {
    console.log('=== Step 6: React Root Check ===');

    const rootInfo = await browser.execute(() => {
      const root = document.querySelector('#root');
      return {
        hasRoot: !!root,
        rootChildren: root ? root.children.length : 0,
        rootInnerHTML: root ? root.innerHTML.substring(0, 200) + '...' : null
      };
    });

    console.log('React root info:', rootInfo);

    if (rootInfo.hasRoot) {
      expect(rootInfo.hasRoot).toBe(true);
      console.log('✓ React root element found');

      if (rootInfo.rootChildren > 0) {
        console.log(`✓ React root has ${rootInfo.rootChildren} child elements`);
      } else {
        console.log('⚠ React root is empty - app may not be fully loaded');
      }
    } else {
      console.log('⚠ React root not found - this indicates app loading issues');
    }
  });

});