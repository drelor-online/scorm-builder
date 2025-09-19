import { expect, browser } from '@wdio/globals';

describe('App Loading Diagnostics', () => {

  it('should diagnose why the React app is not loading', async () => {
    console.log('=== DIAGNOSTIC TEST: App Loading Analysis ===');

    // Step 1: Basic connection test
    console.log('Step 1: Testing WebDriver connection...');
    try {
      const windowHandle = await browser.getWindowHandle();
      const windowHandles = await browser.getWindowHandles();
      console.log(`✓ Connected to window: ${windowHandle}`);
      console.log(`✓ Available windows: ${windowHandles.length}`);
    } catch (error) {
      console.error('✗ WebDriver connection failed:', error.message);
      throw error;
    }

    // Step 2: Comprehensive DOM analysis
    console.log('Step 2: Analyzing DOM state...');
    const domAnalysis = await browser.execute(() => {
      const analysis = {
        // Basic DOM
        hasDocument: typeof document !== 'undefined',
        hasWindow: typeof window !== 'undefined',
        docReady: document.readyState,
        hasBody: !!document.body,
        hasHead: !!document.head,

        // HTML content
        htmlTitle: document.title,
        htmlLang: document.documentElement.lang,
        bodyClasses: document.body ? Array.from(document.body.classList) : [],

        // React root
        rootElement: !!document.querySelector('#root'),
        rootContent: document.querySelector('#root')?.innerHTML || '',
        rootChildren: document.querySelector('#root')?.children.length || 0,

        // Script tags
        scriptTags: Array.from(document.querySelectorAll('script')).map(script => ({
          src: script.src,
          type: script.type,
          defer: script.defer,
          async: script.async,
          crossOrigin: script.crossOrigin,
          hasContent: script.innerHTML.length > 0,
          loaded: script.readyState
        })),

        // CSS links
        cssLinks: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => ({
          href: link.href,
          loaded: !!link.sheet,
          disabled: link.disabled
        })),

        // Network/loading state
        url: window.location.href,
        protocol: window.location.protocol,
        host: window.location.host,
        pathname: window.location.pathname,

        // JavaScript environment
        hasReact: typeof window.React !== 'undefined',
        hasReactDOM: typeof window.ReactDOM !== 'undefined',
        hasTauri: typeof window.__TAURI__ !== 'undefined',
        tauriVersion: window.__TAURI__?.app ? 'available' : 'not available',

        // Error detection
        hasConsole: typeof console !== 'undefined',
        errorCount: 0, // We can't easily access console errors, but we can detect the presence

        // Content analysis
        bodyText: document.body ? document.body.innerText : '',
        bodyTextLength: document.body ? document.body.innerText.length : 0,
        hasVisibleContent: document.body ? document.body.innerText.length > 10 : false,

        // Element counts
        totalElements: document.querySelectorAll('*').length,
        divCount: document.querySelectorAll('div').length,
        buttonCount: document.querySelectorAll('button').length,
        inputCount: document.querySelectorAll('input').length,

        // Meta information
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      };

      return analysis;
    });

    console.log('=== COMPREHENSIVE DOM ANALYSIS ===');
    console.log(JSON.stringify(domAnalysis, null, 2));

    // Step 3: Try to trigger React app loading manually
    console.log('Step 3: Attempting to manually trigger React loading...');
    const manualTrigger = await browser.execute(() => {
      try {
        // Check if scripts are loaded but not executed
        const scripts = Array.from(document.querySelectorAll('script[src*="index-"]'));
        console.log('Found index scripts:', scripts.length);

        // Try to manually trigger DOMContentLoaded if React is waiting for it
        if (document.readyState === 'complete') {
          const domContentLoadedEvent = new Event('DOMContentLoaded', {
            bubbles: true,
            cancelable: false
          });
          document.dispatchEvent(domContentLoadedEvent);
        }

        // Wait a moment then check again
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              reactAvailable: typeof window.React !== 'undefined',
              rootContent: document.querySelector('#root')?.innerHTML || '',
              rootChildren: document.querySelector('#root')?.children.length || 0,
              bodyTextLength: document.body ? document.body.innerText.length : 0
            });
          }, 1000);
        });
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log('Manual trigger result:', manualTrigger);

    // Step 4: Asset loading verification
    console.log('Step 4: Verifying asset loading...');
    const assetCheck = await browser.execute(() => {
      const results = {
        scriptsLoaded: 0,
        scriptsFailed: 0,
        cssLoaded: 0,
        cssFailed: 0,
        assetsDetails: []
      };

      // Check all script tags
      document.querySelectorAll('script[src]').forEach(script => {
        const detail = {
          type: 'script',
          src: script.src,
          loaded: script.readyState !== 'loading'
        };

        if (script.readyState === 'complete' || script.readyState === 'loaded') {
          results.scriptsLoaded++;
          detail.status = 'loaded';
        } else {
          results.scriptsFailed++;
          detail.status = 'failed or loading';
        }

        results.assetsDetails.push(detail);
      });

      // Check all CSS links
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const detail = {
          type: 'css',
          href: link.href,
          loaded: !!link.sheet
        };

        if (link.sheet) {
          results.cssLoaded++;
          detail.status = 'loaded';
        } else {
          results.cssFailed++;
          detail.status = 'failed';
        }

        results.assetsDetails.push(detail);
      });

      return results;
    });

    console.log('Asset loading check:', assetCheck);

    // Assertions for diagnostic purposes
    expect(domAnalysis.hasDocument).toBe(true);
    expect(domAnalysis.hasWindow).toBe(true);
    expect(domAnalysis.hasBody).toBe(true);
    expect(domAnalysis.rootElement).toBe(true);

    // Log final diagnosis
    console.log('=== DIAGNOSTIC SUMMARY ===');
    console.log(`Document ready: ${domAnalysis.docReady}`);
    console.log(`React root exists: ${domAnalysis.rootElement}`);
    console.log(`React available: ${domAnalysis.hasReact}`);
    console.log(`Tauri available: ${domAnalysis.hasTauri}`);
    console.log(`Scripts loaded: ${assetCheck.scriptsLoaded}/${assetCheck.scriptsLoaded + assetCheck.scriptsFailed}`);
    console.log(`CSS loaded: ${assetCheck.cssLoaded}/${assetCheck.cssLoaded + assetCheck.cssFailed}`);
    console.log(`Body text length: ${domAnalysis.bodyTextLength}`);
    console.log(`Total DOM elements: ${domAnalysis.totalElements}`);

    if (!domAnalysis.hasReact && assetCheck.scriptsLoaded > 0) {
      console.log('⚠ DIAGNOSIS: Scripts loaded but React not available - possible CSP or execution error');
    } else if (!domAnalysis.hasReact && assetCheck.scriptsFailed > 0) {
      console.log('⚠ DIAGNOSIS: Script loading failures detected - check asset paths or network');
    } else if (domAnalysis.hasReact && domAnalysis.bodyTextLength === 0) {
      console.log('⚠ DIAGNOSIS: React available but not rendering content - check React app initialization');
    } else if (!domAnalysis.rootElement) {
      console.log('⚠ DIAGNOSIS: React root div missing - check HTML template');
    } else {
      console.log('⚠ DIAGNOSIS: Unknown issue - review comprehensive logs above');
    }
  });

});