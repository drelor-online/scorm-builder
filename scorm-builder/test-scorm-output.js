import { generateSpaceEfficientSCORM12Buffer } from './src/services/spaceEfficientScormGenerator.ts';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test course content
const testContent = {
  title: "Test Course",
  duration: 30,
  passMark: 80,
  navigationMode: "linear",
  allowRetake: true,
  welcome: {
    title: "Welcome to Test Course",
    content: "This is a test course to verify SCORM generation.",
    startButtonText: "Start Course",
    audioFile: "0000-welcome.mp3",
    captionFile: "0000-welcome.vtt",
    media: [{
      id: "welcome-img",
      url: "blob:file:///test",
      title: "Welcome Image",
      type: "image",
      fileExtension: "jpg"
    }]
  },
  objectives: ["Learn about testing", "Understand SCORM"],
  objectivesPage: {
    audioFile: "0001-objectives.mp3",
    captionFile: "0001-objectives.vtt",
    media: [{
      id: "objectives-img",
      url: "https://example.com/image.jpg",
      title: "Objectives Image",
      type: "image"
    }]
  },
  topics: [{
    id: "topic-1",
    title: "Introduction",
    content: "This is the introduction topic content.",
    audioFile: "0002-introduction.mp3",
    captionFile: "0002-introduction.vtt",
    knowledgeCheck: {
      type: "multiple-choice",
      question: "What is SCORM?",
      options: ["A standard", "A software", "A company", "A language"],
      correctAnswer: 0,
      explanation: "SCORM is a standard for e-learning content."
    },
    media: [{
      id: "topic1-img",
      url: "topic-image.png",
      title: "Topic Image",
      type: "image",
      fileExtension: "png"
    }]
  }],
  assessment: {
    questions: [{
      id: "q1",
      question: "What did you learn?",
      options: ["Nothing", "Something", "Everything", "A lot"],
      correctAnswer: 3
    }]
  }
};

// Add test blobs
const createTestBlob = (content, type) => {
  return new Blob([content], { type });
};

// Add audio blobs
testContent.welcome.audioBlob = createTestBlob("fake audio content", "audio/mp3");
testContent.objectivesPage.audioBlob = createTestBlob("fake audio content", "audio/mp3");
testContent.topics[0].audioBlob = createTestBlob("fake audio content", "audio/mp3");

// Add caption blobs
testContent.welcome.captionBlob = createTestBlob(`WEBVTT

00:00:00.000 --> 00:00:05.000
Welcome to the course

00:00:05.000 --> 00:00:10.000
This is a test caption`, "text/vtt");

testContent.objectivesPage.captionBlob = createTestBlob(`WEBVTT

00:00:00.000 --> 00:00:05.000
Learning objectives

00:00:05.000 --> 00:00:10.000
Here are the objectives`, "text/vtt");

testContent.topics[0].captionBlob = createTestBlob(`WEBVTT

00:00:00.000 --> 00:00:05.000
Introduction topic

00:00:05.000 --> 00:00:10.000
Let's begin`, "text/vtt");

// Add image blobs
testContent.welcome.media[0].blob = createTestBlob("fake image content", "image/jpeg");
testContent.objectivesPage.media[0].blob = createTestBlob("fake image content", "image/jpeg");
testContent.topics[0].media[0].blob = createTestBlob("fake image content", "image/png");

async function testScormGeneration() {
  try {
    console.log('Generating SCORM package...');
    const result = await generateSpaceEfficientSCORM12Buffer(testContent);
    
    console.log('Extracting and analyzing package...');
    const zip = await JSZip.loadAsync(result.buffer);
    
    // Create output directory
    const outputDir = path.join(__dirname, 'test-scorm-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Extract all files
    const files = [];
    zip.forEach((relativePath, file) => {
      files.push(relativePath);
    });
    
    console.log('\nPackage structure:');
    files.sort().forEach(f => console.log('  ' + f));
    
    // Check specific files
    console.log('\n--- Checking index.html ---');
    const indexHtml = await zip.file('index.html').async('string');
    console.log('Has nav-footer:', indexHtml.includes('nav-footer'));
    console.log('Has sidebar nav:', indexHtml.includes('sidebar-nav'));
    
    console.log('\n--- Checking pages/welcome.html ---');
    const welcomeHtml = await zip.file('pages/welcome.html').async('string');
    console.log('Has navigation-buttons:', welcomeHtml.includes('navigation-buttons'));
    console.log('Has media-image div:', welcomeHtml.includes('media-image'));
    console.log('Image src:', welcomeHtml.match(/src="([^"]+\.(?:jpg|png|webp))"/)?.[1] || 'Not found');
    console.log('Has audio player:', welcomeHtml.includes('audio-player'));
    console.log('Has caption track:', welcomeHtml.includes('<track'));
    console.log('Caption track type:', welcomeHtml.match(/kind="([^"]+)"/)?.[1] || 'Not found');
    
    console.log('\n--- Checking pages/topic-1.html ---');
    const topicHtml = await zip.file('pages/topic-1.html').async('string');
    console.log('Has navigation-buttons:', topicHtml.includes('navigation-buttons'));
    console.log('Has knowledge check:', topicHtml.includes('kc-option'));
    console.log('Submit button class:', topicHtml.match(/class="([^"]*submit[^"]*)"/)?.[1] || 'Not found');
    console.log('Has audio duration span:', topicHtml.includes('duration-0'));
    
    console.log('\n--- Checking styles/main.css ---');
    const mainCss = await zip.file('styles/main.css').async('string');
    console.log('Has .media-image styles:', mainCss.includes('.media-image'));
    console.log('Has .kc-submit styles:', mainCss.includes('.kc-submit'));
    console.log('Has .navigation-buttons styles:', mainCss.includes('.navigation-buttons'));
    
    console.log('\n--- Checking scripts/navigation.js ---');
    const navJs = await zip.file('scripts/navigation.js').async('string');
    console.log('Has answeredQuestions declaration:', navJs.match(/let answeredQuestions/g)?.length || 0);
    console.log('Has duration element access:', navJs.includes('duration-${identifier}'));
    
    console.log('\n--- Checking media files ---');
    const imageFiles = files.filter(f => f.startsWith('media/images/'));
    console.log('Image files:', imageFiles);
    
    const captionFiles = files.filter(f => f.startsWith('media/captions/'));
    console.log('Caption files:', captionFiles);
    
    // Extract files for manual inspection
    for (const file of files) {
      const content = await zip.file(file).async('nodebuffer');
      const filePath = path.join(outputDir, file);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content);
    }
    
    console.log(`\nFiles extracted to: ${outputDir}`);
    console.log('You can open index.html in a web server to test.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testScormGeneration();