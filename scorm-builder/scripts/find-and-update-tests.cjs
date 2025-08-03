const fs = require('fs');
const path = require('path');

let totalUpdated = 0;
let totalSkipped = 0;
let totalErrors = 0;

function findTestFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other unnecessary directories
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
        findTestFiles(filePath, fileList);
      }
    } else if (file.endsWith('.test.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function updateTestFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if file already imports our custom render
    if (content.includes("from '../test/testProviders'") || 
        content.includes("from '../../test/testProviders'") ||
        content.includes("from '../../../test/testProviders'")) {
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
        // Calculate relative path
        const testDir = path.dirname(filePath);
        const srcDir = path.join(__dirname, '..', 'src');
        const relativeToSrc = path.relative(testDir, srcDir);
        const relPath = path.join(relativeToSrc, 'test', 'testProviders').replace(/\\/g, '/');
        
        content = content.replace(
          importPattern,
          `import {$1} from '${relPath}'`
        );
        modified = true;
      }
    }

    // Remove manual provider wrapping in render calls
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
      console.log(`✅ ${path.relative(process.cwd(), filePath)}`);
      totalUpdated++;
    } else {
      totalSkipped++;
    }
  } catch (error) {
    console.error(`❌ Error updating ${path.relative(process.cwd(), filePath)}: ${error.message}`);
    totalErrors++;
  }
}

console.log('Finding and updating test files...\n');

const srcDir = path.join(__dirname, '..', 'src');
const testFiles = findTestFiles(srcDir);

console.log(`Found ${testFiles.length} test files\n`);

testFiles.forEach(updateTestFile);

console.log('\n========================================');
console.log(`Total files: ${testFiles.length}`);
console.log(`Updated: ${totalUpdated}`);
console.log(`Skipped: ${totalSkipped}`);
console.log(`Errors: ${totalErrors}`);
console.log('========================================');