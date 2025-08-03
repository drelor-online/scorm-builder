import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { createRoot, Root } from 'react-dom/client'
import { CheckCircle, XCircle, Loader2, PlayCircle } from 'lucide-react'

export interface ProgressStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startTime?: number
  endTime?: number
  error?: string
  message?: string
}

interface AutomationProgressOverlayProps {
  steps: ProgressStep[]
  currentStep: string | null
  isRunning: boolean
  showScreenshots?: boolean
  onClose?: () => void
}

/**
 * Visual progress overlay for automation runs
 */
export const AutomationProgressOverlay: React.FC<AutomationProgressOverlayProps> = ({
  steps,
  currentStep,
  isRunning,
  showScreenshots = false,
  onClose
}) => {
  const [minimized, setMinimized] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTime = steps.find(s => s.startTime)?.startTime || Date.now()
  
  // Update elapsed time
  useEffect(() => {
    if (!isRunning) return
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)
    
    return () => clearInterval(interval)
  }, [isRunning, startTime])
  
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  
  const getStepIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'skipped':
        return <div className="w-5 h-5 text-gray-400">⏭</div>
      default:
        return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
    }
  }
  
  const completedSteps = steps.filter(s => s.status === 'completed').length
  const failedSteps = steps.filter(s => s.status === 'failed').length
  const progress = (completedSteps / steps.length) * 100
  
  if (minimized) {
    return ReactDOM.createPortal(
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl p-4 flex items-center gap-3 z-[9999]">
        <div className="relative w-12 h-12">
          <svg className="transform -rotate-90 w-12 h-12">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
              className="text-blue-500 transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold">{Math.round(progress)}%</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Automation Running</p>
          <p className="text-xs text-gray-500">{formatTime(elapsedTime)}</p>
        </div>
        <button
          onClick={() => setMinimized(false)}
          className="ml-2 p-1 hover:bg-gray-100 rounded"
        >
          ↗
        </button>
      </div>,
      document.body
    )
  }
  
  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <PlayCircle className="w-6 h-6" />
                Automation Progress
              </h2>
              <p className="text-blue-100 mt-1">
                {isRunning ? 'Running automated test...' : 'Test completed'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMinimized(true)}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Minimize"
              >
                ↘
              </button>
              {!isRunning && onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                  title="Close"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              Step {completedSteps + (currentStep ? 1 : 0)} of {steps.length}
            </span>
            <span className="text-sm font-medium">{formatTime(elapsedTime)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {failedSteps > 0 && (
            <p className="text-sm text-red-600 mt-2">
              {failedSteps} step{failedSteps > 1 ? 's' : ''} failed
            </p>
          )}
        </div>
        
        {/* Steps List */}
        <div className="overflow-y-auto max-h-[400px] p-6">
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep
              const duration = step.startTime && step.endTime 
                ? step.endTime - step.startTime 
                : step.startTime 
                ? Date.now() - step.startTime 
                : 0
              
              return (
                <div
                  key={step.id}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg transition-all duration-300
                    ${isActive ? 'bg-blue-50 scale-[1.02]' : ''}
                    ${step.status === 'failed' ? 'bg-red-50' : ''}
                    ${step.status === 'completed' ? 'bg-green-50' : ''}
                  `}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-medium ${isActive ? 'text-blue-700' : ''}`}>
                        {step.name}
                      </h4>
                      {duration > 0 && (
                        <span className="text-xs text-gray-500">
                          {(duration / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    {step.message && (
                      <p className="text-sm text-gray-600 mt-1">{step.message}</p>
                    )}
                    {step.error && (
                      <p className="text-sm text-red-600 mt-1">{step.error}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Footer */}
        {showScreenshots && (
          <div className="border-t p-4 bg-gray-50">
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View Screenshots →
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/**
 * Helper class to manage the overlay
 */
export class AutomationProgressManager {
  private container: HTMLDivElement | null = null
  private root: Root | null = null
  private steps: ProgressStep[] = []
  private currentStep: string | null = null
  private isRunning = false
  
  show(steps: Array<{ id: string; name: string }>): void {
    this.steps = steps.map(s => ({
      ...s,
      status: 'pending' as const
    }))
    this.isRunning = true
    this.render()
  }
  
  updateStep(stepId: string, update: Partial<ProgressStep>): void {
    const stepIndex = this.steps.findIndex(s => s.id === stepId)
    if (stepIndex !== -1) {
      this.steps[stepIndex] = { ...this.steps[stepIndex], ...update }
      this.render()
    }
  }
  
  startStep(stepId: string): void {
    this.currentStep = stepId
    this.updateStep(stepId, {
      status: 'running',
      startTime: Date.now()
    })
  }
  
  completeStep(stepId: string, message?: string): void {
    this.updateStep(stepId, {
      status: 'completed',
      endTime: Date.now(),
      message
    })
    this.currentStep = null
  }
  
  failStep(stepId: string, error: string): void {
    this.updateStep(stepId, {
      status: 'failed',
      endTime: Date.now(),
      error
    })
    this.currentStep = null
  }
  
  skipStep(stepId: string, reason?: string): void {
    this.updateStep(stepId, {
      status: 'skipped',
      message: reason
    })
  }
  
  complete(): void {
    this.isRunning = false
    this.currentStep = null
    this.render()
  }
  
  close(): void {
    if (this.root) {
      this.root.unmount()
      this.root = null
    }
    if (this.container) {
      this.container.remove()
      this.container = null
    }
  }
  
  private render(): void {
    if (!this.container) {
      this.container = document.createElement('div')
      document.body.appendChild(this.container)
      this.root = createRoot(this.container)
    }
    
    if (this.root) {
      this.root.render(
        <AutomationProgressOverlay
          steps={this.steps}
          currentStep={this.currentStep}
          isRunning={this.isRunning}
          showScreenshots={true}
          onClose={() => this.close()}
        />
      )
    }
  }
}

// Global instance
export const progressManager = new AutomationProgressManager()

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).automationProgress = progressManager
}