/**
 * Enhanced app readiness helper with detailed debugging
 * This helps diagnose why the React app isn't loading in Tauri E2E tests
 */

async function waitForAppReady(browser, options = {}) {
  const { maxAttempts = 15, checkInterval = 2000, minContent = 100, debug = true } = options;

  let attempts = 0;
  let lastState = null;

  while (attempts < maxAttempts) {
    attempts++;

    if (debug) {
      console.log(`App readiness check ${attempts}/${maxAttempts}`);
    }

    try {
      const appState = await browser.execute(() => {
        // Comprehensive DOM analysis
        const state = {
          // Basic DOM checks
          hasBody: !!document.body,
          bodyLength: document.body ? document.body.innerText.length : 0,
          hasReactRoot: !!document.querySelector('#root'),
          reactRootChildren: document.querySelector('#root')?.children.length || 0,
          readyState: document.readyState,
          hasContent: document.body ? document.body.innerText.length > 100 : false,

          // Script loading checks
          scripts: Array.from(document.querySelectorAll('script')).map(s => ({
            src: s.src,
            loaded: s.readyState !== 'loading',
            error: s.onerror !== null
          })),

          // CSS loading checks
          stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(s => ({
            href: s.href,
            loaded: s.sheet !== null
          })),

          // Error checks
          hasErrors: !!window.onerror || (window.console && window.console.error),
          errorMessages: [],

          // React specific checks
          hasReact: typeof window.React !== 'undefined',
          hasReactDOM: typeof window.ReactDOM !== 'undefined',
          reactRootContent: document.querySelector('#root')?.innerHTML || '',

          // URL and location
          url: window.location.href,
          protocol: window.location.protocol,

          // Tauri specific checks
          hasTauri: typeof window.__TAURI__ !== 'undefined',
          tauriApi: window.__TAURI__ ? Object.keys(window.__TAURI__) : []
        };

        // Capture any JavaScript errors
        try {
          if (window.console && window.console.error) {
            // This is a simplified error capture
            state.errorMessages.push('Console errors may exist (see browser console)');
          }
        } catch (e) {
          state.errorMessages.push(`Error checking console: ${e.message}`);
        }

        return state;
      });

      if (debug && (attempts === 1 || attempts % 5 === 0)) {
        console.log('Detailed app state:', JSON.stringify(appState, null, 2));
      }

      lastState = appState;

      // Success conditions (in order of preference)
      if (appState.hasContent && appState.bodyLength > minContent) {
        console.log('✓ App is ready for testing (has substantial content)');
        return { ready: true, state: appState, attempts };
      }

      if (appState.hasReactRoot && appState.reactRootChildren > 0) {
        console.log('✓ App is ready for testing (React root has children)');
        return { ready: true, state: appState, attempts };
      }

      if (appState.reactRootContent && appState.reactRootContent.length > 50) {
        console.log('✓ App is ready for testing (React root has content)');
        return { ready: true, state: appState, attempts };
      }

      // If we have Tauri and basic DOM but no React, there might be a loading issue
      if (appState.hasTauri && appState.hasReactRoot && attempts > 5) {
        if (debug) {
          console.log('⚠ Tauri loaded but React not initializing. Script loading issues?');
          console.log('Scripts:', appState.scripts);
          console.log('Stylesheets:', appState.stylesheets);
        }
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));

    } catch (error) {
      console.error(`App readiness check ${attempts} failed:`, error.message);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  console.log('⚠ App readiness timeout - proceeding with last known state');
  if (debug && lastState) {
    console.log('Final app state:', JSON.stringify(lastState, null, 2));
  }

  return { ready: false, state: lastState, attempts };
}

module.exports = { waitForAppReady };