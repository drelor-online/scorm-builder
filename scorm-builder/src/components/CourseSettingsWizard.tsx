import React, { useState, useEffect } from 'react'
import { CourseContent } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import { PageLayout } from './PageLayout'
import {
  Card,
  Button,
  FormField,
  FormGroup
} from './DesignSystem'
import { RotateCcw } from 'lucide-react'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import { AutoSaveBadge } from './AutoSaveBadge'
import './DesignSystem/designSystem.css'

interface CourseSettingsWizardProps {
  courseContent: CourseContent
  courseSeedData: CourseSeedData
  onNext: (settings: CourseSettings) => void
  onBack: () => void
  onSettingsClick?: () => void
  onHelp?: () => void
  onSave?: (content?: any, silent?: boolean) => void
  onOpen?: () => void
  onStepClick?: (stepIndex: number) => void
}

export type NavigationMode = 'linear' | 'free'
export type CompletionCriteria = 'view_all_pages' | 'pass_assessment' | 'time_spent' | 'view_and_pass'
export type FontSize = 'small' | 'medium' | 'large'

export interface CourseSettings {
  // Learning Control
  requireAudioCompletion: boolean
  navigationMode: NavigationMode
  autoAdvance: boolean
  allowPreviousReview: boolean

  // Assessment
  passMark: number
  allowRetake: boolean
  retakeDelay: number // hours, 0 = immediate
  completionCriteria: CompletionCriteria

  // Interface & UX
  showProgress: boolean
  showOutline: boolean
  confirmExit: boolean
  fontSize: FontSize

  // Timing & Sessions
  timeLimit: number // minutes, 0 = unlimited
  sessionTimeout: number // minutes for auto-save
  minimumTimeSpent: number // minutes required for completion

  // Accessibility
  keyboardNavigation: boolean
  printable: boolean
}

// Default course settings - these represent the historical defaults that have been used
// since the CourseSettingsWizard was first introduced
export const DEFAULT_COURSE_SETTINGS: CourseSettings = {
  // Learning Control - sensible defaults for most courses
  requireAudioCompletion: false,
  navigationMode: 'free',
  autoAdvance: false, // Let users control their pace
  allowPreviousReview: true, // Good for learning

  // Assessment - standard defaults
  passMark: 80,
  allowRetake: true,
  retakeDelay: 0, // Immediate retakes by default
  completionCriteria: 'view_and_pass', // Most comprehensive

  // Interface & UX - user-friendly defaults
  showProgress: true, // Users like to see progress
  showOutline: true, // Good for navigation
  confirmExit: true, // Prevent accidental exits
  fontSize: 'medium', // Standard size

  // Timing & Sessions - permissive defaults
  timeLimit: 0, // Unlimited by default
  sessionTimeout: 30, // Auto-save every 30 minutes
  minimumTimeSpent: 0, // No minimum time requirement

  // Accessibility - inclusive defaults
  keyboardNavigation: true, // Good for accessibility
  printable: false // Usually not needed, can affect formatting
}

export const CourseSettingsWizard: React.FC<CourseSettingsWizardProps> = ({
  courseContent,
  courseSeedData,
  onNext,
  onBack,
  onSettingsClick,
  onHelp,
  onSave,
  onOpen,
  onStepClick
}) => {
  const [settings, setSettings] = useState<CourseSettings>({
    ...DEFAULT_COURSE_SETTINGS
  })

  // Storage integration
  const storage = useStorage()

  // Unsaved changes integration
  const { markDirty, resetDirty } = useUnsavedChanges()

  // Load saved course settings on mount and when project changes
  useEffect(() => {
    const loadCourseSettings = async () => {
      try {
        // ENHANCED: Check both React state and FileStorage instance directly as fallback
        const reactProjectId = storage.currentProjectId;
        const fileStorageProjectId = storage.fileStorage?.currentProjectId;
        const actualProjectId = reactProjectId || fileStorageProjectId;

        console.log('[CourseSettingsWizard] 🔄 Loading course settings - State check:', {
          reactState: reactProjectId,
          fileStorageState: fileStorageProjectId,
          actualProjectId,
          hasStorage: !!storage,
          hasFileStorage: !!storage.fileStorage,
          storageInitialized: storage.isInitialized
        });

        if (actualProjectId) {
          console.log('[CourseSettingsWizard] 📂 Loading course settings for project:', actualProjectId);

          // Enhanced error handling for storage access
          let savedSettings = null;
          try {
            savedSettings = await storage.getContent('courseSettings');
          } catch (storageError) {
            console.error('[CourseSettingsWizard] ❌ Failed to access storage for courseSettings:', storageError);

            // Try direct FileStorage access as fallback
            if (storage.fileStorage) {
              try {
                console.log('[CourseSettingsWizard] 🔄 Attempting direct FileStorage access...');
                savedSettings = await storage.fileStorage.getContent('courseSettings');
                console.log('[CourseSettingsWizard] ✅ Direct FileStorage access succeeded');
              } catch (directStorageError) {
                console.error('[CourseSettingsWizard] ❌ Direct FileStorage access also failed:', directStorageError);
              }
            }
          }

          if (savedSettings) {
            console.log('[CourseSettingsWizard] ✅ Loaded saved settings from storage:', {
              settingsKeys: Object.keys(savedSettings),
              passMark: savedSettings.passMark,
              fontSize: savedSettings.fontSize,
              confirmExit: savedSettings.confirmExit
            });
            setSettings(savedSettings);
          } else {
            console.log('[CourseSettingsWizard] ⚠️ No saved settings found, using defaults');
            // Use defaults but don't override if we already have non-default settings
            // This prevents resetting when switching between components
            setSettings(prevSettings => {
              const isCurrentlyDefaults = JSON.stringify(prevSettings) === JSON.stringify(DEFAULT_COURSE_SETTINGS);
              console.log('[CourseSettingsWizard] Settings comparison:', {
                isCurrentlyDefaults,
                currentSettingsKeys: Object.keys(prevSettings),
                willUseDefaults: isCurrentlyDefaults
              });
              return isCurrentlyDefaults ? { ...DEFAULT_COURSE_SETTINGS } : prevSettings;
            });
          }
        } else {
          console.log('[CourseSettingsWizard] ⚠️ No project open - State details:', {
            reactProjectId,
            fileStorageProjectId,
            storageKeys: storage ? Object.keys(storage) : 'no storage',
            fileStorageKeys: storage?.fileStorage ? Object.keys(storage.fileStorage) : 'no fileStorage'
          });
          // No project open, reset to defaults
          setSettings({ ...DEFAULT_COURSE_SETTINGS });
        }
      } catch (error) {
        console.error('[CourseSettingsWizard] ❌ Critical error in loadCourseSettings:', error);
        console.error('[CourseSettingsWizard] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          storageState: {
            hasStorage: !!storage,
            currentProjectId: storage?.currentProjectId,
            isInitialized: storage?.isInitialized
          }
        });
        // Continue with default settings
        setSettings({ ...DEFAULT_COURSE_SETTINGS });
      }
    };

    // ENHANCED RETRY MECHANISM: Multiple retry attempts with comprehensive state checking
    let attempts = 0;
    const maxAttempts = 15; // Increased for more thorough checking
    let retryTimeoutId: NodeJS.Timeout | null = null;

    const retryLoadSettings = async () => {
      attempts++;
      console.log(`[CourseSettingsWizard] 🔄 Attempt ${attempts}/${maxAttempts} - Loading settings...`);

      await loadCourseSettings();

      // Enhanced state checking with more comprehensive verification
      const reactProjectId = storage.currentProjectId;
      const fileStorageProjectId = storage.fileStorage?.currentProjectId;
      const hasAnyProjectId = reactProjectId || fileStorageProjectId;
      const storageInitialized = storage.isInitialized;

      console.log(`[CourseSettingsWizard] Attempt ${attempts} result:`, {
        reactProjectId,
        fileStorageProjectId,
        hasAnyProjectId,
        storageInitialized,
        shouldRetry: !hasAnyProjectId && attempts < maxAttempts
      });

      // Retry conditions: no project ID AND not at max attempts AND storage seems to be initializing
      if (!hasAnyProjectId && attempts < maxAttempts && (storageInitialized || attempts < 5)) {
        const delay = Math.min(100 * attempts, 1000); // Cap delay at 1 second
        console.log(`[CourseSettingsWizard] ⏳ Scheduling retry ${attempts + 1} in ${delay}ms...`);
        retryTimeoutId = setTimeout(retryLoadSettings, delay);
      } else if (attempts >= maxAttempts && !hasAnyProjectId) {
        console.warn('[CourseSettingsWizard] ⚠️ Max retry attempts reached without finding project ID');
        console.warn('[CourseSettingsWizard] Final state:', {
          reactProjectId,
          fileStorageProjectId,
          storageInitialized,
          attempts
        });
      } else if (hasAnyProjectId) {
        console.log(`[CourseSettingsWizard] ✅ Successfully loaded with project ID after ${attempts} attempts`);
      }
    };

    // Start with small delay to allow storage initialization
    const initialTimeoutId = setTimeout(retryLoadSettings, 50);

    return () => {
      clearTimeout(initialTimeoutId);
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
    };
  }, [storage.currentProjectId, storage.fileStorage?.currentProjectId, storage]);

  // Helper function to update settings and mark as dirty
  const updateSettings = (updater: (prev: CourseSettings) => CourseSettings) => {
    setSettings(updater)
    markDirty('courseSettings')
  }

  // Auto-save course settings when they change
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const autoSave = async () => {
      // ENHANCED: Check both React state and FileStorage instance directly as fallback
      const reactProjectId = storage.currentProjectId;
      const fileStorageProjectId = storage.fileStorage?.currentProjectId;
      const actualProjectId = reactProjectId || fileStorageProjectId;

      console.log('[CourseSettingsWizard] 💾 Auto-save triggered - State check:', {
        reactState: reactProjectId,
        fileStorageState: fileStorageProjectId,
        actualProjectId,
        hasStorage: !!storage,
        hasFileStorage: !!storage.fileStorage,
        settingsToSave: {
          passMark: settings.passMark,
          fontSize: settings.fontSize,
          confirmExit: settings.confirmExit,
          // Include other key settings for debugging
          navigationMode: settings.navigationMode,
          completionCriteria: settings.completionCriteria
        }
      });

      if (!actualProjectId) {
        console.warn('[CourseSettingsWizard] ❌ Cannot auto-save: No project open', {
          reactState: reactProjectId,
          fileStorageState: fileStorageProjectId,
          storageInitialized: storage.isInitialized
        });
        return;
      }

      try {
        console.log('[CourseSettingsWizard] 💾 Attempting to save course settings...');
        await storage.saveContent('courseSettings', settings);
        console.log('[CourseSettingsWizard] ✅ Auto-saved course settings successfully');
        resetDirty('courseSettings');
      } catch (error) {
        console.error('[CourseSettingsWizard] ❌ Auto-save failed:', error);
        console.error('[CourseSettingsWizard] Auto-save error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          actualProjectId,
          storageType: storage.constructor.name,
          settingsKeys: Object.keys(settings)
        });

        // Try direct FileStorage access as fallback
        if (storage.fileStorage && actualProjectId) {
          try {
            console.log('[CourseSettingsWizard] 🔄 Attempting direct FileStorage save...');
            await storage.fileStorage.saveContent('courseSettings', settings);
            console.log('[CourseSettingsWizard] ✅ Direct FileStorage save succeeded');
            resetDirty('courseSettings');
          } catch (directSaveError) {
            console.error('[CourseSettingsWizard] ❌ Direct FileStorage save also failed:', directSaveError);
            // Keep dirty state if both save methods failed
          }
        }
      }
    };

    // Enhanced conditions checking with better logging
    const reactProjectId = storage.currentProjectId;
    const fileStorageProjectId = storage.fileStorage?.currentProjectId;
    const actualProjectId = reactProjectId || fileStorageProjectId;
    const isDefaultSettings = JSON.stringify(settings) === JSON.stringify(DEFAULT_COURSE_SETTINGS);

    console.log('[CourseSettingsWizard] Auto-save conditions check:', {
      hasProjectId: !!actualProjectId,
      isDefaultSettings,
      shouldAutoSave: actualProjectId && !isDefaultSettings,
      currentSettings: {
        passMark: settings.passMark,
        fontSize: settings.fontSize,
        confirmExit: settings.confirmExit
      },
      defaultSettings: {
        passMark: DEFAULT_COURSE_SETTINGS.passMark,
        fontSize: DEFAULT_COURSE_SETTINGS.fontSize,
        confirmExit: DEFAULT_COURSE_SETTINGS.confirmExit
      }
    });

    if (actualProjectId && !isDefaultSettings) {
      console.log('[CourseSettingsWizard] ⏰ Scheduling auto-save in 1 second...');
      timeoutId = setTimeout(autoSave, 1000); // Debounce auto-save by 1 second
    } else {
      console.log('[CourseSettingsWizard] ⏸️ Skipping auto-save:', {
        reason: !actualProjectId ? 'No project ID' : 'Settings are defaults'
      });
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [settings, storage, resetDirty])

  // Clean up dirty state on unmount
  useEffect(() => {
    return () => {
      resetDirty('courseSettings')
    }
  }, [resetDirty])

  // AutoSave indicator component
  const autoSaveIndicator = (
    <AutoSaveBadge />
  )

  const handleNext = async () => {
    const reactProjectId = storage.currentProjectId;
    const fileStorageProjectId = storage.fileStorage?.currentProjectId;
    const actualProjectId = reactProjectId || fileStorageProjectId;

    console.log('[CourseSettingsWizard] 🚀 handleNext called - Final save before navigation:', {
      reactState: reactProjectId,
      fileStorageState: fileStorageProjectId,
      actualProjectId,
      settingsToSave: {
        passMark: settings.passMark,
        fontSize: settings.fontSize,
        confirmExit: settings.confirmExit,
        navigationMode: settings.navigationMode,
        completionCriteria: settings.completionCriteria
      }
    });

    try {
      if (actualProjectId) {
        console.log('[CourseSettingsWizard] 💾 Saving course settings before navigation...');
        await storage.saveContent('courseSettings', settings);
        console.log('[CourseSettingsWizard] ✅ Successfully saved course settings before navigation');
      } else {
        console.warn('[CourseSettingsWizard] ⚠️ No project ID available for final save');
      }
    } catch (error) {
      console.error('[CourseSettingsWizard] ❌ Failed to save course settings before navigation:', error);
      console.error('[CourseSettingsWizard] Navigation save error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        actualProjectId,
        hasStorage: !!storage,
        hasFileStorage: !!storage.fileStorage
      });
      // Continue anyway - don't block navigation
    }

    console.log('[CourseSettingsWizard] 🎯 Proceeding to next step with settings:', settings);
    onNext(settings)
  }

  const handleResetToDefaults = () => {
    updateSettings(() => ({ ...DEFAULT_COURSE_SETTINGS }))
  }

  return (
    <PageLayout
      currentStep={6}
      title="Course Settings"
      description="Configure course behavior and SCORM package options"
      autoSaveIndicator={autoSaveIndicator}
      onSettingsClick={onSettingsClick}
      onBack={onBack}
      onNext={handleNext}
      onSave={onSave}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      <div className="course-settings-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <Card>
          <div style={{ padding: '2rem' }}>
            {/* Reset to Defaults Button */}
            <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <Button
                variant="secondary"
                onClick={handleResetToDefaults}
                title="Restore all settings to their original default values"
                data-testid="reset-defaults-button"
              >
                <RotateCcw size={16} style={{ marginRight: '0.5rem' }} />
                Reset to Defaults
              </Button>
              <p style={{
                margin: '0.5rem 0 0 0',
                fontSize: '0.875rem',
                color: 'var(--text-tertiary)',
                lineHeight: '1.4'
              }}>
                Reset all course settings to their original default values
              </p>
            </div>

            <FormGroup>
              {/* Two-column grid layout */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '2rem'
              }}>
                
                {/* Left Column - Learning Control & Assessment */}
                <div>
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '600' }}>
                      Learning Control
                    </h3>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.requireAudioCompletion}
                          onChange={(e) => updateSettings(prev => ({
                            ...prev,
                            requireAudioCompletion: e.target.checked
                          }))}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Require audio completion</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                            Users must listen to all audio before navigating
                          </div>
                        </div>
                      </label>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Navigation Mode</div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="navigationMode"
                            value="linear"
                            checked={settings.navigationMode === 'linear'}
                            onChange={() => updateSettings(prev => ({ ...prev, navigationMode: 'linear' }))}
                          />
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Linear</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="navigationMode"
                            value="free"
                            checked={settings.navigationMode === 'free'}
                            onChange={() => updateSettings(prev => ({ ...prev, navigationMode: 'free' }))}
                          />
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Free</span>
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.autoAdvance}
                          onChange={(e) => updateSettings(prev => ({ ...prev, autoAdvance: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Auto-advance after knowledge checks</span>
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.allowPreviousReview}
                          onChange={(e) => updateSettings(prev => ({ ...prev, allowPreviousReview: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Allow reviewing previous content</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '600' }}>
                      Assessment
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                          Pass Mark (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={settings.passMark}
                          onChange={(e) => updateSettings(prev => ({ 
                            ...prev, 
                            passMark: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 80))
                          }))}
                          style={{ 
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid var(--border-default)',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                          Retake Delay (hours)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="168"
                          value={settings.retakeDelay}
                          onChange={(e) => updateSettings(prev => ({ 
                            ...prev, 
                            retakeDelay: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))}
                          style={{ 
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid var(--border-default)',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Completion Criteria
                      </label>
                      <select
                        value={settings.completionCriteria}
                        onChange={(e) => updateSettings(prev => ({ 
                          ...prev, 
                          completionCriteria: e.target.value as CompletionCriteria 
                        }))}
                        style={{ 
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid var(--border-default)',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <option value="view_all_pages">View all pages</option>
                        <option value="pass_assessment">Pass assessment</option>
                        <option value="time_spent">Minimum time spent</option>
                        <option value="view_and_pass">View all pages + pass assessment</option>
                      </select>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.allowRetake}
                        onChange={(e) => updateSettings(prev => ({ ...prev, allowRetake: e.target.checked }))}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Allow assessment retakes</span>
                    </label>
                  </div>
                </div>

                {/* Right Column - Interface & Advanced */}
                <div>
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '600' }}>
                      Interface & UX
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.showProgress}
                          onChange={(e) => updateSettings(prev => ({ ...prev, showProgress: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Show progress bar</span>
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.showOutline}
                          onChange={(e) => updateSettings(prev => ({ ...prev, showOutline: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Show course outline</span>
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.confirmExit}
                          onChange={(e) => updateSettings(prev => ({ ...prev, confirmExit: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Confirm before exit</span>
                      </label>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Font Size
                      </label>
                      <select
                        value={settings.fontSize}
                        onChange={(e) => updateSettings(prev => ({ 
                          ...prev, 
                          fontSize: e.target.value as FontSize 
                        }))}
                        style={{ 
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid var(--border-default)',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '600' }}>
                      Advanced Options
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                          Time Limit (min)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={settings.timeLimit}
                          onChange={(e) => updateSettings(prev => ({ 
                            ...prev, 
                            timeLimit: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))}
                          placeholder="0 = unlimited"
                          style={{ 
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid var(--border-default)',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                          Min. Time (min)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={settings.minimumTimeSpent}
                          onChange={(e) => updateSettings(prev => ({ 
                            ...prev, 
                            minimumTimeSpent: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))}
                          style={{ 
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid var(--border-default)',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Auto-save Interval (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={settings.sessionTimeout}
                        onChange={(e) => updateSettings(prev => ({ 
                          ...prev, 
                          sessionTimeout: Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 30))
                        }))}
                        style={{ 
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid var(--border-default)',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.keyboardNavigation}
                          onChange={(e) => updateSettings(prev => ({ ...prev, keyboardNavigation: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Enable keyboard navigation</span>
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.printable}
                          onChange={(e) => updateSettings(prev => ({ ...prev, printable: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Allow content printing</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </FormGroup>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}