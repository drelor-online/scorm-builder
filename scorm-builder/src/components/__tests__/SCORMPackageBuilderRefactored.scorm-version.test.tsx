import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SCORMPackageBuilder } from '../SCORMPackageBuilderRefactored'
import { CourseContent } from '../../types/aiPrompt'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

describe('SCORMPackageBuilder - SCORM Version Selection', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      duration: 1,
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives</p>',
      narration: 'Objectives narration',
      duration: 1,
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: []
    },
    topics: [],
    assessment: {
      questions: [],
      passMark: 80
    }
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    duration: 30
  }

  const defaultProps = {
    courseContent: mockCourseContent,
    courseSeedData: mockCourseSeedData,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn()
  }

  describe('User should only see implemented SCORM versions', () => {
    it('should NOT show SCORM 2004 option since it is not implemented', () => {
      render(
        <PersistentStorageProvider>
          <SCORMPackageBuilder {...defaultProps} />
        </PersistentStorageProvider>
      )
      
      // Should NOT find SCORM 2004 option
      const scorm2004Radio = screen.queryByLabelText(/SCORM 2004/i)
      expect(scorm2004Radio).not.toBeInTheDocument()
      
      // Should NOT show "Recommended" text for non-existent SCORM 2004
      expect(screen.queryByText(/Recommended/i)).not.toBeInTheDocument()
    })

    it('should only show SCORM 1.2 as the version', () => {
      render(
        <PersistentStorageProvider>
          <SCORMPackageBuilder {...defaultProps} />
        </PersistentStorageProvider>
      )
      
      // Should show SCORM 1.2 as static text, not as a radio option
      expect(screen.getByText(/SCORM Version/i)).toBeInTheDocument()
      expect(screen.getByText(/^SCORM 1.2$/)).toBeInTheDocument()
      
      // Should NOT have any radio buttons
      const radioButtons = screen.queryAllByRole('radio')
      expect(radioButtons).toHaveLength(0)
    })

    it('should display SCORM version as read-only information', () => {
      render(
        <PersistentStorageProvider>
          <SCORMPackageBuilder {...defaultProps} />
        </PersistentStorageProvider>
      )
      
      // Should show SCORM Version label
      expect(screen.getByText(/SCORM Version/i)).toBeInTheDocument()
      
      // Should show SCORM 1.2 as static text
      const scormVersionText = screen.getByText(/^SCORM 1.2$/)
      expect(scormVersionText).toBeInTheDocument()
      
      // The parent should be a div, not an input
      const parentElement = scormVersionText.parentElement
      expect(parentElement?.tagName).toBe('DIV')
      
      // Should not be an editable input
      const inputs = screen.queryAllByRole('radio')
      expect(inputs).toHaveLength(0)
    })

    it('should generate SCORM 1.2 package when Generate button is clicked', async () => {
      render(
        <PersistentStorageProvider>
          <SCORMPackageBuilder {...defaultProps} />
        </PersistentStorageProvider>
      )
      
      const generateButton = screen.getByRole('button', { name: /generate.*package/i })
      expect(generateButton).toBeInTheDocument()
      
      // The button text should indicate SCORM 1.2
      expect(generateButton.textContent).toMatch(/Generate SCORM 1.2 Package/i)
    })
  })
})