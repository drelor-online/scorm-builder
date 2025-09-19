import React, { useState, useEffect } from 'react'
import { CourseSeedData } from '../types/course'
import { PageLayout } from './PageLayout'
import { useFormChanges } from '../hooks/useFormChanges'
import { AutoSaveBadge } from './AutoSaveBadge'
import { Check, Copy, Settings } from 'lucide-react'
import { Card, Button } from './DesignSystem'
import './DesignSystem/designSystem.css'
import { useNotifications } from '../contexts/NotificationContext'
import { usePromptTuning } from '../hooks/usePromptTuning'
import { buildAIPrompt, getSettingsChangeSummary } from '../utils/promptBuilder'
import { PromptTuningModal } from './PromptTuningModal'
import { PromptTuningSettings, DEFAULT_PROMPT_TUNING_SETTINGS } from '../types/promptTuning'
import { usePersistentStorage } from '../hooks/usePersistentStorage'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import styles from './AIPromptGenerator.module.css'

interface AIPromptGeneratorProps {
  courseSeedData: CourseSeedData
  onNext: () => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

export const AIPromptGenerator: React.FC<AIPromptGeneratorProps> = ({
  courseSeedData,
  onNext,
  onBack,
  onSettingsClick,
  onSave,
  onOpen,
  onHelp,
  onStepClick
}) => {
  const [copied, setCopied] = useState(false)
  const [hasCopiedPrompt, setHasCopiedPrompt] = useState(false)
  const { success, error: notifyError } = useNotifications()
  const [customPrompt, setCustomPrompt] = useState('')
  const [mounted, setMounted] = useState(false)
  const [isPromptTuningModalOpen, setIsPromptTuningModalOpen] = useState(false)
  const [promptTuningSettings, setPromptTuningSettings] = useState<PromptTuningSettings>(DEFAULT_PROMPT_TUNING_SETTINGS)

  // Storage integration
  const storage = usePersistentStorage()

  // Unsaved changes integration
  const { markDirty, resetDirty } = useUnsavedChanges()

  // Check if settings are default
  const isDefault = JSON.stringify(promptTuningSettings) === JSON.stringify(DEFAULT_PROMPT_TUNING_SETTINGS)

  // Removed history functionality per UX requirements
  
  // Navigation guard hook - we treat "has copied prompt" as a form change
  const {
    attemptNavigation,
    checkForChanges,
    showNavigationWarning,
    confirmNavigation,
    cancelNavigation
  } = useFormChanges({
    initialValues: { hasCopied: false }
  })
  
  // Custom prompt state is tracked but not auto-saved to localStorage anymore
  
  // Set mounted flag and load prompt tuning settings
  useEffect(() => {
    setMounted(true)

    // Load prompt tuning settings from project storage
    const loadPromptTuningSettings = async () => {
      try {
        const savedSettings = await storage.getContent('promptTuningSettings')
        if (savedSettings) {
          setPromptTuningSettings(savedSettings)
        }
      } catch (error) {
        console.warn('[AIPromptGenerator] Failed to load prompt tuning settings:', error)
        // Continue with default settings
      }
    }

    if (storage.currentProjectId) {
      loadPromptTuningSettings()
    }

    return () => {
      setMounted(false)
      resetDirty('promptTuning')
    }
  }, [storage])
  
  // Track when user copies the prompt
  useEffect(() => {
    if (mounted && copied && !hasCopiedPrompt) {
      setHasCopiedPrompt(true)
      // Tell the form changes hook that we have changes
      checkForChanges({ hasCopied: true })
    }
  }, [mounted, copied, hasCopiedPrompt, checkForChanges])

  const generatePrompt = React.useCallback((): string => {
    return buildAIPrompt(courseSeedData, promptTuningSettings, customPrompt)
  }, [customPrompt, courseSeedData, promptTuningSettings])

  const handleCopy = async () => {
    const prompt = generatePrompt()
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Show user-friendly error without console.error
      setCopied(false)
      notifyError('Failed to copy to clipboard. Please try selecting and copying manually.')
    }
  }
  
  // Wrapped navigation handlers
  const handleBack = () => {
    attemptNavigation(() => onBack())
  }
  
  const handleStepClick = (stepIndex: number) => {
    if (onStepClick) {
      attemptNavigation(() => onStepClick(stepIndex))
    }
  }
  
  const handleOpen = () => {
    if (onOpen) {
      attemptNavigation(() => onOpen())
    }
  }

  // Helper function to get difficulty label
  const getDifficultyLabel = (level: number): string => {
    const labels = ['Basic', 'Easy', 'Medium', 'Hard', 'Expert']
    return labels[level - 1] || 'Medium'
  }

  // Prompt tuning modal handlers
  const handleOpenPromptTuning = () => {
    setIsPromptTuningModalOpen(true)
  }

  const handleClosePromptTuning = () => {
    setIsPromptTuningModalOpen(false)
  }

  const handleApplyPromptTuning = async (newSettings: PromptTuningSettings) => {
    try {
      // Save settings to project storage
      await storage.saveContent('promptTuningSettings', newSettings)

      // Update local state
      setPromptTuningSettings(newSettings)

      // Mark as dirty for unsaved changes tracking
      markDirty('promptTuning')

      const changes = getSettingsChangeSummary(newSettings)
      if (changes.length > 0) {
        success(`Prompt settings updated: ${changes.join(', ')}`)
      } else {
        success('Prompt settings reset to defaults')
      }
    } catch (error) {
      console.error('[AIPromptGenerator] Failed to save prompt tuning settings:', error)
      notifyError('Failed to save prompt tuning settings. Please try again.')
    }
  }

  const prompt = generatePrompt()

  // Removed Reset, Save as Template, and History functionality per UX requirements

  const autoSaveIndicator = (
    <AutoSaveBadge />
  )


  return (
    <>
      <PageLayout
        currentStep={1}
        title="AI Prompt Generator"
        description="Generate a comprehensive AI prompt based on your course configuration"
        autoSaveIndicator={autoSaveIndicator}
        onSettingsClick={onSettingsClick}
        onSave={onSave}
        onOpen={handleOpen}
        onHelp={onHelp}
        onBack={handleBack}
        onNext={onNext}
        onStepClick={handleStepClick}
      >
      {/* Status announcements for screen readers */}
      {copied && (
        <div role="status" aria-live="polite" className={styles.srOnly}>
          Prompt copied to clipboard
        </div>
      )}

      {/* Instructions */}
      <div className={styles.sectionWrapper}>
        <h2 className={styles.sectionTitle}>Instructions</h2>
        <Card>
          <ol className={styles.instructionsList}>
            <li>Copy the prompt to your clipboard</li>
            <li>Review your Prompt Tuning presets so the AI response matches the narration, media, and assessment style you expect</li>
            <li>Paste it into your preferred AI chatbot (ChatGPT, Claude, etc.)</li>
            <li>Copy the JSON response from the AI</li>
            <li>Click Next to proceed to the JSON import step</li>
          </ol>
        </Card>
      </div>

      {/* Course Information */}
      <div className={styles.sectionWrapper}>
        <h2 className={styles.sectionTitle}>Course Information</h2>
        <Card>
          <div className={styles.courseInfoGrid}>
            <p className={styles.courseInfoItem}>
              <strong className={styles.courseInfoLabel}>Title:</strong> {courseSeedData.courseTitle}
            </p>
            <p className={styles.courseInfoItem}>
              <strong className={styles.courseInfoLabel}>Difficulty:</strong> {getDifficultyLabel(courseSeedData.difficulty)} ({courseSeedData.difficulty} out of 5)
            </p>
            <p className={styles.courseInfoItem}>
              <strong className={styles.courseInfoLabel}>Template:</strong> {courseSeedData.template}
            </p>
            {!isDefault && (
              <p className={styles.courseInfoItem}>
                <strong className={styles.courseInfoLabel}>Prompt Settings:</strong> Custom ({getSettingsChangeSummary(promptTuningSettings).length} changes)
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Prompt History removed per UX requirements */}

      {/* AI Prompt */}
      <div className={styles.sectionWrapper}>
        <h2 className={styles.sectionTitle}>AI Prompt</h2>
        <Card>
          {/* Copy button above textarea for better accessibility */}
          <div className={styles.topButtonContainer}>
            <div className={styles.buttonGroup}>
              <Button
                onClick={handleCopy}
                aria-label="Copy prompt to clipboard"
                data-testid="copy-prompt-button-top"
                variant={copied ? 'success' : 'secondary'}
                size="medium"
                className={styles.copyButton}
              >
                {copied ? (
                  <>
                    <Check size={16} className={styles.copyButtonIcon} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} className={styles.copyButtonIcon} /> Copy Prompt
                  </>
                )}
              </Button>
              <Button
                onClick={handleOpenPromptTuning}
                aria-label="Customize prompt generation settings"
                data-testid="prompt-tuning-button"
                variant={!isDefault ? 'primary' : 'secondary'}
                size="medium"
                className={styles.tuningButton}
                title="Customize how AI prompts are generated"
              >
                <Settings size={16} className={styles.tuningButtonIcon} />
                {!isDefault ? 'Custom Settings' : 'Prompt Tuning'}
              </Button>
            </div>
          </div>
          
          <textarea
            id="ai-prompt"
            data-testid="ai-prompt-textarea"
            value={prompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={20}
            aria-label="AI prompt for course generation"
            className={styles.promptTextarea}
          />
        </Card>
      </div>


    </PageLayout>

      {/* Navigation Warning Dialog */}
      {showNavigationWarning && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="navigation-warning-title">
          <div className={styles.modalContent}>
            <h2 id="navigation-warning-title">Unsaved Changes</h2>
            <p>You have copied the prompt. Are you sure you want to leave without continuing to the next step?</p>
            <div className={styles.modalActions}>
              <Button
                onClick={confirmNavigation}
                variant="primary"
                size="medium"
                data-testid="confirm-navigation"
              >
                Yes, Leave
              </Button>
              <Button
                onClick={cancelNavigation}
                variant="secondary"
                size="medium"
                data-testid="cancel-navigation"
              >
                Stay on Page
              </Button>
            </div>
          </div>
        </div>
      )}

      <PromptTuningModal
        isOpen={isPromptTuningModalOpen}
        onClose={handleClosePromptTuning}
        onApply={handleApplyPromptTuning}
        initialSettings={promptTuningSettings}
      />
  </>
  )
}

export default AIPromptGenerator;
