/**
 * AI Prompt Builder Utility
 *
 * This module generates AI prompts dynamically based on prompt tuning settings.
 * It replaces the hardcoded prompt generation in AIPromptGenerator while maintaining
 * the exact same output when using default settings.
 */

import {
  PromptTuningSettings,
  DEFAULT_PROMPT_TUNING_SETTINGS,
  SETTING_OPTIONS
} from '../types/promptTuning'
import { CourseSeedData } from '../types/course'

// ============================================================================
// Helper Functions for Dynamic Prompt Parts
// ============================================================================

/**
 * Generates the narration specification text based on settings
 */
function generateNarrationSpec(settings: PromptTuningSettings, pageType: 'welcome' | 'objectives' | 'topic' = 'topic'): string {
  const lengthConfig = SETTING_OPTIONS.narrationLength[settings.narrationLength]

  const wordCount = pageType === 'welcome' ? settings.welcomeWordCount :
                   pageType === 'objectives' ? settings.objectivesWordCount :
                   settings.topicWordCount

  const characterLimitNote = settings.enforceCharacterLimit
    ? ` (hard limit ${settings.characterLimit} characters)`
    : ''
  return `approximately ${wordCount} words, guided by ${lengthConfig.words} words, maximum ${lengthConfig.chars} characters${characterLimitNote}`
}

/**
 * Generates the content detail instructions based on settings
 */
function generateContentInstructions(settings: PromptTuningSettings): string {
  const baseInstructions = []

  // Content detail level
  switch (settings.contentDetail) {
    case 'brief':
      baseInstructions.push('Provide concise, essential information with minimal elaboration')
      break
    case 'standard':
      baseInstructions.push('Include balanced detail with clear explanations')
      break
    case 'comprehensive':
      baseInstructions.push('Provide detailed explanations with examples and context')
      break
    case 'extensive':
      baseInstructions.push('Include in-depth coverage with additional context, examples, and comprehensive explanations')
      break
  }

  // HTML complexity
  const htmlConfig = SETTING_OPTIONS.htmlComplexity[settings.htmlComplexity]
  baseInstructions.push(`Use HTML elements: ${htmlConfig.tags.join(', ')}`)

  return baseInstructions.join('. ')
}

/**
 * Generates media specifications based on settings
 */
function generateMediaSpecs(settings: PromptTuningSettings): {
  imageKeywords: string
  imagePrompts: string
  videoSearchTerms: string
} {
  const imageKeywordsCount = settings.imageKeywordsCount
  const videoSearchTermsCount = settings.videoSearchTermsCount

  // Generate example arrays based on counts
  const imageKeywordsExample = Array.from({ length: imageKeywordsCount }, (_, i) =>
    `"keyword${i + 1}"`
  ).join(', ')

  const videoSearchTermsExample = Array.from({ length: videoSearchTermsCount }, (_, i) =>
    `"search term ${i + 1}"`
  ).join(', ')

  // Image prompts based on detail level
  let imagePromptInstructions = 'AI image generation prompt'
  switch (settings.imagePromptDetail) {
    case 'simple':
      imagePromptInstructions = 'Basic descriptive AI image prompt'
      break
    case 'standard':
      imagePromptInstructions = 'AI image generation prompt with context'
      break
    case 'detailed':
      imagePromptInstructions = 'Detailed AI image generation prompt with style guidance'
      break
    case 'artistic':
      imagePromptInstructions = 'Creative AI image generation prompt with aesthetic direction'
      break
  }

  // Image search specificity
  let imageSearchNote = 'Target relevant stock imagery that reinforces the topic'
  switch (settings.imageSearchSpecificity) {
    case 'broad':
      imageSearchNote = 'Use broad, exploratory image terms to gather general visuals'
      break
    case 'specific':
      imageSearchNote = 'Use focused image terms tailored to the topic details'
      break
    case 'very-specific':
      imageSearchNote = 'Use highly targeted, niche image terms appropriate for specialized content'
      break
  }

  // Video search specificity
  let videoInstructions = 'YouTube search terms for finding relevant tutorial videos'
  switch (settings.videoSearchSpecificity) {
    case 'broad':
      videoInstructions = 'General YouTube search terms for broad topic coverage'
      break
    case 'specific':
      videoInstructions = 'Specific YouTube search terms for targeted content'
      break
    case 'very-specific':
      videoInstructions = 'Highly specific YouTube search terms with technical focus'
      break
  }

  return {
    imageKeywords: `[${imageKeywordsExample}] // ${imageSearchNote}`,
    imagePrompts: `["${imagePromptInstructions}"]`,
    videoSearchTerms: `[${videoSearchTermsExample}] // ${videoInstructions}`
  }
}

/**
 * Generates assessment specifications based on settings
 */
function generateAssessmentSpecs(settings: PromptTuningSettings): {
  knowledgeCheckSpec: string
  assessmentSpec: string
  questionTypeInstructions: string
} {
  const knowledgeCheckSpec = settings.knowledgeCheckQuestions === 0
    ? '// NO knowledge check for this page'
    : settings.knowledgeCheckQuestions === 1
    ? 'Include 1 knowledge check question with feedback'
    : `Include ${settings.knowledgeCheckQuestions} knowledge check questions with feedback`

  const assessmentSpec = `Include exactly ${settings.assessmentQuestions} questions in the final assessment`

  let questionTypeInstructions = ''
  switch (settings.questionTypeMix) {
    case 'multiple-choice':
      questionTypeInstructions = 'Prioritize multiple choice questions. Use true/false sparingly.'
      break
    case 'true-false-heavy':
      questionTypeInstructions = 'Include more true/false questions alongside multiple choice.'
      break
    case 'balanced':
      questionTypeInstructions = 'Mix question types - multiple choice, true/false, and fill-in-the-blank for knowledge checks.'
      break
  }

  return {
    knowledgeCheckSpec,
    assessmentSpec,
    questionTypeInstructions
  }
}

/**
 * Generates word count specifications for different page types
 */
function generateWordCountSpecs(settings: PromptTuningSettings): {
  welcomeWordCount: number
  objectivesWordCount: number
  topicWordCount: number
} {
  return {
    welcomeWordCount: settings.welcomeWordCount,
    objectivesWordCount: settings.objectivesWordCount,
    topicWordCount: settings.topicWordCount
  }
}

// ============================================================================
// Main Prompt Builder Function
// ============================================================================

/**
 * Builds the complete AI prompt based on course seed data and tuning settings
 */
export function buildAIPrompt(
  courseSeedData: CourseSeedData,
  settings: PromptTuningSettings = DEFAULT_PROMPT_TUNING_SETTINGS,
  customPrompt?: string
): string {
  // If custom prompt is provided, use it as-is
  if (customPrompt) {
    return customPrompt
  }

  // Extract course data
  const topicsText = courseSeedData?.customTopics?.length > 0
    ? courseSeedData.customTopics.map(topic => `- ${topic}`).join('\n')
    : '- Introduction\n- Main Content\n- Summary'

  const courseTitle = courseSeedData?.courseTitle || 'Untitled Course'
  const difficulty = courseSeedData?.difficulty || 3
  const template = courseSeedData?.template || 'standard'

  // Generate dynamic specifications
  const welcomeNarrationSpec = generateNarrationSpec(settings, 'welcome')
  const objectivesNarrationSpec = generateNarrationSpec(settings, 'objectives')
  const topicNarrationSpec = generateNarrationSpec(settings, 'topic')
  const contentInstructions = generateContentInstructions(settings)
  const mediaSpecs = generateMediaSpecs(settings)
  const assessmentSpecs = generateAssessmentSpecs(settings)
  const wordCounts = generateWordCountSpecs(settings)

  // Helper function for difficulty label
  const getDifficultyLabel = (level: number): string => {
    const labels = ['Basic', 'Easy', 'Medium', 'Hard', 'Expert']
    return labels[level - 1] || 'Medium'
  }

  // Build the complete prompt
  return `Please create a comprehensive SCORM course JSON structure for the following course:

Title: ${courseTitle}
Difficulty Level: ${getDifficultyLabel(difficulty)} (${difficulty}/5)
Template: ${template}

Topics to cover:
${topicsText}

Content Generation Guidelines:
${contentInstructions}

Generate a JSON response with the following structure:
{
  "welcomePage": {
    "id": "welcome",
    "title": "Welcome to [Course Title]",
    "content": "HTML fragment for welcome content",
    "narration": "Narration text for welcome page (${welcomeNarrationSpec})",
    "imageKeywords": ${mediaSpecs.imageKeywords},
    "imagePrompts": ${mediaSpecs.imagePrompts},
    "videoSearchTerms": ${mediaSpecs.videoSearchTerms},
    "wordCount": "${wordCounts.welcomeWordCount}"
    // NO knowledge check for Welcome page
  },
  "learningObjectivesPage": {
    "id": "learning-objectives",
    "title": "Learning Objectives",
    "content": "HTML fragment listing learning objectives",
    "narration": "Narration text for learning objectives (${objectivesNarrationSpec})",
    "imageKeywords": ${mediaSpecs.imageKeywords},
    "imagePrompts": ${mediaSpecs.imagePrompts},
    "videoSearchTerms": ${mediaSpecs.videoSearchTerms},
    "wordCount": "${wordCounts.objectivesWordCount}"
    // NO knowledge check for Learning Objectives page
  },
  "topics": [
    {
      "id": "topic-0", // Use numeric IDs: topic-0, topic-1, topic-2, etc.
      "title": "Descriptive title derived from the topic (not a direct copy)",
      "content": "HTML fragment with headings, paragraphs, lists, tables, etc. Example: <h2>Introduction</h2><p>Content here...</p><ul><li>Item 1</li></ul>",
      "narration": "Narration text for this page (${topicNarrationSpec})",
      "imageKeywords": ${mediaSpecs.imageKeywords},
      "imagePrompts": ${mediaSpecs.imagePrompts},
      "videoSearchTerms": ${mediaSpecs.videoSearchTerms},
      "wordCount": "${wordCounts.topicWordCount}",
      "knowledgeCheck": {
        ${assessmentSpecs.knowledgeCheckSpec === '// NO knowledge check for this page'
          ? assessmentSpecs.knowledgeCheckSpec
          : `"questions": [
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
        ]`
        }
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
    "passMark": ${settings.passMark},
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
7. Each page should have exactly ONE narration (single narration per page, ${topicNarrationSpec})
8. Titles should be descriptive and derived from the topic, not a direct copy of the topic name
9. Knowledge checks can include multiple choice, true/false, or fill-in-the-blank questions with feedback for correct and incorrect answers
10. Final assessment should ONLY contain multiple choice or true/false questions (NO fill-in-the-blank)
11. Assessment page should have NO narration (narration: null)
12. ${assessmentSpecs.assessmentSpec}
13. Image keywords and video search terms should be specific and relevant
14. Total course word count should be appropriate for the content depth

Assessment Guidelines:
${assessmentSpecs.questionTypeInstructions}
Pass mark is set to ${settings.passMark}%

Important Notes:
- Character Limit: ${settings.enforceCharacterLimit ? `Enforce a maximum of ${settings.characterLimit} characters per narration.` : 'Use character limits as guidance; do not enforce a hard cap.'}
- Welcome & Learning Objectives: These pages are automatically added to every course - always include them
- HTML Content: Write all content as HTML fragments including <h2>, <h3>, <p>, <ul>, <ol>, <table>, etc.
- Single Narration: Each topic page gets exactly one narration text (${topicNarrationSpec}), not multiple narrations
- Derived Titles: If topic is "Safety procedures in the workplace", title could be "Workplace Safety Fundamentals"
- Knowledge Checks: ${assessmentSpecs.knowledgeCheckSpec}. Include encouraging feedback for correct answers and instructive feedback for incorrect answers
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
}

// ============================================================================
// Utility Functions for Integration
// ============================================================================

/**
 * Checks if the current settings would produce the same prompt as defaults
 */
export function wouldProduceSamePrompt(
  settings: PromptTuningSettings,
  courseSeedData: CourseSeedData
): boolean {
  const defaultPrompt = buildAIPrompt(courseSeedData, DEFAULT_PROMPT_TUNING_SETTINGS)
  const currentPrompt = buildAIPrompt(courseSeedData, settings)
  return defaultPrompt === currentPrompt
}

/**
 * Gets a summary of the changes from default settings
 */
export function getSettingsChangeSummary(settings: PromptTuningSettings): string[] {
  const changes: string[] = []
  const defaults = DEFAULT_PROMPT_TUNING_SETTINGS

  // Check each setting for changes
  if (settings.narrationLength !== defaults.narrationLength) {
    changes.push(`Narration: ${SETTING_OPTIONS.narrationLength[settings.narrationLength].label}`)
  }
  if (settings.contentDetail !== defaults.contentDetail) {
    changes.push(`Content: ${SETTING_OPTIONS.contentDetail[settings.contentDetail].label}`)
  }
  if (settings.imageKeywordsCount !== defaults.imageKeywordsCount) {
    changes.push(`Image keywords: ${settings.imageKeywordsCount}`)
  }
  if (settings.assessmentQuestions !== defaults.assessmentQuestions) {
    changes.push(`Assessment questions: ${settings.assessmentQuestions}`)
  }
  if (settings.passMark !== defaults.passMark) {
    changes.push(`Pass mark: ${settings.passMark}%`)
  }

  return changes
}

/**
 * Validates that a prompt would generate valid JSON structure
 */
export function validatePromptStructure(prompt: string): {
  isValid: boolean
  warnings: string[]
} {
  const warnings: string[] = []

  // Check for potential JSON formatting issues
  if (prompt.includes('"') && prompt.includes('"')) {
    warnings.push('Contains curly quotes which may cause JSON parsing errors')
  }
  if (prompt.includes('$\\')) {
    warnings.push('Contains LaTeX syntax which should be avoided')
  }
  if (!prompt.includes('"welcomePage"')) {
    warnings.push('Missing welcomePage structure')
  }
  if (!prompt.includes('"learningObjectivesPage"')) {
    warnings.push('Missing learningObjectivesPage structure')
  }

  return {
    isValid: warnings.length === 0,
    warnings
  }
}