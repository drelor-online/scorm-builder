const { generateWelcomePage } = require('./dist/services/spaceEfficientScormGeneratorPages.js');

const mockCourseContent = {
  welcome: {
    title: 'Test',
    content: 'Test content',
    audioFile: 'test.mp3',
    captionFile: 'test.vtt',
    media: []
  }
};

const html = generateWelcomePage(mockCourseContent);
const captionIndex = html.indexOf('captionContainer');
if (captionIndex > -1) {
  console.log('Caption container found at index:', captionIndex);
  console.log('Snippet:', html.substring(captionIndex - 50, captionIndex + 100));
} else {
  console.log('Caption container NOT found');
}
