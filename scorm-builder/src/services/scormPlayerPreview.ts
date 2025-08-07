import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'
import { sanitizeHTML } from '../utils/sanitization'

export function generateSCORMPlayerPreviewHTML(
  courseContent: CourseContent,
  courseSeedData: CourseSeedData,
  currentPageId: string = 'welcome'
): string {
  // Get current page content
  const getCurrentPageContent = () => {
    if (currentPageId === 'welcome') {
      return {
        title: 'Welcome',
        content: courseContent.welcomePage.content,
        narration: courseContent.welcomePage.narration,
        media: courseContent.welcomePage.media || []
      }
    } else if (currentPageId === 'objectives') {
      return {
        title: 'Learning Objectives',
        content: courseContent.learningObjectivesPage.content,
        narration: courseContent.learningObjectivesPage.narration,
        media: courseContent.learningObjectivesPage.media || []
      }
    } else if (currentPageId === 'assessment') {
      // Show assessment questions
      const questions = courseContent.assessment.questions.map((q, idx) => `
        <div class="assessment-question">
          <h3>Question ${idx + 1}</h3>
          <p>${sanitizeHTML(q.question)}</p>
          <div class="options">
            ${q.options?.map((opt, optIdx) => `
              <label class="option">
                <input type="radio" name="q${idx}" value="${optIdx}">
                <span>${sanitizeHTML(opt)}</span>
              </label>
            `).join('') || ''}
          </div>
        </div>
      `).join('')
      
      return {
        title: 'Assessment',
        content: questions,
        narration: 'Complete the assessment to test your knowledge.',
        media: []
      }
    } else {
      // Topic page
      const topicIndex = parseInt(currentPageId.replace('topic-', ''))
      const topic = courseContent.topics[topicIndex]
      if (topic) {
        return {
          title: topic.title,
          content: topic.content,
          narration: topic.narration,
          media: topic.media || []
        }
      }
    }
    
    return {
      title: 'Not Found',
      content: 'Page not found',
      narration: '',
      media: []
    }
  }
  
  const currentPage = getCurrentPageContent()
  const totalPages = courseContent.topics.length + 3 // welcome + objectives + topics + assessment
  const currentPageIndex = currentPageId === 'welcome' ? 0 : 
                          currentPageId === 'objectives' ? 1 :
                          currentPageId === 'assessment' ? totalPages - 1 :
                          parseInt(currentPageId.replace('topic-', '')) + 2
  
  const progress = Math.round((currentPageIndex / (totalPages - 1)) * 100)
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${sanitizeHTML(courseSeedData.courseTitle)} - SCORM Player</title>
      <style>
        /* SCORM Player Styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Century Gothic', sans-serif;
          background: #ffffff;
          height: 100vh;
          overflow: hidden;
          display: flex;
        }
        
        .scorm-container {
          display: flex;
          width: 100%;
          height: 100vh;
          overflow: hidden;
        }
        
        /* Sidebar */
        .sidebar {
          width: 240px;
          background: #241f20;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        
        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .course-title {
          font-size: 16px;
          font-weight: 700;
          color: #8fbb40;
          margin-bottom: 12px;
          letter-spacing: 0.5px;
        }
        
        .progress-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: #b3b4b2;
        }
        
        .progress-bar {
          flex: 1;
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: #8fbb40;
          transition: width 0.3s ease;
        }
        
        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 10px 0;
        }
        
        .nav-item {
          display: flex;
          align-items: center;
          padding: 12px 20px;
          color: #b3b4b2;
          text-decoration: none;
          transition: all 0.2s ease;
          font-size: 14px;
          border-left: 3px solid transparent;
        }
        
        .nav-item:hover {
          background: rgba(255,255,255,0.05);
          color: #ffffff;
        }
        
        .nav-item.active {
          background: rgba(143,187,64,0.1);
          color: #8fbb40;
          border-left-color: #8fbb40;
        }
        
        .nav-number {
          font-weight: 600;
          margin-right: 8px;
          opacity: 0.7;
        }
        
        /* Main Area */
        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
        }
        
        .top-bar {
          background: white;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .chapter-info {
          font-size: 18px;
          font-weight: 600;
          color: #241f20;
        }
        
        .top-controls {
          display: flex;
          gap: 8px;
        }
        
        .control-btn {
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        
        .control-btn:hover {
          background: #e0e0e0;
        }
        
        /* Content Container */
        .content-container {
          flex: 1;
          overflow-y: auto;
          padding: 40px;
        }
        
        .content-layout {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 40px;
        }
        
        .text-section {
          background: white;
          padding: 32px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .text-section p {
          margin-bottom: 16px;
          line-height: 1.8;
          color: #333;
        }
        
        .text-section h3 {
          color: #241f20;
          margin: 24px 0 16px;
          font-size: 20px;
        }
        
        /* Media Panel */
        .media-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .visual-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .visual-container img {
          width: 100%;
          height: auto;
          display: block;
        }
        
        /* Audio Player */
        .audio-player {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .audio-main {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }
        
        .play-pause {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #8fbb40;
          color: white;
          border: none;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        
        .play-pause:hover {
          background: #7ba635;
          transform: scale(1.05);
        }
        
        .audio-track {
          flex: 1;
        }
        
        .track-progress {
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          margin-bottom: 8px;
          cursor: pointer;
          position: relative;
        }
        
        .track-fill {
          height: 100%;
          background: #8fbb40;
          border-radius: 3px;
          width: 0%;
          position: relative;
        }
        
        .track-time {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #666;
        }
        
        .audio-controls {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        
        .audio-btn {
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }
        
        .audio-btn:hover {
          background: #e0e0e0;
        }
        
        .audio-btn.active {
          background: #8fbb40;
          color: white;
          border-color: #8fbb40;
        }
        
        .caption-display {
          background: #f5f5f5;
          padding: 12px;
          border-radius: 4px;
          margin-top: 12px;
          min-height: 60px;
          font-size: 14px;
          line-height: 1.6;
          text-align: center;
          color: #333;
        }
        
        /* Navigation Footer */
        .nav-footer {
          background: white;
          padding: 16px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 -1px 3px rgba(0,0,0,0.1);
        }
        
        .nav-btn {
          padding: 10px 24px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .nav-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        #prev-btn {
          background: #f5f5f5;
          color: #333;
          border: 1px solid #e0e0e0;
        }
        
        #next-btn {
          background: #8fbb40;
          color: white;
        }
        
        /* Assessment Styles */
        .assessment-question {
          background: #f9f9f9;
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 24px;
          border: 1px solid #e0e0e0;
        }
        
        .assessment-question h3 {
          color: #241f20;
          margin-bottom: 16px;
          font-size: 18px;
        }
        
        .options {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }
        
        .option {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .option:hover {
          background: #f5f5f5;
          border-color: #8fbb40;
        }
        
        .option input[type="radio"] {
          margin-right: 12px;
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
          .content-layout {
            grid-template-columns: 1fr;
          }
          
          .media-panel {
            order: -1;
          }
        }
        
        @media (max-width: 768px) {
          .sidebar {
            display: none;
          }
          
          .content-container {
            padding: 20px;
          }
          
          .text-section {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="scorm-container">
        <!-- Sidebar -->
        <aside class="sidebar">
          <div class="sidebar-header">
            <h1 class="course-title">${sanitizeHTML(courseSeedData.courseTitle)}</h1>
            <div class="progress-info">
              <span>${progress}%</span>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          </div>
          <nav class="sidebar-nav">
            <a href="#" class="nav-item ${currentPageId === 'welcome' ? 'active' : ''}" data-page="welcome">
              <span class="nav-number">1.</span> Welcome
            </a>
            <a href="#" class="nav-item ${currentPageId === 'objectives' ? 'active' : ''}" data-page="objectives">
              <span class="nav-number">2.</span> Learning Objectives
            </a>
            ${courseContent.topics.map((topic, index) => `
              <a href="#" class="nav-item ${currentPageId === 'topic-' + index ? 'active' : ''}" data-page="topic-${index}">
                <span class="nav-number">${index + 3}.</span> ${sanitizeHTML(topic.title)}
              </a>
            `).join('')}
            <a href="#" class="nav-item ${currentPageId === 'assessment' ? 'active' : ''}" data-page="assessment">
              <span class="nav-number">${courseContent.topics.length + 3}.</span> Assessment
            </a>
          </nav>
        </aside>
        
        <!-- Main Area -->
        <main class="main-area">
          <!-- Top Bar -->
          <div class="top-bar">
            <h2 class="chapter-info">${sanitizeHTML(currentPage.title)}</h2>
            <div class="top-controls">
              <button class="control-btn">A-</button>
              <button class="control-btn">A</button>
              <button class="control-btn">A+</button>
              <button class="control-btn">🌓</button>
              <button class="control-btn">⛶</button>
            </div>
          </div>
          
          <!-- Content Container -->
          <div class="content-container">
            <div class="content-layout">
              <!-- Text Section -->
              <div class="text-section">
                ${currentPageId === 'assessment' ? 
                  currentPage.content : 
                  currentPage.content.split('\\n').map(p => p.trim() ? `<p>${sanitizeHTML(p)}</p>` : '').join('')
                }
              </div>
              
              <!-- Media Panel -->
              <div class="media-panel">
                ${currentPage.media.length > 0 ? currentPage.media.map(media => {
                  if (media.type === 'image') {
                    return `
                      <div class="visual-container">
                        <img src="${sanitizeHTML(media.url)}" alt="${sanitizeHTML(media.title || 'Course image')}" />
                      </div>
                    `
                  } else if (media.type === 'video') {
                    // Check if it's a YouTube video
                    if (media.embedUrl || (media.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be')))) {
                      const embedUrl = media.embedUrl || media.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
                      return `
                        <div class="visual-container">
                          <iframe 
                            src="${sanitizeHTML(embedUrl)}" 
                            title="${sanitizeHTML(media.title || 'Video')}"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen
                            style="width: 100%; height: 100%; min-height: 300px;">
                          </iframe>
                        </div>
                      `
                    } else {
                      // Regular video
                      return `
                        <div class="visual-container">
                          <video controls style="width: 100%; height: auto;">
                            <source src="${sanitizeHTML(media.url)}" type="video/mp4">
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      `
                    }
                  }
                  return ''
                }).join('') : ''}
                
                <!-- Audio Player -->
                <div class="audio-player">
                  <div class="audio-main">
                    <button class="play-pause">▶</button>
                    <div class="audio-track">
                      <div class="track-progress">
                        <div class="track-fill"></div>
                      </div>
                      <div class="track-time">
                        <span>0:00</span>
                        <span>2:45</span>
                      </div>
                    </div>
                  </div>
                  <div class="audio-controls">
                    <button class="audio-btn">◀ 10s</button>
                    <button class="audio-btn">1x</button>
                    <button class="audio-btn active">CC</button>
                    <button class="audio-btn">🔊</button>
                    <button class="audio-btn">10s ▶</button>
                  </div>
                  <div class="caption-display">
                    ${sanitizeHTML(currentPage.narration)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Navigation Footer -->
          <footer class="nav-footer">
            <button class="nav-btn" id="prev-btn" ${currentPageIndex === 0 ? 'disabled' : ''}>
              ◀ Previous
            </button>
            <button class="nav-btn" id="next-btn" ${currentPageIndex === totalPages - 1 ? 'disabled' : ''}>
              Next ▶
            </button>
          </footer>
        </main>
      </div>
      
      <script>
        // Add interactivity for preview
        document.querySelectorAll('.nav-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.preventDefault()
            const page = item.dataset.page
            // In real implementation, this would navigate to the page
            alert('Navigate to: ' + page)
          })
        })
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            if (!btn.disabled) {
              alert(btn.id === 'prev-btn' ? 'Navigate to previous page' : 'Navigate to next page')
            }
          })
        })
        
        document.querySelector('.play-pause').addEventListener('click', function() {
          this.textContent = this.textContent === '▶' ? '❚❚' : '▶'
        })
        
        // Font size controls
        let fontSize = 100
        document.querySelectorAll('.control-btn').forEach((btn, idx) => {
          if (idx === 0) btn.addEventListener('click', () => {
            fontSize = Math.max(80, fontSize - 10)
            document.documentElement.style.fontSize = fontSize + '%'
          })
          if (idx === 1) btn.addEventListener('click', () => {
            fontSize = 100
            document.documentElement.style.fontSize = '100%'
          })
          if (idx === 2) btn.addEventListener('click', () => {
            fontSize = Math.min(120, fontSize + 10)
            document.documentElement.style.fontSize = fontSize + '%'
          })
          if (idx === 3) btn.addEventListener('click', () => {
            document.body.classList.toggle('high-contrast')
          })
        })
      </script>
    </body>
    </html>
  `
}