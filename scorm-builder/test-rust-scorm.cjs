/**
 * Test script to generate SCORM using the Rust backend
 * This script simulates what the frontend does when calling generateRustSCORM
 */

const fs = require('fs').promises;
const path = require('path');

// Project paths
const PROJECT_ID = '192cbdd6-8b7e-44a8-a4a6-ea46665edbf4';
const PROJECT_PATH = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural Gas Safety.scormproj';
const MEDIA_DIR = `C:\\Users\\sierr\\Documents\\SCORM Projects\\${PROJECT_ID}\\media`;
const OUTPUT_DIR = 'C:\\Users\\sierr\\Desktop\\SCORM-Builder\\scorm-builder\\test-output';

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

async function loadMediaFiles() {
  console.log('\nLoading media files from:', MEDIA_DIR);
  const mediaFiles = [];
  
  const files = await fs.readdir(MEDIA_DIR);
  
  for (const file of files) {
    if (file.endsWith('.bin')) {
      const baseName = file.replace('.bin', '');
      const metadataPath = path.join(MEDIA_DIR, `${baseName}.json`);
      
      try {
        // Read metadata to get mime type
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        
        // Read actual file content
        const filePath = path.join(MEDIA_DIR, file);
        const content = await fs.readFile(filePath);
        
        // Determine proper extension
        const ext = MIME_TO_EXT[metadata.mime_type] || 'bin';
        const properFilename = `${baseName}.${ext}`;
        
        mediaFiles.push({
          filename: properFilename,
          content: Array.from(content), // Convert to array for JSON serialization
        });
        
        console.log(`Loaded ${properFilename} (${metadata.type}, ${content.length} bytes)`);
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
      }
    }
  }
  
  console.log(`Total media files loaded: ${mediaFiles.length}`);
  return mediaFiles;
}

/**
 * Convert the old course_content structure to the format expected by Rust
 */
function convertToRustFormat(projectData) {
  const content = projectData.course_content;
  const courseData = projectData.course_data;
  
  // Build welcome page
  const welcomeAudio = content.audioNarration?.welcomePage || {};
  const welcomePage = content.welcome ? {
    title: content.welcome.title || 'Welcome',
    content: content.welcome.content || '',
    start_button_text: 'Start Course',
    audio_file: welcomeAudio.audioId || 'audio-0',
    caption_file: welcomeAudio.captionId || 'caption-0',
    image_url: content['media_image-0']?.url || null,
    media: content.welcome.media || null
  } : null;
  
  // Build objectives page
  let objectives = [];
  
  // Extract objectives from the HTML content
  const objContent = content['learning-objectives'] || content.learningObjectivesPage;
  if (objContent && objContent.content) {
    // Extract <li> items from the content HTML
    const matches = objContent.content.matchAll(/<li>([^<]+)<\/li>/g);
    objectives = Array.from(matches).map(match => match[1].trim());
  }
  
  const objectivesAudio = content.audioNarration?.learningObjectivesPage || {};
  const objectivesPage = objectives.length > 0 ? {
    objectives: objectives,
    audio_file: objectivesAudio.audioId || 'audio-1',
    caption_file: objectivesAudio.captionId || 'caption-1',
    media: null
  } : null;
  
  // Build topics
  const topics = [];
  
  // Get topic IDs from course_data
  const topicIds = courseData.topics || [];
  console.log('Topic IDs from course_data:', topicIds);
  
  // Get audio narration data
  const audioNarrationTopics = content.audioNarration?.topics || [];
  
  // Map each topic ID to its content
  topicIds.forEach((topicId, i) => {
    // Topics are stored as content-N where N is the index + 2
    const contentKey = `content-${i + 2}`;
    const topicContent = content[contentKey];
    console.log(`Looking for ${contentKey}:`, topicContent ? 'Found' : 'Not found');
    
    if (topicContent) {
      // Get audio/caption IDs from audioNarration
      const audioData = audioNarrationTopics[i] || {};
      
      const topic = {
        id: topicContent.id || `topic-${i}`,
        title: topicContent.title,
        content: topicContent.content,
        audio_file: audioData.audioId || `audio-${i + 2}`,
        caption_file: audioData.captionId || `caption-${i + 2}`,
        image_url: content[`media_image-${i + 2}`]?.url || null,
        media: topicContent.media || null
      };
      
      // Add knowledge check if present
      if (topicContent.knowledgeCheck) {
        const kc = topicContent.knowledgeCheck;
        topic.knowledge_check = {
          enabled: true,
          questions: kc.questions ? kc.questions.map(q => ({
            type: q.type,
            text: q.question || q.text,
            options: q.options || null,
            correct_answer: String(q.correctAnswer),
            explanation: q.feedback?.incorrect || q.feedback?.correct || ''
          })) : [{
            type: kc.type,
            text: kc.question || kc.text,
            options: kc.options || null,
            correct_answer: String(kc.correctAnswer),
            explanation: kc.feedback?.incorrect || kc.feedback?.correct || ''
          }]
        };
      }
      
      topics.push(topic);
    }
  });
  
  // Build assessment
  const assessment = content.assessment ? {
    questions: content.assessment.questions.map(q => ({
      type: q.type || 'multiple-choice',
      text: q.question || q.text,
      options: q.options,
      correct_answer: String(q.correctAnswer),
      explanation: q.feedback?.incorrect || q.feedback?.correct || ''
    }))
  } : null;
  
  return {
    course_title: courseData.title,
    course_description: '',
    pass_mark: content.assessment?.passMark || 80,
    navigation_mode: 'linear',
    allow_retake: true,
    welcome_page: welcomePage,
    learning_objectives_page: objectivesPage,
    topics: topics,
    assessment: assessment
  };
}

async function main() {
  try {
    console.log('=== SCORM Rust Backend Test ===\n');
    
    // Load project data
    const projectData = await loadProjectData();
    
    // Load media files
    const mediaFiles = await loadMediaFiles();
    
    // Convert to Rust format
    const rustCourseData = convertToRustFormat(projectData);
    
    console.log('\n=== Course Structure ===');
    console.log('Title:', rustCourseData.course_title);
    console.log('Topics:', rustCourseData.topics.length);
    console.log('Has welcome page:', !!rustCourseData.welcome_page);
    console.log('Has objectives:', !!rustCourseData.learning_objectives_page);
    console.log('Has assessment:', !!rustCourseData.assessment);
    
    // Count knowledge checks
    let kcCount = 0;
    rustCourseData.topics.forEach((topic, i) => {
      if (topic.knowledge_check) {
        console.log(`Topic ${i} has ${topic.knowledge_check.questions.length} KC questions`);
        kcCount += topic.knowledge_check.questions.length;
      }
    });
    console.log('Total knowledge check questions:', kcCount);
    
    // Save the request data for debugging
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    const requestData = {
      courseData: rustCourseData,
      projectId: PROJECT_ID,
      mediaFiles: mediaFiles
    };
    
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'rust-request.json'),
      JSON.stringify(requestData, null, 2)
    );
    
    console.log('\nRequest data saved to:', path.join(OUTPUT_DIR, 'rust-request.json'));
    console.log('\nTo test with Tauri, you can use this data with the generate_scorm_enhanced command');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
main();