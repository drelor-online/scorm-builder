/**
 * Test script to generate SCORM packages directly from project data
 * This bypasses the GUI to allow rapid debugging of SCORM generation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
// DEPRECATED: spaceEfficientScormGenerator has been removed
// import { generateSpaceEfficientScorm } from './src/services/spaceEfficientScormGeneratorEnhanced';
console.error('This test script needs to be updated to use rustScormGenerator');
process.exit(1);
import type { CourseContent } from './src/types/course';
import { exec } from 'child_process';
import { promisify } from 'util';
import JSZip from 'jszip';

const execAsync = promisify(exec);

// Project paths
const PROJECT_ID = '192cbdd6-8b7e-44a8-a4a6-ea46665edbf4';
const PROJECT_PATH = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural Gas Safety.scormproj';
const MEDIA_DIR = `C:\\Users\\sierr\\Documents\\SCORM Projects\\${PROJECT_ID}\\media`;
const OUTPUT_DIR = 'C:\\Users\\sierr\\Desktop\\SCORM-Builder\\scorm-builder\\test-output';

// MIME type to extension mapping
const MIME_TO_EXT: Record<string, string> = {
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

interface MediaFile {
  filename: string;
  content: Uint8Array;
}

async function loadProjectData() {
  console.log('Loading project data from:', PROJECT_PATH);
  const projectContent = await fs.readFile(PROJECT_PATH, 'utf-8');
  const projectData = JSON.parse(projectContent);
  console.log('Project loaded:', projectData.project.name);
  return projectData;
}

async function loadMediaFiles(): Promise<MediaFile[]> {
  console.log('Loading media files from:', MEDIA_DIR);
  const mediaFiles: MediaFile[] = [];
  
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
          content: new Uint8Array(content),
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

async function generateSCORM(projectData: any, mediaFiles: MediaFile[]) {
  console.log('\n--- Generating SCORM Package ---');
  
  // Extract course content
  const courseContent = projectData.course_content as CourseContent;
  
  console.log('Course content summary:');
  console.log('- Title:', courseContent.metadata.title);
  console.log('- Topics:', courseContent.topics.length);
  console.log('- Assessment questions:', courseContent.assessment?.questions?.length || 0);
  
  // Create a media blob map
  const mediaBlobMap = new Map<string, Blob>();
  
  // Process media files and create blobs
  for (const mediaFile of mediaFiles) {
    const blob = new Blob([mediaFile.content]);
    const mediaId = mediaFile.filename.split('.')[0]; // e.g., "image-0" from "image-0.jpg"
    mediaBlobMap.set(mediaId, blob);
    
    // Also create URL-based entry for the generator
    const url = `blob:file:///${mediaId}`;
    mediaBlobMap.set(url, blob);
  }
  
  console.log('\nMedia blob map created with', mediaBlobMap.size, 'entries');
  
  // Log media references in content
  console.log('\nMedia references in content:');
  console.log('- Welcome media:', courseContent.welcomeMedia);
  
  courseContent.topics.forEach((topic, index) => {
    console.log(`\nTopic ${index}:`);
    console.log('  - Title:', topic.title);
    console.log('  - Media items:', topic.media?.length || 0);
    if (topic.media) {
      topic.media.forEach(m => {
        console.log(`    - ${m.type}: ${m.id}`);
      });
    }
  });
  
  try {
    // Generate SCORM package using the space-efficient generator
    console.log('\nCalling generateSpaceEfficientScorm...');
    const scormZip = await generateSpaceEfficientScorm(
      courseContent,
      PROJECT_ID,
      mediaBlobMap
    );
    
    // Convert JSZip to buffer
    const scormBuffer = await scormZip.generateAsync({ 
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
    
    // Save the output
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(OUTPUT_DIR, 'test-scorm.zip');
    await fs.writeFile(outputPath, Buffer.from(scormBuffer));
    
    console.log(`\nSCORM package saved to: ${outputPath}`);
    console.log(`Package size: ${scormBuffer.length} bytes`);
    
    return outputPath;
  } catch (error) {
    console.error('Error generating SCORM:', error);
    throw error;
  }
}

async function analyzeZipContents(zipPath: string) {
  console.log('\n--- Analyzing ZIP Contents ---');
  
  const extractDir = path.join(OUTPUT_DIR, 'extracted');
  await fs.mkdir(extractDir, { recursive: true });
  
  // Extract ZIP using PowerShell (Windows)
  const extractCmd = `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractDir}" -Force`;
  await execAsync(`powershell -Command "${extractCmd}"`);
  
  // List all files
  async function listFiles(dir: string, prefix = ''): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        console.log(`${prefix}📁 ${entry.name}/`);
        await listFiles(fullPath, prefix + '  ');
      } else {
        const stats = await fs.stat(fullPath);
        console.log(`${prefix}📄 ${entry.name} (${stats.size} bytes)`);
        
        // Check if audio/caption files are empty
        if (entry.name.match(/\.(mp3|vtt)$/) && stats.size === 0) {
          console.log(`${prefix}   ⚠️ WARNING: Empty file!`);
        }
      }
    }
  }
  
  await listFiles(extractDir);
  
  // Check specific files
  console.log('\n--- Checking Key Files ---');
  
  // Check index.html
  const indexPath = path.join(extractDir, 'index.html');
  if (await fs.stat(indexPath).catch(() => false)) {
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    console.log('\nindex.html preview:');
    console.log(indexContent.substring(0, 500) + '...');
    
    // Check for knowledge check elements
    const kcCount = (indexContent.match(/knowledge-check/g) || []).length;
    console.log(`\nKnowledge check references: ${kcCount}`);
    
    // Check for media references
    const audioRefs = (indexContent.match(/audio-\d+\.(mp3|bin)/g) || []);
    const imageRefs = (indexContent.match(/image-\d+\.(jpg|png|svg|bin)/g) || []);
    console.log(`Audio references: ${audioRefs.length}`);
    console.log(`Image references: ${imageRefs.length}`);
  }
}

// Main execution
async function main() {
  try {
    console.log('=== SCORM Generation Test ===\n');
    
    // Load project data
    const projectData = await loadProjectData();
    
    // Load media files
    const mediaFiles = await loadMediaFiles();
    
    // Generate SCORM package
    const zipPath = await generateSCORM(projectData, mediaFiles);
    
    // Analyze the output
    await analyzeZipContents(zipPath);
    
    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
main();