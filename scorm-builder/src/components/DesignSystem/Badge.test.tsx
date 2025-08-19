import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge, QuestionTypeBadge, StatusBadge, CountBadge } from './Badge'

describe('Badge Component', () => {
  describe('Basic Badge', () => {
    it('renders with default props', () => {
      render(<Badge>Test Badge</Badge>)
      const badge = screen.getByText('Test Badge')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge', 'badge-default', 'badge-medium')
    })

    it('renders with different variants', () => {
      const variants = ['primary', 'success', 'warning', 'danger', 'info'] as const
      variants.forEach(variant => {
        const { container } = render(<Badge variant={variant}>{variant}</Badge>)
        const badge = container.querySelector('.badge')
        expect(badge).toHaveClass(`badge-${variant}`)
      })
    })

    it('renders with different sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const
      sizes.forEach(size => {
        const { container } = render(<Badge size={size}>{size}</Badge>)
        const badge = container.querySelector('.badge')
        expect(badge).toHaveClass(`badge-${size}`)
      })
    })

    it('renders with icon', () => {
      const icon = <span data-testid="test-icon">🎯</span>
      render(<Badge icon={icon}>With Icon</Badge>)
      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
      expect(screen.getByText('With Icon')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<Badge className="custom-class">Custom</Badge>)
      const badge = container.querySelector('.badge')
      expect(badge).toHaveClass('custom-class')
    })
  })

  describe('QuestionTypeBadge', () => {
    it('renders multiple-choice type', () => {
      render(<QuestionTypeBadge type="multiple-choice" />)
      const badge = screen.getByText('Multiple Choice')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-activity', 'badge-activity-multiple-choice')
    })

    it('renders true-false type', () => {
      render(<QuestionTypeBadge type="true-false" />)
      const badge = screen.getByText('True/False')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-activity', 'badge-activity-true-false')
    })

    it('renders fill-in-blank type', () => {
      render(<QuestionTypeBadge type="fill-in-blank" />)
      const badge = screen.getByText('Fill in the Blank')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-activity', 'badge-activity-fill-in-blank')
    })

    it('uses small size by default', () => {
      render(<QuestionTypeBadge type="multiple-choice" />)
      const badge = screen.getByText('Multiple Choice')
      expect(badge.parentElement).toHaveClass('badge-small')
    })
  })

  describe('StatusBadge', () => {
    it('renders active status with success variant', () => {
      render(<StatusBadge status="active" />)
      const badge = screen.getByText('Active')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-success')
    })

    it('renders inactive status with danger variant', () => {
      render(<StatusBadge status="inactive" />)
      const badge = screen.getByText('Inactive')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-danger')
    })

    it('renders pending status with warning variant', () => {
      render(<StatusBadge status="pending" />)
      const badge = screen.getByText('Pending')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-warning')
    })

    it('renders completed status with info variant', () => {
      render(<StatusBadge status="completed" />)
      const badge = screen.getByText('Completed')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-info')
    })
  })

  describe('CountBadge', () => {
    it('renders with count', () => {
      render(<CountBadge count={42} />)
      const badge = screen.getByText('42')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-primary', 'badge-small')
    })

    it('renders with custom variant', () => {
      render(<CountBadge count={5} variant="danger" />)
      const badge = screen.getByText('5')
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass('badge-danger')
    })

    it('renders zero count', () => {
      render(<CountBadge count={0} />)
      const badge = screen.getByText('0')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Activity Type Badges', () => {
    it('applies activity-specific styles when type is provided', () => {
      const { container } = render(<Badge type="drag-and-drop">Drag & Drop</Badge>)
      const badge = container.querySelector('.badge')
      expect(badge).toHaveClass('badge-activity', 'badge-activity-drag-and-drop')
      expect(badge).not.toHaveClass('badge-default')
    })

    it('supports scenario type', () => {
      const { container } = render(<Badge type="scenario">Scenario</Badge>)
      const badge = container.querySelector('.badge')
      expect(badge).toHaveClass('badge-activity', 'badge-activity-scenario')
    })
  })
})