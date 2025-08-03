import React, { useState } from 'react'
import { PageContainer, Section, Flex } from './DesignSystem/Layout'
import { Card } from './DesignSystem/Card'
import { Button } from './DesignSystem/Button'
import { Alert } from './DesignSystem/Alert'
import { tokens } from './DesignSystem/designTokens'

interface HelpSection {
  title: string
  content: React.ReactNode
}

const helpSections: HelpSection[] = [
  {
    title: 'Step 1: Course Configuration',
    content: (
      <div>
        <p style={{ marginBottom: '1rem' }}>Set up your course fundamentals to generate targeted learning content.</p>
        <ul style={{ 
          listStyle: 'disc', 
          paddingLeft: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li><strong>Course Title:</strong> Enter a descriptive title for your course</li>
          <li><strong>Difficulty Level:</strong> Select from Basic, Easy, Medium, Hard, or Expert</li>
          <li><strong>Learning Topics:</strong> Add specific topics for your course (10-20 recommended)</li>
          <li><strong>Course Template:</strong> Optionally select a pre-made template to get started quickly</li>
        </ul>
      </div>
    )
  },
  {
    title: 'Step 2: AI Prompt Generator',
    content: (
      <div>
        <p style={{ marginBottom: '1rem' }}>Generate a comprehensive AI prompt based on your course configuration.</p>
        <ul style={{ 
          listStyle: 'disc', 
          paddingLeft: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li>Review the auto-generated prompt for your course</li>
          <li>Copy prompt to clipboard with one click</li>
          <li>Paste into your preferred AI chatbot (Claude, ChatGPT, etc.)</li>
          <li>The prompt requests structured JSON output with content, narration, and media suggestions</li>
        </ul>
      </div>
    )
  },
  {
    title: 'Step 3: JSON Import & Validation',
    content: (
      <div>
        <p style={{ marginBottom: '1rem' }}>Paste the JSON response from your AI chatbot and validate its structure.</p>
        <ul style={{ 
          listStyle: 'disc', 
          paddingLeft: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li>Paste JSON from your AI chatbot response</li>
          <li>Upload a JSON file if you have one saved</li>
          <li>Validate JSON structure automatically</li>
          <li>See summary of pages, knowledge checks, and assessment questions</li>
        </ul>
      </div>
    )
  },
  {
    title: 'Step 4: Media Enhancement',
    content: (
      <div>
        <p style={{ marginBottom: '1rem' }}>Search for images and videos to enhance your course content.</p>
        <ul style={{ 
          listStyle: 'disc', 
          paddingLeft: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li>Navigate through all course pages (Welcome, Objectives, Topics)</li>
          <li>Search for images using Google Image Search integration</li>
          <li>Search for videos using YouTube API</li>
          <li>Preview and select media for each page</li>
          <li>Remove unwanted media with confirmation</li>
        </ul>
      </div>
    )
  },
  {
    title: 'Step 5: Audio Narration Wizard',
    content: (
      <div>
        <p style={{ marginBottom: '1rem' }}>Add voiceover narration to your course content.</p>
        <ul style={{ 
          listStyle: 'disc', 
          paddingLeft: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li><strong>Bulk audio upload</strong> with Murf.ai integration instructions</li>
          <li>Download narration text file for AI voice generation</li>
          <li>Upload audio ZIP files (replaces all existing audio)</li>
          <li>Upload caption ZIP files (VTT format)</li>
          <li>Edit narration text for individual blocks</li>
          <li>Preview audio with playback controls</li>
        </ul>
      </div>
    )
  },
  {
    title: 'Step 6: Questions & Assessment Editor',
    content: (
      <div>
        <p style={{ marginBottom: '1rem' }}>Review and edit all questions in your course.</p>
        <ul style={{ 
          listStyle: 'disc', 
          paddingLeft: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li>View summary statistics of all questions</li>
          <li><strong>Knowledge check questions</strong> organized by topic</li>
          <li><strong>Assessment questions</strong> for final evaluation</li>
          <li>Edit question types: Multiple Choice, True/False, Fill in the Blank</li>
          <li>Manage correct/incorrect feedback for each question</li>
          <li>Remove questions from knowledge checks (assessment questions are fixed)</li>
        </ul>
      </div>
    )
  },
  {
    title: 'Step 7: SCORM Package Builder',
    content: (
      <div>
        <p style={{ marginBottom: '1rem' }}>Generate a SCORM-compliant learning package ready for your LMS.</p>
        <ul style={{ 
          listStyle: 'disc', 
          paddingLeft: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li>Review course information and version</li>
          <li>SCORM 1.2 format for maximum compatibility</li>
          <li>Click "Generate SCORM Package" to create the ZIP file</li>
          <li>Download the package when generation is complete</li>
          <li>Upload directly to your Learning Management System</li>
        </ul>
      </div>
    )
  },
  {
    title: 'Keyboard Shortcuts',
    content: (
      <div>
        <p style={{ marginBottom: '1rem' }}>Quick keyboard shortcuts to enhance your workflow:</p>
        <ul style={{ 
          listStyle: 'none', 
          paddingLeft: '0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <li><strong>Ctrl+Shift+P:</strong> Toggle Performance Dashboard - Monitor real-time performance metrics</li>
          <li><strong>Ctrl+Shift+T:</strong> Toggle Test Checklist - View testing recommendations</li>
          <li><strong>Ctrl+Shift+D:</strong> Toggle Debug Panel - View debug information (development mode)</li>
          <li><strong>F12:</strong> Open Developer Tools (if enabled)</li>
        </ul>
        <Alert variant="info">
          <p>The Performance Dashboard helps you identify slow operations and monitor memory usage in real-time.</p>
        </Alert>
      </div>
    )
  }
]

interface HelpPageProps {
  onBack?: () => void
}

export const HelpPage: React.FC<HelpPageProps> = ({ onBack }) => {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSections(newExpanded)
  }

  return (
    <PageContainer className="page-container">
      <Section>
        <Flex justify="space-between" align="center" style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: tokens.colors.text.primary,
            margin: 0
          }}>
            SCORM Course Builder Help
          </h1>
          <Flex gap="medium">
            {onBack && (
              <Button
                variant="tertiary"
                onClick={onBack}
              >
                Back to Course Builder
              </Button>
            )}
          </Flex>
        </Flex>
      </Section>

      <Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {helpSections.map((section, index) => (
            <Card 
              key={index} 
              className="overflow-hidden"
              data-testid="help-section-card"
            >
              <button
                data-testid="section-button"
                onClick={() => toggleSection(index)}
                className="help-section-button"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <h2 
                  data-testid="section-title"
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: tokens.colors.text.secondary,
                    margin: 0
                  }}
                >
                  {section.title}
                </h2>
                <span style={{
                  color: tokens.colors.text.tertiary,
                  fontSize: '1.5rem',
                  fontWeight: 'bold'
                }}>
                  {expandedSections.has(index) ? '−' : '+'}
                </span>
              </button>
              
              {expandedSections.has(index) && (
                <div style={{
                  padding: '1.5rem',
                  paddingTop: '1rem',
                  color: tokens.colors.text.tertiary,
                  borderTop: `1px solid ${tokens.colors.border.default}`
                }}>
                  {section.content}
                </div>
              )}
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <Alert variant="info">
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#c4b5fd',
            marginBottom: '0.75rem'
          }}>
            Tips for Success
          </h2>
          <ul style={{
            listStyle: 'disc',
            paddingLeft: '1.5rem',
            color: '#e9d5ff',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <li>Start with a clear course objective and target audience</li>
            <li>Keep topics focused and specific (10-20 topics recommended)</li>
            <li>Use high-quality media that supports your content</li>
            <li>Always include captions for accessibility</li>
            <li>Test your SCORM package in your LMS before deployment</li>
          </ul>
        </Alert>
      </Section>

    </PageContainer>
  )
}

export default HelpPage;