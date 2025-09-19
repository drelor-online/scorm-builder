/**
 * AI Prompt Tuning Modal Component
 *
 * Provides a comprehensive interface for tuning AI prompt generation settings.
 * Features:
 * - Tabbed interface for different setting categories
 * - Real-time settings validation
 * - Reset to defaults functionality
 * - Persistent settings storage
 * - Accessible form controls
 */
import React, { useState, useCallback } from 'react'
import { Modal, Button, ButtonGroup, Tabs, Tab, Card, Tooltip } from './DesignSystem'
import { Settings, RotateCcw, Check, X, HelpCircle, Info } from 'lucide-react'
import { usePromptTuning } from '../hooks/usePromptTuning'
import {
  PromptTuningModalProps,
  PromptTuningSettings,
  SETTING_OPTIONS,
  SETTING_CONSTRAINTS,
  DEFAULT_PROMPT_TUNING_SETTINGS
} from '../types/promptTuning'
import styles from './PromptTuningModal.module.css'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a specific setting is different from the default value
 */
const isSettingModified = (
  settings: PromptTuningSettings,
  key: keyof PromptTuningSettings
): boolean => {
  return settings[key] !== DEFAULT_PROMPT_TUNING_SETTINGS[key]
}

// ============================================================================
// Individual Setting Components
// ============================================================================

interface SettingGroupProps {
  title: string
  description?: string
  helpText?: string
  children: React.ReactNode
  isModified?: boolean
}

const SettingGroup: React.FC<SettingGroupProps> = ({
  title,
  description,
  helpText,
  children,
  isModified = false
}) => (
  <div className={`${styles.settingGroup} ${isModified ? styles.settingModified : ''}`}>
    <div className={styles.settingHeader}>
      <h4 className={styles.settingTitle}>
        {title}
        {isModified && (
          <span className={styles.modifiedIndicator} aria-label="Modified from default">
            •
          </span>
        )}
      </h4>
      {helpText && (
        <Tooltip
          content={helpText}
          position="top"
          delay={200}
        >
          <button
            type="button"
            className={styles.helpButton}
            aria-label={`Help for ${title}`}
          >
            <HelpCircle size={16} />
          </button>
        </Tooltip>
      )}
    </div>
    {description && <p className={styles.settingDescription}>{description}</p>}
    <div className={styles.settingControl}>
      {children}
    </div>
  </div>
)

interface ButtonGroupSettingProps {
  label: string
  value: string
  options: Record<string, { label: string; description: string }>
  onChange: (value: string) => void
  helpText?: string
  settings: PromptTuningSettings
  settingKey: keyof PromptTuningSettings
}

const ButtonGroupSetting: React.FC<ButtonGroupSettingProps> = ({
  label,
  value,
  options,
  onChange,
  helpText,
  settings,
  settingKey
}) => (
  <SettingGroup
    title={label}
    helpText={helpText}
    isModified={isSettingModified(settings, settingKey)}
  >
    <ButtonGroup gap="small">
      {Object.entries(options).map(([key, option]) => (
        <Tooltip
          key={key}
          content={option.description}
          position="bottom"
          delay={300}
        >
          <Button
            variant={value === key ? 'primary' : 'secondary'}
            onClick={() => onChange(key)}
            aria-pressed={value === key}
            size="small"
          >
            {option.label}
          </Button>
        </Tooltip>
      ))}
    </ButtonGroup>
  </SettingGroup>
)

interface SliderSettingProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  helpText?: string
  unit?: string
  settings: PromptTuningSettings
  settingKey: keyof PromptTuningSettings
}

const SliderSetting: React.FC<SliderSettingProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  helpText,
  unit = '',
  settings,
  settingKey
}) => (
  <SettingGroup
    title={label}
    helpText={helpText}
    isModified={isSettingModified(settings, settingKey)}
  >
    <div className={styles.sliderContainer}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
        aria-label={label}
      />
      <div className={styles.sliderValue}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.sliderInput}
          aria-label={`${label} value`}
        />
        {unit && <span className={styles.sliderUnit}>{unit}</span>}
      </div>
    </div>
    <div className={styles.sliderLabels}>
      <span className={styles.sliderMin}>{min}{unit}</span>
      <span className={styles.sliderMax}>{max}{unit}</span>
    </div>
  </SettingGroup>
)

// ============================================================================
// Tab Content Components
// ============================================================================

interface TabContentProps {
  settings: PromptTuningSettings
  updateSettings: (updates: Partial<PromptTuningSettings>) => void
}

const ContentTab: React.FC<TabContentProps> = ({ settings, updateSettings }) => (
  <div className={styles.tabContent}>
    <ButtonGroupSetting
      label="Narration Length"
      value={settings.narrationLength}
      options={SETTING_OPTIONS.narrationLength}
      onChange={(value) => updateSettings({ narrationLength: value as any })}
      helpText="Controls the length and detail of generated narration text"
      settings={settings}
      settingKey="narrationLength"
    />

    <ButtonGroupSetting
      label="Content Detail Level"
      value={settings.contentDetail}
      options={SETTING_OPTIONS.contentDetail}
      onChange={(value) => updateSettings({ contentDetail: value as any })}
      helpText="Determines how comprehensive the generated content will be"
      settings={settings}
      settingKey="contentDetail"
    />

    <ButtonGroupSetting
      label="HTML Complexity"
      value={settings.htmlComplexity}
      options={SETTING_OPTIONS.htmlComplexity}
      onChange={(value) => updateSettings({ htmlComplexity: value as any })}
      helpText="Controls which HTML elements will be used in content generation"
      settings={settings}
      settingKey="htmlComplexity"
    />
  </div>
)

const MediaTab: React.FC<TabContentProps> = ({ settings, updateSettings }) => (
  <div className={styles.tabContent}>
    <ButtonGroupSetting
      label="AI Image Prompt Detail"
      value={settings.imagePromptDetail}
      options={SETTING_OPTIONS.imagePromptDetail}
      onChange={(value) => updateSettings({ imagePromptDetail: value as any })}
      helpText="Level of detail in AI image generation prompts"
      settings={settings}
      settingKey="imagePromptDetail"
    />

    <SliderSetting
      label="Image Keywords Count"
      value={settings.imageKeywordsCount}
      min={SETTING_CONSTRAINTS.imageKeywordsCount.min}
      max={SETTING_CONSTRAINTS.imageKeywordsCount.max}
      onChange={(value) => updateSettings({ imageKeywordsCount: value })}
      helpText="Number of keywords generated for image searches per page"
      settings={settings}
      settingKey="imageKeywordsCount"
    />

    <ButtonGroupSetting
      label="Image Search Specificity"
      value={settings.imageSearchSpecificity}
      options={SETTING_OPTIONS.imageSearchSpecificity}
      onChange={(value) => updateSettings({ imageSearchSpecificity: value as any })}
      helpText="How targeted and specific the image search terms should be"
      settings={settings}
      settingKey="imageSearchSpecificity"
    />

    <SliderSetting
      label="Video Search Terms Count"
      value={settings.videoSearchTermsCount}
      min={SETTING_CONSTRAINTS.videoSearchTermsCount.min}
      max={SETTING_CONSTRAINTS.videoSearchTermsCount.max}
      onChange={(value) => updateSettings({ videoSearchTermsCount: value })}
      helpText="Number of search terms generated for finding relevant videos"
      settings={settings}
      settingKey="videoSearchTermsCount"
    />

    <ButtonGroupSetting
      label="Video Search Specificity"
      value={settings.videoSearchSpecificity}
      options={SETTING_OPTIONS.videoSearchSpecificity}
      onChange={(value) => updateSettings({ videoSearchSpecificity: value as any })}
      helpText="How targeted and specific the video search terms should be"
      settings={settings}
      settingKey="videoSearchSpecificity"
    />
  </div>
)

const AssessmentTab: React.FC<TabContentProps> = ({ settings, updateSettings }) => (
  <div className={styles.tabContent}>
    <SliderSetting
      label="Knowledge Check Questions"
      value={settings.knowledgeCheckQuestions}
      min={SETTING_CONSTRAINTS.knowledgeCheckQuestions.min}
      max={SETTING_CONSTRAINTS.knowledgeCheckQuestions.max}
      onChange={(value) => updateSettings({ knowledgeCheckQuestions: value })}
      helpText="Number of knowledge check questions per topic (0 = no knowledge checks)"
      settings={settings}
      settingKey="knowledgeCheckQuestions"
    />

    <SliderSetting
      label="Assessment Questions Total"
      value={settings.assessmentQuestions}
      min={SETTING_CONSTRAINTS.assessmentQuestions.min}
      max={SETTING_CONSTRAINTS.assessmentQuestions.max}
      onChange={(value) => updateSettings({ assessmentQuestions: value })}
      helpText="Total number of questions in the final assessment"
      settings={settings}
      settingKey="assessmentQuestions"
    />

    <SliderSetting
      label="Pass Mark Percentage"
      value={settings.passMark}
      min={SETTING_CONSTRAINTS.passMark.min}
      max={SETTING_CONSTRAINTS.passMark.max}
      step={SETTING_CONSTRAINTS.passMark.step}
      onChange={(value) => updateSettings({ passMark: value })}
      helpText="Minimum score required to pass the final assessment"
      unit="%"
      settings={settings}
      settingKey="passMark"
    />

    <ButtonGroupSetting
      label="Question Type Mix"
      value={settings.questionTypeMix}
      options={SETTING_OPTIONS.questionTypeMix}
      onChange={(value) => updateSettings({ questionTypeMix: value as any })}
      helpText="Controls the distribution of different question types"
      settings={settings}
      settingKey="questionTypeMix"
    />
  </div>
)

// Removed WordCountRangeSetting - now using simple SliderSetting component

// Character Limit Setting Component
const CharacterLimitSetting: React.FC<{
  enabled: boolean
  limit: number
  onToggle: (enabled: boolean) => void
  onLimitChange: (limit: number) => void
  settings: any
}> = ({ enabled, limit, onToggle, onLimitChange, settings }) => {
  const isModified = enabled !== DEFAULT_PROMPT_TUNING_SETTINGS.enforceCharacterLimit ||
    limit !== DEFAULT_PROMPT_TUNING_SETTINGS.characterLimit

  return (
    <SettingGroup
      title="Character Limit Control"
      helpText="Controls maximum character count per paragraph for voice generation compatibility. Murf.ai has a 1000 character limit per paragraph."
      isModified={isModified}
    >

      <div className={styles.characterLimitContainer}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className={styles.checkbox}
          />
          Enforce character limit
        </label>

        {enabled && (
          <div className={styles.characterLimitInput}>
            <label className={styles.wordCountLabel}>Maximum characters per paragraph</label>
            <SliderSetting
              label=""
              value={limit}
              min={SETTING_CONSTRAINTS.characterLimit.min}
              max={SETTING_CONSTRAINTS.characterLimit.max}
              onChange={onLimitChange}
              helpText=""
              unit=" chars"
              settings={settings}
              settingKey="characterLimit"
              />
          </div>
        )}

        <div className={styles.murffaiNote}>
          <Info size={16} />
          <span>Note: Murf.ai voice generation has a 1000 character limit per paragraph</span>
        </div>
      </div>
    </SettingGroup>
  )
}

const ContentLengthTab: React.FC<TabContentProps> = ({ settings, updateSettings }) => (
  <div className={styles.tabContent}>
    <SliderSetting
      label="Welcome Page Word Count"
      value={settings.welcomeWordCount}
      min={SETTING_CONSTRAINTS.welcomeWordCount.min}
      max={SETTING_CONSTRAINTS.welcomeWordCount.max}
      onChange={(value) => updateSettings({ welcomeWordCount: value })}
      helpText="Average word count for welcome page content generation"
      unit=" words"
      settings={settings}
      settingKey="welcomeWordCount"
    />

    <SliderSetting
      label="Learning Objectives Word Count"
      value={settings.objectivesWordCount}
      min={SETTING_CONSTRAINTS.objectivesWordCount.min}
      max={SETTING_CONSTRAINTS.objectivesWordCount.max}
      onChange={(value) => updateSettings({ objectivesWordCount: value })}
      helpText="Average word count for learning objectives content"
      unit=" words"
      settings={settings}
      settingKey="objectivesWordCount"
    />

    <SliderSetting
      label="Topic Page Word Count"
      value={settings.topicWordCount}
      min={SETTING_CONSTRAINTS.topicWordCount.min}
      max={SETTING_CONSTRAINTS.topicWordCount.max}
      onChange={(value) => updateSettings({ topicWordCount: value })}
      helpText="Average word count for topic page content"
      unit=" words"
      settings={settings}
      settingKey="topicWordCount"
    />

    <CharacterLimitSetting
      enabled={settings.enforceCharacterLimit}
      limit={settings.characterLimit}
      onToggle={(enabled) => updateSettings({ enforceCharacterLimit: enabled })}
      onLimitChange={(limit) => updateSettings({ characterLimit: limit })}
      settings={settings}
    />
  </div>
)

// ============================================================================
// Main Modal Component
// ============================================================================

export const PromptTuningModal: React.FC<PromptTuningModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialSettings
}) => {
  const { settings, updateSettings, resetToDefaults, isDefault } = usePromptTuning()
  const [activeTab, setActiveTab] = useState('content')

  // Initialize with any provided initial settings
  React.useEffect(() => {
    if (initialSettings && Object.keys(initialSettings).length > 0) {
      updateSettings(initialSettings)
    }
  }, [initialSettings, updateSettings])

  const handleApply = useCallback(() => {
    onApply(settings)
    onClose()
  }, [settings, onApply, onClose])

  const handleReset = useCallback(() => {
    resetToDefaults()
  }, [resetToDefaults])

  const tabProps = { settings, updateSettings }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prompt Tuning"
      size="large"
      data-testid="prompt-tuning-modal"
    >
      <div className={styles.modalContent}>
        {/* Header with description */}
        <div className={styles.modalHeader}>
          <p className={styles.modalDescription}>
            Customize AI prompt generation settings to fine-tune your course content.
            Default settings maintain the current behavior exactly.
          </p>
          {!isDefault && (
            <div className={styles.customIndicator}>
              <Settings size={16} />
              <span>Custom settings active</span>
            </div>
          )}
        </div>

        {/* Tabbed interface */}
        <div className={styles.tabsContainer}>
          <Tabs activeTab={activeTab} onChange={setActiveTab}>
            <Tab tabKey="content" label="Content" icon={<Settings size={16} />}>
              <ContentTab {...tabProps} />
            </Tab>
            <Tab tabKey="media" label="Media" icon={<Settings size={16} />}>
              <MediaTab {...tabProps} />
            </Tab>
            <Tab tabKey="assessment" label="Assessment" icon={<Settings size={16} />}>
              <AssessmentTab {...tabProps} />
            </Tab>
            <Tab tabKey="content-length" label="Content Length" icon={<Settings size={16} />}>
              <ContentLengthTab {...tabProps} />
            </Tab>
          </Tabs>
        </div>

        {/* Modal footer with actions */}
        <div className={styles.modalFooter}>
          <div className={styles.footerLeft}>
            <Button
              variant="secondary"
              onClick={handleReset}
              disabled={isDefault}
              title={isDefault ? "Already using default settings" : "Reset all settings to defaults"}
              data-testid="reset-button"
            >
              <RotateCcw size={16} />
              Reset to Defaults
            </Button>
          </div>

          <div className={styles.footerRight}>
            <Button
              variant="secondary"
              onClick={onClose}
              data-testid="cancel-button"
            >
              <X size={16} />
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApply}
              data-testid="apply-button"
            >
              <Check size={16} />
              Apply Settings
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default PromptTuningModal