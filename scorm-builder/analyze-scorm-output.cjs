const fs = require('fs');
const path = require('path');

// Read the existing test output if available
const outputDir = path.join(__dirname, 'test-output-enhanced');

if (!fs.existsSync(outputDir)) {
  console.log('No test output found. Looking for other test outputs...');
  
  // Check other possible locations
  const possibleDirs = [
    'test-output',
    'test-output-enhanced',
    'test-scorm-output',
    'sample-scorm-package'
  ];
  
  for (const dir of possibleDirs) {
    const fullPath = path.join(__dirname, dir);
    if (fs.existsSync(fullPath)) {
      console.log(`Found: ${fullPath}`);
      const indexPath = path.join(fullPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        analyzeScormPackage(fullPath);
        break;
      }
    }
  }
} else {
  analyzeScormPackage(outputDir);
}

function analyzeScormPackage(dir) {
  console.log(`\nAnalyzing SCORM package in: ${dir}\n`);
  
  // Check index.html
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    console.log('=== index.html analysis ===');
    console.log('Has nav-footer:', indexHtml.includes('nav-footer'));
    console.log('Has sidebar-nav:', indexHtml.includes('sidebar-nav'));
    console.log('Navigation buttons in footer:', indexHtml.includes('<footer class="nav-footer">'));
  }
  
  // Check welcome page
  const welcomePath = path.join(dir, 'pages', 'welcome.html');
  if (fs.existsSync(welcomePath)) {
    const welcomeHtml = fs.readFileSync(welcomePath, 'utf8');
    console.log('\n=== welcome.html analysis ===');
    console.log('Has navigation-buttons div:', welcomeHtml.includes('navigation-buttons'));
    console.log('Has media-image div:', welcomeHtml.includes('media-image'));
    
    // Check image sources
    const imgMatches = welcomeHtml.match(/src="([^"]+)"/g);
    if (imgMatches) {
      console.log('Image sources found:');
      imgMatches.forEach(src => {
        if (src.includes('media/images') || src.includes('blob:')) {
          console.log('  ', src);
        }
      });
    }
    
    // Check audio setup
    console.log('Audio player ID:', welcomeHtml.match(/id="audio-player-([^"]+)"/)?.[1] || 'Not found');
    console.log('Duration span ID:', welcomeHtml.match(/id="duration-([^"]+)"/)?.[1] || 'Not found');
    console.log('Caption track kind:', welcomeHtml.match(/kind="([^"]+)"/)?.[1] || 'Not found');
  }
  
  // Check a topic page
  const topicPath = path.join(dir, 'pages', 'topic-1.html');
  if (fs.existsSync(topicPath)) {
    const topicHtml = fs.readFileSync(topicPath, 'utf8');
    console.log('\n=== topic-1.html analysis ===');
    console.log('Has navigation-buttons div:', topicHtml.includes('navigation-buttons'));
    console.log('Submit button classes:', topicHtml.match(/class="([^"]*submit[^"]*)"/g) || 'Not found');
    console.log('Duration span ID:', topicHtml.match(/id="duration-([^"]+)"/)?.[1] || 'Not found');
  }
  
  // Check CSS
  const cssPath = path.join(dir, 'styles', 'main.css');
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    console.log('\n=== main.css analysis ===');
    console.log('Has .media-image styles:', css.includes('.media-image'));
    console.log('Has .kc-submit styles:', css.includes('.kc-submit'));
    console.log('Has .check-answer-btn styles:', css.includes('.check-answer-btn'));
    console.log('Has .navigation-buttons styles:', css.includes('.navigation-buttons'));
    console.log('Has .nav-footer styles:', css.includes('.nav-footer'));
  }
  
  // Check navigation.js
  const navPath = path.join(dir, 'scripts', 'navigation.js');
  if (fs.existsSync(navPath)) {
    const navJs = fs.readFileSync(navPath, 'utf8');
    console.log('\n=== navigation.js analysis ===');
    const answeredQuestionsCount = (navJs.match(/let answeredQuestions/g) || []).length;
    console.log('answeredQuestions declarations:', answeredQuestionsCount);
    if (answeredQuestionsCount > 1) {
      console.log('ERROR: Duplicate answeredQuestions declaration!');
    }
    
    // Check identifier handling
    console.log('Has duration-${identifier}:', navJs.includes('duration-${identifier}'));
    console.log('Has duration-welcome check:', navJs.includes('duration-welcome'));
  }
  
  // Check media files
  const mediaDir = path.join(dir, 'media');
  if (fs.existsSync(mediaDir)) {
    console.log('\n=== Media files ===');
    const imageDir = path.join(mediaDir, 'images');
    if (fs.existsSync(imageDir)) {
      const images = fs.readdirSync(imageDir);
      console.log('Images:', images);
    }
    
    const captionDir = path.join(mediaDir, 'captions');
    if (fs.existsSync(captionDir)) {
      const captions = fs.readdirSync(captionDir);
      console.log('Captions:', captions);
      
      // Check a caption file content
      if (captions.length > 0) {
        const captionContent = fs.readFileSync(path.join(captionDir, captions[0]), 'utf8');
        console.log(`\nFirst caption file (${captions[0]}) preview:`);
        console.log(captionContent.substring(0, 200) + '...');
      }
    }
  }
}