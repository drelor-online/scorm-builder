#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running BDD tests against Tauri with WebDriver...\n');

// First, check if Tauri dev is already running
const checkTauri = spawn('netstat', ['-an'], { shell: true });
let tauriRunning = false;

checkTauri.stdout.on('data', (data) => {
  if (data.toString().includes(':1420')) {
    tauriRunning = true;
  }
});

checkTauri.on('close', () => {
  if (tauriRunning) {
    console.log('⚠️  Port 1420 is in use. Please stop any running Tauri dev server first.');
    console.log('Run: taskkill /F /IM node.exe (on Windows) or kill the process manually\n');
    process.exit(1);
  }
  
  runTests();
});

function runTests() {
  // Set environment variables for Tauri WebDriver testing
  process.env.TAURI_WEBDRIVER_TEST = 'true';
  process.env.NODE_ENV = 'test';
  
  // Run cucumber with Tauri-specific configuration
  const cucumber = spawn('npx', [
    'cucumber-js',
    '--config', 'cucumber.mjs',
    '--import', 'tests/bdd/support/tauriHooks.ts',
    '--tags', 'not @skip-tauri'
  ], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '1'
    }
  });
  
  cucumber.on('close', (code) => {
    console.log(`\n✨ Tests completed with exit code ${code}`);
    process.exit(code);
  });
  
  cucumber.on('error', (err) => {
    console.error('Failed to start test runner:', err);
    process.exit(1);
  });
}