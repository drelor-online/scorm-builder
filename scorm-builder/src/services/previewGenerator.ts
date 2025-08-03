import { type EnhancedCourseContent } from '../types/scorm'
// import { generateEnhancedMainCss } from './spaceEfficientScormGeneratorEnhanced' // DEPRECATED

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
/* Main CSS for preview - extracted from deprecated generator */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #333;
  line-height: 1.6;
  background-color: #f5f5f5;
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 250px;
  background-color: #fff;
  box-shadow: 2px 0 4px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background-color: #f5f5f5;
}

.content-container {
  max-width: 900px;
  margin: 0 auto;
  background-color: #fff;
  border-radius: 8px;
  padding: 3rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

h1, h2, h3 { 
  color: #241f20;
  margin-bottom: 1rem;
}

.btn-primary {
  background-color: #8fbb40;
  color: white;
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.3s ease;
}

.btn-primary:hover:not(:disabled) {
  background-color: #7ba235;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
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
                    ${courseContent.welcome.media.map((media: any) => {
                        if (media.type === 'image' && media.url) {
                            return `<img src="${media.url}" alt="${media.title || 'Image'}" style="cursor: pointer;" />`
                        }
                        return ''
                    }).join('')}
                </div>` : ''}
                ${(courseContent.welcome as any).audioFile || (courseContent.welcome as any).audioUrl ? `
                <div class="audio-player">
                    <div class="audio-label">Audio Narration</div>
                    <audio id="audio-player-welcome" src="${(courseContent.welcome as any).audioUrl || ''}" controls>
                        ${((courseContent.welcome as any).captionFile || (courseContent.welcome as any).captionUrl) ? `<track kind="captions" src="${(courseContent.welcome as any).captionUrl || ''}" srclang="en" label="English">` : ''}
                    </audio>
                </div>` : ''}
            </div>
        </div>
        
        <div id="content-objectives">
            <div class="objectives-container">
                <h1>Learning Objectives</h1>
                <div class="objectives-content">
                    <ul>${courseContent.objectives.map(obj => `<li>${obj}</li>`).join('')}</ul>
                </div>
                ${(courseContent.objectivesPage as any)?.audioFile || (courseContent.objectivesPage as any)?.audioUrl ? `
                <div class="audio-player">
                    <div class="audio-label">Audio Narration</div>
                    <audio id="audio-player-objectives" src="${(courseContent.objectivesPage as any)?.audioUrl || ''}" controls>
                        ${((courseContent.objectivesPage as any)?.captionFile || (courseContent.objectivesPage as any)?.captionUrl) ? `<track kind="captions" src="${(courseContent.objectivesPage as any)?.captionUrl || ''}" srclang="en" label="English">` : ''}
                    </audio>
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
                        ${(() => {
                            // Handle both single question and multiple questions format
                            const questions = topic.knowledgeCheck.questions || [{
                                question: topic.knowledgeCheck.question,
                                options: topic.knowledgeCheck.options,
                                correctAnswer: topic.knowledgeCheck.correctAnswer,
                                type: topic.knowledgeCheck.type || 'multiple-choice'
                            }]
                            
                            return questions.map((q: any, qIndex: number) => `
                            <div class="kc-question-block">
                                <p class="kc-question">${q.question || q.blank || ''}</p>
                                ${q.type === 'fill-in-the-blank' ? `
                                    <input type="text" class="kc-fill-blank" id="kc-answer-${index}-${qIndex}" placeholder="Enter your answer" />
                                ` : `
                                    <div class="kc-options">
                                        ${(q.options || []).map((opt: string, i: number) => `
                                        <label class="kc-option">
                                            <input type="radio" name="kc-${index}-${qIndex}" value="${i}" />
                                            <span class="kc-option-text">${opt}</span>
                                        </label>`).join('')}
                                    </div>
                                `}
                                <button class="kc-submit" onclick="checkAnswer(${index}, ${qIndex}, '${q.correctAnswer}')">
                                    Submit Answer
                                </button>
                                <div class="kc-feedback" id="kc-feedback-${index}-${qIndex}"></div>
                            </div>
                            `).join('')
                        })()}
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
                    
                    ${topic.audioFile || (topic as any).audioUrl ? `
                    <div class="audio-player">
                        <div class="audio-label">Audio Narration</div>
                        <audio id="audio-player-topic-${index + 1}" src="${(topic as any).audioUrl || ''}" controls>
                            ${(topic.captionFile || (topic as any).captionUrl) ? `<track kind="captions" src="${(topic as any).captionUrl || ''}" srclang="en" label="English">` : ''}
                        </audio>
                    </div>` : ''}
                </div>
            </div>
        </div>`).join('')}
        
        <div id="content-assessment">
            <div class="assessment-container">
                <h1>Final Assessment</h1>
                ${courseContent.assessment && courseContent.assessment.questions && courseContent.assessment.questions.length > 0 ? `
                <p>You must score at least ${courseContent.passMark || 80}% to pass this assessment.</p>
                <div class="assessment-questions">
                    ${courseContent.assessment.questions.map((q: any, qIndex: number) => `
                    <div class="assessment-question">
                        <h3>Question ${qIndex + 1}</h3>
                        <p class="question-text">${q.question}</p>
                        ${q.type === 'fill-in-the-blank' ? `
                            <input type="text" class="answer-input" id="assessment-answer-${qIndex}" placeholder="Enter your answer" />
                        ` : `
                            <div class="answer-options">
                                ${(q.options || []).map((opt: string, i: number) => `
                                <label class="answer-option">
                                    <input type="radio" name="assessment-q-${qIndex}" value="${i}" />
                                    <span class="option-text">${opt}</span>
                                </label>`).join('')}
                            </div>
                        `}
                    </div>
                    `).join('')}
                    <button class="submit-assessment" onclick="submitAssessment()">Submit Assessment</button>
                    <div class="assessment-feedback" id="assessment-feedback"></div>
                </div>
                ` : '<p>No assessment questions available.</p>'}
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

function checkAnswer(topicIndex, questionIndex, correctAnswer) {
    const feedbackEl = document.getElementById('kc-feedback-' + topicIndex + '-' + questionIndex);
    if (feedbackEl) {
        feedbackEl.innerHTML = '<p style="color: #16a34a;">In preview mode - answer checking disabled</p>';
    }
}

function submitAssessment() {
    const feedbackEl = document.getElementById('assessment-feedback');
    if (feedbackEl) {
        feedbackEl.innerHTML = '<p style="color: #16a34a;">In preview mode - assessment submission disabled</p>';
    }
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