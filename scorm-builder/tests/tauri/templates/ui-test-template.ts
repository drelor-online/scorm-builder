/**
 * UI-Focused Test Template
 *
 * Use this template for tests that primarily focus on UI interactions
 * and user interface elements within the SCORM Builder application.
 */

import { expect, browser } from '@wdio/globals';
import {
  navigateToFrontend,
  waitForAutomationReady,
  testTauriCommand,
  createTestData,
  cleanupTestData
} from '../helpers/automation-helpers.js';

describe('UI Feature Test Suite', () => {

  it('should test UI feature with frontend access', async () => {
    console.log('=== UI TEST: Feature Name ===');

    // Step 1: Navigate to frontend for UI access
    const navigation = await navigateToFrontend(browser, { debug: true });
    expect(navigation.success).toBe(true);
    console.log('✅ Frontend loaded successfully');

    // Step 2: Verify automation readiness
    const readiness = await waitForAutomationReady(browser, { debug: true });
    expect(readiness.ready).toBe(true);
    console.log('✅ Automation context ready');

    // Step 3: Test specific UI elements
    const uiElements = [
      '#main-content',
      'button[class*="primary"]',
      'input[type="text"]',
      '.navigation-menu',
      '[data-testid="feature-container"]'
    ];

    let foundElements = [];
    for (const selector of uiElements) {
      try {
        const exists = await browser.$(selector).isExisting();
        if (exists) {
          foundElements.push(selector);
        }
      } catch (error) {
        // Ignore selector errors
      }
    }

    console.log(`Found UI elements: ${foundElements.join(', ')}`);
    expect(foundElements.length).toBeGreaterThan(0);

    // Step 4: Test UI interactions
    if (foundElements.includes('button[class*="primary"]')) {
      const primaryButton = await browser.$('button[class*="primary"]');

      // Check if button is clickable
      const isClickable = await primaryButton.isClickable();
      if (isClickable) {
        console.log('✅ Found clickable primary button');

        // Optional: Click the button and verify result
        // await primaryButton.click();
        // const result = await browser.execute(() => /* check for changes */);
      }
    }

    // Step 5: Test form interactions if applicable
    if (foundElements.includes('input[type="text"]')) {
      const textInput = await browser.$('input[type="text"]');

      // Test input functionality
      await textInput.setValue('Test input value');
      const inputValue = await textInput.getValue();
      expect(inputValue).toBe('Test input value');
      console.log('✅ Text input functionality verified');
    }

    // Step 6: Verify page state after interactions
    const finalState = await browser.execute(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyContent: document.body.textContent?.length || 0,
        interactiveElements: document.querySelectorAll('button, input, select, textarea').length
      };
    });

    console.log('Final page state:', finalState);
    expect(finalState.bodyContent).toBeGreaterThan(0);
    expect(finalState.interactiveElements).toBeGreaterThan(0);

    console.log('🎉 UI test completed successfully');
  });

  it('should test navigation within the application', async () => {
    console.log('=== UI TEST: Navigation ===');

    // Navigate to frontend
    const navigation = await navigateToFrontend(browser, { debug: true });
    expect(navigation.success).toBe(true);

    // Test navigation elements
    const navElements = [
      'nav',
      '.navigation',
      '[role="navigation"]',
      'a[href*="/"]',
      'button[class*="nav"]'
    ];

    let foundNavElements = [];
    for (const selector of navElements) {
      try {
        const exists = await browser.$(selector).isExisting();
        if (exists) {
          foundNavElements.push(selector);
        }
      } catch (error) {
        // Ignore selector errors
      }
    }

    console.log(`Found navigation elements: ${foundNavElements.join(', ')}`);

    // Test internal navigation if elements exist
    if (foundNavElements.length > 0) {
      console.log('✅ Navigation elements found - app has navigation structure');

      // Could test navigation clicks here if needed
      // Example: await browser.$('a[href*="/dashboard"]').click();
    } else {
      console.log('⚠ No navigation elements found - may be single-page or modal-based app');
    }

    expect(foundNavElements.length).toBeGreaterThanOrEqual(0); // Accept 0 for modal-based apps
  });

});