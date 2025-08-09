import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ActivitiesEditor } from './ActivitiesEditor'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content'
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Objectives',
    content: 'Objectives content'
  },
  topics: [
    {
      id: 'topic1',
      title: 'Topic 1',
      pages: [],
      knowledgeCheck: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice' as const,
            question: 'Test question',
            options: ['Option A', 'Option B', 'Option C'],
            correctAnswer: 'Option A',
            feedback: {
              correct: 'Well done!',
              incorrect: 'Try again'
            }
          }
        ]
      }
    }
  ],
  assessment: {
    passMark: 80,
    questions: [
      {
        id: 'a1',
        type: 'true-false' as const,
        question: 'Test assessment question',
        correctAnswer: 'True',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Incorrect'
        }
      }
    ]
  }
}

const mockProps = {
  courseContent: mockCourseContent,
  onNext: vi.fn(),
  onBack: vi.fn(),
  onUpdateContent: vi.fn()
}

describe('ActivitiesEditor', () => {
  it('renders without crashing', () => {
    render(
      <PersistentStorageProvider>
        <ActivitiesEditor {...mockProps} />
      </PersistentStorageProvider>
    )
    
    expect(screen.getByText(/Questions & Assessment Editor/i)).toBeInTheDocument()
  })

  it('displays summary statistics', () => {
    render(
      <PersistentStorageProvider>
        <ActivitiesEditor {...mockProps} />
      </PersistentStorageProvider>
    )
    
    expect(screen.getByText(/Total Questions:/)).toBeInTheDocument()
    expect(screen.getByText(/Knowledge Check Questions:/)).toBeInTheDocument()
    expect(screen.getByText(/Assessment Questions:/)).toBeInTheDocument()
  })

  it('displays knowledge check questions', () => {
    render(
      <PersistentStorageProvider>
        <ActivitiesEditor {...mockProps} />
      </PersistentStorageProvider>
    )
    
    expect(screen.getByText('Test question')).toBeInTheDocument()
    expect(screen.getByText('Option A')).toBeInTheDocument()
  })

  it('displays assessment questions', () => {
    render(
      <PersistentStorageProvider>
        <ActivitiesEditor {...mockProps} />
      </PersistentStorageProvider>
    )
    
    expect(screen.getByText('Test assessment question')).toBeInTheDocument()
    expect(screen.getByText(/Correct Answer:.*True/)).toBeInTheDocument()
  })

  it('shows question type badges', () => {
    render(
      <PersistentStorageProvider>
        <ActivitiesEditor {...mockProps} />
      </PersistentStorageProvider>
    )
    
    expect(screen.getByText('Multiple Choice')).toBeInTheDocument()
    expect(screen.getByText('True/False')).toBeInTheDocument()
  })

  it('applies CSS module classes', () => {
    const { container } = render(
      <PersistentStorageProvider>
        <ActivitiesEditor {...mockProps} />
      </PersistentStorageProvider>
    )
    
    // Check that CSS module classes are being used
    const questionGrid = container.querySelector('[class*="questionGrid"]')
    expect(questionGrid).toBeInTheDocument()
    
    // Check that topic titles use CSS classes
    const topicTitle = container.querySelector('[class*="topicTitle"]')
    expect(topicTitle).toBeInTheDocument()
  })

  it('handles navigation buttons', () => {
    render(
      <PersistentStorageProvider>
        <ActivitiesEditor {...mockProps} />
      </PersistentStorageProvider>
    )
    
    const backButton = screen.getByRole('button', { name: /Back/i })
    const nextButton = screen.getByRole('button', { name: /Next/i })
    
    fireEvent.click(backButton)
    expect(mockProps.onBack).toHaveBeenCalled()
    
    fireEvent.click(nextButton)
    expect(mockProps.onNext).toHaveBeenCalled()
  })

  it('displays pass mark information', () => {
    render(
      <PersistentStorageProvider>
        <ActivitiesEditor {...mockProps} />
      </PersistentStorageProvider>
    )
    
    expect(screen.getByText(/Pass Mark: 80%/)).toBeInTheDocument()
  })
})