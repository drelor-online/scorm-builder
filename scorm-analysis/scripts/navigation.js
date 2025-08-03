
// Course-specific data
window.courseTopics = [
  {
    "id": "topic-0",
    "title": "Core Principles of Natural Gas Safety",
    "index": 0,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": 1,
      "explanation": "Correct! Mercaptan provides the recognizable 'rotten egg' smell to help detect leaks, as natural gas is naturally odorless."
    }
  },
  {
    "id": "topic-1",
    "title": "Recognizing and Identifying Gas Hazards",
    "index": 1,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": 0,
      "explanation": "That's correct! A chronic, slow gas leak can displace oxygen in the soil and kill vegetation directly above the pipeline."
    }
  },
  {
    "id": "topic-2",
    "title": "Evaluating and Mitigating Risks",
    "index": 2,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": "PPE",
      "explanation": "Excellent! PPE (Personal Protective Equipment) is crucial but is considered the least effective control because it doesn't eliminate or reduce the hazard itself."
    }
  },
  {
    "id": "topic-3",
    "title": "Essential PPE for Gas-Related Work",
    "index": 3,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": 2,
      "explanation": "Exactly! FRC is not fireproof, but it provides critical seconds of protection by resisting ignition and self-extinguishing."
    }
  },
  {
    "id": "topic-4",
    "title": "Responding to Natural Gas Emergencies",
    "index": 4,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": 3,
      "explanation": "Correct! The absolute first priority is to not create an ignition source. The next immediate action is to evacuate."
    }
  },
  {
    "id": "topic-5",
    "title": "Learning from Experience: Incident Reporting",
    "index": 5,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": 1,
      "explanation": "Correct! A high number of near-miss reports indicates a healthy safety culture where employees feel comfortable reporting potential problems before they lead to accidents."
    }
  },
  {
    "id": "topic-6",
    "title": "Navigating Gas Safety Regulations",
    "index": 6,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": 2,
      "explanation": "That's right! PHMSA is the lead federal agency for the safe operation of the nation's pipeline system."
    }
  },
  {
    "id": "topic-7",
    "title": "Striving for a Safer Tomorrow",
    "index": 7,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": "Check",
      "explanation": "Perfect! The 'Check' or 'Study' phase is critical for analyzing the results of a change before fully implementing it."
    }
  },
  {
    "id": "topic-8",
    "title": "Empowerment Through Training and Drills",
    "index": 8,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": 1,
      "explanation": "You got it! Refresher training is essential for reinforcing knowledge, adapting to new procedures, and maintaining a high level of safety awareness."
    }
  },
  {
    "id": "topic-9",
    "title": "Building a Proactive Safety Culture",
    "index": 9,
    "hasKnowledgeCheck": true,
    "knowledgeCheck": {
      "correctAnswer": 3,
      "explanation": "You've got it! A strong culture focuses on learning from incidents to improve the overall system, rather than placing blame on individuals."
    }
  }
];


// Initialize variables on window to avoid conflicts
window.currentPage = window.currentPage || 'welcome';
window.completedPages = window.completedPages || new Set();
window.courseStructure = window.courseStructure || [];
window.knowledgeCheckAttempts = window.knowledgeCheckAttempts || {};
window.navigationBlockCount = window.navigationBlockCount || {}; // Track how many times navigation was blocked per page
window.lastBlockTime = window.lastBlockTime || {}; // Track when navigation was last blocked
window.answeredQuestions = window.answeredQuestions || {}; // Track which questions have been answered

// Create local references for easier access
let currentPage = window.currentPage;
let completedPages = window.completedPages;
let courseStructure = window.courseStructure;
let knowledgeCheckAttempts = window.knowledgeCheckAttempts;
let navigationBlockCount = window.navigationBlockCount;
let lastBlockTime = window.lastBlockTime;
let answeredQuestions = window.answeredQuestions;
let currentMediaIndex = 0;
let audioPlayers = {};
let playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
let currentSpeedIndex = 2; // Default to 1x

// Custom alert system
function showCustomAlert(message, severity = 'info') {
    // If we're in an iframe, forward the alert to the parent window
    if (window !== window.parent && window.parent.showCustomAlert) {
        window.parent.showCustomAlert(message, severity);
        return;
    }
    
    const alertContainer = document.getElementById('scorm-alert-container');
    if (!alertContainer) {
        console.error('Alert container not found');
        return;
    }
    
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = 'scorm-alert';
    alertDiv.textContent = message;
    
    // Apply severity styling
    if (severity === 'error') {
        alertDiv.style.backgroundColor = '#ff4444';
        alertDiv.style.borderLeft = '4px solid #cc0000';
    } else if (severity === 'warning') {
        alertDiv.style.backgroundColor = '#ff9800';
        alertDiv.style.borderLeft = '4px solid #e68900';
    }
    
    // Add to container
    alertContainer.appendChild(alertDiv);
    
    // Trigger show animation
    setTimeout(() => {
        alertDiv.classList.add('show');
    }, 10);
    
    // Auto-hide after longer time for errors/warnings
    const displayTime = severity === 'error' ? 5000 : severity === 'warning' ? 4000 : 3000;
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            alertDiv.remove();
        }, 300); // Wait for fade out animation
    }, displayTime);
}

function highlightKnowledgeCheck() {
    // Find knowledge check elements
    const selectors = ['.knowledge-check-container', '.knowledge-check', '[data-knowledge-check]', '.quiz-container'];
    let kcElement = null;
    
    // Try to find in main document
    for (const selector of selectors) {
        kcElement = document.querySelector(selector);
        if (kcElement) break;
    }
    
    // If not found, try in iframe
    if (!kcElement) {
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentDocument) {
            for (const selector of selectors) {
                kcElement = iframe.contentDocument.querySelector(selector);
                if (kcElement) break;
            }
        }
    }
    
    if (kcElement) {
        // Scroll into view
        kcElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight effect
        const originalStyle = {
            outline: kcElement.style.outline,
            boxShadow: kcElement.style.boxShadow,
            transition: kcElement.style.transition
        };
        
        kcElement.style.outline = '3px solid #ff4444';
        kcElement.style.boxShadow = '0 0 20px rgba(255, 68, 68, 0.5)';
        kcElement.style.transition = 'all 0.3s ease';
        
        // Remove highlight after 5 seconds
        setTimeout(() => {
            kcElement.style.outline = originalStyle.outline;
            kcElement.style.boxShadow = originalStyle.boxShadow;
            kcElement.style.transition = originalStyle.transition;
        }, 5000);
    }
}

let courseInitialized = false;

function initializeCourse() {
    console.log('[SCORM Navigation] initializeCourse called');
    
    // Force container to full size first
    if (window.parent && window.parent !== window) {
        try {
            // Try to get Moodle's SCORM player container
            const playerContainer = window.parent.document.getElementById('scorm_object') || 
                                  window.parent.document.querySelector('.scorm-player-container') ||
                                  window.parent.document.querySelector('[role="main"]');
            
            if (playerContainer) {
                playerContainer.style.height = '100vh';
                playerContainer.style.minHeight = '800px';
                playerContainer.style.width = '100%';
            }
            
            // Find all iframes and expand them
            const iframes = window.parent.document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                if (iframe.src && iframe.src.includes('scorm')) {
                    iframe.style.width = '100%';
                    iframe.style.height = '100vh';
                    iframe.style.minHeight = '800px';
                    iframe.style.position = 'relative';
                }
            });
        } catch (e) {
            console.log('[SCORM Navigation] Cannot access parent document');
        }
    }
    
    // Prevent multiple initializations
    if (courseInitialized) {
        console.log('[SCORM Navigation] Course already initialized, skipping...');
        return;
    }
    
    // Check if required elements exist
    const contentArea = document.getElementById('content-area');
    if (!contentArea) {
        console.error('[SCORM Navigation] CRITICAL ERROR: content-area element not found!');
        // Try again after a short delay in case DOM isn't ready
        setTimeout(() => {
            const retryContentArea = document.getElementById('content-area');
            if (retryContentArea) {
                console.log('[SCORM Navigation] Found content-area on retry, initializing...');
                initializeCourse();
            } else {
                document.body.innerHTML = '<div style="color: red; padding: 20px; font-size: 18px;">Error: SCORM package failed to load. Missing content-area element.</div>';
            }
        }, 100);
        return;
    }
    
    courseInitialized = true;
    
    // Initialize SCORM
    if (window.scormAPI) {
        console.log('[SCORM Navigation] Initializing SCORM API...');
        window.scormAPI.LMSInitialize("");
        window.scormAPI.LMSSetValue("cmi.core.lesson_status", "incomplete");
    } else {
        console.log('[SCORM Navigation] SCORM API not found - running in standalone mode');
    }
    
    // Set up navigation structure
    const navItems = document.querySelectorAll('.nav-item');
    console.log('[SCORM Navigation] Found nav items:', navItems.length);
    
    if (navItems.length === 0) {
        console.error('[SCORM Navigation] ERROR: No navigation items found!');
        document.body.innerHTML += '<div style="color: red; padding: 20px;">Error: No navigation items found. Package structure may be corrupted.</div>';
        return;
    }
    
    courseStructure = Array.from(navItems).map(item => ({
        id: item.dataset.page,
        element: item
    }));
    
    console.log('[SCORM Navigation] Course structure:', courseStructure.map(s => s.id));
    
    // Add click handlers to nav items
    navItems.forEach((navItem, index) => {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetPage = this.dataset.page;
            const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
            const targetIndex = courseStructure.findIndex(item => item.id === targetPage);
            
            // Check if trying to navigate forward
            if (targetIndex > currentIndex && shouldBlockNavigation()) {
                // Track how many times navigation was blocked
                if (!navigationBlockCount[currentPage]) {
                    navigationBlockCount[currentPage] = 0;
                }
                navigationBlockCount[currentPage]++;
                lastBlockTime[currentPage] = Date.now();
                
                // Show different messages based on block count
                if (navigationBlockCount[currentPage] === 1) {
                    showCustomAlert("Please complete the knowledge check before proceeding.", "warning");
                } else if (navigationBlockCount[currentPage] === 2) {
                    showCustomAlert("You must answer the knowledge check question to continue. The question is highlighted below.", "warning");
                    highlightKnowledgeCheck();
                } else {
                    showCustomAlert("Navigation is blocked. Complete the knowledge check on this page first!", "error");
                    highlightKnowledgeCheck();
                }
                
                return;
            }
            
            // Allow navigation
            loadPage(targetPage);
        });
    });
    
    // Update visual state of nav items
    updateNavItemStates();
    
    // Initialize audio players if on topic page
    initializeAudioPlayers();
    
    console.log('[SCORM Navigation] Initialization complete');
}

// Expose initializeCourse to window immediately after definition
window.initializeCourse = initializeCourse;

function updateNavItemStates() {
    const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
    const hasKnowledgeCheck = hasKnowledgeCheckOnPage(currentPage);
    const isKnowledgeCheckAnswered = hasAnsweredKnowledgeCheck(currentPage);
    
    courseStructure.forEach((item, index) => {
        const navElement = item.element;
        
        // Remove all state classes first
        navElement.classList.remove('nav-item-disabled', 'nav-item-completed', 'active');
        
        // Add appropriate classes
        if (index === currentIndex) {
            navElement.classList.add('active');
        } else if (index < currentIndex || completedPages.has(item.id)) {
            navElement.classList.add('nav-item-completed');
        } else if (index > currentIndex && hasKnowledgeCheck && !isKnowledgeCheckAnswered) {
            // Disable forward navigation if current page has unanswered knowledge check
            navElement.classList.add('nav-item-disabled');
        }
    });
}

function hasKnowledgeCheckOnPage(pageId) {
    // Check if the current page has a knowledge check
    // This will be determined by the presence of knowledge check elements
    const selectors = ['.knowledge-check-container', '.knowledge-check', '[data-knowledge-check]'];
    
    for (const selector of selectors) {
        if (document.querySelector(selector)) return true;
        
        // Check in iframe if present
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentDocument && iframe.contentDocument.querySelector(selector)) {
            return true;
        }
    }
    
    return false;
}

function initializeAudioPlayers() {
    const audioElements = document.querySelectorAll('audio');
    console.log('Found audio elements:', audioElements.length);
    
    audioElements.forEach((audio) => {
        // Get identifier from audio element ID
        const audioId = audio.id;
        let identifier;
        
        console.log('Initializing audio player:', audioId, 'src:', audio.src);
        
        if (audioId.includes('welcome')) {
            identifier = 'welcome';
        } else if (audioId.includes('objectives')) {
            identifier = 'objectives';
        } else {
            // Extract topic number
            const match = audioId.match(/topic-(\d+)/);
            identifier = match ? parseInt(match[1]) - 1 : 0;
        }
        
        // Set up event listeners
        audio.addEventListener('loadedmetadata', () => {
            console.log('Audio loadedmetadata:', identifier, 'duration:', audio.duration);
            const durationEl = document.getElementById('duration-' + (identifier) + '');
            if (durationEl && !isNaN(audio.duration)) {
                durationEl.textContent = formatTime(audio.duration);
                console.log('Updated duration display for:', identifier);
            } else {
                console.warn('Duration element not found or invalid duration:', 'duration-' + (identifier) + '', audio.duration);
            }
        });
        
        // Also try durationchange event
        audio.addEventListener('durationchange', () => {
            const durationEl = document.getElementById('duration-' + (identifier) + '');
            if (durationEl && !isNaN(audio.duration) && audio.duration > 0) {
                durationEl.textContent = formatTime(audio.duration);
            }
        });
        
        // Add error handling for audio loading
        audio.addEventListener('error', (e) => {
            console.error('Audio loading error for', identifier, ':', e);
            const durationEl = document.getElementById('duration-' + (identifier) + '');
            if (durationEl) {
                durationEl.textContent = 'Error';
            }
        });
        
        // Force load the audio metadata
        if (audio.src && audio.readyState < 1) {
            console.log('Force loading audio:', identifier);
            audio.load();
        }
        
        // Also check if duration is already available
        if (audio.duration && !isNaN(audio.duration)) {
            console.log('Duration already available:', identifier, audio.duration);
            const durationEl = document.getElementById('duration-' + (identifier) + '');
            if (durationEl) {
                durationEl.textContent = formatTime(audio.duration);
            }
        }
        
        audio.addEventListener('timeupdate', () => {
            updateAudioProgress(identifier);
        });
        
        audio.addEventListener('ended', () => {
            const playBtn = audio.parentElement.querySelector('.play-pause');
            if (playBtn) playBtn.textContent = '▶';
        });
        
        // Initialize captions if available
        initializeAudioCaptions(audio, identifier);
        
        // Show caption display by default
        const captionDisplay = document.getElementById('caption-display-' + (identifier) + '');
        const ccBtn = document.getElementById('cc-btn-' + (identifier) + '');
        if (captionDisplay) {
            captionDisplay.classList.add('show');
        }
        if (ccBtn) {
            ccBtn.classList.add('active');
        }
    });
}

function loadPage(pageId) {
    // Check if moving forward and current page has knowledge check that needs to be attempted
    const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
    const newIndex = courseStructure.findIndex(item => item.id === pageId);
    
    // Block any forward navigation (not just the next page) if knowledge check is unanswered
    if (newIndex > currentIndex && shouldBlockNavigation()) {
        showCustomAlert("Please attempt the knowledge check question before proceeding.");
        return;
    }
    
    // Special check for assessment page - ensure all topics with knowledge checks have been attempted
    if (pageId === 'assessment') {
        const incompleteTopic = checkAllTopicsCompleted();
        if (incompleteTopic) {
            showCustomAlert('Please complete all topic knowledge checks before taking the assessment. Topic "' + (incompleteTopic) + '" still needs to be completed.');
            return;
        }
    }
    
    currentPage = pageId;
    window.currentPage = pageId; // Update window variable for iframe access
    
    // Initialize knowledge check attempts for pages with knowledge checks
    const pageItem = courseStructure.find(item => item.id === pageId);
    if (pageItem && pageItem.hasKnowledgeCheck && knowledgeCheckAttempts[pageId] === undefined) {
        knowledgeCheckAttempts[pageId] = false;
    }
    
    // Update navigation highlighting
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });
    
    // Update content area
    const contentArea = document.getElementById('content-area');
    
    if (!contentArea) {
        console.error('Content area not found - navigation.js may have loaded before DOM ready');
        // Try to initialize the course if not already done
        if (!courseInitialized) {
            console.log('[SCORM Navigation] Attempting to initialize course...');
            initializeCourse();
        }
        return;
    }
    
    // Load content directly without iframe to fix Moodle sizing issues
    console.log('[SCORM Navigation] Loading page:', pageId);
    
    let pageSrc = '';
    let pageTitle = '';
    
    if (pageId === 'welcome') {
        pageSrc = 'pages/welcome.html';
        pageTitle = 'Welcome';
    } else if (pageId === 'objectives') {
        pageSrc = 'pages/objectives.html';
        pageTitle = 'Learning Objectives';
    } else if (pageId.startsWith('topic-')) {
        pageSrc = 'pages/' + pageId + '.html';
        // Get actual topic title from courseTopics data
        const topic = window.courseTopics.find(t => t.id === pageId || 'topic-' + (t.index + 1) === pageId);
        pageTitle = topic ? topic.title : 'Topic';
    } else if (pageId === 'assessment') {
        pageSrc = 'pages/assessment.html';
        pageTitle = 'Assessment';
    }
    
    if (pageSrc) {
        console.log('[SCORM Navigation] Loading content from:', pageSrc);
        
        // Fetch the page content directly
        fetch(pageSrc)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load page: ' + response.status);
                }
                return response.text();
            })
            .then(html => {
                // Extract the body content from the HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const bodyContent = doc.body.innerHTML;
                
                // Insert content directly into the content area
                contentArea.innerHTML = bodyContent;
                
                console.log('[SCORM Navigation] Page loaded successfully:', pageSrc);
                
                // Initialize page-specific functionality
                if (pageId !== 'assessment') {
                    initializeTopicPageDirect(pageId);
                } else {
                    initializeAssessmentDirect();
                }
                
                // Fix media paths for Moodle environment (after other initialization)
                fixMediaPaths();
                
                // Re-initialize audio players for the new content
                initializePageAudio(pageId);
            })
            .catch(error => {
                console.error('[SCORM Navigation] Failed to load page:', pageSrc, error);
                contentArea.innerHTML = '<div style="padding: 20px; color: red;">Error loading page: ' + pageSrc + '</div>';
            });
        
        // Update title
        const titleElement = document.getElementById('current-title');
        if (titleElement) {
            titleElement.textContent = pageTitle;
        }
    } else {
        console.error('[SCORM Navigation] Unknown page ID:', pageId);
    }
    
    // Mark page as completed
    if (!completedPages.has(pageId)) {
        completedPages.add(pageId);
        markAsCompleted(pageId);
    }
    
    // Update progress
    updateProgress();
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Update nav item visual states
    updateNavItemStates();
    
    // Check if this page has a knowledge check and disable next button if not answered
    const hasKnowledgeCheck = document.querySelector('.knowledge-check-container, .knowledge-check, [data-knowledge-check]') !== null;
    if (hasKnowledgeCheck && !hasAnsweredKnowledgeCheck(pageId)) {
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.setAttribute('data-requires-answer', 'true');
        }
    }
    
    // Update SCORM
    if (window.scormAPI) {
        window.scormAPI.LMSSetValue("cmi.core.lesson_location", pageId);
        window.scormAPI.LMSCommit("");
    }
}

// Initialize topic page functionality when content is loaded directly (not in iframe)
function initializeTopicPageDirect(pageId) {
    console.log('[SCORM Navigation] Initializing topic page directly:', pageId);
    
    // Initialize audio for this page
    const pageIndex = pageId === 'welcome' ? 'welcome' : 
                     pageId === 'objectives' ? 'objectives' : 
                     pageId.replace('topic-', '');
    
    // Initialize knowledge check if present
    const kcContainer = document.querySelector('.knowledge-check-container, .knowledge-check, [data-knowledge-check]');
    if (kcContainer) {
        initializeKnowledgeCheckDirect(pageId);
    }
    
    // Replace all parent. references with direct function calls
    replaceParentReferences();
    
    // Initialize any media elements
    const images = document.querySelectorAll('.media-image img, .content-image');
    images.forEach(img => {
        img.addEventListener('click', function() {
            const title = this.alt || 'Image';
            enlargeImage(this.src, title);
        });
    });
}

// Initialize assessment page when content is loaded directly
function initializeAssessmentDirect() {
    console.log('[SCORM Navigation] Initializing assessment directly');
    
    const assessmentQuestions = document.querySelectorAll('.assessment-question');
    assessmentQuestions.forEach((question, index) => {
        const inputs = question.querySelectorAll('input[type="radio"]');
        inputs.forEach(input => {
            input.addEventListener('change', function() {
                validateAssessmentAnswer(index, this.value);
            });
        });
    });
    
    // Add submit button handler if present
    const submitBtn = document.getElementById('submit-assessment');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitAssessment);
    }
}

// Initialize audio for a specific page
function initializePageAudio(pageId) {
    console.log('[SCORM Navigation] Initializing audio for page:', pageId);
    
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        const audioId = audio.id || '';
        let identifier;
        
        if (pageId === 'welcome') {
            identifier = 'welcome';
        } else if (pageId === 'objectives') {
            identifier = 'objectives';
        } else if (pageId.startsWith('topic-')) {
            identifier = pageId; // Use full page ID like 'topic-1'
        }
        
        if (identifier !== undefined) {
            // Initialize audio player controls
            initializeAudioPlayer(audio, identifier);
            
            // Initialize captions
            initializeAudioCaptions(audio, identifier);
        }
    });
}

// Initialize knowledge check functionality for direct DOM
function initializeKnowledgeCheckDirect(pageId) {
    const kcInputs = document.querySelectorAll('.knowledge-check input[type="radio"]');
    
    kcInputs.forEach(input => {
        input.addEventListener('change', function() {
            const questionContainer = this.closest('.knowledge-check-question') || this.closest('.knowledge-check');
            const isCorrect = this.dataset.correct === this.value;
            
            // Mark as attempted
            if (!knowledgeCheckAttempts[pageId]) {
                knowledgeCheckAttempts[pageId] = true;
                console.log('Knowledge check attempted for page:', pageId);
            }
            
            // Show feedback
            const feedbackEl = questionContainer.querySelector('.feedback, .explanation');
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = isCorrect ? 'feedback correct' : 'feedback incorrect';
            }
            
            // Update navigation if correct
            if (isCorrect) {
                updateNavigationButtons();
            }
        });
    });
}

// Initialize audio player controls
function initializeAudioPlayer(audio, identifier) {
    // Set up basic audio controls
    audio.addEventListener('loadedmetadata', () => {
        const durationEl = document.getElementById('duration-' + identifier);
        if (durationEl && !isNaN(audio.duration)) {
            durationEl.textContent = formatTime(audio.duration);
        }
    });
    
    audio.addEventListener('timeupdate', () => {
        updateAudioProgress(identifier);
    });
    
    audio.addEventListener('ended', () => {
        const playBtn = audio.parentElement?.querySelector('.play-pause');
        if (playBtn) playBtn.textContent = '▶';
    });
}

function initializeAudioCaptions(audio, identifier) {
    // Debug logging
    console.log('Initializing captions for', identifier, 'TextTracks:', audio.textTracks?.length);
    
    if (audio.textTracks && audio.textTracks.length > 0) {
        const track = audio.textTracks[0];
        
        // Force track to be active
        track.mode = 'showing';
        
        // No offset needed - use exact VTT timings to prevent drift
        // Store original cue times without adjustment
        track.addEventListener('load', function() {
            const cues = track.cues;
            if (cues) {
                console.log('Caption track loaded with', cues.length, 'cues for', identifier);
            }
        });
        
        // Handle track loading
        if (track.readyState === 0) { // Not loaded
            track.addEventListener('load', function() {
                console.log('Caption track loaded for', identifier);
                setupCaptionDisplay(track, identifier, audio);
            });
        } else {
            // Already loaded
            setupCaptionDisplay(track, identifier, audio);
        }
        
        // Also handle errors
        track.addEventListener('error', function(e) {
            console.error('Caption track error for', identifier, e);
        });
    }
}

function setupCaptionDisplay(track, identifier, audio) {
    const captionText = document.getElementById('caption-text-' + (identifier) + '');
    const captionDisplay = document.getElementById('caption-display-' + (identifier) + '');
    
    if (!captionText || !captionDisplay) {
        console.error('Caption elements not found for', identifier);
        return;
    }
    
    // Clear any existing listeners
    track.removeEventListener('cuechange', track._cueChangeHandler);
    
    // Create new handler with timing compensation
    track._cueChangeHandler = function() {
        if (this.activeCues && this.activeCues.length > 0) {
            const cueText = this.activeCues[0].text;
            captionText.textContent = cueText;
            console.log('Caption cue:', cueText);
        } else {
            captionText.textContent = '';
        }
    };
    
    track.addEventListener('cuechange', track._cueChangeHandler);
    
    // Add timeupdate handler for more precise caption sync
    if (audio) {
        audio.addEventListener('timeupdate', function() {
            // Use actual current time without lookahead to prevent drift
            const currentTime = audio.currentTime;
            let activeCue = null;
            
            if (track.cues) {
                for (let i = 0; i < track.cues.length; i++) {
                    const cue = track.cues[i];
                    if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
                        activeCue = cue;
                        break;
                    }
                }
            }
            
            if (activeCue && captionText.textContent !== activeCue.text) {
                captionText.textContent = activeCue.text;
            } else if (!activeCue && captionText.textContent !== '') {
                captionText.textContent = '';
            }
        });
    }
    
    // Trigger initial cue if any
    if (track.activeCues && track.activeCues.length > 0) {
        captionText.textContent = track.activeCues[0].text;
    }
}

function initializeTopicPage(iframe) {
    // Re-initialize audio players for the new content
    setTimeout(() => {
        // Check if iframe and its content are accessible
        if (!iframe || !iframe.contentWindow) {
            console.error('[SCORM Navigation] Cannot access iframe content');
            return;
        }
        
        let iframeDoc;
        try {
            iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        } catch (e) {
            console.error('[SCORM Navigation] Cannot access iframe document:', e);
            return;
        }
        
        if (!iframeDoc) {
            console.error('[SCORM Navigation] Iframe document is null');
            return;
        }
        
        const audioElements = iframeDoc.querySelectorAll('audio');
        audioElements.forEach((audio) => {
            // Get identifier from audio element ID
            const audioId = audio.id;
            let identifier;
            
            if (audioId.includes('welcome')) {
                identifier = 'welcome';
            } else if (audioId.includes('objectives')) {
                identifier = 'objectives';
            } else {
                // Extract topic ID from audio element ID
                const match = audioId.match(/topic-\d+/);
                identifier = match ? match[0] : 'topic-1';
            }
            
            // Set up audio event listeners within iframe context
            audio.addEventListener('loadedmetadata', () => {
                console.log('Iframe audio loadedmetadata:', identifier, 'duration:', audio.duration);
                const durationEl = iframeDoc.getElementById('duration-' + (identifier) + '');
                if (durationEl && !isNaN(audio.duration)) {
                    durationEl.textContent = formatTime(audio.duration);
                    console.log('Updated iframe duration display for:', identifier);
                } else {
                    console.warn('Iframe duration element not found or invalid duration:', 'duration-' + (identifier) + '', audio.duration);
                }
            });
            
            // Also try durationchange event in iframe
            audio.addEventListener('durationchange', () => {
                const durationEl = iframeDoc.getElementById('duration-' + (identifier) + '');
                if (durationEl && !isNaN(audio.duration) && audio.duration > 0) {
                    durationEl.textContent = formatTime(audio.duration);
                }
            });
            
            // Add error handling for audio loading
            audio.addEventListener('error', (e) => {
                console.error('Audio loading error in iframe for', identifier, ':', e);
                const durationEl = iframeDoc.getElementById('duration-' + (identifier) + '');
                if (durationEl) durationEl.textContent = 'Error';
            });
            
            // Force load the audio metadata
            if (audio.src && audio.readyState < 1) {
                console.log('Force loading iframe audio:', identifier);
                audio.load();
            }
            
            // Also check if duration is already available
            if (audio.duration && !isNaN(audio.duration)) {
                console.log('Iframe duration already available:', identifier, audio.duration);
                const durationEl = iframeDoc.getElementById('duration-' + (identifier) + '');
                if (durationEl) {
                    durationEl.textContent = formatTime(audio.duration);
                }
            }
            
            // Add timeupdate handler for progress
            audio.addEventListener('timeupdate', () => {
                const currentTimeEl = iframeDoc.getElementById('current-time-' + (identifier) + '');
                if (currentTimeEl) {
                    currentTimeEl.textContent = formatTime(audio.currentTime);
                }
                
                const trackFill = iframeDoc.getElementById('track-fill-' + (identifier) + '');
                if (trackFill && audio.duration > 0) {
                    const progress = (audio.currentTime / audio.duration) * 100;
                    trackFill.style.width = progress + '%';
                }
            });
            
            // Initialize captions
            console.log('Iframe: Initializing captions for', identifier, 'TextTracks:', audio.textTracks?.length);
            
            if (audio.textTracks && audio.textTracks.length > 0) {
                const track = audio.textTracks[0];
                track.mode = 'showing';
                
                // Handle track loading in iframe context
                const setupIframeCaptions = () => {
                    const captionText = iframeDoc.getElementById('caption-text-' + identifier);
                    const captionDisplay = iframeDoc.getElementById('captionDisplay-' + identifier);
                    
                    if (!captionText || !captionDisplay) {
                        console.error('Iframe: Caption elements not found for', identifier);
                        return;
                    }
                    
                    track.addEventListener('cuechange', function() {
                        if (this.activeCues && this.activeCues.length > 0) {
                            const cueText = this.activeCues[0].text;
                            captionText.textContent = cueText;
                            console.log('Iframe caption cue:', cueText);
                        } else {
                            captionText.textContent = '';
                        }
                    });
                    
                    // Add timeupdate handler for more precise caption sync in iframe
                    audio.addEventListener('timeupdate', function() {
                        const currentTime = audio.currentTime; // Use actual time to prevent drift
                        let activeCue = null;
                        
                        if (track.cues) {
                            for (let i = 0; i < track.cues.length; i++) {
                                const cue = track.cues[i];
                                if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
                                    activeCue = cue;
                                    break;
                                }
                            }
                        }
                        
                        if (activeCue && captionText.textContent !== activeCue.text) {
                            captionText.textContent = activeCue.text;
                        } else if (!activeCue && captionText.textContent !== '') {
                            captionText.textContent = '';
                        }
                    });
                    
                    // Trigger initial cue if any
                    if (track.activeCues && track.activeCues.length > 0) {
                        captionText.textContent = track.activeCues[0].text;
                    }
                };
                
                if (track.readyState === 0) {
                    track.addEventListener('load', setupIframeCaptions);
                } else {
                    setupIframeCaptions();
                }
            }
        });
        
        // Show caption displays by default
        const captionDisplays = iframeDoc.querySelectorAll('.caption-display');
        captionDisplays.forEach(display => display.classList.add('show'));
    }, 100);
}

function hasAnsweredKnowledgeCheck(pageId) {
    return answeredQuestions[pageId] === true || knowledgeCheckAttempts[pageId] === true;
}

function shouldBlockNavigation() {
    const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
    const nextIndex = currentIndex + 1;
    
    // Only block forward navigation
    if (nextIndex >= courseStructure.length) return false;
    
    // Re-check the current state of knowledgeCheckAttempts
    // This ensures we have the latest state after iframe updates
    const isAttempted = hasAnsweredKnowledgeCheck(currentPage);
    
    // Check if current page has unattempted knowledge check
    const hasKnowledgeCheck = document.body.dataset.hasKnowledgeCheck === 'true' ||
                            (document.querySelector('iframe') && 
                             document.querySelector('iframe').contentDocument?.body.dataset.hasKnowledgeCheck === 'true');
    
    if (hasKnowledgeCheck && !isAttempted) {
        // Implement rate limiting and escalating warnings
        const now = Date.now();
        const timeSinceLastBlock = now - (lastBlockTime[currentPage] || 0);
        const blockCount = navigationBlockCount[currentPage] || 0;
        
        // Update tracking
        navigationBlockCount[currentPage] = blockCount + 1;
        lastBlockTime[currentPage] = now;
        
        // Escalate warnings based on attempt count
        if (blockCount >= 5) {
            // After 5 attempts, make the message more stern
            showCustomAlert("⚠️ Knowledge check completion is REQUIRED. You cannot proceed without answering the question.", 'error');
            // Also highlight the knowledge check area
            highlightKnowledgeCheck();
        } else if (blockCount >= 3) {
            // After 3 attempts, provide more guidance
            showCustomAlert("Please scroll down and complete the knowledge check question below before continuing.", 'warning');
        }
        
        // Always block if not attempted - blockNavigation
        return true;
    }
    
    return false;
}

function checkAllTopicsCompleted() {
    // Check all topics with knowledge checks to see if they have been attempted
    if (!window.courseTopics) return null;
    
    for (const topic of window.courseTopics) {
        if (topic.hasKnowledgeCheck) {
            const topicPageId = 'topic-' + (topic.index + 1) + '';
            // If this topic hasn't been attempted, return its title
            if (!knowledgeCheckAttempts[topicPageId]) {
                return topic.title;
            }
        }
    }
    
    return null; // All topics completed
}

function markAsCompleted(pageId) {
    const navItem = document.querySelector('[data-page="' + (pageId) + '"]');
    if (navItem) {
        navItem.classList.add('completed');
    }
}

function updateProgress() {
    const totalPages = courseStructure.length;
    const completedCount = completedPages.size;
    const percentage = Math.round((completedCount / totalPages) * 100);
    
    // Update percentage text
    document.getElementById('progress-percentage').textContent = percentage;
    
    // Update progress circle
    const progressCircle = document.querySelector('.progress-circle-fill');
    if (progressCircle) {
        // Calculate stroke-dashoffset (339.292 is the circumference of the circle)
        const circumference = 339.292;
        const offset = circumference - (circumference * percentage / 100);
        progressCircle.style.strokeDashoffset = offset;
    }
    
    // Update SCORM progress
    if (window.scormAPI) {
        window.scormAPI.LMSSetValue("cmi.core.score.raw", percentage);
        
        if (percentage === 100) {
            window.scormAPI.LMSSetValue("cmi.core.lesson_status", "completed");
        }
    }
}

function calculateProgress() {
    return Math.round((completedPages.size / courseStructure.length) * 100);
}

function navigateNext() {
    if (shouldBlockNavigation()) {
        showCustomAlert("Please complete the knowledge check before proceeding.");
        return;
    }
    
    const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
    if (currentIndex < courseStructure.length - 1) {
        loadPage(courseStructure[currentIndex + 1].id);
    }
}

function navigatePrevious() {
    // No restrictions on going back
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

// Helper functions for finding elements across iframe boundaries
function findElementById(elementId) {
    // First try to find in iframe (when called from parent)
    let element = null;
    const iframe = document.getElementById('content-frame') || document.querySelector('#content-area iframe');
    if (iframe && iframe.contentDocument) {
        element = iframe.contentDocument.getElementById(elementId);
    }
    
    // If not found in iframe, try current document
    if (!element) {
        element = document.getElementById(elementId);
    }
    
    // If still not found and we're in an iframe, try parent
    if (!element && window.parent && window.parent.document) {
        element = window.parent.document.getElementById(elementId);
    }
    
    return element;
}

// Audio player functions
function findAudioElement(audioId) {
    return findElementById(audioId);
}

// Wrapper function for toggleAudio that uses pageId
function toggleAudioPlayback(pageId, event) {
    if (event) event.preventDefault();
    const audio = document.getElementById('audio-player-' + pageId);
    const playBtn = event?.target || document.querySelector('.play-pause');
    
    if (audio) {
        if (audio.paused) {
            audio.play().then(() => {
                if (playBtn) playBtn.textContent = '⏸';
            }).catch(e => {
                console.error('Error playing audio:', e);
                // Don't show alert for missing media files in SCORM environment
            });
        } else {
            audio.pause();
            if (playBtn) playBtn.textContent = '▶';
        }
    }
}

function toggleAudio(identifier, event) {
    // Handle both numeric indices and string identifiers
    const audioId = typeof identifier === 'number' ? 'audio-player-topic-' + (identifier + 1) + '' : 'audio-player-' + (identifier) + '';
    const audio = findAudioElement(audioId);
    const playBtn = event ? event.target : null;
    
    if (!audio) {
        console.error('Audio element not found:', audioId);
        return;
    }
    
    if (audio.paused) {
        audio.play().then(() => {
            playBtn.textContent = '❚❚';
        }).catch(e => {
            console.error('Error playing audio:', e);
            showCustomAlert('Error playing audio. Please check if the audio file exists.');
        });
    } else {
        audio.pause();
        playBtn.textContent = '▶';
    }
}

function updateAudioProgress(identifier) {
    // Handle both numeric indices and string identifiers
    const audioId = typeof identifier === 'number' ? 'audio-player-topic-' + (identifier + 1) + '' : 'audio-player-' + (identifier) + '';
    const audio = findAudioElement(audioId);
    
    if (!audio || isNaN(audio.duration) || audio.duration === 0) return;
    
    const progress = (audio.currentTime / audio.duration) * 100;
    
    const trackFill = document.getElementById('track-fill-' + (identifier) + '');
    if (trackFill) {
        trackFill.style.width = progress + '%';
    }
    
    const currentTimeEl = document.getElementById('current-time-' + (identifier) + '');
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
}

function seekAudio(event, identifier) {
    const audioId = typeof identifier === 'number' ? 'audio-player-topic-' + (identifier + 1) + '' : 'audio-player-' + (identifier) + '';
    const audio = findAudioElement(audioId);
    const progressBar = event.currentTarget;
    const clickX = event.offsetX;
    const width = progressBar.offsetWidth;
    const newTime = (clickX / width) * audio.duration;
    
    audio.currentTime = newTime;
}

function toggleCaptions(identifier) {
    const captionDisplay = document.getElementById('caption-display-' + identifier);
    const ccBtn = document.getElementById('cc-btn-' + identifier);
    const audioId = typeof identifier === 'number' ? 'audio-player-topic-' + (identifier + 1) : 'audio-player-' + identifier;
    const audio = findAudioElement(audioId);
    
    if (!captionDisplay) {
        console.warn('Caption display not found for:', identifier);
        return;
    }
    
    if (captionDisplay.classList.contains('show')) {
        captionDisplay.classList.remove('show');
        if (ccBtn) ccBtn.classList.remove('active');
        // Disable text tracks
        if (audio && audio.textTracks && audio.textTracks[0]) {
            audio.textTracks[0].mode = 'hidden';
        }
    } else {
        captionDisplay.classList.add('show');
        if (ccBtn) ccBtn.classList.add('active');
        // Enable text tracks
        if (audio && audio.textTracks && audio.textTracks[0]) {
            audio.textTracks[0].mode = 'showing';
            audio.textTracks[0].addEventListener('cuechange', function() {
                const cues = this.activeCues;
                if (cues && cues.length > 0) {
                    const captionText = document.getElementById('caption-text-' + identifier);
                    if (captionText) captionText.textContent = cues[0].text;
                }
            });
        }
    }
}

function skip(seconds, identifier) {
    if (!seconds || identifier === undefined) {
        console.warn('Skip function called without proper parameters');
        return;
    }
    const audioId = typeof identifier === 'number' ? 'audio-player-topic-' + (identifier + 1) : 'audio-player-' + identifier;
    const audio = findAudioElement(audioId);
    if (audio && !isNaN(audio.duration) && isFinite(audio.duration)) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    }
}

function changeSpeed(identifier) {
    const audioId = typeof identifier === 'number' ? 'audio-player-topic-' + (identifier + 1) : 'audio-player-' + identifier;
    const audio = findAudioElement(audioId);
    const speedBtn = findElementById('speed-btn-' + identifier);
    
    currentSpeedIndex = (currentSpeedIndex + 1) % playbackSpeeds.length;
    const newSpeed = playbackSpeeds[currentSpeedIndex];
    
    audio.playbackRate = newSpeed;
    speedBtn.textContent = newSpeed + 'x';
}

function toggleVolume(identifier, event) {
    const audioId = typeof identifier === 'number' ? 'audio-player-topic-' + (identifier + 1) : 'audio-player-' + identifier;
    const audio = findAudioElement(audioId);
    if (audio) {
        audio.muted = !audio.muted;
        if (event && event.target) event.target.textContent = audio.muted ? '🔇' : '🔊';
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) {
        return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// Function to replace parent. references with direct function calls
function replaceParentReferences() {
    // Fix onclick handlers that reference parent functions
    document.querySelectorAll('[onclick*="parent."]').forEach(element => {
        let onclick = element.getAttribute('onclick');
        if (onclick) {
            // Remove parent. prefix
            onclick = onclick.replace(/parent\./g, '');
            
            // Also fix media paths in onclick handlers (for enlargeImage calls)
            onclick = onclick.replace(/\.\.\/media\//g, 'media/');
            
            element.setAttribute('onclick', onclick);
        }
    });
}

// Function to fix media paths for Moodle environment
function fixMediaPaths() {
    // In Moodle, relative paths need to be resolved from the SCORM package root
    // Get the base URL of the current document
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    
    // Fix image sources
    document.querySelectorAll('img[src^="../media/"]').forEach(img => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('../media/')) {
            // Convert relative path to be relative from index.html location
            img.setAttribute('src', src.replace('../', ''));
        }
    });
    
    // Fix audio sources
    document.querySelectorAll('audio[src^="../media/"]').forEach(audio => {
        const src = audio.getAttribute('src');
        if (src && src.startsWith('../media/')) {
            audio.setAttribute('src', src.replace('../', ''));
        }
    });
    
    // Fix video sources
    document.querySelectorAll('video[src^="../media/"], source[src^="../media/"]').forEach(media => {
        const src = media.getAttribute('src');
        if (src && src.startsWith('../media/')) {
            media.setAttribute('src', src.replace('../', ''));
        }
    });
    
    // Fix track (caption) sources
    document.querySelectorAll('track[src^="../media/"]').forEach(track => {
        const src = track.getAttribute('src');
        if (src && src.startsWith('../media/')) {
            track.setAttribute('src', src.replace('../', ''));
        }
    });
}

// Navigation gate functions
function canNavigateNext() {
    const nextBtn = document.getElementById("nextBtn");
    if (!nextBtn) return true;
    
    if (nextBtn.dataset.requiresAnswer === "true" && nextBtn.disabled) {
        return false;
    }
    
    return true;
}

// Track which pages have answered questions
// (Note: answeredQuestions is already declared in courseDataJs)

function markQuestionAnswered(pageId) {
    answeredQuestions[pageId || currentPage] = true;
}

// Also track when navigating
function trackPageAnswered() {
    answeredQuestions[currentPage] = true;
}

// Knowledge check functions
// OLD VERSION - COMMENTED OUT - Using the correct version below
/*
function checkFillInBlank(topicIndex, correctAnswerEncoded, explanationEncoded, event) {
    const inputElement = document.getElementById('fill-blank-' + (topicIndex) + '');
    if (!inputElement) {
        showCustomAlert("Please enter an answer before submitting.");
        return;
    }
    
    const userAnswer = inputElement.value.trim().toLowerCase();
    const correctAnswer = decodeURIComponent(correctAnswerEncoded).toLowerCase();
    const explanation = decodeURIComponent(explanationEncoded);
    
    if (!userAnswer) {
        showCustomAlert("Please enter an answer before submitting.");
        return;
    }
    
    // Mark as attempted
    const inIframe = window !== window.parent;
    const pageId = inIframe && window.parent.currentPage ? window.parent.currentPage : currentPage;
    if (inIframe && window.parent.knowledgeCheckAttempts) {
        window.parent.knowledgeCheckAttempts[pageId] = true;
        window.parent.answeredQuestions[pageId] = true;
    } else {
        knowledgeCheckAttempts[pageId] = true;
        answeredQuestions[pageId] = true;
    }
    
    const isCorrect = userAnswer === correctAnswer;
    
    // Add correct/incorrect class to the input
    inputElement.classList.add(isCorrect ? 'correct' : 'incorrect');
    
    // Show feedback
    showFeedback(topicIndex, isCorrect, explanation);
    
    // Disable the submit button and input
    if (event && event.target) event.target.disabled = true;
    inputElement.disabled = true;
    
    // Update SCORM if tracking individual questions
    if (window.scormAPI) {
        window.scormAPI.LMSSetValue('cmi.interactions.' + (topicIndex) + '.result', isCorrect ? 'correct' : 'incorrect');
    }
    
    // Check if knowledge check is completed and enable navigation
    if (inIframe && window.parent.checkKnowledgeCheckCompletion) {
        window.parent.checkKnowledgeCheckCompletion();
    } else {
        checkKnowledgeCheckCompletion();
    }
}
*/

function checkAnswer(topicIndex, correctAnswer, correctFeedback, incorrectFeedback, event) {
    // First check if we're in an iframe context
    const inIframe = window !== window.parent;
    const selectedOption = document.querySelector('input[name="kc-topic-' + topicIndex + '"]:checked');
    
    if (!selectedOption) {
        showCustomAlert("Please select an answer before submitting.");
        return;
    }
    
    // Mark as attempted - use parent's currentPage if in iframe
    const pageId = inIframe && window.parent.currentPage ? window.parent.currentPage : currentPage;
    if (inIframe && window.parent.knowledgeCheckAttempts) {
        window.parent.knowledgeCheckAttempts[pageId] = true;
        window.parent.answeredQuestions[pageId] = true;
    } else {
        knowledgeCheckAttempts[pageId] = true;
        answeredQuestions[pageId] = true;
    }
    
    const selectedValue = parseInt(selectedOption.value);
    const isCorrect = selectedValue === correctAnswer;
    
    // Decode feedback
    const correctFeedbackText = decodeURIComponent(correctFeedback);
    const incorrectFeedbackText = decodeURIComponent(incorrectFeedback);
    
    // Highlight the selected option
    const selectedLabel = selectedOption.closest('.kc-option');
    if (selectedLabel) {
        selectedLabel.classList.add(isCorrect ? 'correct' : 'incorrect');
    }
    
    // Show appropriate feedback
    const feedbackElement = document.getElementById('kc-feedback-topic-' + (topicIndex + 1));
    if (feedbackElement) {
        const feedbackText = feedbackElement.querySelector('.feedback-text');
        if (feedbackText) {
            feedbackText.textContent = isCorrect ? correctFeedbackText : incorrectFeedbackText;
            feedbackElement.classList.remove('correct', 'incorrect');
            feedbackElement.classList.add(isCorrect ? 'correct' : 'incorrect');
            feedbackElement.style.display = 'block';
        }
    }
    
    if (!isCorrect) {
        // Highlight the correct answer
        const correctOption = document.querySelector('input[name="kc-topic-' + topicIndex + '"][value="' + correctAnswer + '"]');
        if (correctOption) {
            const correctLabel = correctOption.closest('.kc-option');
            if (correctLabel) {
                correctLabel.classList.add('correct');
            }
        }
        // Flash the correct answer
        flashCorrectAnswer(topicIndex, correctAnswer);
    }
    
    // Disable all radio buttons for this question
    const allOptions = document.querySelectorAll('input[name="kc-topic-' + topicIndex + '"]');
    allOptions.forEach(opt => opt.disabled = true);
    
    // Disable the submit button
    if (event && event.target) event.target.disabled = true;
    
    // Update SCORM if tracking individual questions
    if (window.scormAPI) {
        window.scormAPI.LMSSetValue('cmi.interactions.' + (topicIndex) + '.result', isCorrect ? 'correct' : 'incorrect');
    }
    
    // Check if knowledge check is completed and enable navigation
    if (inIframe && window.parent.checkKnowledgeCheckCompletion) {
        window.parent.checkKnowledgeCheckCompletion();
    } else {
        checkKnowledgeCheckCompletion();
    }
}

function checkKnowledgeCheckCompletion() {
    // Check if the current page has been attempted
    if (hasAnsweredKnowledgeCheck(currentPage)) {
        // Clear navigation blocking for this page
        navigationBlockCount[currentPage] = 0;
        lastBlockTime[currentPage] = 0;
        
        // Update nav item states to enable forward navigation
        updateNavItemStates();
        
        // Enable the next button in both parent and iframe contexts
        const nextBtn = document.getElementById('next-btn');
        const parentNextBtn = window.parent?.document?.getElementById('next-btn');
        const iframeNextBtn = document.querySelector('iframe')?.contentDocument?.getElementById('next-btn');
        
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.classList.remove('disabled');
            nextBtn.removeAttribute('data-requires-answer');
        }
        
        if (parentNextBtn) {
            parentNextBtn.disabled = false;
            parentNextBtn.classList.remove('disabled');
            parentNextBtn.removeAttribute('data-requires-answer');
        }
        
        if (iframeNextBtn) {
            iframeNextBtn.disabled = false;
            iframeNextBtn.classList.remove('disabled');
            iframeNextBtn.removeAttribute('data-requires-answer');
        }
    }
}

function showFeedback(topicIndex, isCorrect, explanation) {
    const feedbackEl = document.getElementById('kc-feedback-topic-' + (topicIndex + 1) + '');
    if (!feedbackEl) {
        console.error('Feedback element not found for topic:', topicIndex);
        return;
    }
    
    const feedbackText = feedbackEl.querySelector('.feedback-text');
    if (!feedbackText) {
        console.error('Feedback text element not found');
        return;
    }
    
    feedbackEl.style.display = 'block';
    feedbackEl.className = 'kc-feedback ' + (isCorrect ? 'correct' : 'incorrect');
    
    if (isCorrect) {
        feedbackText.textContent = 'Correct! ' + explanation;
    } else {
        feedbackText.textContent = 'Incorrect. ' + explanation;
    }
}

function highlightCorrectAnswer(topicIndex, correctAnswer) {
    const correctOption = document.querySelector('input[name="kc-topic-' + topicIndex + '"][value="' + correctAnswer + '"]');
    if (correctOption) {
        const correctLabel = correctOption.closest('.kc-option');
        if (correctLabel) {
            correctLabel.classList.add('correct');
        }
    }
}

function flashCorrectAnswer(topicIndex, correctAnswer) {
    const correctOption = document.querySelector('input[name="kc-topic-' + topicIndex + '"][value="' + correctAnswer + '"]');
    if (!correctOption) {
        console.error('Correct option not found for flashing');
        return;
    }
    
    const correctLabel = correctOption.closest('.kc-option');
    if (correctLabel) {
        correctLabel.classList.add('flash');
        
        // Remove flash class after animation completes
        setTimeout(() => {
            correctLabel.classList.remove('flash');
        }, 1500);
    }
}

// Media carousel functions
function changeMedia(direction) {
    const carousel = document.querySelector('.media-carousel');
    const mediaCount = parseInt(carousel.dataset.mediaCount);
    const allMedia = carousel.querySelectorAll('.visual-container, .video-container');
    
    // Hide current media
    allMedia[currentMediaIndex].style.display = 'none';
    
    // Calculate new index
    currentMediaIndex = (currentMediaIndex + direction + mediaCount) % mediaCount;
    
    // Show new media
    allMedia[currentMediaIndex].style.display = 'flex';
    
    // Update indicator
    document.querySelector('.carousel-indicator').textContent = (currentMediaIndex + 1) + ' / ' + mediaCount;
}

// Assessment functions
function submitAssessment() {
    const form = document.getElementById('assessment-form');
    const questions = form.querySelectorAll('.assessment-question');
    let score = 0;
    let totalQuestions = questions.length;
    let feedbackHTML = '';
    
    questions.forEach((question, index) => {
        const selectedOption = question.querySelector('input[name="q' + (index) + '"]:checked');
        if (selectedOption) {
            const isCorrect = parseInt(selectedOption.value) === window.assessmentAnswers[index];
            if (isCorrect) score++;
            
            feedbackHTML += '<div class="feedback-item ' + (isCorrect ? 'correct' : 'incorrect') + '">' +
                '<strong>Question ' + (index + 1) + ':</strong> ' + 
                (isCorrect ? '✓ Correct' : '✗ Incorrect') + 
                '</div>';
        }
    });
    
    const percentage = calculateScore(score, totalQuestions);
    const passed = percentage >= window.passMark;
    
    // Hide form and show feedback
    form.style.display = 'none';
    showAssessmentFeedback(percentage, passed, feedbackHTML);
    
    // Update SCORM
    if (window.scormAPI) {
        window.scormAPI.LMSSetValue("cmi.core.score.raw", percentage);
        window.scormAPI.LMSSetValue("cmi.core.lesson_status", passed ? "passed" : "failed");
        window.scormAPI.LMSCommit("");
    }
}

function calculateScore(correct, total) {
    return Math.round((correct / total) * 100);
}

function showAssessmentFeedback(percentage, passed, feedbackHTML) {
    const feedbackSection = document.querySelector('.assessment-feedback');
    feedbackSection.style.display = 'block';
    
    // Display score
    const scoreDisplay = document.getElementById('assessment-score');
    scoreDisplay.textContent = percentage + '%';
    scoreDisplay.className = 'score-display ' + (passed ? 'pass' : 'fail');
    
    // Display detailed feedback
    document.getElementById('feedback-details').innerHTML = feedbackHTML;
}

// Image lightbox functions (removed duplicate - see unified version below)

// Page navigation functions for topic pages
function nextPage() {
    if (!canNavigateNext()) {
        showCustomAlert("Please answer all questions before proceeding.");
        return;
    }
    if (parent && parent.navigateNext) {
        parent.navigateNext();
    }
}

function previousPage() {
    if (parent && parent.navigatePrevious) {
        parent.navigatePrevious();
    }
}

// Add click handlers for navigation items
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            loadPage(this.dataset.page);
        });
    });
    
    // Initialize captions as shown by default
    const captionDisplays = document.querySelectorAll('.caption-display');
    captionDisplays.forEach(display => display.classList.add('show'));
    
    // Add keyboard handler for lightbox
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLightbox();
        }
    });
});

// Protect navigation state from console manipulation
function protectNavigationState() {
    // Make knowledge check attempts protected but allow updates from checkKnowledgeCheckCompletion
    Object.defineProperty(window, 'knowledgeCheckAttempts', {
        get: function() {
            return knowledgeCheckAttempts; // Return the actual object, not a copy
        },
        set: function(value) {
            console.warn('Knowledge check attempts cannot be modified directly.');
            return false;
        },
        configurable: false
    });
    
    // Don't freeze the object - we need to be able to update it from the knowledge check handlers
    
    // Override console.clear to prevent clearing warnings
    const originalClear = console.clear;
    console.clear = function() {
        console.warn('Console clearing is disabled during course navigation.');
    };
    
    // Detect developer tools (works in some browsers)
    let devtools = {open: false, orientation: null};
    const threshold = 160;
    const emitEvent = (state) => {
        if (state.open && navigationBlockCount[currentPage] > 0) {
            console.warn('Developer tools detected. Knowledge check completion is still required.');
        }
    };
    
    setInterval(() => {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
            if (!devtools.open) {
                devtools.open = true;
                emitEvent(devtools);
            }
        } else {
            devtools.open = false;
        }
    }, 500);
}

// checkAnswer, showFeedback, highlightCorrectAnswer, and flashCorrectAnswer functions already defined above

// Export functions to window for iframe access
window.checkKnowledgeCheckCompletion = checkKnowledgeCheckCompletion;
window.hasAnsweredKnowledgeCheck = hasAnsweredKnowledgeCheck;
window.navigateNext = navigateNext;
window.navigatePrevious = navigatePrevious;
window.knowledgeCheckAttempts = knowledgeCheckAttempts;
window.navigationBlockCount = navigationBlockCount;
window.lastBlockTime = lastBlockTime;
window.answeredQuestions = answeredQuestions;
window.showCustomAlert = showCustomAlert;
window.enlargeImage = enlargeImage;
window.closeLightbox = closeLightbox;
window.highlightKnowledgeCheck = highlightKnowledgeCheck;
window.checkAnswer = checkAnswer;
window.showFeedback = showFeedback;
window.highlightCorrectAnswer = highlightCorrectAnswer;
window.flashCorrectAnswer = flashCorrectAnswer;

// navigateNext, navigatePrevious, and toggleFullscreen functions already defined above

// These audio control functions are defined earlier in the file with proper implementations
// The versions here are removed to avoid duplication and use of outdated code

// replaceParentReferences function is defined earlier in the file with proper regex escaping

// Knowledge check submit answer function
function submitAnswer() {
    console.log('Submit answer clicked');
    // The knowledge check logic is already handled by the radio button change event
    // This is just a placeholder for the submit button
}

// Lightbox functionality
function openLightbox(imageSrc) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-image');
    if (lightbox && lightboxImg) {
        // Handle relative paths
        if (imageSrc.startsWith('../')) {
            imageSrc = imageSrc.substring(3);
        }
        lightboxImg.src = imageSrc;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function enlargeImage(imageSrc, title) {
    // For compatibility with both signatures
    if (typeof imageSrc === 'object' && imageSrc.src) {
        openLightbox(imageSrc.src);
    } else {
        openLightbox(imageSrc);
    }
}

// Assessment functionality
function validateAssessmentAnswer(questionIndex, answer) {
    console.log('Validating assessment answer:', questionIndex, answer);
    // Assessment validation will be handled by the assessment page script
}

// submitAssessment function already defined above

// checkAnswer, showFeedback, highlightCorrectAnswer, and flashCorrectAnswer functions already defined above

// Fill-in-blank check function
function checkFillInBlank(topicIndex, correctAnswer, correctFeedback, incorrectFeedback, event) {
    const inputElement = document.getElementById('fill-blank-' + topicIndex);
    
    if (!inputElement) {
        showCustomAlert("Answer field not found.");
        return;
    }
    
    const userAnswer = inputElement.value.trim();
    if (!userAnswer) {
        showCustomAlert("Please enter an answer before submitting.");
        return;
    }
    
    // Decode the correct answer
    const decodedCorrectAnswer = decodeURIComponent(correctAnswer).toLowerCase();
    const isCorrect = userAnswer.toLowerCase() === decodedCorrectAnswer;
    
    // Mark as attempted
    const pageId = currentPage;
    knowledgeCheckAttempts[pageId] = true;
    answeredQuestions[pageId] = true;
    
    // Decode feedback
    const correctFeedbackText = decodeURIComponent(correctFeedback);
    const incorrectFeedbackText = decodeURIComponent(incorrectFeedback);
    
    // Show feedback
    const feedbackElement = document.getElementById('kc-feedback-topic-' + (topicIndex + 1));
    if (feedbackElement) {
        const feedbackText = feedbackElement.querySelector('.feedback-text');
        if (feedbackText) {
            feedbackText.textContent = isCorrect ? correctFeedbackText : incorrectFeedbackText;
            feedbackElement.classList.remove('correct', 'incorrect');
            feedbackElement.classList.add(isCorrect ? 'correct' : 'incorrect');
            feedbackElement.style.display = 'block';
        }
    }
    
    // Disable input and button
    inputElement.disabled = true;
    if (event && event.target) event.target.disabled = true;
    
    // Check if knowledge check is completed and enable navigation
    checkKnowledgeCheckCompletion();
}

// Expose functions to window
window.navigateNext = navigateNext;
window.checkFillInBlank = checkFillInBlank;
window.navigatePrevious = navigatePrevious;
window.toggleFullscreen = toggleFullscreen;
window.toggleAudioPlayback = toggleAudioPlayback;
window.toggleAudio = toggleAudio;
window.seekAudio = seekAudio;
window.skip = skip;
window.changeSpeed = changeSpeed;
window.toggleCaptions = toggleCaptions;
window.toggleVolume = toggleVolume;
window.showCustomAlert = showCustomAlert;
window.enlargeImage = enlargeImage;
window.checkAnswer = checkAnswer;
window.showFeedback = showFeedback;
window.highlightCorrectAnswer = highlightCorrectAnswer;
window.flashCorrectAnswer = flashCorrectAnswer;
window.closeLightbox = closeLightbox;
window.highlightKnowledgeCheck = highlightKnowledgeCheck;
window.openLightbox = openLightbox;
window.validateAssessmentAnswer = validateAssessmentAnswer;
window.submitAssessment = submitAssessment;
window.submitAnswer = submitAnswer;

// Initialize course when DOM is ready
function initializeOnReady() {
    initializeCourse();
    protectNavigationState();
    
    // Ensure window variables are properly initialized
    window.currentPage = currentPage;
    window.knowledgeCheckAttempts = knowledgeCheckAttempts;
    window.navigationBlockCount = navigationBlockCount;
    window.lastBlockTime = lastBlockTime;
    window.answeredQuestions = answeredQuestions;
    
    // Initialize first page
    loadPage('welcome');
}

// Use both DOMContentLoaded and window.onload for maximum compatibility
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOnReady);
} else {
    // DOM is already ready
    initializeOnReady();
}

// Also use window.onload as a fallback
window.addEventListener('load', function() {
    // This will be prevented from running twice by the courseInitialized flag
    initializeCourse();
});