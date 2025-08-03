/**
 * Node.js test script to analyze SCORM project data and media files
 * This script loads and analyzes the Natural Gas Safety project
 */

const fs = require('fs').promises;
const path = require('path');

// Project paths
const PROJECT_ID = '192cbdd6-8b7e-44a8-a4a6-ea46665edbf4';
const PROJECT_PATH = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural Gas Safety.scormproj';
const MEDIA_DIR = `C:\\Users\\sierr\\Documents\\SCORM Projects\\${PROJECT_ID}\\media`;

// MIME type to extension mapping
const MIME_TO_EXT = {
  'audio/*': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'text/vtt': 'vtt',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
};

async function loadProjectData() {
  console.log('Loading project data from:', PROJECT_PATH);
  const projectContent = await fs.readFile(PROJECT_PATH, 'utf-8');
  const projectData = JSON.parse(projectContent);
  console.log('Project loaded:', projectData.project.name);
  return projectData;
}

async function analyzeMediaFiles() {
  console.log('\n=== Analyzing Media Files ===');
  console.log('Media directory:', MEDIA_DIR);
  
  const files = await fs.readdir(MEDIA_DIR);
  const mediaMap = new Map();
  
  // Group files by base name
  for (const file of files) {
    const baseName = file.replace(/\.(bin|json)$/, '');
    if (!mediaMap.has(baseName)) {
      mediaMap.set(baseName, {});
    }
    
    if (file.endsWith('.bin')) {
      const stats = await fs.stat(path.join(MEDIA_DIR, file));
      mediaMap.get(baseName).binFile = file;
      mediaMap.get(baseName).binSize = stats.size;
    } else if (file.endsWith('.json')) {
      const content = await fs.readFile(path.join(MEDIA_DIR, file), 'utf-8');
      mediaMap.get(baseName).metadata = JSON.parse(content);
    }
  }
  
  // Display media analysis
  console.log(`\nFound ${mediaMap.size} media items:`);
  
  for (const [baseName, info] of mediaMap) {
    console.log(`\n${baseName}:`);
    if (info.metadata) {
      console.log(`  Page ID: ${info.metadata.page_id}`);
      console.log(`  Type: ${info.metadata.type}`);
      console.log(`  MIME: ${info.metadata.mime_type}`);
      console.log(`  Original: ${info.metadata.original_name}`);
      
      // Determine expected extension
      const ext = MIME_TO_EXT[info.metadata.mime_type] || 'bin';
      console.log(`  Expected filename: ${baseName}.${ext}`);
    }
    if (info.binFile) {
      console.log(`  Binary size: ${info.binSize} bytes`);
    }
  }
  
  return mediaMap;
}

async function analyzeProjectContent(projectData) {
  console.log('\n=== Analyzing Course Content ===');
  
  const content = projectData.course_content;
  
  console.log('\nCourse Metadata:');
  console.log(`  Title: ${content.metadata.title}`);
  console.log(`  Topics: ${content.topics.length}`);
  
  // Analyze welcome media
  console.log('\nWelcome Page Media:');
  if (content.welcomeMedia) {
    for (const media of content.welcomeMedia) {
      console.log(`  - ${media.type}: ${media.id}`);
      if (media.embedUrl) {
        console.log(`    Embed URL: ${media.embedUrl}`);
      }
    }
  }
  
  // Analyze topics
  console.log('\nTopics:');
  content.topics.forEach((topic, index) => {
    console.log(`\n  Topic ${index}: ${topic.title}`);
    console.log(`    ID: ${topic.id}`);
    
    if (topic.media && topic.media.length > 0) {
      console.log('    Media:');
      topic.media.forEach(m => {
        console.log(`      - ${m.type}: ${m.id}`);
        if (m.embedUrl) {
          console.log(`        Embed URL: ${m.embedUrl}`);
        }
      });
    }
    
    if (topic.narration) {
      console.log('    Narration:');
      console.log(`      Audio: ${topic.narration.audioUrl || 'none'}`);
      console.log(`      Caption: ${topic.narration.captionUrl || 'none'}`);
    }
    
    if (topic.knowledgeChecks && topic.knowledgeChecks.length > 0) {
      console.log(`    Knowledge Checks: ${topic.knowledgeChecks.length} questions`);
      topic.knowledgeChecks.forEach((kc, kcIndex) => {
        console.log(`      ${kcIndex + 1}. Type: ${kc.type}`);
        console.log(`         Question: ${kc.question || kc.text || 'N/A'}`);
      });
    }
  });
  
  // Analyze assessment
  if (content.assessment && content.assessment.questions) {
    console.log(`\nAssessment: ${content.assessment.questions.length} questions`);
    content.assessment.questions.forEach((q, index) => {
      console.log(`  ${index + 1}. Type: ${q.type}`);
      console.log(`     Question: ${q.question || q.text || 'N/A'}`);
    });
  }
}

function crossReferenceMedia(projectData, mediaMap) {
  console.log('\n=== Cross-Referencing Media ===');
  
  const content = projectData.course_content;
  const usedMedia = new Set();
  const missingMedia = new Set();
  
  // Helper to check media reference
  function checkMedia(mediaId, context) {
    if (mediaId) {
      usedMedia.add(mediaId);
      if (!mediaMap.has(mediaId)) {
        missingMedia.add(`${mediaId} (${context})`);
        console.log(`  ❌ Missing: ${mediaId} (${context})`);
      } else {
        console.log(`  ✓ Found: ${mediaId} (${context})`);
      }
    }
  }
  
  // Check welcome media
  if (content.welcomeMedia) {
    console.log('\nWelcome Page:');
    content.welcomeMedia.forEach(m => {
      checkMedia(m.id, `welcome ${m.type}`);
    });
  }
  
  // Check topic media
  content.topics.forEach((topic, index) => {
    console.log(`\nTopic ${index} (${topic.title}):`);
    
    if (topic.media) {
      topic.media.forEach(m => {
        checkMedia(m.id, `topic ${index} ${m.type}`);
      });
    }
    
    if (topic.narration) {
      // Extract media ID from URL if present
      const audioMatch = topic.narration.audioUrl?.match(/(audio-\d+)/);
      const captionMatch = topic.narration.captionUrl?.match(/(caption-\d+)/);
      
      if (audioMatch) {
        checkMedia(audioMatch[1], `topic ${index} audio`);
      }
      if (captionMatch) {
        checkMedia(captionMatch[1], `topic ${index} caption`);
      }
    }
  });
  
  // Summary
  console.log('\n=== Media Usage Summary ===');
  console.log(`Total media files: ${mediaMap.size}`);
  console.log(`Used media references: ${usedMedia.size}`);
  console.log(`Missing media references: ${missingMedia.size}`);
  
  // Find unused media
  const unusedMedia = [];
  for (const [mediaId] of mediaMap) {
    if (!usedMedia.has(mediaId)) {
      unusedMedia.push(mediaId);
    }
  }
  
  if (unusedMedia.length > 0) {
    console.log(`\nUnused media files (${unusedMedia.length}):`);
    unusedMedia.forEach(id => console.log(`  - ${id}`));
  }
}

// Main execution
async function main() {
  try {
    console.log('=== SCORM Project Analysis ===\n');
    
    // Load project data
    const projectData = await loadProjectData();
    
    // Analyze media files
    const mediaMap = await analyzeMediaFiles();
    
    // Analyze project content
    await analyzeProjectContent(projectData);
    
    // Cross-reference media
    crossReferenceMedia(projectData, mediaMap);
    
    console.log('\n=== Analysis Complete ===');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the analysis
main();