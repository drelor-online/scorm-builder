import React from 'react'
import './stepProgress.css'
import { Icon } from './Icons'
import { Check, X } from 'lucide-react'

export interface Step {
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
  description?: string
}

export interface StepProgressProps {
  steps: Step[]
  className?: string
}

export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  className = ''
}) => {
  const currentStep = steps.findIndex(step => step.status === 'active') + 1 || steps.length
  const completedSteps = steps.filter(step => step.status === 'completed').length

  return (
    <div
      className={`step-progress ${className}`}
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemax={steps.length}
      aria-label={`Step ${currentStep} of ${steps.length}`}
    >
      <div className="step-progress-track">
        <div
          className="step-progress-fill"
          style={{ width: `${(completedSteps / (steps.length - 1)) * 100}%` }}
        />
      </div>
      <div className="step-progress-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`step-progress-item step-${step.status}`}
            data-status={step.status}
          >
            <div className="step-progress-indicator">
              {step.status === 'completed' && <Icon icon={Check} size="xs" className="step-check" />}
              {step.status === 'error' && <Icon icon={X} size="xs" className="step-error" />}
              {(step.status === 'pending' || step.status === 'active') && (
                <span className="step-number">{index + 1}</span>
              )}
            </div>
            <div className="step-progress-label">
              <span data-status={step.status}>{step.label}</span>
              {step.description && (
                <span className="step-progress-description">{step.description}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}