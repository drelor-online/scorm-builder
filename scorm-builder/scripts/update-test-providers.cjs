const fs = require('fs');
const path = require('path');

// List of test files that need updating based on the test run output
const testFilesToUpdate = [
  'src/__tests__/App.test.tsx',
  'src/__tests__/App.simple.test.tsx',
  'src/__tests__/App.lazy.test.tsx',
  'src/__tests__/App.save.test.tsx',
  'src/__tests__/App.dashboard.test.tsx',
  'src/__tests__/App.intent.test.tsx',
  'src/__tests__/App.navigation.test.tsx',
  'src/__tests__/accessibility.test.tsx',
  'src/components/__tests__/App.preview.test.tsx',
  'src/components/__tests__/MediaDisplay.test.tsx',
  'src/components/__tests__/ActivitiesEditor.test.tsx',
  'src/components/__tests__/AudioNarrationWizard.test.tsx',
  'src/components/__tests__/MediaEnhancementWizard.test.tsx',
  'src/components/__tests__/SCORMPackageBuilder.test.tsx',
  'src/components/__tests__/ProjectDashboard.test.tsx',
  'src/components/__tests__/RealTimePreview.test.tsx',
  'src/components/__tests__/CoursePreview.test.tsx',
  'src/components/__tests__/CourseSeedInput.test.tsx',
  'src/components/__tests__/JSONImportValidator.test.tsx',
  'src/components/__tests__/TemplateEditor.test.tsx',
];

function updateTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file already imports our custom render
  if (content.includes("from '../test/testProviders'") || content.includes("from '../../test/testProviders'")) {
    console.log(`✓ ${filePath} - already updated`);
    return;
  }

  // Add import for our custom render if it's not already there
  const importPattern = /import\s+{[^}]*render[^}]*}\s+from\s+['"]@testing-library\/react['"]/;
  const hasRenderImport = importPattern.test(content);

  if (hasRenderImport) {
    // Replace @testing-library/react import with our custom one
    content = content.replace(
      importPattern,
      (match) => {
        const relPath = path.relative(path.dirname(filePath), 'src/test/testProviders').replace(/\\/g, '/');
        return match.replace('@testing-library/react', `./${relPath}`);
      }
    );
    modified = true;
  }

  // Remove manual provider wrapping in render calls
  const providerPatterns = [
    /<PersistentStorageProvider[^>]*>[\s\S]*?<\/PersistentStorageProvider>/g,
    /<MediaRegistryProvider[^>]*>[\s\S]*?<\/MediaRegistryProvider>/g,
    /<MediaProvider[^>]*>[\s\S]*?<\/MediaProvider>/g,
    /<StepNavigationProvider[^>]*>[\s\S]*?<\/StepNavigationProvider>/g,
    /<AutoSaveProvider[^>]*>[\s\S]*?<\/AutoSaveProvider>/g,
  ];

  // Find render calls with providers
  const renderWithProvidersPattern = /render\s*\(\s*(<(?:PersistentStorageProvider|MediaRegistryProvider|MediaProvider|StepNavigationProvider|AutoSaveProvider)[^>]*>[\s\S]*?<\/(?:PersistentStorageProvider|MediaRegistryProvider|MediaProvider|StepNavigationProvider|AutoSaveProvider)>)\s*\)/g;
  
  content = content.replace(renderWithProvidersPattern, (match, providersAndComponent) => {
    // Extract just the component being rendered (innermost element)
    let component = providersAndComponent;
    providerPatterns.forEach(pattern => {
      component = component.replace(pattern, (providerMatch) => {
        const innerContent = providerMatch.match(/>[\s\S]*<\//)?.[0]?.slice(1, -2) || '';
        return innerContent.trim();
      });
    });
    
    modified = true;
    return `render(${component})`;
  });

  // Remove provider imports that are no longer needed
  const providerImports = [
    /import\s+{\s*PersistentStorageProvider\s*}\s+from\s+['"][^'"]+PersistentStorageContext['"]\s*;?\n/g,
    /import\s+{\s*MediaRegistryProvider\s*}\s+from\s+['"][^'"]+MediaRegistryContext['"]\s*;?\n/g,
    /import\s+{\s*MediaProvider\s*}\s+from\s+['"][^'"]+MediaContext['"]\s*;?\n/g,
    /import\s+{\s*StepNavigationProvider\s*}\s+from\s+['"][^'"]+StepNavigationContext['"]\s*;?\n/g,
    /import\s+{\s*AutoSaveProvider\s*}\s+from\s+['"][^'"]+AutoSaveContext['"]\s*;?\n/g,
  ];

  providerImports.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${filePath} - updated`);
  } else {
    console.log(`⚠️  ${filePath} - no changes needed`);
  }
}

console.log('Updating test files to use custom render with providers...\n');

testFilesToUpdate.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    try {
      updateTestFile(fullPath);
    } catch (error) {
      console.error(`❌ Error updating ${file}: ${error.message}`);
    }
  } else {
    console.log(`⚠️  ${file} - file not found`);
  }
});

console.log('\nDone!');