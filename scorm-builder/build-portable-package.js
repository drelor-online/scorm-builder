import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔨 Building SCORM Builder Portable Package...\n');

async function buildPortable() {
  try {
    // Step 1: Clean previous builds
    console.log('📦 Cleaning previous builds...');
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }

    // Step 2: Build the frontend
    console.log('🎨 Building frontend...');
    execSync('npm run build', { stdio: 'inherit' });

    // Step 3: Build Tauri application (regular build)
    console.log('\n🦀 Building Tauri application...');
    
    try {
      // Run regular Tauri build - it will create installers but also the exe
      execSync('npm run tauri:build', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Build completed with warnings');
    }

    // Step 4: Create portable package from the built exe
    console.log('\n📦 Creating portable package...');
    
    const tauriConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'src-tauri', 'tauri.conf.json'), 'utf8'));
    const portableDir = path.join(__dirname, 'SCORM-Builder-Portable');
    const zipName = `SCORM-Builder-Portable-v${tauriConfig.version}-Win64.zip`;

    // Create portable directory
    if (fs.existsSync(portableDir)) {
      fs.rmSync(portableDir, { recursive: true, force: true });
    }
    fs.mkdirSync(portableDir);

    // Find the built exe (Tauri builds to different locations based on architecture)
    const possiblePaths = [
      path.join(__dirname, 'src-tauri', 'target', 'release', 'SCORM Course Builder.exe'),
      path.join(__dirname, 'src-tauri', 'target', 'release', 'scorm-course-builder.exe'),
      path.join(__dirname, 'src-tauri', 'target', 'release', 'scorm-builder.exe'),
      path.join(__dirname, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'SCORM Course Builder.exe'),
      path.join(__dirname, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'scorm-course-builder.exe')
    ];
    
    // Also check for the exe name from cargo.toml
    const cargoPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      const cargoContent = fs.readFileSync(cargoPath, 'utf8');
      const nameMatch = cargoContent.match(/name\s*=\s*"([^"]+)"/);
      if (nameMatch) {
        possiblePaths.push(
          path.join(__dirname, 'src-tauri', 'target', 'release', `${nameMatch[1]}.exe`),
          path.join(__dirname, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', `${nameMatch[1]}.exe`)
        );
      }
    }
    
    let builtExePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        builtExePath = p;
        break;
      }
    }

    if (builtExePath) {
      console.log(`✅ Found executable at: ${builtExePath}`);
      
      // Copy exe
      fs.copyFileSync(builtExePath, path.join(portableDir, 'SCORM-Builder.exe'));
      
      // Copy WebView2 loader if it exists
      const webview2Path = path.join(path.dirname(builtExePath), 'WebView2Loader.dll');
      if (fs.existsSync(webview2Path)) {
        fs.copyFileSync(webview2Path, path.join(portableDir, 'WebView2Loader.dll'));
      }
      
      // Check for any other required DLLs
      const releaseDir = path.dirname(builtExePath);
      const dllFiles = fs.readdirSync(releaseDir).filter(f => f.endsWith('.dll'));
      dllFiles.forEach(dll => {
        console.log(`📄 Copying ${dll}`);
        fs.copyFileSync(path.join(releaseDir, dll), path.join(portableDir, dll));
      });
      
      // Create README
      const readme = `SCORM Builder - Portable Edition
================================

This is a portable version of SCORM Builder that can run without installation.

IMPORTANT: First Time Setup
---------------------------
Windows may require WebView2 Runtime to be installed. If the app doesn't start:
1. Download WebView2 from: https://go.microsoft.com/fwlink/p/?LinkId=2124703
2. Install it and try running SCORM-Builder.exe again

How to use:
-----------
1. Extract ALL files from this ZIP to any location
2. Double-click SCORM-Builder.exe to run the application
3. No installation required!

Features:
---------
✓ Create SCORM 1.2 compliant packages
✓ Add images, videos, and audio content
✓ Interactive knowledge checks and assessments
✓ Fill-in-the-blank questions
✓ Progress tracking and resume capability
✓ Multiple SCORM player templates
✓ Audio narration support
✓ File size validation
✓ Export to ZIP automatically

System Requirements:
-------------------
• Windows 10 version 1803 or later (64-bit)
• 4GB RAM minimum
• 200MB free disk space
• Microsoft Edge WebView2 Runtime (auto-downloads if needed)

Troubleshooting:
---------------
If the application doesn't start:
1. Make sure you extracted ALL files from the ZIP
2. Right-click SCORM-Builder.exe > Properties > Unblock (if present)
3. Try running as Administrator
4. Check that WebView2 is installed (see above)

Version: ${tauriConfig.version}
Build Date: ${new Date().toLocaleDateString()}
Architecture: x64

For support, please contact your system administrator.
`;
      
      fs.writeFileSync(path.join(portableDir, 'README.txt'), readme);
      
      // Create a launcher batch file
      const launchBat = `@echo off
title SCORM Builder
echo Starting SCORM Builder...
echo.
echo If this window stays open, please install WebView2:
echo https://go.microsoft.com/fwlink/p/?LinkId=2124703
echo.
start "" "%~dp0SCORM-Builder.exe"
exit`;
      
      fs.writeFileSync(path.join(portableDir, 'Start-SCORM-Builder.bat'), launchBat);
      
      console.log('✅ Portable package created successfully!');
      console.log(`📁 Location: ${portableDir}`);
      
      // Show installer locations too
      const bundlePath = path.join(__dirname, 'src-tauri', 'target', 'release', 'bundle');
      if (fs.existsSync(bundlePath)) {
        console.log('\n📦 Installers also created:');
        const msiPath = path.join(bundlePath, 'msi');
        const nsisPath = path.join(bundlePath, 'nsis');
        
        if (fs.existsSync(msiPath)) {
          const msiFiles = fs.readdirSync(msiPath).filter(f => f.endsWith('.msi'));
          msiFiles.forEach(f => console.log(`  - MSI: ${path.join(msiPath, f)}`));
        }
        
        if (fs.existsSync(nsisPath)) {
          const exeFiles = fs.readdirSync(nsisPath).filter(f => f.endsWith('.exe'));
          exeFiles.forEach(f => console.log(`  - Setup: ${path.join(nsisPath, f)}`));
        }
      }
      
      // Create ZIP file using PowerShell
      console.log('\n🗜️ Creating ZIP archive...');
      const zipPath = path.join(__dirname, zipName);
      
      try {
        execSync(`powershell -Command "Compress-Archive -Path '${portableDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
        console.log(`\n✅ ZIP created: ${zipName}`);
        console.log(`📦 Full path: ${zipPath}`);
        
        const stats = fs.statSync(zipPath);
        console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        console.log('\n🎉 You can now share this ZIP file with your colleague!');
        console.log('   They just need to extract it and run SCORM-Builder.exe');
        
      } catch (zipError) {
        console.log('⚠️  Could not create ZIP automatically.');
        console.log('Please manually zip the contents of:', portableDir);
      }
      
    } else {
      console.error('❌ Could not find built executable.');
      console.log('Searched in:');
      possiblePaths.forEach(p => console.log(`  - ${p}`));
      
      // List what's actually in the release directory
      const releaseDir = path.join(__dirname, 'src-tauri', 'target', 'release');
      if (fs.existsSync(releaseDir)) {
        console.log('\nFiles in release directory:');
        const files = fs.readdirSync(releaseDir);
        files.filter(f => f.endsWith('.exe')).forEach(f => console.log(`  - ${f}`));
      }
    }

    console.log('\n✨ Build process complete!');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

buildPortable();