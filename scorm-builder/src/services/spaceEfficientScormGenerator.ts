import JSZip from 'jszip'
import { generateEnhancedTopicPage, generateAssessmentPage, generateEnhancedMainCss } from './spaceEfficientScormGeneratorEnhanced'
import { generateEnhancedNavigationJs } from './spaceEfficientScormGeneratorNavigation'
import { generateWelcomePage, generateObjectivesPage } from './spaceEfficientScormGeneratorPages'
import { adjustCaptionTiming } from './captionTimingAdjuster'

// Helper function to read blob as text
async function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text()
  }
  // Fallback for test environment
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(blob)
  })
}

// Export topic type for tests
export type EnhancedTopic = EnhancedCourseContent['topics'][0]

export interface EnhancedCourseContent {
  title: string
  duration: number // minutes
  passMark: number // percentage
  navigationMode: "linear" | "free"
  allowRetake: boolean
  welcome: {
    title: string
    content: string
    startButtonText: string
    imageUrl?: string
    audioFile?: string
    audioBlob?: Blob
    captionFile?: string
    captionBlob?: Blob
    embedUrl?: string
    media?: Array<{
      id: string
      url: string
      title: string
      type: 'image' | 'video' | 'audio'
      embedUrl?: string
      blob?: Blob
      captionUrl?: string
      captionBlob?: Blob
    }>
  }
  objectives: string[]
  objectivesPage?: {
    imageUrl?: string
    audioFile?: string
    audioBlob?: Blob
    captionFile?: string
    captionBlob?: Blob
    embedUrl?: string
    media?: Array<{
      id: string
      url: string
      title: string
      type: 'image' | 'video' | 'audio'
      embedUrl?: string
      blob?: Blob
      captionUrl?: string
      captionBlob?: Blob
    }>
  }
  topics: Array<{
    id: string
    title: string
    content: string
    imageUrl?: string
    audioFile?: string
    audioBlob?: Blob
    captionFile?: string
    captionBlob?: Blob
    embedUrl?: string
    knowledgeCheck?: {
      type?: 'multiple-choice' | 'true-false' | 'fill-in-the-blank'
      question?: string
      blank?: string // For fill-in-the-blank: question with _____
      options?: string[]
      correctAnswer: number | string // number for MC/TF, string for fill-in-blank
      explanation?: string
      // Support for multiple questions
      questions?: Array<{
        id?: string
        type: 'multiple-choice' | 'true-false' | 'fill-in-the-blank'
        question: string
        blank?: string
        options?: string[]
        correctAnswer: number | string
        explanation?: string
      }>
    }
    media?: Array<{
      id: string
      url: string
      title: string
      type: 'image' | 'video' | 'audio'
      embedUrl?: string
      blob?: Blob
      captionUrl?: string
      captionBlob?: Blob
    }>
  }>
  assessment: {
    questions: Array<{
      id: string
      question: string
      options: string[]
      correctAnswer: number
    }>
  }
  audioDurations?: Record<string, number> // Map of audio file names to their durations in seconds
}

export interface GeneratorResult {
  buffer: Uint8Array
}

/**
 * Generates a space-efficient SCORM 1.2 package with sidebar navigation
 * Based on the space-efficient-mockup-2.html design
 */
// Helper function to get file extension from blob type or media metadata
const getFileExtension = (blob: Blob | undefined, media?: any): string => {
  if (!blob) return 'jpg';
  
  const mimeType = blob.type ? blob.type.toLowerCase() : '';
  console.log('Blob MIME type:', mimeType, 'Media:', media);
  
  // First check if we have a filename with extension in metadata
  if (media?.metadata?.fileName) {
    const match = media.metadata.fileName.match(/\.([^.]+)$/);
    if (match) {
      const ext = match[1].toLowerCase();
      console.log('Using extension from filename:', ext);
      return ext;
    }
  }
  
  // Then check MIME type
  if (mimeType && mimeType !== 'application/octet-stream') {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('svg')) return 'svg';
  }
  
  // For application/octet-stream or empty MIME type, try to guess from URL
  if (media?.url) {
    const urlMatch = media.url.match(/\.([^.?]+)(\?|$)/);
    if (urlMatch) {
      const ext = urlMatch[1].toLowerCase();
      console.log('Using extension from URL:', ext);
      return ext;
    }
  }
  
  // Check if media has an id that might indicate file type
  if (media?.id) {
    const idMatch = media.id.match(/\.([^.]+)$/);
    if (idMatch) {
      const ext = idMatch[1].toLowerCase();
      console.log('Using extension from media ID:', ext);
      return ext;
    }
  }
  
  // Default to jpg if unknown
  console.warn('Could not determine file extension, defaulting to jpg');
  return 'jpg';
};

export async function generateSpaceEfficientSCORM12Buffer(
  courseContent: EnhancedCourseContent,
  _storage?: any // Optional PersistentStorage instance
): Promise<GeneratorResult> {
  const zip = new JSZip()
  
  // Pre-process media to determine file extensions
  if (courseContent.welcome.media) {
    for (const media of courseContent.welcome.media) {
      if (media.type === 'image' && media.blob) {
        (media as any).fileExtension = getFileExtension(media.blob, media);
      }
    }
  }
  
  if (courseContent.objectivesPage?.media) {
    for (const media of courseContent.objectivesPage.media) {
      if (media.type === 'image' && media.blob) {
        (media as any).fileExtension = getFileExtension(media.blob, media);
      }
    }
  }
  
  for (const topic of courseContent.topics) {
    if (topic.media) {
      for (const media of topic.media) {
        if (media.type === 'image' && media.blob) {
          (media as any).fileExtension = getFileExtension(media.blob, media);
        }
      }
    }
  }
  
  // Create folder structure
  zip.folder('pages')
  zip.folder('media')
  zip.folder('media/images')
  zip.folder('media/audio')
  zip.folder('media/captions')
  zip.folder('scripts')
  zip.folder('styles')
  zip.folder('assets')
  
  // Generate manifest
  const manifest = generateManifest(courseContent)
  zip.file('imsmanifest.xml', manifest)
  
  // Generate main index.html with sidebar navigation
  const indexHtml = generateIndexHtml(courseContent)
  zip.file('index.html', indexHtml)
  
  // Generate welcome page
  const welcomeHtml = generateWelcomePage(courseContent)
  zip.file('pages/welcome.html', welcomeHtml)
  
  // Generate objectives page
  const objectivesHtml = generateObjectivesPage(courseContent)
  zip.file('pages/objectives.html', objectivesHtml)
  
  // Generate individual topic pages with enhanced media support
  courseContent.topics.forEach((topic, index) => {
    const topicHtml = generateEnhancedTopicPage(topic, index, courseContent)
    zip.file(`pages/topic-${index + 1}.html`, topicHtml)
  })
  
  // Generate assessment page
  const assessmentHtml = generateAssessmentPage(courseContent)
  zip.file('pages/assessment.html', assessmentHtml)
  
  // Generate CSS with all media styles
  const mainCss = generateEnhancedMainCss()
  zip.file('styles/main.css', mainCss)
  
  // Generate JavaScript files with course data
  const navigationJs = generateEnhancedNavigationJs()
  
  // Add course-specific data to navigation
  const courseDataJs = `
// Course-specific data
window.courseTopics = ${JSON.stringify(courseContent.topics.map((topic, idx) => ({
  id: topic.id,
  title: topic.title,
  index: idx,
  hasKnowledgeCheck: !!topic.knowledgeCheck,
  knowledgeCheck: topic.knowledgeCheck ? {
    correctAnswer: topic.knowledgeCheck.correctAnswer,
    explanation: topic.knowledgeCheck.explanation,
    questions: topic.knowledgeCheck.questions
  } : null
})))};

// Track which pages have answered questions
let answeredQuestions = {};
`;
  
  zip.file('scripts/navigation.js', courseDataJs + '\n\n' + navigationJs)
  
  const scormApiJs = generateScormApiJs()
  zip.file('scripts/scorm-api.js', scormApiJs)
  
  // Add media files
  await addMediaFiles(zip, courseContent)
  
  // Generate the zip buffer
  const buffer = await zip.generateAsync({ type: 'uint8array' })
  
  return { buffer }
}

function generateManifest(courseContent: EnhancedCourseContent): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${courseContent.title.replace(/\s+/g, '_')}_manifest" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
    http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  
  <organizations default="course_org">
    <organization identifier="course_org">
      <title>${courseContent.title}</title>
      <item identifier="course_item" identifierref="course_resource">
        <title>${courseContent.title}</title>
      </item>
    </organization>
  </organizations>
  
  <resources>
    <resource identifier="course_resource" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="styles/main.css"/>
      <file href="scripts/navigation.js"/>
      <file href="scripts/scorm-api.js"/>
      ${courseContent.topics.map((_, i) => `<file href="pages/topic-${i + 1}.html"/>`).join('\n      ')}
    </resource>
  </resources>
</manifest>`
}

function generateIndexHtml(courseContent: EnhancedCourseContent): string {
  const totalSections = 2 + courseContent.topics.length + 1 // welcome, objectives, topics, assessment
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${courseContent.title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Century+Gothic:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles/main.css">
</head>
<body>
    <aside class="sidebar">
        <div class="sidebar-header">
            <div class="progress-circle-container">
                <svg class="progress-circle" width="120" height="120" viewBox="0 0 120 120">
                    <circle class="progress-circle-bg" cx="60" cy="60" r="54" fill="none" stroke="#e9ecef" stroke-width="8"/>
                    <circle class="progress-circle-fill" cx="60" cy="60" r="54" fill="none" stroke="#8fbb40" stroke-width="8"
                            stroke-dasharray="339.292" stroke-dashoffset="339.292"
                            transform="rotate(-90 60 60)"/>
                    <text class="progress-circle-text" x="60" y="60" text-anchor="middle" dy=".3em" font-size="28" font-weight="bold" fill="#241f20">
                        <tspan id="progress-percentage">0</tspan><tspan font-size="20">%</tspan>
                    </text>
                </svg>
                <div class="progress-label">Course Progress</div>
            </div>
        </div>
        <nav class="sidebar-nav">
            <a href="#" class="nav-item active" id="nav-welcome" data-page="welcome">
                <span class="nav-number">1.</span> Welcome
            </a>
            <a href="#" class="nav-item" id="nav-objectives" data-page="objectives">
                <span class="nav-number">2.</span> Objectives
            </a>
            ${courseContent.topics.map((topic, i) => `
            <a href="#" class="nav-item" id="nav-topic-${i + 1}" data-page="topic-${i + 1}">
                <span class="nav-number">${i + 3}.</span> ${topic.title}
            </a>`).join('')}
            <a href="#" class="nav-item" id="nav-assessment" data-page="assessment">
                <span class="nav-number">${totalSections}.</span> Assessment
            </a>
        </nav>
    </aside>

    <main class="main-area">
        <div class="top-bar">
            <h1 class="chapter-info" id="current-title">Welcome</h1>
            <button class="fullscreen-btn" onclick="toggleFullscreen()">⛶ Fullscreen</button>
        </div>

        <div class="content-container">
            <div class="content-scroll">
                <div id="content-area">
                    <!-- Content will be loaded here dynamically -->
                </div>
            </div>
        </div>

        <footer class="nav-footer">
            <button class="nav-btn" id="prev-btn" onclick="navigatePrevious()" disabled>◀ Previous Topic</button>
            <button class="nav-btn" id="next-btn" onclick="navigateNext()">Next Topic ▶</button>
        </footer>
    </main>
    
    <script src="scripts/scorm-api.js"></script>
    <script src="scripts/navigation.js"></script>
    <script>
        // Initialize the course
        window.addEventListener('load', function() {
            initializeCourse();
            loadPage('welcome');
        });
    </script>
    
    <!-- Custom Alert Container -->
    <div id="scorm-alert-container"></div>
    
    <!-- Image Lightbox -->
    <div id="image-lightbox" class="lightbox-overlay" onclick="closeLightbox()">
        <div class="lightbox-content" onclick="event.stopPropagation()">
            <img id="lightbox-image" src="" alt="">
            <button class="lightbox-close" onclick="closeLightbox()">×</button>
        </div>
    </div>
</body>
</html>`
}

// generateTopicPage function removed - functionality moved to generateEnhancedTopicPage in spaceEfficientScormGeneratorEnhanced.ts

// generateMainCss function removed - functionality moved to generateEnhancedMainCss in spaceEfficientScormGeneratorEnhanced.ts

// generateNavigationJs function removed - functionality moved to generateEnhancedNavigationJs in spaceEfficientScormGeneratorNavigation.ts

function generateScormApiJs(): string {
  return `// SCORM 1.2 API Implementation
window.scormAPI = {
    LMSInitialize: function(param) {
        console.log('SCORM: Initialize', param);
        return "true";
    },
    
    LMSSetValue: function(element, value) {
        console.log('SCORM: SetValue', element, value);
        // Store values in localStorage for persistence
        localStorage.setItem('scorm_' + element, value);
        return "true";
    },
    
    LMSGetValue: function(element) {
        console.log('SCORM: GetValue', element);
        // Retrieve values from localStorage
        return localStorage.getItem('scorm_' + element) || "";
    },
    
    LMSCommit: function(param) {
        console.log('SCORM: Commit', param);
        return "true";
    },
    
    LMSFinish: function(param) {
        console.log('SCORM: Finish', param);
        return "true";
    },
    
    LMSGetLastError: function() {
        return "0";
    },
    
    LMSGetErrorString: function(errorCode) {
        return "No error";
    },
    
    LMSGetDiagnostic: function(errorCode) {
        return "No diagnostic information";
    }
};

// Make API available as both API and API_1484_11 for compatibility
window.API = window.scormAPI;`
}

async function addMediaFiles(zip: JSZip, courseContent: EnhancedCourseContent) {

  // Process welcome page media and audio
  if (courseContent.welcome.media) {
    for (const media of courseContent.welcome.media) {
      if (media.type === 'image' && media.blob) {
        // Extension should already be set during pre-processing
        const ext = (media as any).fileExtension || getFileExtension(media.blob, media);
        zip.file(`media/images/${media.id}.${ext}`, media.blob);
      }
    }
  }
  
  // Process welcome page audio
  if (courseContent.welcome.audioFile && courseContent.welcome.audioBlob) {
    zip.file(`media/audio/${courseContent.welcome.audioFile}`, courseContent.welcome.audioBlob);
  }
  
  // Process welcome page captions
  if (courseContent.welcome.captionFile && courseContent.welcome.captionBlob) {
    // Adjust caption timing if audio duration is provided
    let captionContent = await blobToText(courseContent.welcome.captionBlob)
    if (courseContent.audioDurations && courseContent.welcome.audioFile && courseContent.audioDurations[courseContent.welcome.audioFile]) {
      captionContent = adjustCaptionTiming(captionContent, courseContent.audioDurations[courseContent.welcome.audioFile])
    }
    
    zip.file(`media/captions/${courseContent.welcome.captionFile}`, captionContent);
  }
  
  // Process objectives page media and audio
  if (courseContent.objectivesPage) {
    if (courseContent.objectivesPage.media) {
      for (const media of courseContent.objectivesPage.media) {
        if (media.type === 'image' && media.blob) {
          // Extension should already be set during pre-processing
          const ext = (media as any).fileExtension || getFileExtension(media.blob, media);
          zip.file(`media/images/${media.id}.${ext}`, media.blob);
        }
      }
    }
    
    if (courseContent.objectivesPage.audioFile && courseContent.objectivesPage.audioBlob) {
      zip.file(`media/audio/${courseContent.objectivesPage.audioFile}`, courseContent.objectivesPage.audioBlob);
    }
    
    if (courseContent.objectivesPage.captionFile && courseContent.objectivesPage.captionBlob) {
      // Adjust caption timing if audio duration is provided
      let captionContent = await blobToText(courseContent.objectivesPage.captionBlob)
      if (courseContent.audioDurations && courseContent.objectivesPage.audioFile && courseContent.audioDurations[courseContent.objectivesPage.audioFile]) {
        captionContent = adjustCaptionTiming(captionContent, courseContent.audioDurations[courseContent.objectivesPage.audioFile])
      }
      
      zip.file(`media/captions/${courseContent.objectivesPage.captionFile}`, captionContent);
    }
  }
  
  // Process topics
  for (let i = 0; i < courseContent.topics.length; i++) {
    const topic = courseContent.topics[i];
    
    // Add audio file if specified
    if (topic.audioFile) {
      if (topic.audioBlob) {
        // Use the actual audio blob if provided
        zip.file(`media/audio/${topic.audioFile}`, topic.audioBlob);
      } else {
        // Create a placeholder audio file if no blob provided
        const audioContent = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]); // MP3 header
        zip.file(`media/audio/${topic.audioFile}`, audioContent);
      }
    }
    
    // Add caption file if specified
    if (topic.captionFile) {
      if (topic.captionBlob) {
        // Use the actual caption blob if provided
        let captionContent = await blobToText(topic.captionBlob)
        
        // Adjust caption timing if audio duration is provided
        if (courseContent.audioDurations && topic.audioFile && courseContent.audioDurations[topic.audioFile]) {
          captionContent = adjustCaptionTiming(captionContent, courseContent.audioDurations[topic.audioFile])
        }
        
        zip.file(`media/captions/${topic.captionFile}`, captionContent);
      } else {
        // Create a VTT file with actual content (strip HTML tags)
        const plainText = topic.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
${plainText.substring(0, 100)}...

00:00:05.000 --> 00:00:10.000
This is a sample caption for the audio narration.

00:00:10.000 --> 00:00:15.000
Captions help with accessibility and comprehension.`;
        zip.file(`media/captions/${topic.captionFile}`, vttContent);
      }
    }
    
    // Add media files (images and videos)
    if (topic.media) {
      for (const media of topic.media) {
        if (media.type === 'image' && media.blob) {
          // Extension should already be set during pre-processing
          const ext = (media as any).fileExtension || getFileExtension(media.blob, media);
          zip.file(`media/images/${media.id}.${ext}`, media.blob);
        }
        // Videos are embedded via iframe, so no need to store them
      }
    }
  }
  
  // Add assessment script with correct answers
  const assessmentScript = `window.assessmentAnswers = [${courseContent.assessment.questions.map(q => q.correctAnswer).join(', ')}];
window.passMark = ${courseContent.passMark};`;
  zip.file('scripts/assessment.js', assessmentScript);
  
  // Logo removed - replaced with progress circle
}