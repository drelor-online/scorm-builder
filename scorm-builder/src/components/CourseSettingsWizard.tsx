import React, { useState } from 'react'
import { CourseContent } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import { PageLayout } from './PageLayout'
import { 
  Card, 
  FormField,
  FormGroup
} from './DesignSystem'
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
    // Learning Control - sensible defaults for most courses
    requireAudioCompletion: false,
    navigationMode: 'linear',
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
  })

  const handleNext = () => {
    onNext(settings)
  }

  return (
    <PageLayout
      currentStep={6}
      title="Course Settings"
      description="Configure course behavior and SCORM package options"
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
                          onChange={(e) => setSettings(prev => ({
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
                            onChange={() => setSettings(prev => ({ ...prev, navigationMode: 'linear' }))}
                          />
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Linear</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="navigationMode"
                            value="free"
                            checked={settings.navigationMode === 'free'}
                            onChange={() => setSettings(prev => ({ ...prev, navigationMode: 'free' }))}
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
                          onChange={(e) => setSettings(prev => ({ ...prev, autoAdvance: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Auto-advance after knowledge checks</span>
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.allowPreviousReview}
                          onChange={(e) => setSettings(prev => ({ ...prev, allowPreviousReview: e.target.checked }))}
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
                          onChange={(e) => setSettings(prev => ({ 
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
                          onChange={(e) => setSettings(prev => ({ 
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
                        onChange={(e) => setSettings(prev => ({ 
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
                        onChange={(e) => setSettings(prev => ({ ...prev, allowRetake: e.target.checked }))}
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
                          onChange={(e) => setSettings(prev => ({ ...prev, showProgress: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Show progress bar</span>
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.showOutline}
                          onChange={(e) => setSettings(prev => ({ ...prev, showOutline: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Show course outline</span>
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.confirmExit}
                          onChange={(e) => setSettings(prev => ({ ...prev, confirmExit: e.target.checked }))}
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
                        onChange={(e) => setSettings(prev => ({ 
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
                          onChange={(e) => setSettings(prev => ({ 
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
                          onChange={(e) => setSettings(prev => ({ 
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
                        onChange={(e) => setSettings(prev => ({ 
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
                          onChange={(e) => setSettings(prev => ({ ...prev, keyboardNavigation: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Enable keyboard navigation</span>
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.printable}
                          onChange={(e) => setSettings(prev => ({ ...prev, printable: e.target.checked }))}
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