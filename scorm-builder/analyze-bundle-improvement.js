#!/usr/bin/env node

/**
 * Script to analyze bundle size improvements from code splitting
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Analyzing bundle size improvements...\n');

// Build current version
console.log('📦 Building current version (without code splitting)...');
execSync('npm run build', { stdio: 'inherit' });

// Get current bundle stats
const distPath = path.join(__dirname, 'dist', 'assets');
const currentStats = analyzeBundleSize(distPath);
console.log('\n📊 Current bundle stats:');
printStats(currentStats);

// Save current stats
fs.writeFileSync('bundle-stats-before.json', JSON.stringify(currentStats, null, 2));

// Now we would need to:
// 1. Replace App.tsx with App.lazy.tsx
// 2. Update vite config if needed
// 3. Build again
// 4. Compare results

console.log('\n💡 To complete the analysis:');
console.log('1. Replace src/App.tsx with src/App.lazy.tsx');
console.log('2. Run this script again to see the improvements');
console.log('3. Compare initial bundle size reduction');

function analyzeBundleSize(dir) {
  const files = fs.readdirSync(dir);
  const stats = {
    totalSize: 0,
    totalGzipped: 0,
    chunks: [],
    initialBundle: 0,
    lazyChunks: 0
  };

  files.forEach(file => {
    if (file.endsWith('.js') && !file.endsWith('.gz') && !file.endsWith('.br')) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const size = stat.size;
      
      // Check if gzipped version exists
      const gzPath = filePath + '.gz';
      const gzSize = fs.existsSync(gzPath) ? fs.statSync(gzPath).size : size * 0.3; // Estimate if not found
      
      stats.chunks.push({
        name: file,
        size: size,
        gzipped: gzSize,
        isInitial: !file.includes('chunk-') && (file.includes('index') || file.includes('vendor'))
      });
      
      stats.totalSize += size;
      stats.totalGzipped += gzSize;
      
      if (!file.includes('chunk-')) {
        stats.initialBundle += size;
      } else {
        stats.lazyChunks += size;
      }
    }
  });
  
  return stats;
}

function printStats(stats) {
  console.log(`Total Size: ${formatBytes(stats.totalSize)} (${formatBytes(stats.totalGzipped)} gzipped)`);
  console.log(`Initial Bundle: ${formatBytes(stats.initialBundle)}`);
  console.log(`Lazy Chunks: ${formatBytes(stats.lazyChunks)}`);
  console.log(`\nTop 5 chunks by size:`);
  
  stats.chunks
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .forEach(chunk => {
      console.log(`  - ${chunk.name}: ${formatBytes(chunk.size)} (${formatBytes(chunk.gzipped)} gzipped)`);
    });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Export for potential reuse
export { analyzeBundleSize, printStats, formatBytes };