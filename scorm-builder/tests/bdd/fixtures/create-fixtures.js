import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a small 1x1 pixel red JPEG image
const redPixelJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=', 'base64');

// Create test images
fs.writeFileSync(path.join(__dirname, 'images', 'test-image.jpg'), redPixelJpeg);
fs.writeFileSync(path.join(__dirname, 'images', 'image1.jpg'), redPixelJpeg);
fs.writeFileSync(path.join(__dirname, 'images', 'image2.jpg'), redPixelJpeg);
fs.writeFileSync(path.join(__dirname, 'images', 'image3.jpg'), redPixelJpeg);
fs.writeFileSync(path.join(__dirname, 'images', 'replacement.jpg'), redPixelJpeg);

// Create a larger image (simulate 5MB)
const largeImage = Buffer.alloc(5 * 1024 * 1024);
largeImage[0] = 0xFF; // JPEG magic bytes
largeImage[1] = 0xD8;
fs.writeFileSync(path.join(__dirname, 'images', 'large-image.jpg'), largeImage);
fs.writeFileSync(path.join(__dirname, 'images', 'large-5mb.jpg'), largeImage);

// Create test audio file (WAV header with minimal data)
const wavHeader = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x24, 0x00, 0x00, 0x00, // file size
  0x57, 0x41, 0x56, 0x45, // "WAVE"
  0x66, 0x6D, 0x74, 0x20, // "fmt "
  0x10, 0x00, 0x00, 0x00, // format chunk size
  0x01, 0x00, // audio format (PCM)
  0x01, 0x00, // number of channels
  0x44, 0xAC, 0x00, 0x00, // sample rate (44100)
  0x88, 0x58, 0x01, 0x00, // byte rate
  0x02, 0x00, // block align
  0x10, 0x00, // bits per sample
  0x64, 0x61, 0x74, 0x61, // "data"
  0x00, 0x00, 0x00, 0x00  // data size
]);

fs.writeFileSync(path.join(__dirname, 'audio', 'test-audio.wav'), wavHeader);
fs.writeFileSync(path.join(__dirname, 'audio', 'narration.wav'), wavHeader);
fs.writeFileSync(path.join(__dirname, 'audio', 'welcome.wav'), wavHeader);

// Create test caption files (VTT format)
const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
This is a test caption.

00:00:05.000 --> 00:00:10.000
This is another test caption.
`;

fs.writeFileSync(path.join(__dirname, 'captions', 'test-captions.vtt'), vttContent);
fs.writeFileSync(path.join(__dirname, 'captions', 'narration.vtt'), vttContent);

// Create test JSON course data
const courseData = {
  title: "Test Course",
  description: "This is a test course for BDD testing",
  topics: [
    {
      title: "Topic 1",
      content: "Content for topic 1"
    },
    {
      title: "Topic 2", 
      content: "Content for topic 2"
    }
  ],
  assessment: {
    questions: [
      {
        type: "multiple-choice",
        question: "Test question?",
        options: ["Option A", "Option B", "Option C"],
        correct: 0
      }
    ]
  }
};

fs.writeFileSync(
  path.join(__dirname, 'json', 'valid-course.json'),
  JSON.stringify(courseData, null, 2)
);

// Create invalid JSON
fs.writeFileSync(
  path.join(__dirname, 'json', 'invalid-course.json'),
  '{ "title": "Invalid JSON", "missing_closing_brace": '
);

// Create invalid file type (PDF header)
const pdfHeader = Buffer.from('%PDF-1.4\n');
fs.writeFileSync(path.join(__dirname, 'invalid', 'document.pdf'), pdfHeader);

// Create a text file for testing wrong file types
fs.writeFileSync(path.join(__dirname, 'invalid', 'document.txt'), 'This is a text file');

console.log('Test fixtures created successfully!');