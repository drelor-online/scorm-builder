/**
 * Call the Rust SCORM generation endpoint directly
 * This simulates what the Tauri invoke() function does
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

async function callRustSCORM() {
  try {
    // Load the request data
    const requestData = await fs.readFile('./test-output/rust-request.json', 'utf-8');
    const parsed = JSON.parse(requestData);
    
    console.log('Loaded request data:');
    console.log(`- Course: ${parsed.courseData.course_title}`);
    console.log(`- Topics: ${parsed.courseData.topics.length}`);
    console.log(`- Media files: ${parsed.mediaFiles.length}`);
    
    // Check knowledge checks
    let kcCount = 0;
    parsed.courseData.topics.forEach((topic, i) => {
      if (topic.knowledge_check && topic.knowledge_check.questions) {
        console.log(`Topic ${i}: ${topic.knowledge_check.questions.length} KC questions`);
        kcCount += topic.knowledge_check.questions.length;
      }
    });
    console.log(`Total KC questions: ${kcCount}`);
    
    // Since we can't directly call Rust from Node.js, let's analyze the data structure
    console.log('\nAnalyzing data structure for Rust compatibility:');
    
    // Check first topic structure
    const firstTopic = parsed.courseData.topics[0];
    console.log('\nFirst topic structure:');
    console.log('- id:', firstTopic.id);
    console.log('- title:', firstTopic.title);
    console.log('- content length:', firstTopic.content?.length || 0);
    console.log('- audio_file:', firstTopic.audio_file);
    console.log('- caption_file:', firstTopic.caption_file);
    console.log('- image_url:', firstTopic.image_url);
    console.log('- knowledge_check:', firstTopic.knowledge_check ? 'Present' : 'Missing');
    
    if (firstTopic.knowledge_check) {
      const firstQuestion = firstTopic.knowledge_check.questions[0];
      console.log('\nFirst KC question structure:');
      console.log('- type:', firstQuestion.type);
      console.log('- text:', firstQuestion.text);
      console.log('- options:', firstQuestion.options);
      console.log('- correct_answer:', firstQuestion.correct_answer);
      console.log('- explanation:', firstQuestion.explanation?.substring(0, 50) + '...');
    }
    
    // Check media files
    console.log('\nMedia files check:');
    const audioFiles = parsed.mediaFiles.filter(f => f.filename.endsWith('.mp3'));
    const captionFiles = parsed.mediaFiles.filter(f => f.filename.endsWith('.vtt'));
    const imageFiles = parsed.mediaFiles.filter(f => f.filename.match(/\.(jpg|png|svg)$/));
    
    console.log(`- Audio files: ${audioFiles.length}`);
    console.log(`- Caption files: ${captionFiles.length}`);
    console.log(`- Image files: ${imageFiles.length}`);
    
    // Check if audio files are referenced correctly
    const audioRefs = new Set();
    const captionRefs = new Set();
    
    if (parsed.courseData.welcome_page) {
      if (parsed.courseData.welcome_page.audio_file) audioRefs.add(parsed.courseData.welcome_page.audio_file);
      if (parsed.courseData.welcome_page.caption_file) captionRefs.add(parsed.courseData.welcome_page.caption_file);
    }
    
    parsed.courseData.topics.forEach(topic => {
      if (topic.audio_file) audioRefs.add(topic.audio_file);
      if (topic.caption_file) captionRefs.add(topic.caption_file);
    });
    
    console.log(`\nReferenced audio files: ${audioRefs.size}`);
    console.log(`Referenced caption files: ${captionRefs.size}`);
    
    // Save a cleaned version for manual testing
    const cleanedData = {
      courseData: parsed.courseData,
      projectId: parsed.projectId,
      mediaFiles: parsed.mediaFiles.map(f => ({
        filename: f.filename,
        content_length: f.content.length
      }))
    };
    
    await fs.writeFile(
      './test-output/rust-request-clean.json',
      JSON.stringify(cleanedData, null, 2)
    );
    
    console.log('\nCleaned request data saved to: ./test-output/rust-request-clean.json');
    console.log('This can be used to manually test the Rust SCORM generation.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
callRustSCORM();