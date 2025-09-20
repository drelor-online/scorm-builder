#!/usr/bin/env node

/**
 * SCORM Package Validator
 *
 * Standalone validator that analyzes a SCORM package and validates:
 * - All media files exist and have correct extensions
 * - HTML references match actual files
 * - SVG files are included and referenced properly
 * - YouTube video embeds have correct parameters
 * - Package structure is valid
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DetailedSCORMValidator {
  constructor(packagePath) {
    this.packagePath = packagePath;
    this.extractPath = path.join(path.dirname(packagePath), 'validation-extract');
    this.results = {
      structure: { passed: 0, failed: 0, details: [] },
      mediaFiles: { passed: 0, failed: 0, details: [] },
      htmlReferences: { passed: 0, failed: 0, details: [] },
      extensionMatching: { passed: 0, failed: 0, details: [] },
      svgValidation: { passed: 0, failed: 0, details: [] },
      youtubeValidation: { passed: 0, failed: 0, details: [] },
      summary: { totalChecks: 0, passed: 0, failed: 0 }
    };
  }

  async validate() {
    console.log('🔍 SCORM Package Detailed Validation');
    console.log('===================================');
    console.log(`📦 Package: ${path.basename(this.packagePath)}`);
    console.log(`📂 Size: ${this.getFileSize(this.packagePath)}`);
    console.log('');

    try {
      await this.extractPackage();
      await this.validateStructure();
      await this.analyzeMedia();
      await this.validateHTMLReferences();
      await this.validateExtensionMatching();
      await this.validateSVGHandling();
      await this.validateYouTubeEmbeds();

      this.calculateSummary();
      this.printDetailedResults();

      return this.results.summary.failed === 0;

    } catch (error) {
      console.error('💥 Validation failed:', error.message);
      return false;
    }
  }

  getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    const sizeInBytes = stats.size;
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async extractPackage() {
    console.log('📂 Extracting package for analysis...');

    // Clean extraction directory
    if (fs.existsSync(this.extractPath)) {
      fs.rmSync(this.extractPath, { recursive: true });
    }
    fs.mkdirSync(this.extractPath, { recursive: true });

    try {
      execSync(`powershell -Command "Expand-Archive -Path '${this.packagePath}' -DestinationPath '${this.extractPath}' -Force"`,
               { stdio: 'pipe' });
      console.log(`✅ Extracted to: ${this.extractPath}`);
    } catch (error) {
      throw new Error(`Failed to extract: ${error.message}`);
    }
  }

  async validateStructure() {
    console.log('🏗️ Validating SCORM structure...');

    const checks = [
      { name: 'imsmanifest.xml', required: true },
      { name: 'pages', required: true, type: 'directory' },
      { name: 'media', required: true, type: 'directory' },
      { name: 'css', required: true, type: 'directory' },
      { name: 'js', required: true, type: 'directory' },
      { name: 'index.html', required: false },
      { name: 'scormdriver.js', required: false }
    ];

    checks.forEach(check => {
      const itemPath = path.join(this.extractPath, check.name);
      const exists = fs.existsSync(itemPath);
      const isCorrectType = !exists ||
        (check.type === 'directory' ? fs.statSync(itemPath).isDirectory() : fs.statSync(itemPath).isFile());

      if (exists && isCorrectType) {
        this.results.structure.passed++;
        this.results.structure.details.push(`✅ ${check.name} present`);
      } else if (check.required) {
        this.results.structure.failed++;
        this.results.structure.details.push(`❌ ${check.name} missing or wrong type`);
      } else {
        this.results.structure.details.push(`⚠️ ${check.name} optional, not present`);
      }
    });

    // Additional structure checks
    this.checkManifestContent();
  }

  checkManifestContent() {
    const manifestPath = path.join(this.extractPath, 'imsmanifest.xml');
    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, 'utf8');

      if (content.includes('<identifier>')) {
        this.results.structure.passed++;
        this.results.structure.details.push('✅ Manifest has valid identifier');
      } else {
        this.results.structure.failed++;
        this.results.structure.details.push('❌ Manifest missing identifier');
      }

      if (content.includes('adlcp:scormType="sco"')) {
        this.results.structure.passed++;
        this.results.structure.details.push('✅ SCORM SCO type declared');
      } else {
        this.results.structure.failed++;
        this.results.structure.details.push('❌ SCORM SCO type not declared');
      }
    }
  }

  async analyzeMedia() {
    console.log('📁 Analyzing media directory...');

    const mediaDir = path.join(this.extractPath, 'media');
    if (!fs.existsSync(mediaDir)) {
      this.results.mediaFiles.failed++;
      this.results.mediaFiles.details.push('❌ Media directory not found');
      return;
    }

    const mediaFiles = fs.readdirSync(mediaDir);
    const byExtension = {};

    mediaFiles.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (!byExtension[ext]) byExtension[ext] = [];
      byExtension[ext].push(file);
    });

    this.results.mediaFiles.details.push(`📊 Total media files: ${mediaFiles.length}`);

    Object.keys(byExtension).sort().forEach(ext => {
      const count = byExtension[ext].length;
      this.results.mediaFiles.details.push(`  ${ext || '(no ext)'}: ${count} files`);

      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp3', '.vtt'].includes(ext)) {
        this.results.mediaFiles.passed++;
      }
    });

    // Check for specific file types we expect
    const expectedTypes = ['.png', '.jpg', '.webp', '.gif', '.svg'];
    expectedTypes.forEach(type => {
      if (byExtension[type] && byExtension[type].length > 0) {
        this.results.mediaFiles.passed++;
        this.results.mediaFiles.details.push(`✅ ${type.toUpperCase()} files present (${byExtension[type].length})`);
      } else {
        this.results.mediaFiles.failed++;
        this.results.mediaFiles.details.push(`❌ No ${type.toUpperCase()} files found`);
      }
    });
  }

  async validateHTMLReferences() {
    console.log('🔗 Validating HTML media references...');

    const pagesDir = path.join(this.extractPath, 'pages');
    const mediaDir = path.join(this.extractPath, 'media');

    if (!fs.existsSync(pagesDir)) {
      this.results.htmlReferences.failed++;
      this.results.htmlReferences.details.push('❌ Pages directory not found');
      return;
    }

    const htmlFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
    const mediaFiles = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];

    this.results.htmlReferences.details.push(`📄 Analyzing ${htmlFiles.length} HTML files`);

    let totalReferences = 0;
    let brokenReferences = 0;

    htmlFiles.forEach(htmlFile => {
      const htmlPath = path.join(pagesDir, htmlFile);
      const content = fs.readFileSync(htmlPath, 'utf8');

      // Find media references
      const mediaPatterns = [
        /(?:src|href)=["']media\/([^"']+)["']/g,
        /url\(['"]?media\/([^'"\\)]+)['"]?\)/g
      ];

      mediaPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          totalReferences++;
          const referencedFile = match[1];

          if (mediaFiles.includes(referencedFile)) {
            this.results.htmlReferences.passed++;
            this.results.htmlReferences.details.push(`✅ ${htmlFile}: ${referencedFile} exists`);
          } else {
            this.results.htmlReferences.failed++;
            this.results.htmlReferences.details.push(`❌ ${htmlFile}: ${referencedFile} MISSING`);
            brokenReferences++;
          }
        }
      });
    });

    this.results.htmlReferences.details.unshift(`📊 Total references found: ${totalReferences}`);
    if (brokenReferences > 0) {
      this.results.htmlReferences.details.unshift(`⚠️ Broken references: ${brokenReferences}`);
    }
  }

  async validateExtensionMatching() {
    console.log('🔧 Validating file extension matching...');

    const pagesDir = path.join(this.extractPath, 'pages');
    const mediaDir = path.join(this.extractPath, 'media');

    if (!fs.existsSync(pagesDir) || !fs.existsSync(mediaDir)) return;

    const htmlFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
    const mediaFiles = fs.readdirSync(mediaDir);

    // Create a map of what files actually exist
    const actualFiles = new Map();
    mediaFiles.forEach(file => {
      const baseName = file.replace(/\.[^.]+$/, ''); // Remove extension
      if (!actualFiles.has(baseName)) {
        actualFiles.set(baseName, []);
      }
      actualFiles.get(baseName).push(file);
    });

    htmlFiles.forEach(htmlFile => {
      const content = fs.readFileSync(path.join(pagesDir, htmlFile), 'utf8');
      const references = [...content.matchAll(/media\/(image-\d+)\.(\w+)/g)];

      references.forEach(([fullMatch, baseName, htmlExt]) => {
        if (actualFiles.has(baseName)) {
          const actualFile = actualFiles.get(baseName)[0];
          const actualExt = path.extname(actualFile).substring(1);

          if (htmlExt === actualExt) {
            this.results.extensionMatching.passed++;
            this.results.extensionMatching.details.push(`✅ ${htmlFile}: ${baseName}.${htmlExt} matches actual file`);
          } else {
            this.results.extensionMatching.failed++;
            this.results.extensionMatching.details.push(`❌ ${htmlFile}: References ${baseName}.${htmlExt} but actual file is ${actualFile}`);
          }
        }
      });
    });
  }

  async validateSVGHandling() {
    console.log('🎨 Validating SVG file handling...');

    const mediaDir = path.join(this.extractPath, 'media');
    const pagesDir = path.join(this.extractPath, 'pages');

    if (!fs.existsSync(mediaDir)) return;

    const mediaFiles = fs.readdirSync(mediaDir);
    const svgFiles = mediaFiles.filter(f => f.endsWith('.svg'));

    if (svgFiles.length === 0) {
      this.results.svgValidation.failed++;
      this.results.svgValidation.details.push('❌ No SVG files found in media directory');
      return;
    }

    this.results.svgValidation.passed++;
    this.results.svgValidation.details.push(`✅ Found ${svgFiles.length} SVG files: ${svgFiles.join(', ')}`);

    // Check if SVGs are referenced in HTML
    if (fs.existsSync(pagesDir)) {
      const htmlFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
      let svgReferences = 0;
      let referencedSVGs = new Set();

      htmlFiles.forEach(htmlFile => {
        const content = fs.readFileSync(path.join(pagesDir, htmlFile), 'utf8');
        const refs = [...content.matchAll(/media\/([^"']*\.svg)/g)];

        refs.forEach(ref => {
          svgReferences++;
          referencedSVGs.add(ref[1]);

          if (svgFiles.includes(ref[1])) {
            this.results.svgValidation.passed++;
            this.results.svgValidation.details.push(`✅ ${htmlFile}: SVG ${ref[1]} referenced and exists`);
          } else {
            this.results.svgValidation.failed++;
            this.results.svgValidation.details.push(`❌ ${htmlFile}: SVG ${ref[1]} referenced but missing`);
          }
        });

        // Check for SVG-specific CSS classes
        if (content.includes('content-svg') || content.includes('svg')) {
          this.results.svgValidation.passed++;
          this.results.svgValidation.details.push(`✅ ${htmlFile}: Contains SVG-specific styling`);
        }
      });

      if (svgReferences > 0) {
        this.results.svgValidation.details.push(`📊 Total SVG references: ${svgReferences}`);
      } else {
        this.results.svgValidation.failed++;
        this.results.svgValidation.details.push('❌ SVG files present but not referenced in HTML');
      }

      // Check for unreferenced SVGs
      svgFiles.forEach(svgFile => {
        if (!referencedSVGs.has(svgFile)) {
          this.results.svgValidation.failed++;
          this.results.svgValidation.details.push(`⚠️ SVG file ${svgFile} exists but is not referenced`);
        }
      });
    }
  }

  async validateYouTubeEmbeds() {
    console.log('🎬 Validating YouTube video embeds...');

    const pagesDir = path.join(this.extractPath, 'pages');
    if (!fs.existsSync(pagesDir)) return;

    const htmlFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
    let youtubeEmbeds = 0;
    let clippedVideos = 0;

    htmlFiles.forEach(htmlFile => {
      const content = fs.readFileSync(path.join(pagesDir, htmlFile), 'utf8');

      // Look for YouTube embeds
      const youtubePatterns = [
        /youtube\.com\/embed\/([a-zA-Z0-9_-]+)(\?[^"']*)?/g,
        /youtu\.be\/([a-zA-Z0-9_-]+)/g
      ];

      youtubePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          youtubeEmbeds++;
          const videoId = match[1];
          const params = match[2] || '';

          this.results.youtubeValidation.passed++;
          this.results.youtubeValidation.details.push(`✅ ${htmlFile}: YouTube video ${videoId} embedded`);

          // Check for clipping parameters
          if (params.includes('start=') || params.includes('end=')) {
            clippedVideos++;
            this.results.youtubeValidation.passed++;
            this.results.youtubeValidation.details.push(`✅ ${htmlFile}: Video has clip parameters: ${params}`);
          }

          // Validate embed URL structure
          if (match[0].includes('youtube.com/embed/')) {
            this.results.youtubeValidation.passed++;
            this.results.youtubeValidation.details.push(`✅ ${htmlFile}: Proper embed URL format`);
          } else {
            this.results.youtubeValidation.failed++;
            this.results.youtubeValidation.details.push(`❌ ${htmlFile}: Non-embed YouTube URL found`);
          }
        }
      });
    });

    if (youtubeEmbeds === 0) {
      this.results.youtubeValidation.details.push('ℹ️ No YouTube videos found in package');
    } else {
      this.results.youtubeValidation.details.unshift(`📊 Found ${youtubeEmbeds} YouTube embeds (${clippedVideos} with clipping)`);
    }
  }

  calculateSummary() {
    const categories = ['structure', 'mediaFiles', 'htmlReferences', 'extensionMatching', 'svgValidation', 'youtubeValidation'];

    categories.forEach(category => {
      this.results.summary.passed += this.results[category].passed;
      this.results.summary.failed += this.results[category].failed;
    });

    this.results.summary.totalChecks = this.results.summary.passed + this.results.summary.failed;
  }

  printDetailedResults() {
    console.log('\n📊 DETAILED VALIDATION RESULTS');
    console.log('==============================');

    const categories = [
      { key: 'structure', name: '🏗️ Structure Validation', icon: '🏗️' },
      { key: 'mediaFiles', name: '📁 Media Files Analysis', icon: '📁' },
      { key: 'htmlReferences', name: '🔗 HTML References', icon: '🔗' },
      { key: 'extensionMatching', name: '🔧 Extension Matching', icon: '🔧' },
      { key: 'svgValidation', name: '🎨 SVG Handling', icon: '🎨' },
      { key: 'youtubeValidation', name: '🎬 YouTube Embeds', icon: '🎬' }
    ];

    categories.forEach(category => {
      const result = this.results[category.key];
      const total = result.passed + result.failed;
      const status = result.failed === 0 ? '✅' : '❌';

      console.log(`\\n${category.icon} ${category.name} ${status}`);
      console.log(`   Passed: ${result.passed}, Failed: ${result.failed}`);

      if (result.details.length > 0) {
        result.details.forEach(detail => {
          console.log(`   ${detail}`);
        });
      }
    });

    console.log(`\\n🎯 OVERALL SUMMARY`);
    console.log(`   Total Checks: ${this.results.summary.totalChecks}`);
    console.log(`   Passed: ${this.results.summary.passed}`);
    console.log(`   Failed: ${this.results.summary.failed}`);
    console.log(`   Success Rate: ${((this.results.summary.passed / this.results.summary.totalChecks) * 100).toFixed(1)}%`);

    const overallStatus = this.results.summary.failed === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`\\n🏁 FINAL RESULT: ${overallStatus}`);

    if (this.results.summary.failed > 0) {
      console.log(`\\n💡 RECOMMENDATION: Review the failed checks above to fix SCORM package issues.`);
    }
  }
}

// CLI interface
async function main() {
  const packagePath = process.argv[2];

  if (!packagePath) {
    console.log('Usage: node validate-scorm-package.js <path-to-scorm-package.zip>');
    console.log('');
    console.log('Example: node validate-scorm-package.js "C:\\\\path\\\\to\\\\package.zip"');
    process.exit(1);
  }

  if (!fs.existsSync(packagePath)) {
    console.error(`❌ Package not found: ${packagePath}`);
    process.exit(1);
  }

  const validator = new DetailedSCORMValidator(packagePath);
  const isValid = await validator.validate();

  process.exit(isValid ? 0 : 1);
}

// Export for use as module
module.exports = { DetailedSCORMValidator };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Validation error:', error.message);
    process.exit(1);
  });
}