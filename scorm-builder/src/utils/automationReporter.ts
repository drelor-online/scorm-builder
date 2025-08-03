import React from 'react'
import ReactDOM from 'react-dom/client'

export interface AutomationStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  startTime?: number
  endTime?: number
  error?: string
  details?: any
}

export interface AutomationReport {
  startTime: number
  endTime?: number
  totalSteps: number
  completedSteps: number
  failedSteps: number
  currentStep?: string
  steps: AutomationStep[]
  logs: string[]
}

/**
 * Progress reporter for automation runs
 */
export class AutomationReporter {
  private report: AutomationReport
  private onUpdate?: (report: AutomationReport) => void
  private consoleLogging: boolean = true
  private modalRoot?: ReactDOM.Root
  
  constructor(totalSteps: number, options?: { 
    onUpdate?: (report: AutomationReport) => void,
    consoleLogging?: boolean 
  }) {
    this.report = {
      startTime: Date.now(),
      totalSteps,
      completedSteps: 0,
      failedSteps: 0,
      steps: [],
      logs: []
    }
    this.onUpdate = options?.onUpdate
    this.consoleLogging = options?.consoleLogging ?? true
  }
  
  /**
   * Add a step to track
   */
  addStep(id: string, name: string): void {
    this.report.steps.push({
      id,
      name,
      status: 'pending'
    })
    this.update()
  }
  
  /**
   * Start a step
   */
  startStep(id: string): void {
    const step = this.report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'running'
      step.startTime = Date.now()
      this.report.currentStep = step.name
      this.log(`🚀 Starting: ${step.name}`)
      this.update()
    }
  }
  
  /**
   * Complete a step successfully
   */
  completeStep(id: string, details?: any): void {
    const step = this.report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'success'
      step.endTime = Date.now()
      step.details = details
      this.report.completedSteps++
      
      const duration = step.endTime - (step.startTime || 0)
      this.log(`✅ Completed: ${step.name} (${this.formatDuration(duration)})`)
      this.update()
    }
  }
  
  /**
   * Mark a step as failed
   */
  failStep(id: string, error: string): void {
    const step = this.report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'failed'
      step.endTime = Date.now()
      step.error = error
      this.report.failedSteps++
      
      this.log(`❌ Failed: ${step.name} - ${error}`, 'error')
      this.update()
    }
  }
  
  /**
   * Skip a step
   */
  skipStep(id: string, reason?: string): void {
    const step = this.report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'skipped'
      step.details = { reason }
      this.log(`⏭️ Skipped: ${step.name}${reason ? ` - ${reason}` : ''}`)
      this.update()
    }
  }
  
  /**
   * Add a log entry
   */
  log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${message}`
    
    this.report.logs.push(logEntry)
    
    if (this.consoleLogging) {
      switch (level) {
        case 'error':
          console.error(logEntry)
          break
        case 'warn':
          console.warn(logEntry)
          break
        default:
          console.log(logEntry)
      }
    }
    
    this.update()
  }
  
  /**
   * Complete the automation run
   */
  complete(): void {
    this.report.endTime = Date.now()
    this.report.currentStep = undefined
    
    const duration = this.report.endTime - this.report.startTime
    const successRate = Math.round((this.report.completedSteps / this.report.totalSteps) * 100)
    
    this.log(`\n📊 Automation Complete!`)
    this.log(`Total Duration: ${this.formatDuration(duration)}`)
    this.log(`Steps: ${this.report.completedSteps}/${this.report.totalSteps} completed (${successRate}% success rate)`)
    if (this.report.failedSteps > 0) {
      this.log(`Failed Steps: ${this.report.failedSteps}`, 'error')
    }
    
    this.update()
  }
  
  /**
   * Get the current report
   */
  getReport(): AutomationReport {
    return { ...this.report }
  }
  
  /**
   * Get progress percentage
   */
  getProgress(): number {
    const completed = this.report.completedSteps + this.report.failedSteps
    return Math.round((completed / this.report.totalSteps) * 100)
  }
  
  /**
   * Show progress in a modal (React component)
   */
  showProgressModal(): void {
    // Create a container for the modal
    const container = document.createElement('div')
    container.id = 'automation-progress-modal'
    document.body.appendChild(container)
    
    this.modalRoot = ReactDOM.createRoot(container)
    this.renderModal()
  }
  
  /**
   * Close the progress modal
   */
  closeProgressModal(): void {
    if (this.modalRoot) {
      this.modalRoot.unmount()
      const container = document.getElementById('automation-progress-modal')
      if (container) {
        document.body.removeChild(container)
      }
    }
  }
  
  private update(): void {
    if (this.onUpdate) {
      this.onUpdate(this.getReport())
    }
    if (this.modalRoot) {
      this.renderModal()
    }
  }
  
  private renderModal(): void {
    const ProgressModal = () => {
      const progress = this.getProgress()
      const elapsed = Date.now() - this.report.startTime
      
      return React.createElement('div', {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }
      }, 
        React.createElement('div', {
          style: {
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            color: '#e4e4e7'
          }
        },
          // Header
          React.createElement('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }
          },
            React.createElement('h2', { style: { margin: 0 } }, '🤖 Automation Progress'),
            React.createElement('button', {
              onClick: () => this.closeProgressModal(),
              style: {
                background: 'none',
                border: 'none',
                color: '#e4e4e7',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }
            }, '×')
          ),
          
          // Progress bar
          React.createElement('div', {
            style: {
              backgroundColor: '#374151',
              borderRadius: '8px',
              height: '24px',
              marginBottom: '1rem',
              overflow: 'hidden'
            }
          },
            React.createElement('div', {
              style: {
                backgroundColor: this.report.failedSteps > 0 ? '#ef4444' : '#10b981',
                height: '100%',
                width: `${progress}%`,
                transition: 'width 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }
            }, progress > 5 ? `${progress}%` : '')
          ),
          
          // Current step
          this.report.currentStep && React.createElement('div', {
            style: {
              backgroundColor: '#374151',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem'
            }
          },
            React.createElement('strong', {}, 'Current Step: '),
            this.report.currentStep
          ),
          
          // Stats
          React.createElement('div', {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }
          },
            this.renderStat('Elapsed Time', this.formatDuration(elapsed)),
            this.renderStat('Completed', `${this.report.completedSteps}/${this.report.totalSteps}`),
            this.renderStat('Failed', this.report.failedSteps.toString(), this.report.failedSteps > 0 ? '#ef4444' : undefined),
            this.renderStat('Success Rate', `${Math.round((this.report.completedSteps / Math.max(1, this.report.completedSteps + this.report.failedSteps)) * 100)}%`)
          ),
          
          // Steps list
          React.createElement('div', {
            style: {
              flex: 1,
              overflowY: 'auto',
              marginBottom: '1rem'
            }
          },
            React.createElement('h3', { style: { marginBottom: '0.5rem' } }, 'Steps'),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
              this.report.steps.map(step => this.renderStep(step))
            )
          ),
          
          // Logs
          React.createElement('div', {
            style: {
              backgroundColor: '#111',
              borderRadius: '8px',
              padding: '1rem',
              maxHeight: '200px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }
          },
            React.createElement('div', {},
              this.report.logs.slice(-20).map((log, i) => 
                React.createElement('div', { key: i }, log)
              )
            )
          )
        )
      )
    }
    
    if (this.modalRoot) {
      this.modalRoot.render(React.createElement(ProgressModal))
    }
  }
  
  private renderStat(label: string, value: string, color?: string): React.ReactElement {
    return React.createElement('div', {
      style: {
        backgroundColor: '#374151',
        padding: '1rem',
        borderRadius: '8px',
        textAlign: 'center'
      }
    },
      React.createElement('div', { style: { fontSize: '0.875rem', color: '#9ca3af' } }, label),
      React.createElement('div', { 
        style: { 
          fontSize: '1.5rem', 
          fontWeight: 'bold',
          color: color || '#e4e4e7'
        } 
      }, value)
    )
  }
  
  private renderStep(step: AutomationStep): React.ReactElement {
    const statusIcons = {
      pending: '⏳',
      running: '🔄',
      success: '✅',
      failed: '❌',
      skipped: '⏭️'
    }
    
    const statusColors = {
      pending: '#6b7280',
      running: '#3b82f6',
      success: '#10b981',
      failed: '#ef4444',
      skipped: '#f59e0b'
    }
    
    return React.createElement('div', {
      key: step.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem',
        backgroundColor: step.status === 'running' ? '#1f2937' : 'transparent',
        borderRadius: '4px'
      }
    },
      React.createElement('span', { style: { fontSize: '1.25rem' } }, statusIcons[step.status]),
      React.createElement('span', { 
        style: { 
          flex: 1,
          color: statusColors[step.status]
        } 
      }, step.name),
      step.endTime && step.startTime && React.createElement('span', {
        style: { fontSize: '0.875rem', color: '#6b7280' }
      }, this.formatDuration(step.endTime - step.startTime))
    )
  }
  
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
}