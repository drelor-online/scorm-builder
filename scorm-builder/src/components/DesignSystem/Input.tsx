import React from 'react'
import './designSystem.css'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  multiline?: boolean
  rows?: number
  required?: boolean
}

const InputComponent = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(({
  label,
  error,
  helperText,
  fullWidth = false,
  multiline = false,
  rows = 4,
  className = '',
  id,
  required,
  disabled,
  ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  const wrapperClasses = ['input-wrapper', fullWidth && 'input-full-width'].filter(Boolean).join(' ')
  const inputClasses = [multiline ? 'textarea' : 'input', error && 'input-error', className].filter(Boolean).join(' ')

  const inputElement = multiline ? (
    <textarea
      ref={ref as React.Ref<HTMLTextAreaElement>}
      id={inputId}
      className={inputClasses}
      rows={rows}
      required={required}
      disabled={disabled}
      aria-required={required}
      aria-disabled={disabled ? 'true' : undefined}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
      {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
    />
  ) : (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      id={inputId}
      className={inputClasses}
      required={required}
      disabled={disabled}
      aria-required={required}
      aria-disabled={disabled ? 'true' : undefined}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
      {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
    />
  )

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
          {required && !label.includes('*') && (
            <span style={{ color: 'rgb(220, 38, 38)', marginLeft: '0.25rem' }}>*</span>
          )}
        </label>
      )}
      {inputElement}
      {error && (
        <span id={`${inputId}-error`} className="input-error-text" role="alert">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={`${inputId}-helper`} className="input-helper-text">
          {helperText}
        </span>
      )}
    </div>
  )
})

InputComponent.displayName = 'Input'

export const Input = React.memo(InputComponent)