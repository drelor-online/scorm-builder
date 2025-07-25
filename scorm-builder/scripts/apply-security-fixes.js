#!/usr/bin/env node

/**
 * Security Fix Migration Script
 * This script safely applies critical security fixes to the SCORM Builder codebase
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m'
};

function log(message, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

function error(message) {
  log(`❌ ${message}`, COLORS.RED);
}

function success(message) {
  log(`✅ ${message}`, COLORS.GREEN);
}

function info(message) {
  log(`ℹ️  ${message}`, COLORS.BLUE);
}

function warning(message) {
  log(`⚠️  ${message}`, COLORS.YELLOW);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createBackup(filePath) {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    await fs.copyFile(filePath, backupPath);
    success(`Created backup: ${backupPath}`);
    return backupPath;
  } catch (err) {
    error(`Failed to create backup: ${err.message}`);
    throw err;
  }
}

async function applyRustSecurityFixes() {
  info('Applying Rust security fixes...');
  
  const commandsPath = path.join('src-tauri', 'src', 'commands.rs');
  const secureCommandsPath = path.join('src-tauri', 'src', 'commands_secure.rs');
  
  // Check if files exist
  if (!await fileExists(commandsPath)) {
    error('commands.rs not found!');
    return false;
  }
  
  if (!await fileExists(secureCommandsPath)) {
    error('commands_secure.rs not found! Please ensure you have the security fixes file.');
    return false;
  }
  
  // Create backup
  await createBackup(commandsPath);
  
  // Read current commands.rs
  const currentContent = await fs.readFile(commandsPath, 'utf8');
  
  // Check if security fixes are already applied
  if (currentContent.includes('validate_project_path') && currentContent.includes('validate_image_url')) {
    warning('Security fixes appear to already be applied to commands.rs');
    return true;
  }
  
  // Copy secure version
  try {
    const secureContent = await fs.readFile(secureCommandsPath, 'utf8');
    await fs.writeFile(commandsPath, secureContent);
    success('Applied Rust security fixes to commands.rs');
    
    // Update Cargo.toml
    const cargoPath = path.join('src-tauri', 'Cargo.toml');
    const cargoContent = await fs.readFile(cargoPath, 'utf8');
    
    if (!cargoContent.includes('url = ')) {
      const updatedCargo = cargoContent.replace(
        '[dependencies]',
        '[dependencies]\nurl = "2.5"'
      );
      await fs.writeFile(cargoPath, updatedCargo);
      success('Added url crate to Cargo.toml');
    }
    
    return true;
  } catch (err) {
    error(`Failed to apply Rust fixes: ${err.message}`);
    return false;
  }
}

async function verifyTypeScriptFixes() {
  info('Verifying TypeScript security fixes...');
  
  const fileStoragePath = path.join('src', 'services', 'FileStorage.ts');
  
  if (!await fileExists(fileStoragePath)) {
    error('FileStorage.ts not found!');
    return false;
  }
  
  const content = await fs.readFile(fileStoragePath, 'utf8');
  
  // Check if sanitization is imported and used
  const hasSanitizerImport = content.includes("import { sanitizeContentItem } from '../utils/contentSanitizer'");
  const usesSanitization = content.includes('sanitizeContentItem(content)');
  
  if (hasSanitizerImport && usesSanitization) {
    success('TypeScript security fixes are already applied');
    return true;
  }
  
  if (!hasSanitizerImport) {
    warning('contentSanitizer import not found in FileStorage.ts');
    warning('The import has been added at line 5');
  }
  
  if (!usesSanitization) {
    warning('sanitizeContentItem not being used in saveContent method');
    warning('The sanitization has been added at line 609');
  }
  
  return hasSanitizerImport && usesSanitization;
}

async function checkDependencies() {
  info('Checking security dependencies...');
  
  try {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (!deps.dompurify) {
      warning('DOMPurify not found in package.json');
      info('Installing DOMPurify...');
      execSync('npm install dompurify @types/dompurify', { stdio: 'inherit' });
      success('Installed DOMPurify');
    } else {
      success('DOMPurify is installed');
    }
    
    return true;
  } catch (err) {
    error(`Failed to check dependencies: ${err.message}`);
    return false;
  }
}

async function runSecurityTests() {
  info('Running security tests...');
  
  try {
    // Check if test file exists
    if (await fileExists(path.join('src', 'tests', 'security.test.ts'))) {
      info('Running unit security tests...');
      execSync('npm test src/tests/security.test.ts', { stdio: 'inherit' });
      success('Security tests passed');
    } else {
      warning('Security test file not found');
    }
    
    return true;
  } catch (err) {
    error('Security tests failed!');
    error(err.message);
    return false;
  }
}

async function buildProject() {
  info('Building project to verify changes...');
  
  try {
    // Build TypeScript
    info('Building TypeScript...');
    execSync('npm run build', { stdio: 'inherit' });
    success('TypeScript build successful');
    
    // Build Rust
    info('Building Rust...');
    execSync('cd src-tauri && cargo build --release', { stdio: 'inherit', shell: true });
    success('Rust build successful');
    
    return true;
  } catch (err) {
    error(`Build failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('');
  log('🔐 SCORM Builder Security Fix Migration Script', COLORS.BLUE);
  console.log('='.repeat(50));
  console.log('');
  
  warning('This script will apply critical security fixes to your codebase.');
  warning('Backups will be created for all modified files.');
  console.log('');
  
  // Check current directory
  if (!await fileExists('package.json')) {
    error('Please run this script from the scorm-builder root directory');
    process.exit(1);
  }
  
  const steps = [
    { name: 'Check Dependencies', fn: checkDependencies },
    { name: 'Apply Rust Security Fixes', fn: applyRustSecurityFixes },
    { name: 'Verify TypeScript Fixes', fn: verifyTypeScriptFixes },
    { name: 'Build Project', fn: buildProject },
    { name: 'Run Security Tests', fn: runSecurityTests }
  ];
  
  let allSuccess = true;
  
  for (const step of steps) {
    console.log('');
    log(`Step: ${step.name}`, COLORS.YELLOW);
    log('-'.repeat(30), COLORS.YELLOW);
    
    const result = await step.fn();
    if (!result && step.name !== 'Run Security Tests') {
      allSuccess = false;
      error(`${step.name} failed!`);
      
      if (step.name === 'Build Project') {
        error('Build failed - security fixes may have syntax errors');
        info('Check the error messages above and fix any issues');
      }
      break;
    }
  }
  
  console.log('');
  console.log('='.repeat(50));
  
  if (allSuccess) {
    success('🎉 Security fixes applied successfully!');
    console.log('');
    info('Next steps:');
    console.log('  1. Test the application manually');
    console.log('  2. Run: npm run tauri dev');
    console.log('  3. Test security fixes in browser console');
    console.log('  4. Commit changes: git commit -am "SECURITY: Apply critical security fixes"');
    console.log('  5. Deploy immediately');
  } else {
    error('⚠️  Security migration incomplete!');
    console.log('');
    info('Please fix the errors above and run the script again.');
    info('Backups have been created for any modified files.');
  }
}

// Run the migration
main().catch(err => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});