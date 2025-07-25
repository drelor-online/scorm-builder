import React, { useState, useId, useEffect } from 'react'
import './formField.css'
import { Input, InputProps } from './Input'

export interface FormFieldProps extends Omit<InputProps, 'error'> {
  label: string
  error?: string
  success?: boolean
  touched?: boolean
  required?: boolean
  helpText?: string
  validationMode?: 'onBlur' | 'onChange'
  onValidate?: (value: string) => void
  id?: string
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  success,
  touched = false,
  required = false,
  helpText,
  validationMode = 'onBlur',
  onValidate,
  value,
  onChange,
  onBlur,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId()
  const fieldId = id || generatedId
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`
  const [localTouched, setLocalTouched] = useState(touched)

  useEffect(() => {
    setLocalTouched(touched)
  }, [touched])

  const showError = error && localTouched
  const showSuccess = success && localTouched && !error

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setLocalTouched(true)
    if (validationMode === 'onBlur' && onValidate) {
      onValidate(e.target.value)
    }
    onBlur?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (validationMode === 'onChange' && onValidate) {
      onValidate(e.target.value)
    }
    onChange?.(e)
  }

  const inputClasses = [
    showError && 'input-error',
    showSuccess && 'input-success',
    className
  ].filter(Boolean).join(' ')

  const describedBy = [
    showError && errorId,
    helpText && helpId
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className="form-field">
      <label htmlFor={fieldId} className="form-field-label">
        {label}
        {required && <span className="form-field-required" aria-label="required">*</span>}
      </label>
      
      <Input
        id={fieldId}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={inputClasses}
        aria-invalid={showError ? 'true' : 'false'}
        aria-describedby={describedBy}
        {...props}
      />
      
      {helpText && !showError && (
        <p id={helpId} className="form-field-help">
          {helpText}
        </p>
      )}
      
      {showError && (
        <div role="alert" aria-live="polite">
          <p id={errorId} className="form-field-error">
            {error}
          </p>
        </div>
      )}
      
      {showSuccess && (
        <p className="form-field-success">
          ✓
        </p>
      )}
    </div>
  )
}