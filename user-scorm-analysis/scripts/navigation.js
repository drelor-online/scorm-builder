
// Course-specific data
window.courseTopics = [{"id":"safety-fundamentals","title":"Core Principles of Electrical Safety","index":0,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":0,"questions":[{"id":"kc-q1-fundamentals","type":"multiple-choice","question":"Which of the following is the primary cause of electric shock?","options":["Voltage","Current","Resistance","Power"],"correctAnswer":"Current","feedback":{"correct":"That's right! While voltage provides the 'push', it's the flow of current through the body that causes harm.","incorrect":"Not quite. The primary danger in an electric shock is the amount of current (measured in Amps) flowing through the body."},"explanation":"That's right! While voltage provides the 'push', it's the flow of current through the body that causes harm."},{"id":"kc-q2-fundamentals","type":"multiple-choice","question":"Materials with high resistance, like rubber, are good conductors of electricity.","options":["True","False"],"correctAnswer":"False","feedback":{"correct":"Correct. Materials with high resistance are insulators, which block the flow of electricity.","incorrect":"That's incorrect. Materials with high resistance are called insulators because they resist the flow of electricity. Conductors have low resistance."},"explanation":"Correct. Materials with high resistance are insulators, which block the flow of electricity."}]}},{"id":"hazard-identification","title":"Recognizing Electrical Dangers","index":1,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":0,"questions":[{"id":"kc-q1-hazard","type":"fill-in-the-blank","question":"Plugging too many devices into a single circuit can cause it to _____ and create a fire risk.","blank":"Plugging too many devices into a single circuit can cause it to _____ and create a fire risk.","correctAnswer":"overheat","feedback":{"correct":"Excellent! Overloading a circuit causes it to overheat, which can melt insulation and start a fire.","incorrect":"Not quite. The correct term is 'overheat'. An overloaded circuit draws too much current, generating excessive heat."},"explanation":"Excellent! Overloading a circuit causes it to overheat, which can melt insulation and start a fire."},{"id":"kc-q2-hazard","type":"multiple-choice","question":"What is the primary danger of a missing ground prong on a three-prong plug?","options":["The tool won't receive enough power.","It can damage the outlet.","There is no safe path for fault current to flow.","It creates a trip hazard."],"correctAnswer":"There is no safe path for fault current to flow.","feedback":{"correct":"Correct! The ground prong provides a safe path for electricity in case of a fault, preventing the tool's metal casing from becoming energized.","incorrect":"Think about the safety function of the third prong. It's designed to protect you if something goes wrong inside the tool."},"explanation":"Correct! The ground prong provides a safe path for electricity in case of a fault, preventing the tool's metal casing from becoming energized."}]}},{"id":"risk-assessment","title":"Evaluating and Mitigating Electrical Risks","index":2,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":"Elimination","explanation":"Correct! Eliminating the hazard entirely, such as de-energizing a circuit, is the most effective control measure."}},{"id":"ppe","title":"Your First Line of Defense: Electrical PPE","index":3,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":0,"questions":[{"id":"kc-q1-ppe","type":"multiple-choice","question":"It is safe to use insulated gloves that have a small, non-visible pinhole.","options":["True","False"],"correctAnswer":"False","feedback":{"correct":"Correct! Any damage, no matter how small, compromises the glove's insulating properties and makes it unsafe to use.","incorrect":"That is incorrect. A tiny pinhole can allow a lethal amount of current to pass through. Gloves must be inspected before each use and discarded if damaged."},"explanation":"Correct! Any damage, no matter how small, compromises the glove's insulating properties and makes it unsafe to use."},{"id":"kc-q2-ppe","type":"multiple-choice","question":"What is the purpose of wearing leather protectors over rubber insulated gloves?","options":["To provide extra insulation","To keep the rubber gloves clean","To protect the rubber from cuts and punctures","To improve grip"],"correctAnswer":"To protect the rubber from cuts and punctures","feedback":{"correct":"Excellent! The leather protectors shield the delicate rubber from physical damage that could compromise its insulating ability.","incorrect":"Not quite. While they might offer some of the other benefits, their primary safety function is to protect the rubber insulating glove from physical damage."},"explanation":"Excellent! The leather protectors shield the delicate rubber from physical damage that could compromise its insulating ability."}]}},{"id":"emergency-procedures","title":"Responding to Electrical Emergencies","index":4,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":"Shut off the power source","explanation":"Absolutely right. Safely de-energizing the circuit is the first and most important step to prevent further harm to the victim and to yourself."}},{"id":"incident-reporting","title":"Learning from Mistakes: The Power of Reporting","index":5,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":"To identify and correct a hazard before it causes an injury","explanation":"Exactly! Near misses are warnings. Reporting them allows the organization to learn from them and prevent a future accident."}},{"id":"safety-regulations","title":"Understanding Key Safety Standards","index":6,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":0,"questions":[{"id":"kc-q1-regulations","type":"fill-in-the-blank","question":"The procedure for controlling hazardous energy during servicing or maintenance is called _____/Tagout.","blank":"The procedure for controlling hazardous energy during servicing or maintenance is called _____/Tagout.","correctAnswer":"Lockout","feedback":{"correct":"Perfect! Lockout/Tagout (LOTO) is the full name for this critical safety procedure.","incorrect":"The correct answer is 'Lockout'. The full term is Lockout/Tagout, often abbreviated as LOTO."},"explanation":"Perfect! Lockout/Tagout (LOTO) is the full name for this critical safety procedure."},{"id":"kc-q2-regulations","type":"multiple-choice","question":"According to LOTO procedures, any employee is authorized to remove another employee's lock.","options":["True","False"],"correctAnswer":"False","feedback":{"correct":"Correct. A core principle of LOTO is that only the person who applied the lock is authorized to remove it.","incorrect":"This is false and a very important rule to remember. For your own safety, only you should remove your own lock."},"explanation":"Correct. A core principle of LOTO is that only the person who applied the lock is authorized to remove it."}]}},{"id":"continuous-improvement","title":"Making Safety a Habit: Continuous Improvement","index":7,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":"The results of the change are monitored and measured.","explanation":"Correct! The 'Check' phase is all about reviewing the data and feedback to see if the plan implemented in the 'Do' phase was effective."}},{"id":"safety-training","title":"The Role of Ongoing Safety Training","index":8,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":"A short, informal meeting at the job site to discuss the day's hazards","explanation":"You got it! Toolbox talks are quick, practical, and highly relevant safety briefings for the work at hand."}},{"id":"safety-culture","title":"Building a Strong Safety Culture","index":9,"hasKnowledgeCheck":true,"knowledgeCheck":{"correctAnswer":"Employees feel empowered to stop work if they see an unsafe condition.","explanation":"Yes! Empowering every employee with 'Stop Work Authority' is a hallmark of a mature and effective safety culture."}}];

// Track which pages have answered questions
let answeredQuestions = {};


let currentPage = 'welcome';
let completedPages = new Set();
let courseStructure = [];
let knowledgeCheckAttempts = {};
let currentMediaIndex = 0;
let audioPlayers = {};
let playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
let currentSpeedIndex = 2; // Default to 1x

// Custom alert system
function showCustomAlert(message) {
    // If we're in an iframe, forward the alert to the parent window
    if (window !== window.parent && window.parent.showCustomAlert) {
        window.parent.showCustomAlert(message);
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
    
    // Add to container
    alertContainer.appendChild(alertDiv);
    
    // Trigger show animation
    setTimeout(() => {
        alertDiv.classList.add('show');
    }, 10);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            alertDiv.remove();
        }, 300); // Wait for fade out animation
    }, 3000);
}

function initializeCourse() {
    // Initialize SCORM
    if (window.scormAPI) {
        window.scormAPI.LMSInitialize("");
        window.scormAPI.LMSSetValue("cmi.core.lesson_status", "incomplete");
    }
    
    // Set up navigation structure
    courseStructure = Array.from(document.querySelectorAll('.nav-item')).map(item => ({
        id: item.dataset.page,
        element: item
    }));
    
    // Initialize audio players if on topic page
    initializeAudioPlayers();
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
            const durationEl = document.getElementById(`duration-${identifier}`);
            if (durationEl && !isNaN(audio.duration)) {
                durationEl.textContent = formatTime(audio.duration);
                console.log('Updated duration display for:', identifier);
            } else {
                console.warn('Duration element not found or invalid duration:', `duration-${identifier}`, audio.duration);
            }
        });
        
        // Also try durationchange event
        audio.addEventListener('durationchange', () => {
            const durationEl = document.getElementById(`duration-${identifier}`);
            if (durationEl && !isNaN(audio.duration) && audio.duration > 0) {
                durationEl.textContent = formatTime(audio.duration);
            }
        });
        
        // Add error handling for audio loading
        audio.addEventListener('error', (e) => {
            console.error('Audio loading error for', identifier, ':', e);
            const durationEl = document.getElementById(`duration-${identifier}`);
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
            const durationEl = document.getElementById(`duration-${identifier}`);
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
        const captionDisplay = document.getElementById(`captionDisplay-${identifier}`);
        const ccBtn = document.getElementById(`cc-btn-${identifier}`);
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
    
    // Only check knowledge check when moving forward
    if (newIndex > currentIndex && shouldBlockNavigation()) {
        showCustomAlert("Please attempt the knowledge check question before proceeding.");
        return;
    }
    
    currentPage = pageId;
    
    // Update navigation highlighting
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });
    
    // Update content area
    const contentArea = document.getElementById('content-area');
    
    // Always load content via iframe for consistency
    if (pageId === 'welcome') {
        contentArea.innerHTML = `<iframe src="pages/welcome.html" style="width: 100%; height: 100%; border: none;" onload="initializeTopicPage(this)"></iframe>`;
        document.getElementById('current-title').textContent = 'Welcome';
    } else if (pageId === 'objectives') {
        contentArea.innerHTML = `<iframe src="pages/objectives.html" style="width: 100%; height: 100%; border: none;" onload="initializeTopicPage(this)"></iframe>`;
        document.getElementById('current-title').textContent = 'Learning Objectives';
    } else if (pageId.startsWith('topic-')) {
        // Load topic content via iframe
        contentArea.innerHTML = `<iframe src="pages/${pageId}.html" style="width: 100%; height: 100%; border: none;" onload="initializeTopicPage(this)"></iframe>`;
        
        // Get actual topic title from courseTopics data
        const topic = window.courseTopics.find(t => t.id === pageId || `topic-${t.index + 1}` === pageId);
        const topicTitle = topic ? topic.title : 'Topic';
        document.getElementById('current-title').textContent = topicTitle;
    } else if (pageId === 'assessment') {
        contentArea.innerHTML = `<iframe src="pages/assessment.html" style="width: 100%; height: 100%; border: none;"></iframe>`;
        document.getElementById('current-title').textContent = 'Assessment';
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
    
    // Update SCORM
    if (window.scormAPI) {
        window.scormAPI.LMSSetValue("cmi.core.lesson_location", pageId);
        window.scormAPI.LMSCommit("");
    }
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
    const captionText = document.getElementById(`caption-text-${identifier}`);
    const captionDisplay = document.getElementById(`captionDisplay-${identifier}`);
    
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
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
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
                // Extract topic number
                const match = audioId.match(/topic-(\d+)/);
                identifier = match ? parseInt(match[1]) - 1 : 0;
            }
            
            // Set up audio event listeners within iframe context
            audio.addEventListener('loadedmetadata', () => {
                console.log('Iframe audio loadedmetadata:', identifier, 'duration:', audio.duration);
                const durationEl = iframeDoc.getElementById(`duration-${identifier}`);
                if (durationEl && !isNaN(audio.duration)) {
                    durationEl.textContent = formatTime(audio.duration);
                    console.log('Updated iframe duration display for:', identifier);
                } else {
                    console.warn('Iframe duration element not found or invalid duration:', `duration-${identifier}`, audio.duration);
                }
            });
            
            // Also try durationchange event in iframe
            audio.addEventListener('durationchange', () => {
                const durationEl = iframeDoc.getElementById(`duration-${identifier}`);
                if (durationEl && !isNaN(audio.duration) && audio.duration > 0) {
                    durationEl.textContent = formatTime(audio.duration);
                }
            });
            
            // Add error handling for audio loading
            audio.addEventListener('error', (e) => {
                console.error('Audio loading error in iframe for', identifier, ':', e);
                const durationEl = iframeDoc.getElementById(`duration-${identifier}`);
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
                const durationEl = iframeDoc.getElementById(`duration-${identifier}`);
                if (durationEl) {
                    durationEl.textContent = formatTime(audio.duration);
                }
            }
            
            // Add timeupdate handler for progress
            audio.addEventListener('timeupdate', () => {
                const currentTimeEl = iframeDoc.getElementById(`current-time-${identifier}`);
                if (currentTimeEl) {
                    currentTimeEl.textContent = formatTime(audio.currentTime);
                }
                
                const trackFill = iframeDoc.getElementById(`track-fill-${identifier}`);
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
                    const captionText = iframeDoc.getElementById(`caption-text-${identifier}`);
                    const captionDisplay = iframeDoc.getElementById(`captionDisplay-${identifier}`);
                    
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

function shouldBlockNavigation() {
    const currentIndex = courseStructure.findIndex(item => item.id === currentPage);
    const nextIndex = currentIndex + 1;
    
    // Only block forward navigation
    if (nextIndex >= courseStructure.length) return false;
    
    // Check if current page has unattempted knowledge check
    const hasKnowledgeCheck = document.body.dataset.hasKnowledgeCheck === 'true' ||
                            (document.querySelector('iframe') && 
                             document.querySelector('iframe').contentDocument?.body.dataset.hasKnowledgeCheck === 'true');
    
    if (hasKnowledgeCheck && !knowledgeCheckAttempts[currentPage]) {
        return true;
    }
    
    return false;
}

function markAsCompleted(pageId) {
    const navItem = document.querySelector(`[data-page="${pageId}"]`);
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
        showCustomAlert("Please attempt the knowledge check question before proceeding.");
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

// Audio player functions
function toggleAudio(identifier) {
    // Handle both numeric indices and string identifiers
    const audioId = typeof identifier === 'number' ? `audio-player-topic-${identifier + 1}` : `audio-player-${identifier}`;
    // Check both parent and current document
    let audio = document.getElementById(audioId);
    if (!audio && window.parent && window.parent.document) {
        audio = window.parent.document.getElementById(audioId);
    }
    const playBtn = event.target;
    
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
    const audioId = typeof identifier === 'number' ? `audio-player-topic-${identifier + 1}` : `audio-player-${identifier}`;
    const audio = document.getElementById(audioId);
    
    if (!audio || isNaN(audio.duration) || audio.duration === 0) return;
    
    const progress = (audio.currentTime / audio.duration) * 100;
    
    const trackFill = document.getElementById(`track-fill-${identifier}`);
    if (trackFill) {
        trackFill.style.width = progress + '%';
    }
    
    const currentTimeEl = document.getElementById(`current-time-${identifier}`);
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
}

function seekAudio(event, identifier) {
    const audioId = typeof identifier === 'number' ? `audio-player-topic-${identifier + 1}` : `audio-player-${identifier}`;
    const audio = document.getElementById(audioId);
    const progressBar = event.currentTarget;
    const clickX = event.offsetX;
    const width = progressBar.offsetWidth;
    const newTime = (clickX / width) * audio.duration;
    
    audio.currentTime = newTime;
}

function toggleCaptions(identifier) {
    const captionDisplay = document.getElementById(`captionDisplay-${identifier}`);
    const ccBtn = document.getElementById(`cc-btn-${identifier}`);
    const audioId = typeof identifier === 'number' ? `audio-player-topic-${identifier + 1}` : `audio-player-${identifier}`;
    const audio = document.getElementById(audioId);
    
    if (captionDisplay.classList.contains('show')) {
        captionDisplay.classList.remove('show');
        ccBtn.classList.remove('active');
        // Disable text tracks
        if (audio && audio.textTracks && audio.textTracks[0]) {
            audio.textTracks[0].mode = 'hidden';
        }
    } else {
        captionDisplay.classList.add('show');
        ccBtn.classList.add('active');
        // Enable text tracks
        if (audio && audio.textTracks && audio.textTracks[0]) {
            audio.textTracks[0].mode = 'showing';
            audio.textTracks[0].addEventListener('cuechange', function() {
                const cues = this.activeCues;
                if (cues && cues.length > 0) {
                    document.getElementById(`caption-text-${identifier}`).textContent = cues[0].text;
                }
            });
        }
    }
}

function skip(seconds, identifier) {
    const audioId = typeof identifier === 'number' ? `audio-player-topic-${identifier + 1}` : `audio-player-${identifier}`;
    const audio = document.getElementById(audioId);
    if (audio) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    }
}

function changeSpeed(identifier) {
    const audioId = typeof identifier === 'number' ? `audio-player-topic-${identifier + 1}` : `audio-player-${identifier}`;
    const audio = document.getElementById(audioId);
    const speedBtn = document.getElementById(`speed-btn-${identifier}`);
    
    currentSpeedIndex = (currentSpeedIndex + 1) % playbackSpeeds.length;
    const newSpeed = playbackSpeeds[currentSpeedIndex];
    
    audio.playbackRate = newSpeed;
    speedBtn.textContent = newSpeed + 'x';
}

function toggleVolume(identifier) {
    const audioId = typeof identifier === 'number' ? `audio-player-topic-${identifier + 1}` : `audio-player-${identifier}`;
    const audio = document.getElementById(audioId);
    if (audio) {
        audio.muted = !audio.muted;
        event.target.textContent = audio.muted ? '🔇' : '🔊';
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
function checkFillInBlank(topicIndex, correctAnswerEncoded, explanationEncoded) {
    const inputElement = document.getElementById(`fill-blank-${topicIndex}`);
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
    } else {
        knowledgeCheckAttempts[pageId] = true;
    }
    
    const isCorrect = userAnswer === correctAnswer;
    
    // Add correct/incorrect class to the input
    inputElement.classList.add(isCorrect ? 'correct' : 'incorrect');
    
    // Show feedback
    showFeedback(topicIndex, isCorrect, explanation);
    
    // Disable the submit button and input
    event.target.disabled = true;
    inputElement.disabled = true;
    
    // Update SCORM if tracking individual questions
    if (window.scormAPI) {
        window.scormAPI.LMSSetValue(`cmi.interactions.${topicIndex}.result`, isCorrect ? 'correct' : 'incorrect');
    }
    
    // Check if knowledge check is completed and enable navigation
    if (inIframe && window.parent.checkKnowledgeCheckCompletion) {
        window.parent.checkKnowledgeCheckCompletion();
    } else {
        checkKnowledgeCheckCompletion();
    }
}

function checkAnswer(topicIndex, correctAnswer, explanationEncoded) {
    // First check if we're in an iframe context
    const inIframe = window !== window.parent;
    const doc = inIframe ? window.parent.document : document;
    const selectedOption = document.querySelector(`input[name="kc-topic-${topicIndex}"]:checked`);
    
    if (!selectedOption) {
        showCustomAlert("Please select an answer before submitting.");
        return;
    }
    
    // Mark as attempted - use parent's currentPage if in iframe
    const pageId = inIframe && window.parent.currentPage ? window.parent.currentPage : currentPage;
    if (inIframe && window.parent.knowledgeCheckAttempts) {
        window.parent.knowledgeCheckAttempts[pageId] = true;
    } else {
        knowledgeCheckAttempts[pageId] = true;
    }
    
    const selectedValue = parseInt(selectedOption.value);
    const isCorrect = selectedValue === correctAnswer;
    const explanation = decodeURIComponent(explanationEncoded);
    
    // Show feedback
    showFeedback(topicIndex, isCorrect, explanation);
    
    if (!isCorrect) {
        // Flash the correct answer
        flashCorrectAnswer(topicIndex, correctAnswer);
    }
    
    // Disable the submit button
    event.target.disabled = true;
    
    // Update SCORM if tracking individual questions
    if (window.scormAPI) {
        window.scormAPI.LMSSetValue(`cmi.interactions.${topicIndex}.result`, isCorrect ? 'correct' : 'incorrect');
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
    if (knowledgeCheckAttempts[currentPage]) {
        // Enable the next button
        const nextBtn = document.getElementById('nextBtn');
        const iframeNextBtn = document.querySelector('iframe')?.contentDocument?.getElementById('nextBtn');
        
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.classList.remove('disabled');
        }
        
        if (iframeNextBtn) {
            iframeNextBtn.disabled = false;
            iframeNextBtn.classList.remove('disabled');
        }
    }
}

function showFeedback(topicIndex, isCorrect, explanation) {
    const feedbackEl = document.getElementById(`kc-feedback-topic-${topicIndex + 1}`);
    const feedbackText = feedbackEl.querySelector('.feedback-text');
    
    feedbackEl.style.display = 'block';
    feedbackEl.className = 'kc-feedback ' + (isCorrect ? 'correct' : 'incorrect');
    
    if (isCorrect) {
        feedbackText.textContent = 'Correct! ' + explanation;
    } else {
        feedbackText.textContent = 'Incorrect. ' + explanation;
    }
}

function flashCorrectAnswer(topicIndex, correctAnswer) {
    const correctOption = document.querySelector(`input[name="kc-topic-${topicIndex}"][value="${correctAnswer}"]`).closest('.kc-option');
    correctOption.classList.add('flash');
    
    // Remove flash class after animation completes
    setTimeout(() => {
        correctOption.classList.remove('flash');
    }, 1500);
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
    document.querySelector('.carousel-indicator').textContent = `${currentMediaIndex + 1} / ${mediaCount}`;
}

// Assessment functions
function submitAssessment() {
    const form = document.getElementById('assessment-form');
    const questions = form.querySelectorAll('.assessment-question');
    let score = 0;
    let totalQuestions = questions.length;
    let feedbackHTML = '';
    
    questions.forEach((question, index) => {
        const selectedOption = question.querySelector(`input[name="q${index}"]:checked`);
        if (selectedOption) {
            const isCorrect = parseInt(selectedOption.value) === window.assessmentAnswers[index];
            if (isCorrect) score++;
            
            feedbackHTML += `
                <div class="feedback-item ${isCorrect ? 'correct' : 'incorrect'}">
                    <strong>Question ${index + 1}:</strong> ${isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </div>`;
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

// Image lightbox functions
function enlargeImage(imageSrc, imageAlt) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    
    if (lightbox && lightboxImage) {
        lightboxImage.src = imageSrc;
        lightboxImage.alt = imageAlt || '';
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

// Export functions to window for iframe access
window.checkKnowledgeCheckCompletion = checkKnowledgeCheckCompletion;
window.navigateNext = navigateNext;
window.navigatePrevious = navigatePrevious;
window.knowledgeCheckAttempts = knowledgeCheckAttempts;
window.showCustomAlert = showCustomAlert;