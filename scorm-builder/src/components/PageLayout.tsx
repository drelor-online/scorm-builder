import React from 'react'
import { commonButtons } from '../styles/buttonStyles'
import { tokens } from './DesignSystem/designTokens'
import styles from './PageLayout.module.css'
import { useStepNavigation } from '../contexts/StepNavigationContext'
import { Tooltip } from './DesignSystem/Tooltip'

// Inline WorkflowProgress component
const WorkflowProgress: React.FC<{ currentStep: number; isDarkMode: boolean; onStepClick?: (step: number) => void }> = ({ 
  currentStep, 
  onStepClick 
}) => {
  const steps = ['Seed', 'Prompt', 'JSON', 'Media', 'Audio', 'Activities', 'SCORM']
  const navigation = useStepNavigation()
  const visitedSteps = navigation?.visitedSteps || []
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '1rem',
      padding: '1rem'
    }}>
      {steps.map((step, index) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip 
            content={`${step}${visitedSteps.includes(index) ? ' - Click to navigate' : ' - Complete previous steps first'}`} 
            position="bottom"
            disabled={!visitedSteps.includes(index)}
          >
            <button
              onClick={() => onStepClick?.(index)}
              disabled={!visitedSteps.includes(index)}
              data-testid={`progress-step-${index}`}
              data-visited={visitedSteps.includes(index) ? 'true' : 'false'}
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                border: visitedSteps.includes(index) ? '2px solid #3b82f6' : '2px solid #374151',
                backgroundColor: index < currentStep ? '#3b82f6' : index === currentStep ? '#1e40af' : 'transparent',
                color: visitedSteps.includes(index) ? 'white' : '#9ca3af',
                cursor: visitedSteps.includes(index) && onStepClick ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              {index + 1}
            </button>
          </Tooltip>
          {index < steps.length - 1 && (
            <div style={{
              width: '2rem',
              height: tokens.spacing.xs, // 4px
              backgroundColor: index < currentStep ? '#3b82f6' : '#374151',
              marginLeft: '0.5rem',
              marginRight: '0.5rem'
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

interface PageLayoutProps {
  children: React.ReactNode
  currentStep: number
  title?: string
  description?: string
  actions?: React.ReactNode
  autoSaveIndicator?: React.ReactNode
  isGenerating?: boolean
  onSettingsClick?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onBack?: () => void
  onNext?: () => void
  nextDisabled?: boolean
  onGenerateSCORM?: () => void
  onStepClick?: (stepIndex: number) => void
  onExport?: () => void
  onImport?: () => void
}

const PageLayoutComponent: React.FC<PageLayoutProps> = ({
  children,
  currentStep,
  title,
  description,
  autoSaveIndicator,
  isGenerating,
  onSettingsClick,
  onSave,
  onSaveAs,
  onOpen,
  onHelp,
  onBack,
  onNext,
  nextDisabled,
  onGenerateSCORM,
  onStepClick,
  onExport: _onExport,
  onImport: _onImport
}) => {
  return (
    <div className={`${styles.pageLayout} page-layout`} data-testid="page-wrapper">
      {/* Fixed Header with Action Bar */}
      <header className={styles.fixedHeader} data-testid="page-header">
        <div className={styles.headerContent}>
          <div className={styles.actionBar} data-testid="top-bar" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '2rem'
          }}>
            {/* Left group: Open, Save, AutoSave */}
            <div data-testid="top-bar-left" style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              <Tooltip content="Open an existing project file" position="bottom">
                <button 
                  onClick={onOpen}
                  type="button"
                  style={commonButtons.headerButton}
                  aria-label="Open project"
                  data-testid="open-button"
                >
                  Open
                </button>
              </Tooltip>
              <Tooltip content="Save current project (Ctrl+S)" position="bottom">
                <button 
                  onClick={() => onSave && onSave()}
                  type="button"
                  style={commonButtons.headerButton}
                  aria-label="Save project"
                >
                  Save
                </button>
              </Tooltip>
              {onSaveAs && (
                <Tooltip content="Save project with a new name" position="bottom">
                  <button 
                    onClick={onSaveAs}
                    type="button"
                    style={commonButtons.headerButton}
                    aria-label="Save project as"
                  >
                    Save As...
                  </button>
                </Tooltip>
              )}
              {autoSaveIndicator && (
                <div className="autoSaveWrapper" data-testid="autosave-indicator" style={{ marginLeft: '0.5rem' }}>
                  {autoSaveIndicator}
                </div>
              )}
            </div>
            
            {/* Center group: Help, Settings */}
            <div data-testid="top-bar-center" style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              <Tooltip content="View help documentation (F1)" position="bottom">
                <button 
                  onClick={onHelp}
                  type="button"
                  style={commonButtons.headerButton}
                  aria-label="Help documentation"
                >
                  Help
                </button>
              </Tooltip>
              <Tooltip content="Configure application settings" position="bottom">
                <button 
                  onClick={onSettingsClick}
                  type="button"
                  style={commonButtons.headerButton}
                  aria-label="Application settings"
                  data-testid="settings-button"
                >
                  Settings
                </button>
              </Tooltip>
            </div>
            
            {/* Right group: Back, Next/Generate */}
            <div data-testid="top-bar-right" style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              {onBack && currentStep > 0 && (
                <Tooltip content="Go to previous step" position="bottom">
                  <button 
                    onClick={onBack}
                    type="button"
                    style={commonButtons.secondaryAction}
                    data-testid="back-button"
                  >
                    ← Back
                  </button>
                </Tooltip>
              )}
              {currentStep === 6 && onGenerateSCORM ? (
                <Tooltip content="Generate SCORM package for LMS deployment" position="bottom" disabled={isGenerating}>
                  <button 
                    onClick={onGenerateSCORM}
                    type="button"
                    style={commonButtons.primaryAction}
                    disabled={isGenerating}
                    data-testid="generate-scorm-button"
                  >
                    {isGenerating ? 'Generating...' : 'Generate SCORM Package'}
                  </button>
                </Tooltip>
              ) : onNext ? (
                <Tooltip content="Go to next step" position="bottom">
                  <button 
                    onClick={onNext}
                    type="button"
                    style={commonButtons.primaryAction}
                    disabled={nextDisabled}
                    data-testid="next-button"
                  >
                    Next →
                  </button>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Stepper Progress - Moved to top */}
      <div className={`${styles.stepperContainer} stepper-container sticky`}>
        <WorkflowProgress currentStep={currentStep} isDarkMode={true} onStepClick={onStepClick} />
      </div>

      {/* Main Content */}
      <main className={`${styles.mainContent} main-content`}>
        <div className={`${styles.contentContainer} ${styles.pageContent} page-content content-wrapper`} data-testid="content-container">
          {title && (
            <div className={styles.pageTitleSection}>
              <h1 data-testid="page-title">{title}</h1>
              {description && <p data-testid="page-description">{description}</p>}
            </div>
          )}
          
          {children}
        </div>
      </main>
    </div>
  )
}

export const PageLayout = React.memo(PageLayoutComponent)

// Form Section Component for consistent card styling
interface FormSectionProps {
  children: React.ReactNode
  title?: string
}

export const FormSection: React.FC<FormSectionProps> = ({ children, title }) => {
  return (
    <div className={`${styles.formSection} form-section form-card`} data-testid="form-section">
      {title && <h2 className={styles.sectionTitle}>{title}</h2>}
      {children}
    </div>
  )
}