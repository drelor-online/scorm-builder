#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Valid template values from CourseTemplate type
const validTemplates = [
  'None',
  'How-to Guide',
  'Corporate', 
  'Technical',
  'Safety',
  'Business Development',
  'Human Resources'
];

// Find all test files
const testFiles = glob.sync('src/**/*.test.{ts,tsx}', { 
  cwd: process.cwd(),
  absolute: true 
});

console.log(`Found ${testFiles.length} test files to check...`);

let filesModified = 0;
let totalReplacements = 0;

testFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern to match template declarations without 'as const'
  validTemplates.forEach(template => {
    // Match template: 'TemplateName' without as const
    const regex = new RegExp(`template:\\s*'${template}'(?!\\s*as\\s*const)`, 'g');
    const matches = content.match(regex);
    
    if (matches) {
      content = content.replace(regex, `template: '${template}' as const`);
      modified = true;
      totalReplacements += matches.length;
    }
  });
  
  // Fix other common issues
  // Fix itemName to projectName in DeleteConfirmDialog tests
  if (filePath.includes('DeleteConfirmDialog')) {
    content = content.replace(/itemName=/g, 'projectName=');
    modified = true;
  }
  
  // Fix assessment narration (should be null)
  const assessmentNarrationRegex = /narration:\s*['"][^'"]*['"]\s*(?=\s*}\s*})/g;
  if (content.match(assessmentNarrationRegex)) {
    content = content.replace(assessmentNarrationRegex, 'narration: null');
    modified = true;
  }
  
  // Remove unused imports
  const lines = content.split('\n');
  const newLines = [];
  
  lines.forEach(line => {
    // Check if it's an import line
    if (line.includes('import') && line.includes('from')) {
      // Extract imported items
      const importMatch = line.match(/import\s*{\s*([^}]+)\s*}\s*from/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(i => i.trim());
        const usedImports = [];
        
        imports.forEach(imp => {
          // Check if the import is used in the file (excluding the import line itself)
          const contentWithoutThisLine = lines.filter(l => l !== line).join('\n');
          if (contentWithoutThisLine.includes(imp)) {
            usedImports.push(imp);
          }
        });
        
        if (usedImports.length === 0) {
          // Skip this import line entirely
          return;
        } else if (usedImports.length < imports.length) {
          // Reconstruct import with only used items
          const newImport = line.replace(/import\s*{\s*[^}]+\s*}/, `import { ${usedImports.join(', ')} }`);
          newLines.push(newImport);
          modified = true;
          return;
        }
      }
    }
    newLines.push(line);
  });
  
  if (modified) {
    content = newLines.join('\n');
    fs.writeFileSync(filePath, content);
    filesModified++;
    console.log(`✓ Fixed ${path.relative(process.cwd(), filePath)}`);
  }
});

console.log(`\nFixed ${filesModified} files with ${totalReplacements} template type assertions.`);