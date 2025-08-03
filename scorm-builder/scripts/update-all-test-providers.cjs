const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('src/**/*.test.tsx', { cwd: path.join(__dirname, '..') });

let totalUpdated = 0;
let totalSkipped = 0;
let totalErrors = 0;

function updateTestFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if file already imports our custom render
    if (content.includes("from '../test/testProviders'") || 
        content.includes("from '../../test/testProviders'") ||
        content.includes("from '../../../test/testProviders'")) {
      console.log(`✓ ${filePath} - already updated`);
      totalSkipped++;
      return;
    }

    // Check if file imports render from @testing-library/react
    const importPattern = /import\s+{([^}]*)}\s+from\s+['"]@testing-library\/react['"]/;
    const match = content.match(importPattern);

    if (match) {
      const imports = match[1];
      // Check if render is among the imports
      if (imports.includes('render')) {
        // Replace @testing-library/react import with our custom one
        const depth = filePath.split(path.sep).length - 2; // subtract 'src' and filename
        const relPath = '../'.repeat(depth) + 'test/testProviders';
        
        content = content.replace(
          importPattern,
          `import {$1} from '${relPath}'`
        );
        modified = true;
      }
    }

    // Remove manual provider wrapping in render calls
    const providerPatterns = [
      // Match multi-line provider wrapping
      /render\s*\(\s*<PersistentStorageProvider[^>]*>[\s\S]*?<\/PersistentStorageProvider>\s*\)/g,
      /render\s*\(\s*<MediaRegistryProvider[^>]*>[\s\S]*?<\/MediaRegistryProvider>\s*\)/g,
      /render\s*\(\s*<MediaProvider[^>]*>[\s\S]*?<\/MediaProvider>\s*\)/g,
      /render\s*\(\s*<StepNavigationProvider[^>]*>[\s\S]*?<\/StepNavigationProvider>\s*\)/g,
      /render\s*\(\s*<AutoSaveProvider[^>]*>[\s\S]*?<\/AutoSaveProvider>\s*\)/g,
    ];

    // Complex pattern to handle nested providers
    const nestedProviderPattern = /render\s*\(\s*(<(?:PersistentStorageProvider|MediaRegistryProvider|MediaProvider|StepNavigationProvider|AutoSaveProvider)[^>]*>[\s\S]*?<\/(?:PersistentStorageProvider|MediaRegistryProvider|MediaProvider|StepNavigationProvider|AutoSaveProvider)>)\s*\)/g;
    
    if (nestedProviderPattern.test(content)) {
      content = content.replace(nestedProviderPattern, (match, providersAndComponent) => {
        // Extract the innermost component
        let component = providersAndComponent;
        
        // Remove each provider layer
        const providers = ['PersistentStorageProvider', 'MediaRegistryProvider', 'MediaProvider', 'StepNavigationProvider', 'AutoSaveProvider'];
        
        providers.forEach(provider => {
          const regex = new RegExp(`<${provider}[^>]*>([\\s\\S]*?)<\\/${provider}>`, 'g');
          component = component.replace(regex, '$1');
        });
        
        modified = true;
        return `render(${component.trim()})`;
      });
    }

    // Remove provider imports that are no longer needed (only if we modified render calls)
    if (modified) {
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
        }
      });
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ ${filePath} - updated`);
      totalUpdated++;
    } else {
      console.log(`⚠️  ${filePath} - no changes needed`);
      totalSkipped++;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}: ${error.message}`);
    totalErrors++;
  }
}

console.log('Updating all test files to use custom render with providers...\n');
console.log(`Found ${testFiles.length} test files\n`);

testFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  updateTestFile(fullPath);
});

console.log('\n========================================');
console.log(`Total files: ${testFiles.length}`);
console.log(`Updated: ${totalUpdated}`);
console.log(`Skipped: ${totalSkipped}`);
console.log(`Errors: ${totalErrors}`);
console.log('========================================');