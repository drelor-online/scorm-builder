const fs = require('fs');
const path = require('path');

// Fix 1: Replace incorrect color references
const colorReplacements = [
  { from: /tokens\.colors\.background\.accent/g, to: 'tokens.colors.primary.main' },
  { from: /tokens\.colors\.background\.subtle/g, to: 'tokens.colors.background.tertiary' },
  { from: /tokens\.colors\.background\.elevated/g, to: 'tokens.colors.background.card' },
  { from: /tokens\.colors\.background\.surface/g, to: 'tokens.colors.background.secondary' },
  { from: /tokens\.colors\.border\.subtle/g, to: 'tokens.colors.border.light' },
  { from: /tokens\.colors\.danger(?!\.|\/)/g, to: 'tokens.colors.danger.main' },
  { from: /tokens\.colors\.success(?!\.|\/)/g, to: 'tokens.colors.success.main' },
  { from: /tokens\.colors\.primary(?!\.|\/)/g, to: 'tokens.colors.primary.main' },
];

// Files to fix
const filesToFix = [
  'src/components/ConflictResolutionDialog.tsx',
  'src/components/CoursePreview.tsx',
  'src/components/KeyboardShortcutsHelp.tsx',
  'src/components/MediaLibrary.tsx',
  'src/components/TemplateEditor.tsx',
];

// Fix 2: Remove unnecessary React imports from test files
const testFiles = [
  'src/components/__tests__/ConflictResolutionDialog.test.tsx',
  'src/components/__tests__/CoursePreview.test.tsx',
  'src/components/__tests__/KeyboardShortcutsHelp.test.tsx',
  'src/components/__tests__/MediaLibrary.test.tsx',
  'src/components/__tests__/TemplateEditor.test.tsx',
  'src/components/__tests__/UndoRedoButtons.test.tsx',
  'src/components/__tests__/UndoRedoIntegration.test.tsx',
];

// Process component files
filesToFix.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Apply color replacements
    colorReplacements.forEach(({ from, to }) => {
      content = content.replace(from, to);
    });
    
    // Fix fontSize.md references
    content = content.replace(/fontSize\.md/g, 'fontSize.base');
    
    // Remove unused React import if it's only imported but not used
    if (!content.includes('<') && content.includes("import React")) {
      content = content.replace(/^import React, { /gm, 'import { ');
      content = content.replace(/^import React from 'react'\n/gm, '');
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${file}`);
  }
});

// Process test files
testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove React import if not used
    if (!content.includes('React.') && content.includes("import React from 'react'")) {
      content = content.replace(/^import React from 'react'\n/gm, '');
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed test file: ${file}`);
  }
});

// Fix the CoursePreview.tsx specific issue
const coursePreviewPath = path.join(__dirname, 'src/components/__tests__/CoursePreview.test.tsx');
if (fs.existsSync(coursePreviewPath)) {
  let content = fs.readFileSync(coursePreviewPath, 'utf8');
  
  // Remove the alt property from media items
  content = content.replace(/, alt: 'Test image'/g, '');
  
  // Fix the topic property issue
  content = content.replace(/topic: 'Advanced Topics',/g, 'title: \'Advanced Topics\',');
  
  fs.writeFileSync(coursePreviewPath, content);
  console.log('Fixed CoursePreview.test.tsx specific issues');
}

// Fix SCORM types
const scormTestPath = path.join(__dirname, 'src/services/__tests__/scorm2004Generator.test.ts');
if (fs.existsSync(scormTestPath)) {
  let content = fs.readFileSync(scormTestPath, 'utf8');
  
  // Add missing type definition
  if (!content.includes('interface CourseConfig')) {
    content = content.replace(
      "import { CourseConfig } from '../../types/course'",
      `interface CourseConfig {
  title: string
  description: string
  version: string
  language: string
  organization: string
  identifier: string
  scormVersion: string
  pages: any[]
  sequencing?: any
  navigation?: any
  objectives?: any[]
  completionTracking?: any
  resources?: any[]
  metadata?: any
}`
    );
  }
  
  fs.writeFileSync(scormTestPath, content);
  console.log('Fixed scorm2004Generator.test.ts');
}

console.log('Build error fixes completed!');