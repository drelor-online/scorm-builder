const path = require('path');

const buildType = process.env.TAURI_BUILD_TYPE === 'release' ? 'release' : 'debug';
const defaultAppDir = path.join(__dirname, 'src-tauri', 'target', buildType);
const appDir = process.env.TAURI_APP_DIR || defaultAppDir;
const executableName = process.platform === 'win32' ? 'scorm-builder.exe' : 'scorm-builder';
const defaultAppPath = path.join(appDir, executableName);
const applicationPath = process.env.TAURI_APP_PATH || defaultAppPath;

// CRITICAL FIX: Use project root as working directory so Tauri can find dist folder
const projectRoot = __dirname;

exports.config = {
  runner: 'local',
  automationProtocol: 'webdriver',
  specs: [
    path.join(__dirname, 'tests', 'tauri', '**', '*.spec.ts')
  ],
  maxInstances: 1,
  logLevel: 'debug', // More detailed logging
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 30000, // Increased timeout for app startup
  connectionRetryTimeout: 180000, // Increased retry timeout
  connectionRetryCount: 3, // More retries
  services: [],

  // Add hooks for session lifecycle logging
  beforeSession: (config, capabilities, specs) => {
    console.log('=== WebDriver Session Starting ===');
    console.log('Config:', {
      logLevel: config.logLevel,
      waitforTimeout: config.waitforTimeout,
      connectionRetryTimeout: config.connectionRetryTimeout
    });
    console.log('Capabilities:', capabilities);
  },

  beforeCommand: (commandName, args) => {
    if (['getWindowHandles', 'getWindowHandle', 'getUrl', 'switchToWindow'].includes(commandName)) {
      console.log(`>>> Executing: ${commandName}(${JSON.stringify(args)})`);
    }
  },

  afterCommand: (commandName, args, result, error) => {
    if (['getWindowHandles', 'getWindowHandle', 'getUrl', 'switchToWindow'].includes(commandName)) {
      if (error) {
        console.log(`<<< ${commandName} FAILED:`, error.message);
      } else {
        console.log(`<<< ${commandName} SUCCESS:`, result);
      }
    }
  },
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000 // Increased timeout for Tauri app startup
  },
  port: Number(process.env.TAURI_DRIVER_PORT || 4444),
  path: '/',
  autoCompileOpts: {
    tsNodeOpts: {
      transpileOnly: true,
      project: path.join(__dirname, 'tsconfig.wdio.json')
    }
  },
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: applicationPath,
        cwd: projectRoot, // Use project root so Tauri can find dist folder
        args: process.env.TAURI_APP_ARGS ? JSON.parse(process.env.TAURI_APP_ARGS) : [
          '--dev'  // Force development mode to load from localhost:1420
        ],
        // Add extra time for app startup and stability
        webDriverOptions: {
          startTimeout: 90000,  // Increased startup timeout
          connectionRetryTimeout: 45000,  // Increased connection timeout
          commandTimeout: 30000  // Add command timeout
        }
      },
      // Add browser-specific options for stability
      'ms:edgeOptions': {
        // Disable web security to avoid CORS issues
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-sandbox',
          '--disable-dev-shm-usage'
        ]
      }
    }
  ],

  // Add global before/after hooks for session management
  before: (capabilities, specs) => {
    console.log('=== Test Session Starting ===');
    console.log('Application path:', applicationPath);
    console.log('Working directory (FIXED):', projectRoot);
    console.log('Previous working directory was:', appDir);
  },

  after: (result, capabilities, specs) => {
    console.log('=== Test Session Ending ===');
    console.log('Final result:', result);
  },

  beforeTest: (test, context) => {
    console.log(`--- Starting test: ${test.title} ---`);
  },

  afterTest: (test, context, { error, result, duration, passed, retries }) => {
    console.log(`--- Finished test: ${test.title} (${passed ? 'PASSED' : 'FAILED'}) ---`);
    if (error) {
      console.log('Test error:', error.message);
    }
  }
};
