import { type EnhancedCourseContent } from './spaceEfficientScormGenerator'
import { generateEnhancedMainCss } from './spaceEfficientScormGeneratorEnhanced'

export async function generatePreviewHTML(courseContent: EnhancedCourseContent): Promise<string> {
  const totalSections = 2 + courseContent.topics.length + 1 // welcome, objectives, topics, assessment
  
  // Inline all content for preview
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${courseContent.title} - Preview</title>
    <style>
${generateEnhancedMainCss()}
    </style>
</head>
<body>
    <aside class="sidebar">
        <div class="sidebar-header">
            <div class="logo-row">
                <svg viewBox="0 0 400 100" class="logo-img">
                  <rect x="0" y="0" width="100" height="33.33" fill="#8fbb40"/>
                  <rect x="0" y="33.33" width="100" height="33.33" fill="#241f20"/>
                  <rect x="0" y="66.66" width="100" height="33.34" fill="#439c45"/>
                  <text x="120" y="35" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#8fbb40">EN</text>
                  <text x="175" y="35" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#241f20">TRUST</text>
                  <text x="120" y="70" font-family="Arial, sans-serif" font-size="18" fill="#241f20">SOLUTIONS GROUP</text>
                </svg>
            </div>
            <div class="progress-info">
                <span id="progress-percentage">0%</span>
                <div class="progress-bar" id="progress-bar-main">
                    <div class="progress-fill" id="progress-fill-main"></div>
                </div>
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
                    <!-- Content will be loaded here -->
                </div>
            </div>
        </div>

        <div class="bottom-nav">
            <button class="nav-btn" id="prev-btn" onclick="navigatePrevious()">← Previous</button>
            <button class="nav-btn" id="next-btn" onclick="navigateNext()">Next →</button>
        </div>
    </main>

    <!-- Embed all page content -->
    <div style="display: none;" id="page-content">
        <div id="content-welcome">
            <div class="welcome-container">
                <h1>${courseContent.welcome.title}</h1>
                <p>${courseContent.welcome.content}</p>
                ${courseContent.welcome.media && courseContent.welcome.media.length > 0 ? `
                <div class="welcome-media">
                    <img src="${courseContent.welcome.media[0].url || '#'}" alt="${courseContent.welcome.media[0].title}" style="cursor: pointer;" />
                </div>` : ''}
                ${(courseContent.welcome as any).audioFile && (courseContent.welcome as any).audioUrl ? `
                <div class="audio-player">
                    <div class="audio-label">Audio Narration</div>
                    <audio id="audio-player-welcome" src="${(courseContent.welcome as any).audioUrl}" preload="metadata">
                        ${(courseContent.welcome as any).captionFile && (courseContent.welcome as any).captionUrl ? `<track kind="captions" src="${(courseContent.welcome as any).captionUrl}" srclang="en" label="English">` : ''}
                    </audio>
                    <div class="audio-controls">
                        <button class="audio-btn">▶ Play</button>
                    </div>
                </div>` : ''}
            </div>
        </div>
        
        <div id="content-objectives">
            <div class="objectives-container">
                <h1>Learning Objectives</h1>
                <div class="objectives-content">
                    <ul>${courseContent.objectives.map(obj => `<li>${obj}</li>`).join('')}</ul>
                </div>
                ${(courseContent.objectivesPage as any)?.audioFile && (courseContent.objectivesPage as any)?.audioUrl ? `
                <div class="audio-player">
                    <div class="audio-label">Audio Narration</div>
                    <audio id="audio-player-objectives" src="${(courseContent.objectivesPage as any).audioUrl}" preload="metadata">
                        ${(courseContent.objectivesPage as any).captionFile && (courseContent.objectivesPage as any).captionUrl ? `<track kind="captions" src="${(courseContent.objectivesPage as any).captionUrl}" srclang="en" label="English">` : ''}
                    </audio>
                    <div class="audio-controls">
                        <button class="audio-btn">▶ Play</button>
                    </div>
                </div>` : ''}
            </div>
        </div>
        
        ${courseContent.topics.map((topic, index) => `
        <div id="content-topic-${index + 1}">
            <div class="content-layout">
                <div class="text-section">
                    <h2>${topic.title}</h2>
                    ${topic.content.split('\\n\\n').map((p: string) => `<p>${p}</p>`).join('\\n')}
                    
                    ${topic.knowledgeCheck ? `
                    <div class="knowledge-check" id="knowledge-check-${index}">
                        <h3>Knowledge Check</h3>
                        <p class="kc-question">${topic.knowledgeCheck.question}</p>
                        <div class="kc-options">
                            ${topic.knowledgeCheck.options?.map((opt, i) => `
                            <label class="kc-option">
                                <input type="radio" name="kc-${index}" value="${i}" />
                                <span class="kc-option-text">${opt}</span>
                            </label>`).join('') || ''}
                        </div>
                        <button class="kc-submit" onclick="checkAnswer(${index}, ${topic.knowledgeCheck.correctAnswer})">
                            Submit Answer
                        </button>
                        <div class="kc-feedback" id="kc-feedback-${index}"></div>
                    </div>` : ''}
                </div>
                
                <div class="media-panel">
                    ${topic.media && topic.media.length > 0 && topic.media.some(m => m.url) ? `
                    <div class="visual-container">
                        ${topic.media
                            .filter(media => media.url) // Only show media with valid URLs
                            .map(media => 
                                media.type === 'image' ? 
                                `<img src="${media.url}" alt="${media.title || 'Image'}" />` : 
                                `<div>Video: ${media.title}</div>`
                            ).join('')}
                    </div>` : ''}
                    
                    ${topic.audioFile && (topic as any).audioUrl ? `
                    <div class="audio-player">
                        <div class="audio-label">Audio Narration</div>
                        <audio id="audio-player-topic-${index + 1}" src="${(topic as any).audioUrl}" preload="metadata">
                            ${topic.captionFile && (topic as any).captionUrl ? `<track kind="captions" src="${(topic as any).captionUrl}" srclang="en" label="English">` : ''}
                        </audio>
                        <div class="audio-controls">
                            <button class="audio-btn">▶ Play</button>
                        </div>
                    </div>` : ''}
                </div>
            </div>
        </div>`).join('')}
        
        <div id="content-assessment">
            <div class="assessment-container">
                <h1>Final Assessment</h1>
                <p>Assessment content would appear here</p>
            </div>
        </div>
    </div>

    <script>
// Course data
window.courseTopics = ${JSON.stringify(courseContent.topics.map((topic, idx) => ({
  id: topic.id,
  title: topic.title,
  index: idx,
  hasKnowledgeCheck: !!topic.knowledgeCheck
})))};

// Basic navigation
let currentPage = 'welcome';
const courseStructure = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'objectives', title: 'Learning Objectives' },
    ${courseContent.topics.map((t, i) => `{ id: 'topic-${i + 1}', title: '${t.title}' }`).join(',\n    ')},
    { id: 'assessment', title: 'Assessment' }
];

function loadPage(pageId) {
    currentPage = pageId;
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });
    
    // Load content
    const contentArea = document.getElementById('content-area');
    const content = document.getElementById('content-' + pageId);
    if (content) {
        contentArea.innerHTML = content.innerHTML;
    }
    
    // Update title
    const page = courseStructure.find(p => p.id === pageId);
    if (page) {
        document.getElementById('current-title').textContent = page.title;
    }
    
    updateNavigationButtons();
}

function navigateNext() {
    const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
    if (currentIndex < courseStructure.length - 1) {
        loadPage(courseStructure[currentIndex + 1].id);
    }
}

function navigatePrevious() {
    const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
    if (currentIndex > 0) {
        loadPage(courseStructure[currentIndex - 1].id);
    }
}

function updateNavigationButtons() {
    const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
    document.getElementById('prev-btn').disabled = currentIndex === 0;
    document.getElementById('next-btn').disabled = currentIndex === courseStructure.length - 1;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function checkAnswer(index, correctAnswer) {
    alert('In preview mode - answer checking disabled');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Add click handlers to nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            loadPage(item.dataset.page);
        });
    });
    
    // Load initial page
    loadPage('welcome');
});
    </script>
</body>
</html>`
  
  return html
}