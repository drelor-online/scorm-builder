#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting E2E Test Suite...\n');

// Start the dev server
console.log('📦 Starting development server...');
const devServer = spawn('npm', ['run', 'dev'], {
  shell: true,
  stdio: 'pipe',
  cwd: __dirname
});

let serverReady = false;

// Wait for server to be ready
devServer.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Local:') && output.includes('1420')) {
    serverReady = true;
    console.log('✅ Development server is ready!\n');
    
    // Run E2E tests
    console.log('🧪 Running E2E tests...\n');
    const tests = spawn('npx', ['playwright', 'test'], {
      shell: true,
      stdio: 'inherit',
      cwd: __dirname
    });
    
    tests.on('close', (code) => {
      console.log(`\n${code === 0 ? '✅' : '❌'} Tests finished with code ${code}`);
      
      // Kill dev server
      devServer.kill();
      process.exit(code);
    });
    
    tests.on('error', (err) => {
      console.error('❌ Failed to run tests:', err);
      devServer.kill();
      process.exit(1);
    });
  }
});

devServer.stderr.on('data', (data) => {
  const error = data.toString();
  // Ignore non-critical warnings
  if (!error.includes('warning')) {
    console.error('Dev server error:', error);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping test runner...');
  devServer.kill();
  process.exit(0);
});

// Timeout if server doesn't start
setTimeout(() => {
  if (!serverReady) {
    console.error('❌ Development server failed to start within 30 seconds');
    devServer.kill();
    process.exit(1);
  }
}, 30000);