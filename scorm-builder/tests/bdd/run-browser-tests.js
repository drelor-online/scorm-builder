#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running BDD tests against browser with mock Tauri API...\n');

// Set environment variables for browser testing
process.env.TAURI_TEST = 'false';
process.env.NODE_ENV = 'test';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:1420';

// Get additional arguments passed to the script
const additionalArgs = process.argv.slice(2);

// Run cucumber with the configuration
const cucumber = spawn('npx', ['cucumber-js', '--config', 'cucumber.mjs', ...additionalArgs], {
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