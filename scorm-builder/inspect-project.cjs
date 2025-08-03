/**
 * Simple script to inspect the project structure
 */

const fs = require('fs').promises;
const path = require('path');

const PROJECT_PATH = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural Gas Safety.scormproj';

async function main() {
  try {
    const projectContent = await fs.readFile(PROJECT_PATH, 'utf-8');
    const projectData = JSON.parse(projectContent);
    
    console.log('=== Project Structure ===\n');
    
    // Basic info
    console.log('Project Name:', projectData.project?.name);
    console.log('Project ID:', projectData.project?.id);
    
    // Course content structure
    console.log('\n=== Course Content Structure ===');
    const content = projectData.course_content;
    if (content) {
      console.log('Keys:', Object.keys(content));
      
      // Check metadata
      if (content.metadata) {
        console.log('\nMetadata:', JSON.stringify(content.metadata, null, 2));
      }
      
      // Check topics
      if (content.topics) {
        console.log(`\nTopics (${content.topics.length}):`);
        content.topics.forEach((topic, i) => {
          console.log(`\n  Topic ${i}:`);
          console.log(`    Title: ${topic.title}`);
          console.log(`    ID: ${topic.id}`);
          console.log(`    Has media: ${topic.media ? 'Yes' : 'No'}`);
          console.log(`    Has narration: ${topic.narration ? 'Yes' : 'No'}`);
          console.log(`    Has knowledge checks: ${topic.knowledgeChecks ? topic.knowledgeChecks.length : 0}`);
          
          if (topic.narration) {
            console.log(`    Narration audio: ${topic.narration.audioUrl || 'none'}`);
            console.log(`    Narration caption: ${topic.narration.captionUrl || 'none'}`);
          }
          
          if (topic.media && topic.media.length > 0) {
            console.log('    Media items:');
            topic.media.forEach(m => {
              console.log(`      - ${m.type}: ${m.id}`);
            });
          }
        });
      }
      
      // Check welcome media
      if (content.welcomeMedia) {
        console.log('\nWelcome Media:');
        content.welcomeMedia.forEach(m => {
          console.log(`  - ${m.type}: ${m.id}`);
        });
      }
      
      // Check assessment
      if (content.assessment) {
        console.log('\nAssessment:');
        console.log('  Questions:', content.assessment.questions?.length || 0);
      }
    }
    
    // Save full structure for reference
    await fs.writeFile(
      'project-structure.json', 
      JSON.stringify(projectData, null, 2),
      'utf-8'
    );
    console.log('\nFull structure saved to project-structure.json');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();