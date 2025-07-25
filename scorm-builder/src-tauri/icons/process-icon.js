import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// The PNG icon provided by the user (save this as base64 or copy the file)
// Since we can't directly access the image from the conversation, 
// we'll provide instructions for manual processing

console.log('Processing PNG icon for Tauri application...');

const sizes = [
  { size: 32, name: '32x32.png' },
  { size: 128, name: '128x128.png' },
  { size: 256, name: '128x128@2x.png' },
  { size: 512, name: 'icon.png' }
];

const inputFile = 'original-app-icon.png';

if (!fs.existsSync(inputFile)) {
  console.log('❌ Please save the provided PNG icon as "original-app-icon.png" in this directory');
  console.log('Then run: node process-icon.js');
  process.exit(1);
}

async function generateIcons() {
  try {
    for (const { size, name } of sizes) {
      await sharp(inputFile)
        .resize(size, size)
        .png()
        .toFile(name);
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }
    
    // Generate ICO file
    await sharp(inputFile)
      .resize(256, 256)
      .png()
      .toFile('temp-256.png');
    
    console.log('✅ Generated all PNG icons');
    console.log('ℹ️  For ICO format, use online converter or ImageMagick');
    console.log('   magick temp-256.png icon.ico');
    
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();