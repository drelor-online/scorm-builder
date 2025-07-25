import React from 'react'
import './formGroup.css'

export interface FormGroupProps {
  children: React.ReactNode
  errors?: Record<string, string>
  showSummary?: boolean
  className?: string
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  errors = {},
  showSummary = false,
  className = ''
}) => {
  const hasErrors = Object.keys(errors).length > 0

  return (
    <div className={`form-group ${className}`}>
      {showSummary && hasErrors && (
        <div className="form-group-error-summary" role="alert">
          <h3 className="form-group-error-title">Please fix the following errors:</h3>
          <ul className="form-group-error-list">
            {Object.entries(errors).map(([field, error]) => (
              <li key={field} className="form-group-error-item">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {children}
    </div>
  )
}