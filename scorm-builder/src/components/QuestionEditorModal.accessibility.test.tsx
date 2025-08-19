import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QuestionEditorModal from './QuestionEditorModal';
import type { Question } from '../types/aiPrompt';

describe('QuestionEditorModal Accessibility', () => {
  const mockMultipleChoiceQuestion: Question = {
    id: 'test-mc',
    type: 'multiple-choice',
    question: 'Test multiple choice question?',
    options: ['Option A', 'Option B', 'Option C'],
    correctAnswer: 'Option A'
  };

  const mockTrueFalseQuestion: Question = {
    id: 'test-tf',
    type: 'true-false',
    question: 'Test true/false question?',
    correctAnswer: 'True'
  };

  const mockFillInTheBlankQuestion: Question = {
    id: 'test-fitb',
    type: 'fill-in-the-blank',
    question: 'Test fill-in-the-blank question?',
    blank: 'answer',
    correctAnswer: 'correct answer'
  };

  const defaultProps = {
    isOpen: true,
    onClose: () => {},
    onSave: () => {},
    question: null
  };

  describe('Label and Form Field Accessibility', () => {
    it('should have all labels with proper htmlFor attributes', () => {
      render(<QuestionEditorModal {...defaultProps} question={mockMultipleChoiceQuestion} />);
      
      // Get all label elements using querySelector since they don't have role="label"
      const labels = document.querySelectorAll('label');
      
      // Check that each label has an htmlFor attribute
      labels.forEach(label => {
        const htmlFor = label.getAttribute('for');
        expect(htmlFor).toBeTruthy();
        expect(htmlFor).not.toBe('');
        
        // Verify the target element exists
        const targetElement = document.getElementById(htmlFor!);
        expect(targetElement).toBeTruthy();
      });
    });

    it('should have all form inputs with either id or name attributes', () => {
      render(<QuestionEditorModal {...defaultProps} question={mockTrueFalseQuestion} />);
      
      // Get all form inputs (excluding combobox for true/false questions)
      const textboxes = screen.getAllByRole('textbox');
      const radios = screen.getAllByRole('radio');
      
      // Try to get combobox but it might not exist for true/false questions
      let comboboxes: HTMLElement[] = [];
      try {
        comboboxes = screen.getAllByRole('combobox');
      } catch (e) {
        // No combobox found, which is fine for true/false questions
      }
      
      const inputs = textboxes.concat(radios, comboboxes);
      
      // Check that each input has either id or name attribute
      inputs.forEach(input => {
        const id = input.getAttribute('id');
        const name = input.getAttribute('name');
        
        expect(id || name).toBeTruthy();
        expect((id || name)!.trim()).not.toBe('');
      });
    });

    it('should have unique IDs for True/False radio buttons', () => {
      render(<QuestionEditorModal {...defaultProps} question={mockTrueFalseQuestion} />);
      
      // Get radio buttons
      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons).toHaveLength(2);
      
      // Check each radio button has unique ID
      const ids = radioButtons.map(radio => radio.getAttribute('id'));
      expect(ids[0]).toBeTruthy();
      expect(ids[1]).toBeTruthy();
      expect(ids[0]).not.toBe(ids[1]);
      
      // Check IDs are descriptive
      expect(ids[0]).toMatch(/true-false-(true|false)/i);
      expect(ids[1]).toMatch(/true-false-(true|false)/i);
    });

    it('should have proper label association for True/False radio buttons', () => {
      render(<QuestionEditorModal {...defaultProps} question={mockTrueFalseQuestion} />);
      
      // Find radio buttons by their labels
      const trueRadio = screen.getByLabelText('True');
      const falseRadio = screen.getByLabelText('False');
      
      // Verify they are properly associated
      expect(trueRadio).toBeInTheDocument();
      expect(falseRadio).toBeInTheDocument();
      expect(trueRadio.getAttribute('type')).toBe('radio');
      expect(falseRadio.getAttribute('type')).toBe('radio');
    });

    it('should not have orphaned labels without associated form controls', () => {
      render(<QuestionEditorModal {...defaultProps} question={mockMultipleChoiceQuestion} />);
      
      // Get all elements with role="label" or label tags
      const labels = document.querySelectorAll('label[for]');
      
      labels.forEach(label => {
        const htmlFor = label.getAttribute('for');
        if (htmlFor) {
          // If label has htmlFor, verify target exists
          const targetElement = document.getElementById(htmlFor);
          expect(targetElement).toBeTruthy();
        }
      });
    });
  });

  describe('Specific Component Label Issues', () => {
    it('should have proper labeling for Answer Options section in multiple choice', () => {
      render(<QuestionEditorModal {...defaultProps} question={mockMultipleChoiceQuestion} />);
      
      // This test will fail initially - the "Answer Options" label should not be a <label>
      // without htmlFor, it should be a section header
      const optionsSection = screen.getByText('Answer Options');
      
      // Should not be a label element without htmlFor
      if (optionsSection.tagName === 'LABEL') {
        expect(optionsSection.getAttribute('for')).toBeTruthy();
      }
    });

    it('should have proper labeling for Correct Answer section in true/false', () => {
      render(<QuestionEditorModal {...defaultProps} question={mockTrueFalseQuestion} />);
      
      // This test will fail initially - check for proper labeling structure
      const correctAnswerLabels = screen.getAllByText('Correct Answer');
      
      correctAnswerLabels.forEach(label => {
        if (label.tagName === 'LABEL') {
          // If it's a label, it should have htmlFor
          expect(label.getAttribute('for')).toBeTruthy();
        }
      });
    });
  });
});