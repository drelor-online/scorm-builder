#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// CSS files that were deleted
const deletedCssFiles = [
  'MediaEnhancementWizard.css',
  'HelpPage.css', 
  'OpenProjectDialog.css',
  'PageLayout.css',
  'layout.css',
  'accessibility.css',
  'transitions.css'
];

// Find all TypeScript files
const files = glob.sync('src/**/*.{ts,tsx}', {
  cwd: process.cwd(),
  absolute: true
});

console.log(`Checking ${files.length} files for CSS imports...`);

let filesModified = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  deletedCssFiles.forEach(cssFile => {
    // Match various import patterns
    const patterns = [
      new RegExp(`^import\\s+['"].*${cssFile}['"];?\\s*$`, 'gm'),
      new RegExp(`^import\\s+['"].*/${cssFile}['"];?\\s*$`, 'gm')
    ];
    
    patterns.forEach(pattern => {
      if (content.match(pattern)) {
        content = content.replace(pattern, '');
        modified = true;
      }
    });
  });
  
  // Clean up double newlines
  if (modified) {
    content = content.replace(/\n\n\n+/g, '\n\n');
    fs.writeFileSync(filePath, content);
    filesModified++;
    console.log(`✓ Removed CSS imports from ${path.relative(process.cwd(), filePath)}`);
  }
});

console.log(`\nRemoved CSS imports from ${filesModified} files.`);