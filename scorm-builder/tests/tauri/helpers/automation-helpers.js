/**
 * Shared helpers for Tauri E2E automation testing
 *
 * This module provides utilities for working with Tauri's automation limitations,
 * focusing on backend testing and DOM manipulation rather than frontend UI testing.
 */

/**
 * Navigate to the frontend application and wait for it to load
 * @param {object} browser - WebDriver browser instance
 * @param {object} options - Configuration options
 * @returns {Promise<{success: boolean, url: string, hasReactRoot: boolean}>}
 */
async function navigateToFrontend(browser, options = {}) {
  const { devServerUrl = 'http://localhost:1420', debug = false } = options;

  if (debug) {
    console.log(`Navigating to frontend at ${devServerUrl}...`);
  }

  try {
    // Get current URL
    const currentUrl = await browser.getUrl();
    if (debug) {
      console.log(`Current URL: ${currentUrl}`);
    }

    // Navigate to dev server
    await browser.url(devServerUrl);

    // Wait for navigation to complete
    await browser.pause(2000);

    // Check if navigation was successful
    const newUrl = await browser.getUrl();
    const hasReactRoot = await browser.$('#root').isExisting();

    if (debug) {
      console.log(`Navigation result: ${newUrl}, React root: ${hasReactRoot}`);
    }

    return {
      success: newUrl.includes('localhost:1420') && hasReactRoot,
      url: newUrl,
      hasReactRoot,
      navigatedFrom: currentUrl
    };

  } catch (error) {
    if (debug) {
      console.log(`Navigation failed: ${error.message}`);
    }
    return {
      success: false,
      error: error.message,
      url: await browser.getUrl().catch(() => 'unknown')
    };
  }
}

/**
 * Wait for automation context to be ready and detect the testing environment
 * @param {object} browser - WebDriver browser instance
 * @param {object} options - Configuration options
 * @returns {Promise<{ready: boolean, automationMode: boolean, context: object}>}
 */
async function waitForAutomationReady(browser, options = {}) {
  const { maxAttempts = 5, checkInterval = 1000, debug = false } = options;

  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    if (debug) {
      console.log(`Automation readiness check ${attempts}/${maxAttempts}`);
    }

    try {
      const automationState = await browser.execute(() => {
        return {
          hasWindow: typeof window !== 'undefined',
          hasDocument: typeof document !== 'undefined',
          hasTauri: typeof window.__TAURI__ !== 'undefined',
          hasBody: !!document.body,
          readyState: document.readyState,
          url: window.location.href,
          isAutomationContext: window.location.href !== 'about:blank',
          timestamp: Date.now()
        };
      });

      if (debug) {
        console.log(`Automation state: ${JSON.stringify(automationState)}`);
      }

      // For automation testing, we need basic DOM and Tauri APIs
      if (automationState.hasWindow && automationState.hasDocument &&
          automationState.hasTauri && automationState.readyState === 'complete') {

        if (debug) {
          console.log('✓ Automation context is ready');
        }

        return {
          ready: true,
          automationMode: automationState.isAutomationContext,
          context: automationState
        };
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      if (debug) {
        console.error(`Automation readiness check ${attempts} failed:`, error.message);
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  console.log('⚠ Automation readiness timeout - may still be functional');
  return { ready: false, automationMode: true, context: null };
}

/**
 * Test a Tauri command with proper error handling and logging
 * @param {object} browser - WebDriver browser instance
 * @param {string} command - Tauri command name
 * @param {object} args - Command arguments
 * @param {object} options - Test options
 * @returns {Promise<{success: boolean, result: any, error: string}>}
 */
async function testTauriCommand(browser, command, args = {}, options = {}) {
  const { debug = false, timeout = 5000 } = options;

  if (debug) {
    console.log(`Testing Tauri command: ${command}`, args);
  }

  try {
    const result = await browser.execute(async (cmd, cmdArgs, timeoutMs) => {
      try {
        const tauri = window.__TAURI__;
        if (!tauri || !tauri.invoke) {
          return { success: false, error: 'Tauri invoke not available' };
        }

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Command ${cmd} timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        // Race the command against the timeout
        const commandPromise = tauri.invoke(cmd, cmdArgs);
        const commandResult = await Promise.race([commandPromise, timeoutPromise]);

        return { success: true, result: commandResult };
      } catch (error) {
        return { success: false, error: error.message, details: error.toString() };
      }
    }, command, args, timeout);

    if (debug) {
      console.log(`Command ${command} result:`, result);
    }

    return result;
  } catch (error) {
    const errorResult = { success: false, error: error.message };

    if (debug) {
      console.error(`Command ${command} execution failed:`, errorResult);
    }

    return errorResult;
  }
}

/**
 * Simulate user interaction with DOM elements
 * @param {object} browser - WebDriver browser instance
 * @param {string} action - Action type ('click', 'input', 'change')
 * @param {string} selector - CSS selector for target element
 * @param {any} value - Value to set (for input actions)
 * @param {object} options - Action options
 * @returns {Promise<{success: boolean, found: boolean, error?: string}>}
 */
async function simulateUserAction(browser, action, selector, value = null, options = {}) {
  const { debug = false, timeout = 2000 } = options;

  if (debug) {
    console.log(`Simulating ${action} on ${selector}`, value !== null ? `with value: ${value}` : '');
  }

  try {
    const result = await browser.execute((actionType, sel, val, timeoutMs) => {
      return new Promise((resolve) => {
        const startTime = Date.now();

        function attemptAction() {
          const element = document.querySelector(sel);

          if (!element) {
            if (Date.now() - startTime < timeoutMs) {
              setTimeout(attemptAction, 100);
              return;
            }
            resolve({ success: false, found: false, error: 'Element not found' });
            return;
          }

          try {
            switch (actionType) {
              case 'click':
                element.click();
                break;
              case 'input':
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                  element.value = val;
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                }
                break;
              case 'change':
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                  element.value = val;
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
              case 'focus':
                element.focus();
                break;
              case 'blur':
                element.blur();
                break;
              default:
                resolve({ success: false, found: true, error: `Unknown action: ${actionType}` });
                return;
            }

            resolve({ success: true, found: true });
          } catch (error) {
            resolve({ success: false, found: true, error: error.message });
          }
        }

        attemptAction();
      });
    }, action, selector, value, timeout);

    if (debug) {
      console.log(`Action ${action} result:`, result);
    }

    return result;
  } catch (error) {
    const errorResult = { success: false, found: false, error: error.message };

    if (debug) {
      console.error(`Action ${action} failed:`, errorResult);
    }

    return errorResult;
  }
}

/**
 * Verify a backend operation by testing its effects
 * @param {object} browser - WebDriver browser instance
 * @param {function} operationFn - Function that performs the operation
 * @param {function} verificationFn - Function that verifies the operation worked
 * @param {object} options - Verification options
 * @returns {Promise<{success: boolean, operationResult: any, verificationResult: any, error?: string}>}
 */
async function verifyBackendOperation(browser, operationFn, verificationFn, options = {}) {
  const { debug = false, delay = 100 } = options;

  try {
    if (debug) {
      console.log('Performing backend operation...');
    }

    // Execute the operation
    const operationResult = await operationFn(browser);

    if (!operationResult.success) {
      return {
        success: false,
        operationResult,
        verificationResult: null,
        error: 'Operation failed'
      };
    }

    // Small delay to allow operation to complete
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (debug) {
      console.log('Verifying operation result...');
    }

    // Verify the operation worked
    const verificationResult = await verificationFn(browser, operationResult);

    const success = verificationResult.success === true;

    if (debug) {
      console.log(`Backend operation ${success ? 'verified successfully' : 'verification failed'}`);
    }

    return {
      success,
      operationResult,
      verificationResult,
      error: success ? undefined : 'Verification failed'
    };

  } catch (error) {
    const errorResult = {
      success: false,
      operationResult: null,
      verificationResult: null,
      error: error.message
    };

    if (debug) {
      console.error('Backend operation verification failed:', errorResult);
    }

    return errorResult;
  }
}

/**
 * Create test data for use in tests
 * @param {string} type - Type of test data ('project', 'media', 'quiz', 'course')
 * @param {object} overrides - Properties to override in the default data
 * @returns {object} Test data object
 */
function createTestData(type, overrides = {}) {
  const timestamp = Date.now();

  const templates = {
    project: {
      name: `E2E Test Project ${timestamp}`,
      description: 'Test project created by E2E automation',
      id: `test-project-${timestamp}`,
      ...overrides
    },

    course: {
      title: `Test Course ${timestamp}`,
      description: 'Test course for E2E automation',
      objectives: ['Learn testing', 'Understand automation'],
      ...overrides
    },

    media: {
      filename: `test-media-${timestamp}.txt`,
      content: 'Test media content for E2E testing',
      type: 'text/plain',
      ...overrides
    },

    quiz: {
      title: `Test Quiz ${timestamp}`,
      questions: [
        {
          question: 'What is E2E testing?',
          type: 'multiple-choice',
          options: ['End-to-End testing', 'Error testing', 'Easy testing'],
          correct: 0
        }
      ],
      ...overrides
    }
  };

  return templates[type] || { ...overrides };
}

/**
 * Cleanup test data after test completion
 * @param {object} browser - WebDriver browser instance
 * @param {string} type - Type of cleanup ('project', 'media', 'all')
 * @param {array|string} identifiers - IDs or identifiers to cleanup
 * @param {object} options - Cleanup options
 * @returns {Promise<{success: boolean, cleanedUp: array, errors: array}>}
 */
async function cleanupTestData(browser, type, identifiers, options = {}) {
  const { debug = false } = options;

  if (!Array.isArray(identifiers)) {
    identifiers = [identifiers];
  }

  const cleanedUp = [];
  const errors = [];

  if (debug) {
    console.log(`Cleaning up ${type} test data:`, identifiers);
  }

  for (const id of identifiers) {
    try {
      let result;

      switch (type) {
        case 'project':
          result = await testTauriCommand(browser, 'delete_project', { projectId: id });
          break;
        case 'media':
          result = await testTauriCommand(browser, 'delete_media', { mediaId: id });
          break;
        default:
          result = { success: false, error: `Unknown cleanup type: ${type}` };
      }

      if (result.success) {
        cleanedUp.push(id);
        if (debug) {
          console.log(`✓ Cleaned up ${type}: ${id}`);
        }
      } else {
        errors.push({ id, error: result.error });
        if (debug) {
          console.log(`⚠ Failed to cleanup ${type}: ${id} - ${result.error}`);
        }
      }
    } catch (error) {
      errors.push({ id, error: error.message });
      if (debug) {
        console.error(`Error cleaning up ${type}: ${id}`, error);
      }
    }
  }

  return {
    success: errors.length === 0,
    cleanedUp,
    errors
  };
}

// Export all helper functions (ES module format)
export {
  navigateToFrontend,
  waitForAutomationReady,
  testTauriCommand,
  simulateUserAction,
  verifyBackendOperation,
  createTestData,
  cleanupTestData
};