import type { EnhancedCourseContent } from './spaceEfficientScormGenerator'

/**
 * Enhanced version of generateTopicPage with full media support
 */
export function generateEnhancedTopicPage(
  topic: EnhancedCourseContent['topics'][0], 
  index: number, 
  _courseContent: EnhancedCourseContent
): string {
  const hasMedia = topic.media && topic.media.length > 0
  const hasAudio = !!topic.audioFile
  const hasKnowledgeCheck = !!topic.knowledgeCheck
  
  // Generate media content based on type
  const generateMediaContent = () => {
    if (!hasMedia || !topic.media) return ''
    
    // Filter out media items without blobs or embed URLs (these are placeholder items)
    const validMedia = topic.media.filter((m: any) => 
      (m.type === 'image' && m.blob) || 
      (m.type === 'video' && m.embedUrl)
    )
    
    if (validMedia.length === 0) return ''
    
    // Handle multiple media items
    if (validMedia.length > 1) {
      return `
            <div class="media-carousel" data-media-count="${validMedia.length}">
                ${validMedia.map((media, idx) => generateSingleMedia(media, idx)).join('\n                ')}
                <div class="carousel-controls">
                    <button class="carousel-prev" onclick="changeMedia(-1)">◀</button>
                    <span class="carousel-indicator">1 / ${validMedia.length}</span>
                    <button class="carousel-next" onclick="changeMedia(1)">▶</button>
                </div>
            </div>`
    } else {
      return generateSingleMedia(validMedia[0], 0)
    }
  }
  
  const generateSingleMedia = (media: any, idx: number) => {
    if (media.type === 'video' && media.embedUrl) {
      // YouTube video embed
      return `
            <div class="video-container" data-media-index="${idx}">
                <iframe 
                    src="${media.embedUrl}" 
                    title="${media.title}"
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>`
    } else {
      // Image display with click to enlarge
      // Use the file extension stored during media processing, default to jpg if not set
      const ext = media.fileExtension || 'jpg'
      const imagePath = `../media/images/${media.id}.${ext}`
      // Escape single quotes in title for onclick handler
      const escapedTitle = media.title.replace(/'/g, "\\'")
      return `
            <div class="visual-container" data-media-index="${idx}">
                <img src="${imagePath}" alt="${media.title}" onclick="parent.enlargeImage('${imagePath}', '${escapedTitle}')" style="cursor: pointer;" />
                <div class="media-caption">${media.title}</div>
            </div>`
    }
  }
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${topic.title}</title>
    <link rel="stylesheet" href="../styles/main.css">
</head>
<body data-has-knowledge-check="${hasKnowledgeCheck}" style="margin: 0; padding: 20px; overflow-y: auto; height: 100vh; box-sizing: border-box;">
    <div class="content-layout">
        <div class="text-section">
            ${topic.content.split('\n\n').map((p: string) => `<p>${p}</p>`).join('\n            ')}
            
            ${hasKnowledgeCheck && topic.knowledgeCheck ? generateKnowledgeCheck(topic.knowledgeCheck, index) : ''}
        </div>

        <div class="media-panel">
            ${generateMediaContent()}
            
            ${hasAudio ? `
            <div class="audio-player">
                <audio id="audio-player-topic-${index + 1}" src="../media/audio/${topic.audioFile}" preload="metadata">
                    ${topic.captionFile ? `<track kind="subtitles" src="../media/captions/${topic.captionFile}" srclang="en" label="English" default>` : ''}
                </audio>
                <div class="audio-main">
                    <button class="play-pause" onclick="toggleAudio(${index})">▶</button>
                    <div class="audio-track">
                        <div class="track-progress" onclick="seekAudio(event, ${index})">
                            <div class="track-fill" id="track-fill-${index}">
                                <div class="track-handle"></div>
                            </div>
                        </div>
                        <div class="track-time">
                            <span id="current-time-${index}">0:00</span>
                            <span id="duration-${index}">0:00</span>
                        </div>
                    </div>
                </div>
                <div class="audio-controls">
                    <button class="audio-btn" onclick="skip(-10, ${index})">◀ 10s</button>
                    <button class="audio-btn" id="speed-btn-${index}" onclick="changeSpeed(${index})">1x</button>
                    <button class="audio-btn active" id="cc-btn-${index}" onclick="toggleCaptions(${index})">CC</button>
                    <button class="audio-btn" onclick="toggleVolume(${index})">🔊</button>
                    <button class="audio-btn" onclick="skip(10, ${index})">10s ▶</button>
                </div>
                <div class="caption-display" id="captionDisplay-${index}">
                    <p id="caption-text-${index}"></p>
                </div>
            </div>` : ''}
        </div>
    </div>
    
    <!-- Image Lightbox -->
    <div id="image-lightbox" class="lightbox-overlay" onclick="closeLightbox()">
        <div class="lightbox-content" onclick="event.stopPropagation()">
            <img id="lightbox-image" src="" alt="">
            <button class="lightbox-close" onclick="closeLightbox()">×</button>
        </div>
    </div>
    
    <!-- Navigation handled by main index.html sidebar and footer -->
    
    <script src="../scripts/navigation.js"></script>
    
    ${hasKnowledgeCheck ? `
    <script>
        // Disable next button on page load if knowledge check exists
        window.addEventListener('load', function() {
            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn && nextBtn.dataset.requiresAnswer === 'true') {
                nextBtn.disabled = true;
                nextBtn.classList.add('disabled');
            }
        });
    </script>
    ` : ''}
    
    <!-- Custom Alert Container -->
    <div id="scorm-alert-container"></div>
</body>
</html>`
}

/**
 * Generate assessment page with deferred feedback
 */
export function generateAssessmentPage(courseContent: EnhancedCourseContent): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assessment</title>
    <link rel="stylesheet" href="../styles/main.css">
</head>
<body style="margin: 0; padding: 20px; overflow-y: auto; height: 100vh; box-sizing: border-box;">
    <div class="assessment-container">
        <form id="assessment-form">
            <h1>Final Assessment</h1>
            <p class="assessment-intro">Answer all questions below and click Submit to see your results.</p>
            ${courseContent.assessment.questions.map((q, idx) => `
            <div class="assessment-question">
                <h3>Question ${idx + 1}</h3>
                <p>${q.question}</p>
                <div class="assessment-options">
                    ${q.options.map((opt, optIdx) => `
                    <label class="assessment-option">
                        <input type="radio" name="q${idx}" value="${optIdx}">
                        ${opt}
                    </label>`).join('\n                    ')}
                </div>
            </div>`).join('\n            ')}
            
            <div class="assessment-actions">
                <button type="button" class="btn btn-primary" id="submit-assessment" onclick="submitAssessment()">
                    Submit Assessment
                </button>
            </div>
        </form>
        
        <div class="assessment-feedback" style="display: none;">
            <h2>Assessment Results</h2>
            <div class="score-display" id="assessment-score"></div>
            <div class="feedback-details" id="feedback-details"></div>
        </div>
    </div>
    <script src="../scripts/navigation.js"></script>
    <script src="../scripts/assessment.js"></script>
</body>
</html>`
}

/**
 * Enhanced CSS with all media and interaction styles
 */
export function generateEnhancedMainCss(): string {
  return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Century Gothic', sans-serif;
    background: #ffffff;
    height: 100vh;
    margin: 0;
    display: flex;
}

/* Compact sidebar */
.sidebar {
    width: 180px;
    background: #241f20;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}

.sidebar-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* Progress circle styles */
.progress-circle-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 16px;
}

.progress-circle {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.progress-circle-bg {
    stroke: rgba(255,255,255,0.1);
}

.progress-circle-fill {
    stroke: #8fbb40;
    transition: stroke-dashoffset 0.3s ease;
}

.progress-circle-text {
    fill: #8fbb40;
    font-family: 'Century Gothic', sans-serif;
}

.progress-label {
    font-size: 12px;
    color: #b3b4b2;
    margin-top: 8px;
    text-align: center;
    font-weight: 600;
}

/* Sidebar navigation */
.sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
}

.nav-item {
    display: block;
    padding: 10px 12px;
    color: #b3b4b2;
    text-decoration: none;
    font-size: 12px;
    border-radius: 6px;
    margin-bottom: 2px;
    transition: all 0.2s ease;
    position: relative;
}

.nav-item:hover {
    background: rgba(143,187,64,0.1);
    color: #8fbb40;
}

.nav-item.active {
    background: rgba(143,187,64,0.1);
    color: #007acc;
    font-weight: 700;
    border-left: 3px solid #8fbb40;
    padding-left: 9px;
}

.nav-item.completed {
    color: #00b0d0;
}

.nav-item.completed::before {
    content: '✓';
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
}

.nav-number {
    display: inline-block;
    width: 20px;
    font-weight: 700;
    opacity: 0.7;
}

/* Main content area */
.main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* Prevent flex item from growing beyond container */
}

/* Minimal top bar */
.top-bar {
    background: #f8f9fa;
    padding: 12px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e9ecef;
    flex-shrink: 0;
}

.chapter-info {
    font-size: 24px;
    font-weight: 700;
    color: #241f20;
}

.fullscreen-btn {
    background: transparent;
    border: 1px solid #b3b4b2;
    color: #5d6771;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
}

.fullscreen-btn:hover {
    border-color: #8fbb40;
    color: #8fbb40;
}

/* Content container */
.content-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    background: white;
    min-height: 0; /* Allow container to shrink */
}

.content-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 32px 40px;
    min-height: 0; /* Allow scroll container to shrink */
}
#content-area {
    width: 100%;
    min-height: 100%;
}
#content-area iframe {
    width: 100%;
    min-height: 100vh;
    border: none;
    display: block;
}

/* Content layout */
.content-layout {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 32px;
    align-items: start;
}

.text-section h2 {
    font-size: 28px;
    font-weight: 700;
    color: #241f20;
    margin-bottom: 16px;
}

.text-section p {
    font-size: 16px;
    line-height: 1.8;
    color: #241f20;
    margin-bottom: 20px;
}

/* Media panel */
.media-panel {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.visual-container {
    width: 100%;
    aspect-ratio: 16/9;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 18px;
    text-align: center;
    padding: 24px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    overflow: hidden;
    position: relative;
}

.visual-container img {
    max-width: 100%;
    height: auto;
    display: block;
}

.media-caption {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 8px;
    font-size: 14px;
}

/* Video container */
.video-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    border-radius: 8px;
    overflow: hidden;
    background: #000;
}

.video-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

/* Media carousel */
.media-carousel {
    position: relative;
}

.media-carousel .visual-container,
.media-carousel .video-container {
    display: none;
}

.media-carousel .visual-container[data-media-index="0"],
.media-carousel .video-container[data-media-index="0"] {
    display: flex;
}

/* Media image styling for welcome/objectives pages */
.media-image {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 1rem;
}

.media-image img {
    max-width: 100%;
    height: auto;
    max-height: 400px;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: transform 0.2s ease;
}

.media-image img:hover {
    transform: scale(1.02);
}

.carousel-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 12px;
}

.carousel-prev,
.carousel-next {
    background: #8fbb40;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.carousel-prev:hover,
.carousel-next:hover {
    background: #7da036;
}

.carousel-indicator {
    font-size: 14px;
    color: #5d6771;
}

/* Custom audio player */
.audio-player {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(36,31,32,0.1);
}

.audio-main {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
}

.play-pause {
    width: 48px;
    height: 48px;
    background: #8fbb40;
    border-radius: 50%;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.play-pause:hover {
    background: #7da036;
    transform: scale(1.05);
}

.audio-track {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.track-progress {
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    cursor: pointer;
    position: relative;
}

.track-fill {
    height: 100%;
    width: 0%;
    background: #439c45;
    border-radius: 4px;
    position: relative;
    transition: width 0.1s ease;
}

.track-handle {
    position: absolute;
    right: -6px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    background: white;
    border: 2px solid #439c45;
    border-radius: 50%;
    cursor: pointer;
}

.track-time {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #5d6771;
}

.audio-controls {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
}

.audio-btn {
    background: white;
    border: 1px solid #e9ecef;
    color: #5d6771;
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s ease;
    text-align: center;
}

.audio-btn:hover {
    border-color: #8fbb40;
    color: #8fbb40;
}

.audio-btn.active {
    background: #8fbb40;
    color: white;
    border-color: #8fbb40;
}

/* Caption display */
.caption-display {
    margin-top: 12px;
    padding: 12px 16px;
    background-color: #fff8dc;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.6;
    color: #333;
    font-style: italic;
    display: none;
    border: 1px solid #f0e68c;
    box-shadow: 0 2px 4px rgba(240,230,140,0.3);
}

.caption-display.show {
    display: block;
}

/* Compact knowledge check */
.knowledge-check {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 24px;
    margin-top: 32px;
    border: 1px solid #e9ecef;
}

.kc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.kc-title {
    font-size: 18px;
    font-weight: 700;
    color: #241f20;
}

.kc-count {
    font-size: 12px;
    color: #5d6771;
    background: white;
    padding: 4px 12px;
    border-radius: 12px;
}

.kc-question {
    font-size: 16px;
    color: #241f20;
    margin-bottom: 20px;
}

.kc-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 20px;
}

.kc-option {
    display: flex;
    align-items: center;
    padding: 14px 18px;
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
}

.kc-option:hover {
    border-color: #8fbb40;
    background: rgba(143,187,64,0.05);
}

.kc-option input {
    margin-right: 12px;
    cursor: pointer;
}

/* Correct answer styling */
.kc-option.correct {
    background: #d4edda;
    border-color: #8fbb40;
    color: #155724;
}

/* Incorrect answer styling */
.kc-option.incorrect {
    background: #f8d7da;
    border-color: #ff6b6b;
    color: #721c24;
}

/* Flash animation for correct answer when shown after incorrect selection */
.kc-option.flash {
    animation: flash 0.5s ease-in-out 3;
}

@keyframes flash {
    0%, 100% { 
        background: #8fbb40; 
        border-color: #8fbb40;
        color: white;
    }
    50% { 
        background: white; 
        border-color: #8fbb40;
        color: #333;
    }
}

/* Fill-in-the-blank input styling */
input[type="text"].correct {
    background-color: #d4edda;
    border-color: #8fbb40;
    color: #155724;
}

input[type="text"].incorrect {
    background-color: #f8d7da;
    border-color: #ff6b6b;
    color: #721c24;
}

/* Position navigation buttons at bottom of page */
.navigation-buttons {
    position: fixed;
    bottom: 20px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 20px;
    padding: 0 20px;
    z-index: 100;
}

.nav-button {
    padding: 10px 24px;
    background: #439c45;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.nav-button:hover {
    background: #3a8a3d;
    transform: translateY(-1px);
}

.nav-button:disabled {
    background: #cccccc;
    cursor: not-allowed;
    transform: none;
}

.kc-submit {
    background: #439c45;
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 700;
    font-size: 14px;
    transition: all 0.2s ease;
    display: block;
    margin: 0 auto;
}

.kc-submit:hover {
    background: #2d7a30;
    transform: translateY(-1px);
}

.kc-submit:disabled {
    background: #b3b4b2;
    cursor: not-allowed;
    transform: none;
}

/* Knowledge check feedback */
.kc-feedback {
    margin-top: 16px;
    padding: 16px;
    border-radius: 6px;
    font-size: 14px;
    line-height: 1.6;
}

.kc-feedback.correct {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    color: #155724;
}

.kc-feedback.incorrect {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
}

/* Minimal navigation footer */
.nav-footer {
    background: #f8f9fa;
    padding: 16px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e9ecef;
    flex-shrink: 0;
}

.nav-btn {
    background: #8fbb40;
    color: white;
    border: none;
    padding: 10px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 700;
    font-size: 14px;
    transition: all 0.2s ease;
}

.nav-btn:hover {
    background: #7da036;
    transform: translateY(-1px);
}

.nav-btn:disabled {
    background: #b3b4b2;
    cursor: not-allowed;
    transform: none;
}

/* Assessment styles */
.assessment-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
}

.assessment-intro {
    font-size: 16px;
    color: #5d6771;
    margin-bottom: 32px;
}

.assessment-question {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 24px;
    border: 1px solid #e9ecef;
}

.assessment-question h3 {
    font-size: 18px;
    font-weight: 700;
    color: #241f20;
    margin-bottom: 12px;
}

.assessment-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
}

.assessment-option {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.assessment-option:hover {
    border-color: #8fbb40;
    background: rgba(143,187,64,0.05);
}

.assessment-option input {
    margin-right: 12px;
}

.assessment-actions {
    text-align: center;
    margin-top: 32px;
}

.btn {
    padding: 12px 32px;
    border: none;
    border-radius: 6px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-primary {
    background: #439c45;
    color: white;
}

.btn-primary:hover {
    background: #2d7a30;
    transform: translateY(-1px);
}

.score-display {
    font-size: 48px;
    font-weight: 700;
    text-align: center;
    margin: 32px 0;
}

.score-display.pass {
    color: #439c45;
}

.score-display.fail {
    color: #dc3545;
}

.feedback-details {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 24px;
}

.feedback-item {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e9ecef;
}

.feedback-item:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

.feedback-item.correct {
    color: #155724;
}

.feedback-item.incorrect {
    color: #721c24;
}

/* Image Lightbox */
.lightbox-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    z-index: 9999;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.lightbox-overlay.active {
    display: flex;
    opacity: 1;
}

.lightbox-content {
    position: relative;
    max-width: 90%;
    max-height: 90%;
    cursor: default;
}

.lightbox-content img {
    display: block;
    max-width: 100%;
    max-height: 90vh;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
}

.lightbox-close {
    position: absolute;
    top: -40px;
    right: 0;
    background: transparent;
    border: none;
    color: white;
    font-size: 40px;
    cursor: pointer;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
}

.lightbox-close:hover {
    transform: scale(1.1);
}

/* Make images appear clickable */
.visual-container img {
    transition: transform 0.2s ease;
}

.visual-container img:hover {
    transform: scale(1.02);
}

/* Legacy knowledge check styles for old format */
.question {
    margin-bottom: 20px;
}

.question-text {
    font-size: 16px;
    color: #241f20;
    margin-bottom: 12px;
    font-weight: 700;
}

.options {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.option {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.option:hover {
    border-color: #8fbb40;
    background: rgba(143,187,64,0.05);
}

.option input {
    margin-right: 12px;
}

.check-answer-btn {
    background: #439c45;
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 700;
    font-size: 14px;
    transition: all 0.2s ease;
    display: block;
    margin: 20px auto 0;
}

.check-answer-btn:hover {
    background: #2d7a30;
    transform: translateY(-1px);
}

.check-answer-btn:disabled {
    background: #b3b4b2;
    cursor: not-allowed;
    transform: none;
}

@media (max-width: 1200px) {
    .content-layout {
        grid-template-columns: 1fr;
    }
    
    .media-panel {
        position: static;
    }
}

@media (max-width: 768px) {
    .sidebar {
        width: 60px;
    }
    
    .brand,
    .nav-item span,
    .progress-info span {
        display: none;
    }
    
    .nav-number {
        width: auto;
    }
    
    .content-scroll {
        padding: 20px;
    }
    
    .kc-options {
        grid-template-columns: 1fr;
    }
    
    .lightbox-close {
        top: 10px;
        right: 10px;
    }
}
/* Custom alert system */
#scorm-alert-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.scorm-alert {
    background: #2c3e50;
    color: white;
    padding: 15px 25px;
    border-radius: 5px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    min-width: 250px;
    max-width: 400px;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
}
.scorm-alert.show {
    opacity: 1;
    transform: translateX(0);
}
@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Pulse animation for highlighting knowledge checks */
@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7);
    }
    70% {
        box-shadow: 0 0 0 10px rgba(255, 68, 68, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(255, 68, 68, 0);
    }
}

/* Enhanced alert styles for severity levels */
.scorm-alert.error {
    background-color: #ff4444;
    border-left: 4px solid #cc0000;
}

.scorm-alert.warning {
    background-color: #ff9800;
    border-left: 4px solid #e68900;
}

/* Shake animation for error alerts */
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.custom-alert.shake {
    animation: shake 0.5s ease-in-out;
}`
}

/**
 * Generate knowledge check HTML supporting any number of questions uniformly
 */
function generateKnowledgeCheck(knowledgeCheck: any, topicIndex: number): string {
  // Normalize the questions into an array
  let questions;
  if (knowledgeCheck.questions) {
    questions = knowledgeCheck.questions;
  } else {
    // Convert single question format to array format
    questions = [{
      id: `q1`,
      question: knowledgeCheck.question || knowledgeCheck.blank,
      blank: knowledgeCheck.blank,
      options: knowledgeCheck.options,
      correctAnswer: knowledgeCheck.correctAnswer,
      explanation: knowledgeCheck.explanation || 'Correct!',
      type: knowledgeCheck.type || 'multiple-choice'
    }];
  }
  // Filter out invalid questions first
  const validQuestions = questions.filter((q: any) => {
    // Check if question is valid
    if (q.type === 'fill-in-the-blank') {
      return true; // Fill-in-the-blank questions are valid
    } else if (q.options && Array.isArray(q.options) && q.options.length > 0) {
      return true; // Multiple choice questions with options are valid
    } else {
      console.error('Invalid question - missing options or unknown type:', q);
      return false;
    }
  });
  
  const questionCount = validQuestions.length
  if (questionCount === 0) return ''; // No valid questions
  
  return `
            <div class="knowledge-check" data-question-count="${questionCount}">
                <div class="kc-header">
                    <h3 class="kc-title">Knowledge Check</h3>
                    <span class="kc-count">Question${questionCount > 1 ? 's' : ''} (${questionCount} total)</span>
                </div>
                ${validQuestions.map((q: any, qIndex: number) => {
                  const questionId = q.id || `q${qIndex + 1}`
                  
                  // Handle different question types
                  let questionHtml = '';
                  if (q.type === 'fill-in-the-blank') {
                    questionHtml = `
                <div class="question" data-question-id="${questionId}">
                    <p class="kc-question">${q.blank || q.question}</p>
                    <div style="margin: 20px 0;">
                        <input type="text" name="${questionId}" id="input-${questionId}" style="padding: 8px; font-size: 16px; width: 300px; border: 2px solid #e9ecef; border-radius: 4px;">
                    </div>
                    <div id="kc-feedback-${questionId}" class="kc-feedback" style="display: none;">
                        <p class="feedback-text"></p>
                    </div>
                </div>`;
                  } else {
                    // Multiple choice question (already validated to have options)
                    questionHtml = `
                <div class="question" data-question-id="${questionId}">
                    <p class="kc-question">${q.question}</p>
                    <div class="kc-options">
                        ${q.options.map((option: string, optIdx: number) => `
                        <label class="kc-option">
                            <input type="radio" name="${questionId}" value="${optIdx}">
                            ${option}
                        </label>`).join('\n                        ')}
                    </div>
                    <div id="kc-feedback-${questionId}" class="kc-feedback" style="display: none;">
                        <p class="feedback-text"></p>
                    </div>
                </div>`;
                  }
                  
                  return questionHtml;
                }).join('')}
                
                <button class="kc-submit" onclick="submitAnswer()">Submit Answer</button>
                
                <script>
                // answeredQuestions is already declared in navigation.js
                
                // Store correct answers for evaluation
                const correctAnswers = {
                    ${validQuestions.map((q: any, qIndex: number) => {
                      const questionId = q.id || `q${qIndex + 1}`;
                      if (q.type === 'fill-in-the-blank') {
                        const correctFeedback = q.feedback?.correct || q.explanation || 'Correct!';
                        const incorrectFeedback = q.feedback?.incorrect || q.explanation || 'Please try again.';
                        return `'${questionId}': { type: 'fill-in-the-blank', answer: '${q.correctAnswer}', correctFeedback: '${correctFeedback.replace(/'/g, "\\'").replace(/\n/g, " ")}', incorrectFeedback: '${incorrectFeedback.replace(/'/g, "\\'").replace(/\n/g, " ")}' }`;
                      } else {
                        // For multiple choice, convert to index if text-based answer
                        let answerValue;
                        if (typeof q.correctAnswer === 'number') {
                          answerValue = q.correctAnswer.toString();
                        } else if (typeof q.correctAnswer === 'string' && q.options) {
                          // Convert text answer to index
                          const answerIndex = q.options.indexOf(q.correctAnswer);
                          answerValue = answerIndex >= 0 ? answerIndex.toString() : '0';
                        } else {
                          answerValue = '0';
                        }
                        const correctFeedback = q.feedback?.correct || q.explanation || 'Correct!';
                        const incorrectFeedback = q.feedback?.incorrect || q.explanation || 'Please try again.';
                        return `'${questionId}': { type: 'multiple-choice', answer: '${answerValue}', correctFeedback: '${correctFeedback.replace(/'/g, "\\'").replace(/\n/g, " ")}', incorrectFeedback: '${incorrectFeedback.replace(/'/g, "\\'").replace(/\n/g, " ")}' }`;
                      }
                    }).join(',\n                    ')}
                };
                
                function submitAnswer() {
                    console.log('submitAnswer called');
                    console.log('correctAnswers object:', correctAnswers);
                    
                    const questions = document.querySelectorAll('.question');
                    console.log('Found questions:', questions.length);
                    
                    let allAnswered = true;
                    let allCorrect = true;
                    
                    // Handle case where no questions are found
                    if (questions.length === 0) {
                        console.error('No questions found in knowledge check');
                        return;
                    }
                    
                    questions.forEach((questionEl, index) => {
                        const questionId = questionEl.getAttribute('data-question-id');
                        try {
                            console.log('Processing question:', questionId);
                            const correctAnswer = correctAnswers[questionId];
                            
                            // Skip if no correct answer is defined for this question
                            if (!correctAnswer) {
                                console.error('No correct answer defined for question:', questionId);
                                console.error('Available questions in correctAnswers:', Object.keys(correctAnswers));
                                return;
                            }
                            console.log('Found correctAnswer:', correctAnswer);
                        
                        const radioInput = document.querySelector('input[name="' + questionId + '"]:checked');
                        const textInput = document.querySelector('input[name="' + questionId + '"][type="text"]') || document.getElementById('input-' + questionId);
                        
                        let hasAnswer = false;
                        let isCorrect = false;
                        let userAnswer = '';
                        
                        if (correctAnswer.type === 'fill-in-the-blank' && textInput) {
                            userAnswer = textInput.value.trim();
                            if (userAnswer) {
                                hasAnswer = true;
                                // Case-insensitive comparison for fill-in-the-blank
                                isCorrect = userAnswer.toLowerCase() === correctAnswer.answer.toLowerCase();
                            }
                        } else if (correctAnswer.type === 'multiple-choice' && radioInput) {
                            userAnswer = radioInput.value;
                            hasAnswer = true;
                            // Compare as strings for consistency
                            isCorrect = userAnswer === correctAnswer.answer;
                        }
                        
                        if (!hasAnswer) {
                            allAnswered = false;
                        } else {
                            answeredQuestions[questionId] = isCorrect;
                            
                            // Mark question as answered
                            questionEl.classList.add('question-answered');
                            questionEl.classList.add(isCorrect ? 'correct' : 'incorrect');
                            
                            // Show feedback
                            const feedbackEl = document.getElementById('kc-feedback-' + questionId) || document.getElementById('feedback-' + questionId);
                            if (feedbackEl) {
                                feedbackEl.style.display = 'block';
                                const feedbackText = feedbackEl.querySelector('.feedback-text') || feedbackEl;
                                
                                // Debug logging
                                console.log('Feedback Debug:', {
                                    questionId: questionId,
                                    isCorrect: isCorrect,
                                    correctAnswer: correctAnswer,
                                    correctFeedback: correctAnswer.correctFeedback,
                                    incorrectFeedback: correctAnswer.incorrectFeedback,
                                    feedbackElement: feedbackEl,
                                    feedbackTextElement: feedbackText
                                });
                                
                                feedbackText.textContent = isCorrect ? 
                                    (correctAnswer.correctFeedback || 'Correct!') : 
                                    (correctAnswer.incorrectFeedback || 'Please try again.');
                                feedbackEl.className = feedbackEl.className.includes('kc-feedback') ? 
                                    'kc-feedback ' + (isCorrect ? 'correct' : 'incorrect') : 
                                    'feedback ' + (isCorrect ? 'feedback-correct' : 'feedback-incorrect');
                            } else {
                                console.error('Feedback element not found for question:', questionId);
                            }
                            
                            if (isCorrect) {
                                // For correct answers, mark the selected option as correct
                                if (correctAnswer.type === 'multiple-choice' && radioInput) {
                                    radioInput.parentElement.classList.add('correct');
                                } else if (correctAnswer.type === 'fill-in-the-blank' && textInput) {
                                    // Add correct class to fill-in-the-blank input
                                    textInput.classList.add('correct');
                                }
                            } else {
                                allCorrect = false;
                                // For incorrect answers
                                if (correctAnswer.type === 'multiple-choice') {
                                    // Mark the selected option as incorrect
                                    if (radioInput && radioInput.parentElement) {
                                        radioInput.parentElement.classList.add('incorrect');
                                    }
                                    
                                    // Find and flash the correct answer (using index value)
                                    const correctOption = document.querySelector('input[name="' + questionId + '"][value="' + correctAnswer.answer + '"]');
                                    if (correctOption && correctOption.parentElement) {
                                        correctOption.parentElement.classList.add('flash');
                                        // After flashing, keep it green
                                        setTimeout(() => {
                                            correctOption.parentElement.classList.remove('flash');
                                            correctOption.parentElement.classList.add('correct');
                                        }, 1500);
                                    }
                                } else if (correctAnswer.type === 'fill-in-the-blank' && textInput) {
                                    // Add incorrect class to fill-in-the-blank input
                                    textInput.classList.add('incorrect');
                                }
                            }
                        }
                        } catch (error) {
                            console.error('Error processing question:', questionId, error);
                            console.error('Error stack:', error.stack);
                        }
                    });
                    
                    if (!allAnswered) {
                        // Use custom alert from parent window or current window
                        if (window !== window.parent && window.parent.showCustomAlert) {
                            window.parent.showCustomAlert('Please answer all questions before proceeding.');
                        } else if (window.showCustomAlert) {
                            window.showCustomAlert('Please answer all questions before proceeding.');
                        }
                        return;
                    }
                    
                    // Disable submit button and inputs after submission
                    document.querySelector('.kc-submit').disabled = true;
                    document.querySelectorAll('.question input').forEach(input => {
                        input.disabled = true;
                    });
                    
                    // Mark as attempted and enable navigation
                    const inIframe = window !== window.parent;
                    const pageId = inIframe && window.parent.currentPage ? window.parent.currentPage : (window.currentPage || 'topic-${topicIndex + 1}');
                    
                    if (inIframe && window.parent.knowledgeCheckAttempts) {
                        window.parent.knowledgeCheckAttempts[pageId] = true;
                        // Also clear navigation blocking in parent
                        if (window.parent.navigationBlockCount) {
                            window.parent.navigationBlockCount[pageId] = 0;
                        }
                        if (window.parent.lastBlockTime) {
                            window.parent.lastBlockTime[pageId] = 0;
                        }
                    } else if (window.knowledgeCheckAttempts) {
                        window.knowledgeCheckAttempts[pageId] = true;
                        // Clear navigation blocking
                        if (window.navigationBlockCount) {
                            window.navigationBlockCount[pageId] = 0;
                        }
                        if (window.lastBlockTime) {
                            window.lastBlockTime[pageId] = 0;
                        }
                    }
                    
                    // Check if knowledge check is completed and enable navigation
                    if (inIframe && window.parent.checkKnowledgeCheckCompletion) {
                        window.parent.checkKnowledgeCheckCompletion();
                    } else if (window.checkKnowledgeCheckCompletion) {
                        window.checkKnowledgeCheckCompletion();
                    }
                }
                
                function enableNextButton() {
                    // Mark knowledge check as attempted in parent navigation system
                    const inIframe = window !== window.parent;
                    const pageId = inIframe && window.parent.currentPage ? window.parent.currentPage : (window.currentPage || 'topic-${topicIndex + 1}');
                    
                    if (inIframe && window.parent.knowledgeCheckAttempts) {
                        window.parent.knowledgeCheckAttempts[pageId] = true;
                    } else if (window.knowledgeCheckAttempts) {
                        window.knowledgeCheckAttempts[pageId] = true;
                    }
                    
                    // Enable the next button
                    const nextBtn = document.getElementById('nextBtn');
                    if (nextBtn) {
                        nextBtn.disabled = false;
                        nextBtn.classList.remove("disabled");
                        nextBtn.removeAttribute('data-requires-answer');
                    }
                    
                    // Also check if parent needs to enable navigation
                    if (inIframe && window.parent.checkKnowledgeCheckCompletion) {
                        window.parent.checkKnowledgeCheckCompletion();
                    }
                }
                
                // Check if all questions are answered
                function checkAllQuestionsAnswered() {
                    const totalQuestions = ${questionCount};
                    const answeredCount = document.querySelectorAll(".question-answered").length;
                    return answeredCount >= totalQuestions;
                }
                </script>
            </div>`
}