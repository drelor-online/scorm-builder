import React from 'react'
import { Button } from './DesignSystem/Button'
import styles from './PageLayout.module.css'
import stepperStyles from './WorkflowProgress.module.css'
import { useStepNavigation } from '../contexts/StepNavigationContext'
import { Tooltip } from './DesignSystem/Tooltip'

// WorkflowProgress component with CSS modules
const WorkflowProgress: React.FC<{ currentStep: number; isDarkMode: boolean; onStepClick?: (step: number) => void }> = ({ 
  currentStep, 
  onStepClick 
}) => {
  const steps = ['Seed', 'Prompt', 'JSON', 'Media', 'Audio', 'Activities', 'SCORM']
  const navigation = useStepNavigation()
  const visitedSteps = navigation?.visitedSteps || []
  
  return (
    <div className={stepperStyles.stepperContainer}>
      {steps.map((step, index) => (
        <div key={step} className={stepperStyles.stepWrapper}>
          <div className={stepperStyles.stepItem}>
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
                className={`
                  ${stepperStyles.stepButton}
                  ${visitedSteps.includes(index) ? stepperStyles.visited : ''}
                  ${index < currentStep ? stepperStyles.completed : ''}
                  ${index === currentStep ? stepperStyles.current : ''}
                `.trim()}
                aria-label={`Step ${index + 1}: ${step}`}
              >
                {index + 1}
              </button>
            </Tooltip>
            <span className={stepperStyles.stepLabel}>{step}</span>
          </div>
          {index < steps.length - 1 && (
            <div 
              className={`
                ${stepperStyles.stepConnector}
                ${index < currentStep ? stepperStyles.completed : ''}
              `.trim()}
              aria-hidden="true"
            />
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
          <div className={styles.actionBar} data-testid="top-bar">
            {/* Left group: Open, Save, AutoSave */}
            <div data-testid="top-bar-left" className={styles.headerButtonGroup}>
              <Tooltip content="Exit to dashboard" position="bottom">
                <div>
                  <Button 
                    onClick={onOpen}
                    variant="secondary"
                    size="medium"
                    aria-label="Exit to dashboard"
                    data-testid="exit-button"
                  >
                    Exit to Dashboard
                  </Button>
                </div>
              </Tooltip>
              <Tooltip content="Save current project (Ctrl+S)" position="bottom">
                <div>
                  <Button 
                    onClick={() => onSave && onSave()}
                    variant="secondary"
                    size="medium"
                    aria-label="Save project"
                  >
                    Save
                  </Button>
                </div>
              </Tooltip>
              {autoSaveIndicator && (
                <div className={styles.autoSaveWrapper} data-testid="autosave-indicator">
                  {autoSaveIndicator}
                </div>
              )}
            </div>
            
            {/* Center group: Help, Settings */}
            <div data-testid="top-bar-center" className={styles.headerButtonGroup}>
              <Tooltip content="View help documentation (F1)" position="bottom">
                <div>
                  <Button 
                    onClick={onHelp}
                    variant="secondary"
                    size="medium"
                    aria-label="Help documentation"
                  >
                    Help
                  </Button>
                </div>
              </Tooltip>
              <Tooltip content="Configure application settings" position="bottom">
                <div>
                  <Button 
                    onClick={onSettingsClick}
                    variant="secondary"
                    size="medium"
                    aria-label="Application settings"
                    data-testid="settings-button"
                  >
                    Settings
                  </Button>
                </div>
              </Tooltip>
            </div>
            
            {/* Right group: Exit, Back, Next/Generate */}
            <div data-testid="top-bar-right" className={styles.headerButtonGroup}>
              {onBack && currentStep > 0 && (
                <Tooltip content="Go to previous step" position="bottom">
                  <div>
                    <Button 
                      onClick={onBack}
                      variant="secondary"
                      size="medium"
                      data-testid="back-button"
                    >
                      ← Back
                    </Button>
                  </div>
                </Tooltip>
              )}
              {currentStep === 6 && onGenerateSCORM ? (
                <Tooltip content="Generate SCORM package for LMS deployment" position="bottom" disabled={isGenerating}>
                  <div>
                    <Button 
                      onClick={onGenerateSCORM}
                      variant="primary"
                      size="large"
                      disabled={isGenerating}
                      loading={isGenerating}
                      data-testid="generate-scorm-button"
                    >
                      {isGenerating ? 'Generating...' : 'Generate SCORM package'}
                    </Button>
                  </div>
                </Tooltip>
              ) : onNext ? (
                <Tooltip content="Go to next step" position="bottom">
                  <div>
                    <Button 
                      onClick={onNext}
                      variant="primary"
                      size="large"
                      disabled={nextDisabled}
                      data-testid="next-button"
                    >
                      Next →
                    </Button>
                  </div>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Stepper Progress */}
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