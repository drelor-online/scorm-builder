import React from 'react'

export interface ValidationMessageProps {
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  fieldName?: string
  minLength?: number
  maxLength?: number
  message?: string
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  type,
  fieldName = 'Field',
  minLength,
  maxLength,
  message
}) => {
  let text = ''

  switch (type) {
    case 'required':
      text = `${fieldName} is required`
      break
    case 'email':
      text = 'Please enter a valid email address'
      break
    case 'minLength':
      text = `${fieldName} must be at least ${minLength} characters`
      break
    case 'maxLength':
      text = `${fieldName} must be no more than ${maxLength} characters`
      break
    case 'pattern':
      text = `${fieldName} format is invalid`
      break
    case 'custom':
      text = message || 'Invalid value'
      break
  }

  return <span className="validation-message">{text}</span>
}