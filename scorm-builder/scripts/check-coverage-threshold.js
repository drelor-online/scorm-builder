import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COVERAGE_THRESHOLD = 85.0; // Minimum 85% coverage

try {
  // Read coverage analysis
  const analysisPath = path.join(__dirname, '..', 'coverage-analysis.json');
  const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
  
  const coveragePercent = (analysis.tested / analysis.total) * 100;
  
  console.log('=== Coverage Threshold Check ===');
  console.log(`Required: ${COVERAGE_THRESHOLD}%`);
  console.log(`Current: ${coveragePercent.toFixed(1)}%`);
  
  if (coveragePercent < COVERAGE_THRESHOLD) {
    console.error(`\n❌ Coverage is below threshold!`);
    console.error(`Missing ${(COVERAGE_THRESHOLD - coveragePercent).toFixed(1)}% to meet requirements.`);
    
    // Show which files need tests
    console.error('\nFiles that need tests:');
    analysis.untested.slice(0, 10).forEach(file => {
      console.error(`  - ${file}`);
    });
    
    if (analysis.untested.length > 10) {
      console.error(`  ... and ${analysis.untested.length - 10} more files`);
    }
    
    process.exit(1);
  } else {
    console.log(`\n✅ Coverage meets threshold!`);
    console.log(`Exceeding requirement by ${(coveragePercent - COVERAGE_THRESHOLD).toFixed(1)}%`);
    
    // Show coverage breakdown
    console.log('\nCoverage by category:');
    Object.entries(analysis.byCategory).forEach(([category, data]) => {
      if (category !== 'byCategory' && data.total > 0) {
        const categoryPercent = (data.tested / data.total) * 100;
        const status = categoryPercent >= COVERAGE_THRESHOLD ? '✅' : '⚠️';
        console.log(`  ${status} ${category}: ${categoryPercent.toFixed(1)}%`);
      }
    });
  }
} catch (error) {
  console.error('Failed to check coverage threshold:', error.message);
  process.exit(1);
}