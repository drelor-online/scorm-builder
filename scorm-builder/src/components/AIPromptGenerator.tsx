import React, { useState, useEffect } from 'react'
import { CourseSeedData } from '../types/course'
import { PageLayout } from './PageLayout'
import { Toast } from './Toast'
import { useFormChanges } from '../hooks/useFormChanges'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import { Check, Copy } from 'lucide-react'
import { Card, Button } from './DesignSystem'
import './DesignSystem/designSystem.css'
import styles from './AIPromptGenerator.module.css'

interface AIPromptGeneratorProps {
  courseSeedData: CourseSeedData
  onNext: () => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

export const AIPromptGenerator: React.FC<AIPromptGeneratorProps> = ({
  courseSeedData,
  onNext,
  onBack,
  onSettingsClick,
  onSave,
  onOpen,
  onHelp,
  onStepClick
}) => {
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [hasCopiedPrompt, setHasCopiedPrompt] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [mounted, setMounted] = useState(false)
  // Removed history functionality per UX requirements
  
  // Navigation guard hook - we treat "has copied prompt" as a form change
  const {
    attemptNavigation,
    checkForChanges
  } = useFormChanges({
    initialValues: { hasCopied: false }
  })
  
  // Custom prompt state is tracked but not auto-saved to localStorage anymore
  
  // Set mounted flag
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])
  
  // Track when user copies the prompt
  useEffect(() => {
    if (mounted && copied && !hasCopiedPrompt) {
      setHasCopiedPrompt(true)
      // Tell the form changes hook that we have changes
      checkForChanges({ hasCopied: true })
    }
  }, [mounted, copied, hasCopiedPrompt, checkForChanges])

  const generatePrompt = React.useCallback((): string => {
    if (customPrompt) return customPrompt
    // Only use topics from the textarea (customTopics)
    const topicsText = courseSeedData?.customTopics?.length > 0 
      ? courseSeedData.customTopics.map(topic => `- ${topic}`).join('\n')
      : '- Introduction\n- Main Content\n- Summary'

    return `Please create a comprehensive SCORM course JSON structure for the following course:

Title: ${courseSeedData?.courseTitle || 'Untitled Course'}
Difficulty Level: ${getDifficultyLabel(courseSeedData?.difficulty || 3)} (${courseSeedData?.difficulty || 3}/5)
Template: ${courseSeedData?.template || 'standard'}

Topics to cover:
${topicsText}

Generate a JSON response with the following structure:
{
  "welcomePage": {
    "id": "welcome",
    "title": "Welcome to [Course Title]",
    "content": "HTML fragment for welcome content",
    "narration": "Narration text for welcome page (2-3 minutes, approximately 300-500 words)",
    "imageKeywords": ["welcome", "introduction"],
    "imagePrompts": ["AI image generation prompt for welcome"],
    "videoSearchTerms": ["course introduction", "overview"],
    "duration": 2
    // NO knowledge check for Welcome page
  },
  "learningObjectivesPage": {
    "id": "learning-objectives",
    "title": "Learning Objectives",
    "content": "HTML fragment listing learning objectives",
    "narration": "Narration text for learning objectives (2-3 minutes, approximately 300-500 words)",
    "imageKeywords": ["objectives", "goals"],
    "imagePrompts": ["AI image generation prompt for objectives"],
    "videoSearchTerms": ["learning goals", "course objectives"],
    "duration": 3
    // NO knowledge check for Learning Objectives page
  },
  "topics": [
    {
      "id": "topic-0", // Use numeric IDs: topic-0, topic-1, topic-2, etc.
      "title": "Descriptive title derived from the topic (not a direct copy)",
      "content": "HTML fragment with headings, paragraphs, lists, tables, etc. Example: <h2>Introduction</h2><p>Content here...</p><ul><li>Item 1</li></ul>",
      "narration": "Narration text for this page (2-3 minutes, approximately 300-500 words per page)",
      "imageKeywords": ["keyword1", "keyword2"],
      "imagePrompts": ["AI image generation prompt"],
      "videoSearchTerms": ["search term 1", "search term 2"], // YouTube search terms for finding relevant tutorial videos
      "duration": 5,
      "knowledgeCheck": {
        "questions": [
          {
            "id": "kc-question-id",
            "type": "multiple-choice|true-false|fill-in-the-blank",
            "question": "Question text",
            "options": ["Option A", "Option B", "Option C", "Option D"], // for multiple choice
            "correctAnswer": "Option A", // or true/false, or "answer text" for fill-in-blank
            "blank": "The _____ is important for safety", // for fill-in-the-blank only
            "feedback": {
              "correct": "Great job! You got it right.",
              "incorrect": "Not quite. Review the material and try again."
            }
          }
        ]
      }
    }
  ],
  "assessment": {
    "questions": [
      {
        "id": "assessment-question-id",
        "type": "multiple-choice|true-false", // NO fill-in-the-blank for assessment
        "question": "Question text",
        "options": ["Option A", "Option B", "Option C", "Option D"], // for multiple choice
        "correctAnswer": "Option A", // or true/false
        "feedback": {
          "correct": "Correct feedback",
          "incorrect": "Incorrect feedback"
        }
      }
    ],
    "passMark": 80,
    "narration": null // No narration for the assessment page
  }
}

Please ensure:
1. Always include Welcome and Learning Objectives pages (these are automatically added to every course)
   - Welcome page ID must be "welcome" (as shown in the JSON structure above)
   - Learning Objectives page ID must be "learning-objectives" (as shown in the JSON structure above)
   - Topic IDs must be "topic-0", "topic-1", "topic-2", etc. (numeric sequence)
2. Welcome page should introduce the course with engaging welcome content
3. Learning Objectives page should list clear learning objectives for the course
4. NO knowledge check for Welcome page or Learning Objectives page
5. Content must be provided as an HTML fragment with proper semantic markup (headings, paragraphs, lists, tables, etc.)
6. Do NOT include bulletPoints - all content should be in the HTML fragment
7. Each page should have exactly ONE narration (single narration per page, 2-3 minutes long, approximately 300-500 words)
8. Titles should be descriptive and derived from the topic, not a direct copy of the topic name
9. Knowledge checks can include multiple choice, true/false, or fill-in-the-blank questions with feedback for correct and incorrect answers
10. Final assessment should ONLY contain multiple choice or true/false questions (NO fill-in-the-blank)
11. Assessment page should have NO narration (narration: null)
12. Include at least 10 questions in the final assessment
13. Image keywords and video search terms should be specific and relevant
14. Total course duration should be appropriate for the content

Important Notes:
- Welcome & Learning Objectives: These pages are automatically added to every course - always include them
- HTML Content: Write all content as HTML fragments including <h2>, <h3>, <p>, <ul>, <ol>, <table>, etc.
- Single Narration: Each topic page gets exactly one narration text (300-500 words for 2-3 minutes of speech), not multiple narrations
- Derived Titles: If topic is "Safety procedures in the workplace", title could be "Workplace Safety Fundamentals"
- Knowledge Checks: Mix question types - multiple choice, true/false, and fill-in-the-blank. Include encouraging feedback for correct answers and instructive feedback for incorrect answers
- Assessment Only: The final assessment should only use multiple choice or true/false questions
- No Assessment Narration: The assessment page should not include any narration
- No knowledge check for Welcome page
- No knowledge check for Learning Objectives page
- videoSearchTerms: Concise terms for YouTube searches (e.g., "workplace safety training", "hazard identification")
- All media selections should be relevant and enhance the learning experience

MATHEMATICAL EXPRESSIONS - DO NOT USE LATEX:
- NEVER use LaTeX syntax ($ symbols with backslashes like $\\Omega$)
- For Greek letters: Use HTML entities (&Omega;, &alpha;, &pi;) or Unicode (Ω, α, π)
- For math operators: Use HTML entities (&times;, &divide;, &plusmn;) or Unicode (×, ÷, ±)
- For superscripts: Use <sup>2</sup> not ^2
- For subscripts: Use <sub>2</sub> not _2
- For fractions: Use "1/2" or "½" (Unicode)
- Example: "Resistance (Ω)" NOT "Resistance ($\\Omega$)"
- Example: "E = mc<sup>2</sup>" NOT "E = mc^2"
- Example: "V = I × R" NOT "$ V = I \\times R $"

CRITICAL JSON FORMATTING RULES - MUST FOLLOW EXACTLY:
1. Use ONLY straight quotes (ASCII 34), NEVER smart/curly quotes:
   - CORRECT: "text"
   - WRONG: "text" or "text" (these are curly quotes - DO NOT USE)
   
2. Use ONLY straight apostrophes (ASCII 39) in contractions:
   - CORRECT: don't, it's, you're, we're
   - WRONG: don't, it's, you're, we're (these have curly apostrophes - DO NOT USE)
   
3. ESCAPE all quotes inside string values:
   - CORRECT: "He said \\"Hello\\" to me"
   - WRONG: "He said "Hello" to me"
   
4. For HTML content inside JSON strings, ensure proper escaping:
   - CORRECT: "<p class=\\"highlight\\">Text</p>"
   - WRONG: "<p class="highlight">Text</p>"
   
5. AVOID LaTeX expressions ($ symbols with backslashes). Instead use:
   - HTML entities: &Omega; &times; &pi; &alpha; &le; &ge;
   - Unicode: Ω × π α ≤ ≥
   - HTML tags: <sup>2</sup> for superscript, <sub>2</sub> for subscript
   - Example: "V = I × R" or "V = I &times; R" (NOT "$ V = I \\times R $")
   
6. NEVER include comments in the JSON (no // or /* */ allowed)

7. Ensure proper comma placement - no trailing commas

8. Replace these characters if you're tempted to use them:
   - Replace — (em dash) with --
   - Replace – (en dash) with -
   - Replace … (ellipsis) with ...
   - Replace any other non-ASCII characters with ASCII equivalents

REMEMBER: The JSON must parse without any errors. Test mentally that all quotes are balanced and properly escaped.`
  }, [customPrompt, courseSeedData])

  const handleCopy = async () => {
    const prompt = generatePrompt()
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setToast({ message: 'Copied to clipboard!', type: 'success' })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Show user-friendly error without console.error
      setCopied(false)
      setToast({ message: 'Failed to copy to clipboard. Please try selecting and copying manually.', type: 'error' })
    }
  }
  
  // Wrapped navigation handlers
  const handleBack = () => {
    attemptNavigation(() => onBack())
  }
  
  const handleStepClick = (stepIndex: number) => {
    if (onStepClick) {
      attemptNavigation(() => onStepClick(stepIndex))
    }
  }
  
  const handleOpen = () => {
    if (onOpen) {
      attemptNavigation(() => onOpen())
    }
  }

  // Helper function to get difficulty label
  const getDifficultyLabel = (level: number): string => {
    const labels = ['Basic', 'Easy', 'Medium', 'Hard', 'Expert']
    return labels[level - 1] || 'Medium'
  }

  const prompt = generatePrompt()

  // Removed Reset, Save as Template, and History functionality per UX requirements

  const autoSaveIndicator = (
    <AutoSaveIndicatorConnected />
  )


  return (
    <>
      <PageLayout
        currentStep={1}
        title="AI Prompt Generator"
        description="Generate a comprehensive AI prompt based on your course configuration"
        autoSaveIndicator={autoSaveIndicator}
        onSettingsClick={onSettingsClick}
        onSave={onSave}
        onOpen={handleOpen}
        onHelp={onHelp}
        onBack={handleBack}
        onNext={onNext}
        onStepClick={handleStepClick}
      >
      {/* Status announcements for screen readers */}
      {copied && (
        <div role="status" aria-live="polite" className={styles.srOnly}>
          Prompt copied to clipboard
        </div>
      )}

      {/* Instructions */}
      <div className={styles.sectionWrapper}>
        <h2 className={styles.sectionTitle}>Instructions</h2>
        <Card>
          <ol className={styles.instructionsList}>
            <li>Copy the prompt to your clipboard</li>
            <li>Paste it into your preferred AI chatbot (ChatGPT, Claude, etc.)</li>
            <li>Copy the JSON response from the AI</li>
            <li>Click Next to proceed to the JSON import step</li>
          </ol>
        </Card>
      </div>

      {/* Course Information */}
      <div className={styles.sectionWrapper}>
        <h2 className={styles.sectionTitle}>Course Information</h2>
        <Card>
          <div className={styles.courseInfoGrid}>
            <p className={styles.courseInfoItem}>
              <strong className={styles.courseInfoLabel}>Title:</strong> {courseSeedData.courseTitle}
            </p>
            <p className={styles.courseInfoItem}>
              <strong className={styles.courseInfoLabel}>Difficulty:</strong> {getDifficultyLabel(courseSeedData.difficulty)} ({courseSeedData.difficulty} out of 5)
            </p>
            <p className={styles.courseInfoItem}>
              <strong className={styles.courseInfoLabel}>Template:</strong> {courseSeedData.template}
            </p>
          </div>
        </Card>
      </div>

      {/* Prompt History removed per UX requirements */}

      {/* AI Prompt */}
      <div className={styles.sectionWrapper}>
        <h2 className={styles.sectionTitle}>AI Prompt</h2>
        <Card>
          <textarea
            id="ai-prompt"
            data-testid="ai-prompt-textarea"
            value={prompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={20}
            aria-label="AI prompt for course generation"
            className={styles.promptTextarea}
          />
          
          <Button
            onClick={handleCopy}
            aria-label="Copy prompt to clipboard"
            data-testid="copy-prompt-button"
            variant={copied ? 'success' : 'secondary'}
            size="medium"
            className={styles.copyButton}
          >
            {copied ? (
              <>
                <Check size={16} className={styles.copyButtonIcon} /> Copied!
              </>
            ) : (
              <>
                <Copy size={16} className={styles.copyButtonIcon} /> Copy Prompt
              </>
            )}
          </Button>
        </Card>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

    </PageLayout>
  </>
  )
}

export default AIPromptGenerator;
