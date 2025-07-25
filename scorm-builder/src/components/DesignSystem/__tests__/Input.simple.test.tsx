import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../Input'

describe('Input Component - Simple Tests', () => {
  it('should render input with label', () => {
    render(<Input label="Email Address" name="email" />)
    
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should handle value changes', () => {
    const handleChange = vi.fn()
    render(<Input label="Name" name="name" onChange={handleChange} />)
    
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'John Doe' } })
    
    expect(handleChange).toHaveBeenCalled()
  })

  it('should show error message', () => {
    render(<Input label="Email" name="email" error="Invalid email address" />)
    
    expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveClass('input-error')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Input label="Username" name="username" disabled />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('should show required indicator', () => {
    render(<Input label="Password" name="password" required />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('required')
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('should accept different input types', () => {
    const { rerender } = render(<Input label="Password" name="password" type="password" />)
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    
    rerender(<Input label="Email" name="email" type="email" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    
    rerender(<Input label="Phone" name="phone" type="tel" />)
    expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel')
  })

  it('should render textarea when multiline is true', () => {
    render(<Input label="Comments" name="comments" multiline />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('should accept placeholder text', () => {
    render(<Input label="Search" name="search" placeholder="Type to search..." />)
    
    expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument()
  })

  it('should apply custom className to input', () => {
    render(<Input label="Custom" name="custom" className="custom-input" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-input')
  })

  it('should work with fullWidth prop', () => {
    const { container } = render(<Input label="Full Width" name="fullwidth" fullWidth />)
    
    const wrapper = container.querySelector('.input-wrapper')
    expect(wrapper).toHaveClass('input-full-width')
  })
})