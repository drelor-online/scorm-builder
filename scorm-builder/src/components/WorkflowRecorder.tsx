import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import JSZip from 'jszip';
import styles from './WorkflowRecorder.module.css';

interface InteractionEvent {
  type: 'click' | 'input' | 'select' | 'navigation' | 'screenshot' | 'step_change' | 'note';
  selector: string;
  value?: string;
  timestamp: string;
  screenshot?: string;
  elementText?: string;
  elementTag?: string;
  elementAttributes?: Record<string, string>;
  step?: string;
  finalValue?: string; // For debounced inputs
  noteText?: string; // For note interactions
  isPriority?: boolean; // Mark notes as priority interactions
}

interface WorkflowSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  interactions: InteractionEvent[];
  screenshots: string[];
}

interface WorkflowRecorderProps {
  onClose?: () => void;
}

export const WorkflowRecorder: React.FC<WorkflowRecorderProps> = ({ onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number }>({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });
  const screenshotCounter = useRef(0);
  const inputDebounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastInputValues = useRef<Map<string, string>>(new Map());
  const currentStep = useRef<string>('dashboard');

  // Generate unique selector for an element
  const getElementSelector = useCallback((element: Element): string => {
    // Priority: data-testid > id > class > tag with position
    const testId = element.getAttribute('data-testid');
    if (testId) return `[data-testid="${testId}"]`;

    const id = element.id;
    if (id) return `#${id}`;

    const className = element.className;
    if (className && typeof className === 'string') {
      const validClasses = className.split(' ').filter(cls => cls && !cls.includes(' '));
      if (validClasses.length > 0) {
        return `.${validClasses[0]}`;
      }
    }

    // Fallback to tag with position
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
      const index = siblings.indexOf(element);
      if (siblings.length > 1) {
        return `${tagName}:nth-of-type(${index + 1})`;
      }
    }

    return tagName;
  }, []);

  // Get element attributes for context
  const getElementAttributes = useCallback((element: Element): Record<string, string> => {
    const attrs: Record<string, string> = {};
    const importantAttrs = ['placeholder', 'type', 'name', 'value', 'href', 'title', 'alt'];
    
    importantAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) attrs[attr] = value;
    });

    return attrs;
  }, []);

  // Take screenshot
  const takeScreenshot = useCallback(async (): Promise<string | null> => {
    try {
      screenshotCounter.current += 1;
      const filename = `workflow-screenshot-${screenshotCounter.current}-${Date.now()}.png`;
      
      // Use Tauri's screenshot capability
      try {
        await invoke('take_screenshot', { filename });
        return filename;
      } catch (error) {
        console.warn('Tauri screenshot failed, using canvas fallback:', error);
      }
      
      // Fallback: use HTML5 canvas (limited to app content only)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // This is a very basic implementation - real screenshots would need more work
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.fillText(`Screenshot ${screenshotCounter.current} - ${new Date().toLocaleTimeString()}`, 10, 30);
      
      return filename;
    } catch (error) {
      console.error('Screenshot failed:', error);
      return null;
    }
  }, []);

  // Detect current workflow step
  const detectWorkflowStep = useCallback((): string => {
    try {
      const url = window.location.href;
      const path = window.location.pathname;
      
      // Check for specific step indicators by data-testid first (most reliable)
      const testIdIndicators = [
        { selector: '[data-testid="new-project-button"]', step: 'dashboard' },
        { selector: '[data-testid="template-select"]', step: 'course-seed' },
        { selector: '[data-testid="ai-prompt-textarea"]', step: 'ai-prompt' },
        { selector: '[data-testid="copy-prompt-button"]', step: 'ai-prompt' },
        { selector: '[data-testid="json-textarea"]', step: 'json-import' },
        { selector: '[data-testid="set-media-button"]', step: 'media-enhancement' },
        { selector: '[data-testid="start-recording-button"]', step: 'audio-narration' },
        { selector: '[data-testid="add-knowledge-check-question"]', step: 'activities' },
        { selector: '[data-testid="generate-scorm-button"]', step: 'scorm-generation' }
      ];
      
      for (const indicator of testIdIndicators) {
        if (document.querySelector(indicator.selector)) {
          return indicator.step;
        }
      }
      
      // Fallback: Check heading text content (safe way without :contains())
      const headings = document.querySelectorAll('h1, h2, h3');
      for (const heading of headings) {
        const text = heading.textContent?.toLowerCase() || '';
        
        if (text.includes('course seed') || text.includes('course config')) {
          return 'course-seed';
        }
        if (text.includes('ai prompt') || text.includes('prompt generator')) {
          return 'ai-prompt';
        }
        if (text.includes('json import') || text.includes('import validator')) {
          return 'json-import';
        }
        if (text.includes('media enhancement') || text.includes('media wizard')) {
          return 'media-enhancement';
        }
        if (text.includes('content review') || text.includes('review content')) {
          return 'content-review';
        }
        if (text.includes('audio narration') || text.includes('narration wizard')) {
          return 'audio-narration';
        }
        if (text.includes('activities') || text.includes('knowledge check')) {
          return 'activities';
        }
        if (text.includes('scorm package') || text.includes('generate scorm')) {
          return 'scorm-generation';
        }
      }
      
      // Final fallback based on URL or DOM content
      if (path.includes('dashboard') || document.querySelector('[data-testid="new-project-button"]')) {
        return 'dashboard';
      }
      
      return 'unknown';
    } catch (error) {
      console.warn('[WorkflowRecorder] Error detecting step:', error);
      return 'unknown';
    }
  }, []);

  // Record interaction with step tracking
  const recordInteraction = useCallback(async (type: InteractionEvent['type'], element: Element, value?: string) => {
    if (!isRecording || !session) return;

    const newStep = detectWorkflowStep();
    if (newStep !== currentStep.current) {
      // Step changed - record step change event
      const stepChangeInteraction: InteractionEvent = {
        type: 'step_change',
        selector: 'body',
        timestamp: new Date().toLocaleTimeString(),
        step: newStep,
        elementText: newStep,
        elementTag: 'body',
        elementAttributes: {}
      };
      
      setSession(prev => prev ? {
        ...prev,
        interactions: [...prev.interactions, stepChangeInteraction]
      } : null);
      
      currentStep.current = newStep;
    }

    const interaction: InteractionEvent = {
      type,
      selector: getElementSelector(element),
      timestamp: new Date().toLocaleTimeString(),
      elementText: element.textContent?.slice(0, 50) || '',
      elementTag: element.tagName.toLowerCase(),
      elementAttributes: getElementAttributes(element),
      step: currentStep.current
    };

    if (value !== undefined) {
      interaction.value = value;
    }

    // Take screenshot for important interactions only (not every input)
    if (type === 'click' || type === 'screenshot' || type === 'step_change') {
      const screenshot = await takeScreenshot();
      if (screenshot) {
        interaction.screenshot = screenshot;
      }
    }

    setSession(prev => prev ? {
      ...prev,
      interactions: [...prev.interactions, interaction]
    } : null);
  }, [isRecording, session, getElementSelector, getElementAttributes, takeScreenshot, detectWorkflowStep]);

  // Debounced input recording
  const recordDebouncedInput = useCallback(async (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    if (!isRecording || !session) return;

    const selector = getElementSelector(element);
    const currentValue = element.value;
    
    // Clear existing timer for this element
    const existingTimer = inputDebounceTimers.current.get(selector);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timer = setTimeout(async () => {
      const lastValue = lastInputValues.current.get(selector);
      if (currentValue !== lastValue) {
        lastInputValues.current.set(selector, currentValue);
        
        const interaction: InteractionEvent = {
          type: 'input',
          selector,
          timestamp: new Date().toLocaleTimeString(),
          elementText: element.textContent?.slice(0, 50) || '',
          elementTag: element.tagName.toLowerCase(),
          elementAttributes: getElementAttributes(element),
          step: currentStep.current,
          finalValue: currentValue, // Store the final debounced value
          value: currentValue
        };

        setSession(prev => prev ? {
          ...prev,
          interactions: [...prev.interactions, interaction]
        } : null);
      }
      
      inputDebounceTimers.current.delete(selector);
    }, 1000); // 1 second debounce
    
    inputDebounceTimers.current.set(selector, timer);
  }, [isRecording, session, getElementSelector, getElementAttributes]);

  // Event listeners
  useEffect(() => {
    if (!isRecording) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target && !target.closest(`.${styles.recorder}`)) {
        recordInteraction('click', target);
      }
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (target && !target.closest(`.${styles.recorder}`)) {
        recordDebouncedInput(target);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // F10 for manual screenshot
      if (e.key === 'F10') {
        e.preventDefault();
        const activeElement = document.activeElement;
        if (activeElement) {
          recordInteraction('screenshot', activeElement);
        }
      }
      // F9 to toggle recording
      if (e.key === 'F9') {
        e.preventDefault();
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleInput);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('input', handleInput);
      document.removeEventListener('change', handleInput);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecording, recordInteraction, recordDebouncedInput]);

  // Auto-save workflow JSON function
  const autoSaveWorkflowJSON = useCallback(async (sessionData: WorkflowSession) => {
    try {
      const exportData = {
        ...sessionData,
        metadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          totalInteractions: sessionData.interactions.length,
          totalScreenshots: sessionData.interactions.filter(i => i.screenshot).length,
        }
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      
      // Save JSON file via Tauri backend
      const jsonPath = await invoke('save_workflow_json', { 
        sessionId: sessionData.sessionId, 
        workflowData: dataStr 
      }) as string;
      
      console.log('✅ Workflow JSON auto-saved:', jsonPath);
    } catch (error) {
      console.warn('⚠️ Auto-save workflow JSON failed:', error);
    }
  }, []);

  // Periodic auto-save during recording (every 30 seconds)
  useEffect(() => {
    if (!isRecording || !session) return;

    const autoSaveInterval = setInterval(async () => {
      if (session && session.interactions.length > 0) {
        await autoSaveWorkflowJSON(session);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [isRecording, session, autoSaveWorkflowJSON]);

  const startRecording = useCallback(() => {
    const sessionId = `workflow-${Date.now()}`;
    setSession({
      sessionId,
      startTime: new Date().toISOString(),
      interactions: [],
      screenshots: []
    });
    setIsRecording(true);
    screenshotCounter.current = 0;
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    
    // Clear all pending debounce timers
    inputDebounceTimers.current.forEach(timer => clearTimeout(timer));
    inputDebounceTimers.current.clear();
    lastInputValues.current.clear();
    
    if (session) {
      const updatedSession = {
        ...session,
        endTime: new Date().toISOString()
      };
      
      setSession(updatedSession);
      
      // Auto-save the workflow JSON when recording stops
      await autoSaveWorkflowJSON(updatedSession);
    }
  }, [session, autoSaveWorkflowJSON]);

  const exportSession = useCallback(async () => {
    if (!session) return;
    
    if (isExporting) return; // Prevent double-clicks
    
    setIsExporting(true);

    try {
      console.log('🔄 Starting ZIP export for session:', session.sessionId);

      // Create workflow data JSON
      const exportData = {
        ...session,
        metadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          totalInteractions: session.interactions.length,
          totalScreenshots: session.interactions.filter(i => i.screenshot).length,
        }
      };

      const dataStr = JSON.stringify(exportData, null, 2);

      // Try Tauri backend ZIP export first
      try {
        const zipPath = await invoke('export_workflow_zip', { 
          sessionId: session.sessionId, 
          workflowData: dataStr 
        }) as string;
        
        console.log('✅ ZIP created successfully via Tauri:', zipPath);
        
        // Trigger download of the ZIP file
        const zipFilename = `workflow-${session.sessionId}.zip`;
        const zipData = await invoke('read_file_binary', { path: zipPath }) as number[];
        const zipBlob = new Blob([new Uint8Array(zipData)], { type: 'application/zip' });
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('🎉 ZIP downloaded successfully:', zipFilename);
        // TODO: Show toast notification here instead of console
        return;
      } catch (error) {
        console.warn('Tauri ZIP export failed, using browser fallback:', error);
      }

      // Browser fallback using JSZip
      console.log('Creating ZIP using browser fallback...');
      
      const zip = new JSZip();
      
      // Add workflow JSON to ZIP
      zip.file('workflow-data.json', dataStr);
      
      // Add README
      const readmeContent = `# Workflow Recording Package

Session ID: ${session.sessionId}
Exported: ${new Date().toISOString()}

## Contents
- workflow-data.json: Complete interaction data and metadata
- screenshots/: All screenshots captured during the session (if available)

## Usage
This package contains a complete workflow recording that can be analyzed 
to understand user behavior and identify UI/UX issues.

The workflow-data.json file contains:
- All user interactions (clicks, inputs, navigation)
- Step transitions and timestamps  
- Screenshot references
- Browser and environment metadata

Note: Screenshots may not be included in browser fallback mode due to file system limitations.
`;
      
      zip.file('README.txt', readmeContent);
      
      // Try to add screenshots (browser limitations apply)
      const screenshotPaths = session.interactions
        .filter(i => i.screenshot)
        .map(i => i.screenshot!)
        .filter(Boolean);
        
      console.log(`Browser fallback: Attempting to include ${screenshotPaths.length} screenshots`);
      
      // Attempt to fetch screenshots via Tauri even in fallback mode
      let screenshotsAdded = 0;
      for (const screenshotFile of screenshotPaths) {
        try {
          const projectsDir = await invoke('get_projects_directory') as string;
          const screenshotPath = `${projectsDir}/workflow-screenshots/${screenshotFile}`;
          const screenshotData = await invoke('read_file_binary', { path: screenshotPath }) as number[];
          
          // Add screenshot to ZIP
          zip.file(`screenshots/${screenshotFile}`, new Uint8Array(screenshotData));
          screenshotsAdded++;
          console.log(`Browser fallback: Added screenshot ${screenshotFile}`);
        } catch (error) {
          console.warn(`Browser fallback: Failed to add screenshot ${screenshotFile}:`, error);
        }
      }
      
      console.log(`Browser fallback: Successfully added ${screenshotsAdded}/${screenshotPaths.length} screenshots`);
      
      // Update README to reflect actual screenshot inclusion
      const actualReadmeContent = `# Workflow Recording Package

Session ID: ${session.sessionId}
Exported: ${new Date().toISOString()}

## Contents
- workflow-data.json: Complete interaction data and metadata
- screenshots/: ${screenshotsAdded > 0 ? `${screenshotsAdded} screenshots included` : 'No screenshots (could not access files)'}

## Usage
This package contains a workflow recording that can be analyzed 
to understand user behavior and identify UI/UX issues.

The workflow-data.json file contains:
- All user interactions (clicks, inputs, navigation)
- Step transitions and timestamps  
- Screenshot references
- Browser and environment metadata

${screenshotsAdded === 0 ? 'Note: Screenshots could not be included due to file access limitations.' : ''}
`;
      
      // Update the README in the ZIP
      zip.file('README.txt', actualReadmeContent);
      
      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFilename = `workflow-${session.sessionId}.zip`;
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Browser fallback ZIP downloaded:', zipFilename);
      
    } catch (error) {
      console.error('ZIP export failed:', error);
      
      // Ultimate fallback: just download the JSON
      try {
        const exportData = {
          ...session,
          metadata: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            totalInteractions: session.interactions.length,
            totalScreenshots: session.interactions.filter(i => i.screenshot).length,
          }
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow-${session.sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ Fallback: JSON file downloaded');
      } catch (fallbackError) {
        console.error('❌ Even JSON fallback failed:', fallbackError);
        // Show user-friendly error message
        alert('Export failed completely. Please check the console for details.');
      }
    } finally {
      setIsExporting(false);
    }
  }, [session, isExporting]);

  // Cleanup all workflow files
  const cleanupWorkflowFiles = useCallback(async () => {
    setIsCleaningUp(true);
    setCleanupMessage(null);
    
    try {
      const result = await invoke('clean_workflow_files') as string;
      setCleanupMessage(result);
      console.log('Cleanup completed:', result);
    } catch (error) {
      const errorMessage = `Failed to clean workflow files: ${error}`;
      setCleanupMessage(errorMessage);
      console.error('Cleanup failed:', error);
    } finally {
      setIsCleaningUp(false);
      // Clear message after 3 seconds
      setTimeout(() => setCleanupMessage(null), 3000);
    }
  }, []);

  // Handle adding a note with automatic screenshot
  const addNote = useCallback(async () => {
    if (!isRecording || !session || !noteText.trim()) return;

    try {
      // Take screenshot automatically
      const screenshot = await takeScreenshot();
      
      const noteInteraction: InteractionEvent = {
        type: 'note',
        selector: 'body', // Notes aren't tied to specific elements
        timestamp: new Date().toLocaleTimeString(),
        elementText: 'User Note',
        elementTag: 'note',
        elementAttributes: {},
        step: currentStep.current,
        noteText: noteText.trim(),
        isPriority: true, // All notes are priority
        screenshot: screenshot || undefined
      };

      setSession(prev => prev ? {
        ...prev,
        interactions: [...prev.interactions, noteInteraction]
      } : null);

      // Clear the note text and close modal
      setNoteText('');
      setShowNoteModal(false);
      
      console.log('Note added with screenshot:', noteInteraction);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  }, [isRecording, session, noteText, takeScreenshot]);

  // Open note modal
  const openNoteModal = useCallback(() => {
    if (isRecording) {
      setShowNoteModal(true);
      setNoteText('');
    }
  }, [isRecording]);

  // Close note modal
  const closeNoteModal = useCallback(() => {
    setShowNoteModal(false);
    setNoteText('');
  }, []);

  // Dragging functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.startPosX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 200, dragRef.current.startPosY + deltaY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  if (isMinimized) {
    return (
      <div
        className={`${styles.recorder} ${styles.minimized}`}
        style={{ left: position.x, top: position.y }}
        onClick={() => setIsMinimized(false)}
      >
        🎥 {isRecording ? '●' : '⏹'}
      </div>
    );
  }

  return (
    <div
      className={styles.recorder}
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={styles.header}
        onMouseDown={handleMouseDown}
      >
        <h3>🎥 Workflow Recorder</h3>
        <div className={styles.headerButtons}>
          <button
            className={styles.minimizeBtn}
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            _
          </button>
          {onClose && (
            <button
              className={styles.closeBtn}
              onClick={onClose}
              title="Close Workflow Recorder"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className={styles.controls}>
        {!isRecording ? (
          <button className={styles.startBtn} onClick={startRecording}>
            ▶ Start Recording
          </button>
        ) : (
          <>
            <button className={styles.stopBtn} onClick={stopRecording}>
              ⏹ Stop Recording
            </button>
            <button className={styles.screenshotBtn} onClick={() => {
              const activeElement = document.activeElement || document.body;
              recordInteraction('screenshot', activeElement);
            }}>
              📷 Screenshot
            </button>
            <button className={styles.noteBtn} onClick={openNoteModal}>
              📝 Add Note
            </button>
          </>
        )}
      </div>

      {/* Always visible Delete All button */}
      <div className={styles.standaloneActions}>
        <button 
          className={styles.cleanupBtn} 
          onClick={cleanupWorkflowFiles}
          disabled={isCleaningUp}
        >
          {isCleaningUp ? '🔄 Cleaning...' : '🗂 Delete All Recordings'}
        </button>
      </div>

      {session && (
        <div className={styles.status}>
          <div>Session: {session.sessionId}</div>
          <div>Interactions: {session.interactions.length}</div>
          <div>Screenshots: {session.interactions.filter(i => i.screenshot).length}</div>
        </div>
      )}

      {session && session.interactions.length > 0 && (
        <div className={styles.recentInteractions}>
          <h4>Recent Interactions:</h4>
          <div className={styles.interactionsList}>
            {session.interactions
              .sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0)) // Priority first
              .slice(-10) // Show 10 interactions for better visibility of notes
              .map((interaction, index) => (
              <div key={index} className={`${styles.interaction} ${interaction.isPriority ? styles.priorityInteraction : ''}`}>
                <span className={styles.interactionType}>{interaction.type}</span>
                <span className={styles.interactionSelector}>
                  {interaction.type === 'note' ? 'User Note' : interaction.selector}
                </span>
                {interaction.noteText && (
                  <span className={styles.interactionNote}>"{interaction.noteText}"</span>
                )}
                {interaction.value && !interaction.noteText && (
                  <span className={styles.interactionValue}>: "{interaction.value}"</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {session && !isRecording && (
        <div className={styles.actions}>
          <button 
            className={styles.exportBtn} 
            onClick={exportSession}
            disabled={isExporting}
          >
            {isExporting ? '⏳ Exporting...' : '📦 Export as ZIP'}
          </button>
          <button className={styles.clearBtn} onClick={() => setSession(null)}>
            🗑 Clear
          </button>
          <button 
            className={styles.cleanupBtn} 
            onClick={cleanupWorkflowFiles}
            disabled={isCleaningUp}
          >
            {isCleaningUp ? '🔄 Cleaning...' : '🗂 Delete All Recordings'}
          </button>
        </div>
      )}

      {cleanupMessage && (
        <div className={styles.message}>
          {cleanupMessage}
        </div>
      )}

      <div className={styles.shortcuts}>
        <small>F9: Toggle • F10: Screenshot</small>
      </div>

      {/* Note Modal */}
      {showNoteModal && (
        <div 
          className={styles.noteModalOverlay} 
          data-testid="note-modal-overlay"
        >
          <div className={styles.noteModal}>
            <div className={styles.noteModalHeader}>
              <h3>📝 Add Workflow Note</h3>
            </div>
            <div className={styles.noteModalBody}>
              <textarea
                className={styles.noteTextarea}
                placeholder="Enter your note here..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus={true}
                rows={4}
              />
            </div>
            <div className={styles.noteModalFooter}>
              <button
                className={styles.noteModalCancel}
                onClick={closeNoteModal}
              >
                Cancel
              </button>
              <button
                className={styles.noteModalSave}
                onClick={addNote}
                disabled={!noteText.trim()}
              >
                📷 Capture & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};