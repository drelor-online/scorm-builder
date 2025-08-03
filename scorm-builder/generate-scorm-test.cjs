/**
 * Generate a test SCORM package using the prepared data
 * This script generates a SCORM package and analyzes its contents
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

async function generateAndAnalyzeSCORM() {
  try {
    console.log('=== SCORM Generation Test ===\n');
    
    // Load the prepared request data
    const requestData = await fs.readFile('./test-output/rust-request.json', 'utf-8');
    const parsed = JSON.parse(requestData);
    
    console.log('Loaded course:', parsed.courseData.course_title);
    console.log('Topics:', parsed.courseData.topics.length);
    console.log('Media files:', parsed.mediaFiles.length);
    
    // The actual Rust SCORM generation would happen here
    // For now, we'll analyze what the generated package should contain
    
    console.log('\n=== Expected SCORM Package Structure ===');
    console.log('index.html - Main entry point');
    console.log('imsmanifest.xml - SCORM manifest');
    console.log('navigation.js - Navigation logic');
    console.log('media/ - Media files directory');
    
    // List expected media files
    console.log('\n=== Expected Media Files ===');
    parsed.mediaFiles.forEach(file => {
      console.log(`media/${file.filename}`);
    });
    
    // Analyze knowledge check structure
    console.log('\n=== Knowledge Check Analysis ===');
    parsed.courseData.topics.forEach((topic, i) => {
      if (topic.knowledge_check && topic.knowledge_check.questions) {
        const kc = topic.knowledge_check.questions[0];
        console.log(`\nTopic ${i}: ${topic.title}`);
        console.log(`- Question type: ${kc.type}`);
        console.log(`- Question: ${kc.text ? kc.text.substring(0, 50) + '...' : 'N/A'}`);
        console.log(`- Has options: ${kc.options ? 'Yes' : 'No'}`);
        console.log(`- Correct answer: ${kc.correct_answer}`);
      }
    });
    
    // Check audio/caption references
    console.log('\n=== Audio/Caption References ===');
    const audioRefs = new Set();
    const captionRefs = new Set();
    
    if (parsed.courseData.welcome_page) {
      audioRefs.add(parsed.courseData.welcome_page.audio_file);
      captionRefs.add(parsed.courseData.welcome_page.caption_file);
    }
    
    if (parsed.courseData.learning_objectives_page) {
      audioRefs.add(parsed.courseData.learning_objectives_page.audio_file);
      captionRefs.add(parsed.courseData.learning_objectives_page.caption_file);
    }
    
    parsed.courseData.topics.forEach(topic => {
      if (topic.audio_file) audioRefs.add(topic.audio_file);
      if (topic.caption_file) captionRefs.add(topic.caption_file);
    });
    
    console.log(`Audio files referenced: ${Array.from(audioRefs).join(', ')}`);
    console.log(`Caption files referenced: ${Array.from(captionRefs).join(', ')}`);
    
    // Check that all referenced files exist
    console.log('\n=== Media File Validation ===');
    let missingFiles = 0;
    
    audioRefs.forEach(ref => {
      const found = parsed.mediaFiles.find(f => f.filename === `${ref}.mp3`);
      if (!found) {
        console.log(`❌ Missing audio file: ${ref}.mp3`);
        missingFiles++;
      } else {
        console.log(`✓ Found audio file: ${ref}.mp3`);
      }
    });
    
    captionRefs.forEach(ref => {
      const found = parsed.mediaFiles.find(f => f.filename === `${ref}.vtt`);
      if (!found) {
        console.log(`❌ Missing caption file: ${ref}.vtt`);
        missingFiles++;
      } else {
        console.log(`✓ Found caption file: ${ref}.vtt`);
      }
    });
    
    if (missingFiles === 0) {
      console.log('\n✅ All referenced media files are present!');
    } else {
      console.log(`\n❌ ${missingFiles} media files are missing!`);
    }
    
    // Save a summary report
    const report = {
      course: parsed.courseData.course_title,
      topics: parsed.courseData.topics.length,
      knowledgeChecks: parsed.courseData.topics.filter(t => t.knowledge_check).length,
      mediaFiles: parsed.mediaFiles.length,
      audioFiles: parsed.mediaFiles.filter(f => f.filename.endsWith('.mp3')).length,
      captionFiles: parsed.mediaFiles.filter(f => f.filename.endsWith('.vtt')).length,
      imageFiles: parsed.mediaFiles.filter(f => f.filename.match(/\.(jpg|png|svg)$/)).length,
      validation: {
        allAudioPresent: Array.from(audioRefs).every(ref => 
          parsed.mediaFiles.find(f => f.filename === `${ref}.mp3`)
        ),
        allCaptionsPresent: Array.from(captionRefs).every(ref => 
          parsed.mediaFiles.find(f => f.filename === `${ref}.vtt`)
        )
      }
    };
    
    await fs.writeFile(
      './test-output/scorm-analysis.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\nAnalysis report saved to: ./test-output/scorm-analysis.json');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
generateAndAnalyzeSCORM();