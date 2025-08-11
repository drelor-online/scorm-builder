export interface HelpTopic {
  id: string
  title: string
  summary: string
  details: string[]
  tips?: string[]
  warnings?: string[]
  related?: string[]
  keywords?: string[]
}

export const helpTopics: HelpTopic[] = [
  // ========== WORKFLOW STEPS ==========
  {
    id: 'course-config',
    title: 'Step 1: Course Configuration',
    summary: 'Set up your course fundamentals to generate targeted learning content.',
    details: [
      'Enter a descriptive course title that clearly identifies your training topic',
      'Select a difficulty level from Basic to Expert based on your target audience',
      'Add 10-20 specific learning topics that will form the structure of your course',
      'Optionally choose a pre-made template to quickly populate common topics for your industry'
    ],
    tips: [
      'Use clear, specific topic names rather than generic terms',
      'Consider your audience\'s prior knowledge when selecting difficulty',
      'Templates are great starting points but can be customized after selection'
    ],
    related: ['prompt-generator', 'templates'],
    keywords: ['setup', 'configuration', 'title', 'difficulty', 'topics', 'template']
  },
  {
    id: 'prompt-generator',
    title: 'Step 2: AI Prompt Generator',
    summary: 'Generate a comprehensive AI prompt based on your course configuration.',
    details: [
      'The system automatically generates a detailed prompt based on your course configuration',
      'Click "Copy Prompt" to copy the entire prompt to your clipboard',
      'Paste the prompt into your preferred AI chatbot (Claude, ChatGPT, Gemini, etc.)',
      'The prompt requests structured JSON output with content, narration scripts, and media suggestions',
      'Wait for the AI to generate the complete JSON response before proceeding'
    ],
    tips: [
      'Claude 3.5 Sonnet or GPT-4 tend to produce the best quality content',
      'If the AI response is cut off, ask it to continue from where it stopped',
      'Save the AI response to a text file as backup before proceeding'
    ],
    warnings: [
      'Ensure the AI completes the entire JSON response including the closing brackets',
      'Some AI models may have token limits that prevent generating the full course in one response'
    ],
    related: ['course-config', 'json-import'],
    keywords: ['AI', 'prompt', 'generate', 'chatbot', 'Claude', 'ChatGPT', 'copy']
  },
  {
    id: 'json-import',
    title: 'Step 3: JSON Import & Validation',
    summary: 'Import and validate the AI-generated course content.',
    details: [
      'Copy the complete JSON response from your AI chatbot',
      'Paste it into the JSON input field or upload a saved JSON file',
      'The system automatically validates the JSON structure',
      'Review the validation summary showing pages, topics, and questions',
      'Fix any validation errors before proceeding to the next step'
    ],
    tips: [
      'Use a JSON formatter/validator tool if you need to manually edit the JSON',
      'Common issues include missing commas, unclosed brackets, or invalid characters',
      'The validator will highlight specific line numbers where errors occur'
    ],
    warnings: [
      'Incomplete JSON will fail validation - ensure you have the entire response',
      'Smart quotes from word processors can cause JSON parse errors'
    ],
    related: ['prompt-generator', 'json-errors', 'media-enhancement'],
    keywords: ['JSON', 'import', 'validate', 'paste', 'upload', 'structure']
  },
  {
    id: 'media-enhancement',
    title: 'Step 4: Media Enhancement',
    summary: 'Add images and videos to enhance your course content.',
    details: [
      'Navigate through all course pages using the page selector',
      'Search for relevant images using the integrated Google Image Search',
      'Search for educational videos using the YouTube integration',
      'Preview media before adding it to your course',
      'Remove unwanted media with the delete button (with confirmation)',
      'Media is automatically saved with your project'
    ],
    tips: [
      'Choose high-quality, relevant images that support the learning objectives',
      'Educational videos should be concise and directly related to the topic',
      'Consider copyright and usage rights when selecting media',
      'You can skip this step and add media later if needed'
    ],
    related: ['audio-narration', 'scorm-package'],
    keywords: ['media', 'images', 'videos', 'YouTube', 'Google', 'search', 'enhance']
  },
  {
    id: 'audio-narration',
    title: 'Step 5: Audio Narration',
    summary: 'Add professional voiceover narration to your course.',
    details: [
      'Download the narration script file containing all text to be narrated',
      'Use Murf.ai or another text-to-speech service to generate audio files',
      'Upload the audio files as a ZIP archive (replaces all existing audio)',
      'Optionally upload caption files (VTT format) for accessibility',
      'Edit individual narration blocks if adjustments are needed',
      'Preview audio with the built-in player controls'
    ],
    tips: [
      'Murf.ai offers high-quality AI voices in multiple languages',
      'Name your audio files to match the expected format (audio-0.mp3, audio-1.mp3, etc.)',
      'Generate captions for accessibility compliance',
      'Test audio playback before generating the final SCORM package'
    ],
    warnings: [
      'Uploading a new audio ZIP will replace ALL existing audio files',
      'Ensure audio files are in MP3 format for best compatibility'
    ],
    related: ['media-enhancement', 'activities-editor', 'murf-integration'],
    keywords: ['audio', 'narration', 'voice', 'Murf', 'TTS', 'captions', 'VTT']
  },
  {
    id: 'activities-editor',
    title: 'Step 6: Activities & Assessment',
    summary: 'Review and edit all questions and assessments in your course.',
    details: [
      'View summary statistics of all questions in your course',
      'Edit knowledge check questions that appear after each topic',
      'Modify assessment questions for the final evaluation',
      'Support for Multiple Choice, True/False, and Fill-in-the-Blank questions',
      'Customize correct and incorrect feedback messages',
      'Remove questions from knowledge checks (assessment questions cannot be removed)'
    ],
    tips: [
      'Ensure questions align with the learning objectives',
      'Provide helpful feedback that reinforces learning',
      'Keep fill-in-the-blank answers simple and unambiguous',
      'Test all questions for clarity and correctness'
    ],
    related: ['course-config', 'scorm-package'],
    keywords: ['questions', 'assessment', 'quiz', 'knowledge check', 'activities']
  },
  {
    id: 'scorm-package',
    title: 'Step 7: Generate SCORM Package',
    summary: 'Create a SCORM-compliant package ready for your LMS.',
    details: [
      'Review the course summary and statistics',
      'Click "Generate SCORM Package" to build the ZIP file',
      'Wait for the package generation to complete (may take 30-60 seconds)',
      'Download the generated SCORM package',
      'Upload the ZIP file directly to your Learning Management System',
      'The package is SCORM 1.2 compliant for maximum compatibility'
    ],
    tips: [
      'Test the package in your LMS before widespread deployment',
      'SCORM 1.2 is supported by virtually all LMS platforms',
      'The package includes all media, audio, and assessment data',
      'Save your project before generating to preserve your work'
    ],
    warnings: [
      'Large media files may increase generation time',
      'Ensure all required content is complete before generating'
    ],
    related: ['activities-editor', 'audio-narration', 'lms-upload'],
    keywords: ['SCORM', 'package', 'generate', 'download', 'LMS', 'export']
  },

  // ========== TROUBLESHOOTING ==========
  {
    id: 'json-errors',
    title: 'Troubleshooting: JSON Validation Errors',
    summary: 'Common JSON validation issues and how to fix them.',
    details: [
      'Missing comma: Add commas between array items and object properties',
      'Unclosed brackets: Ensure all { [ have matching } ]',
      'Invalid characters: Remove smart quotes, use straight quotes only',
      'Truncated response: Ask the AI to continue generating from where it stopped',
      'Invalid escape sequences: Ensure backslashes are properly escaped'
    ],
    tips: [
      'Use an online JSON validator to identify specific error locations',
      'JSONLint.com can help format and validate your JSON',
      'Copy JSON to a text editor with syntax highlighting to spot errors'
    ],
    related: ['json-import', 'prompt-generator'],
    keywords: ['JSON', 'error', 'validation', 'syntax', 'parse', 'invalid']
  },
  {
    id: 'api-issues',
    title: 'Troubleshooting: API Key Issues',
    summary: 'Resolving problems with API keys for media search.',
    details: [
      'Google API key is required for image search functionality',
      'YouTube API key enables video search features',
      'API keys are stored securely in encrypted configuration',
      'Keys can be obtained from Google Cloud Console',
      'Rate limits may apply based on your API quota'
    ],
    tips: [
      'Enable the correct APIs in Google Cloud Console',
      'Set up billing if you exceed free tier limits',
      'Restrict API keys to your application for security'
    ],
    warnings: [
      'Never share or commit API keys to version control',
      'Rotate keys regularly for security'
    ],
    related: ['media-enhancement', 'settings'],
    keywords: ['API', 'key', 'Google', 'YouTube', 'authentication', 'credentials']
  },
  {
    id: 'media-upload-errors',
    title: 'Troubleshooting: Media Upload Problems',
    summary: 'Fixing issues with audio and media file uploads.',
    details: [
      'Audio files must be in MP3 format for compatibility',
      'ZIP archives should contain files named audio-0.mp3, audio-1.mp3, etc.',
      'Caption files should be in WebVTT (.vtt) format',
      'Large files may take time to process - be patient',
      'Browser may block pop-ups for file selection dialogs'
    ],
    tips: [
      'Use a ZIP utility that preserves file names exactly',
      'Convert audio to MP3 using tools like Audacity if needed',
      'Test with a small ZIP file first to verify format'
    ],
    related: ['audio-narration', 'media-enhancement'],
    keywords: ['upload', 'media', 'audio', 'ZIP', 'files', 'error']
  },

  // ========== FEATURES ==========
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    summary: 'Quick keyboard commands to enhance your workflow.',
    details: [
      'Ctrl+S: Save your project',
      'Ctrl+O: Open an existing project',
      'Ctrl+Shift+P: Toggle Performance Dashboard',
      'Ctrl+Shift+T: Toggle Test Checklist',
      'Ctrl+Shift+D: Toggle Debug Panel (development mode)',
      'F1: Open context-sensitive help',
      'Escape: Close dialogs and overlays'
    ],
    tips: [
      'Performance Dashboard helps identify slow operations',
      'Test Checklist ensures your course meets quality standards',
      'Debug Panel provides technical information for troubleshooting'
    ],
    related: ['performance-monitoring', 'test-checklist'],
    keywords: ['keyboard', 'shortcuts', 'hotkeys', 'commands', 'keys']
  },
  {
    id: 'performance-monitoring',
    title: 'Performance Dashboard',
    summary: 'Monitor application performance and resource usage.',
    details: [
      'Real-time performance metrics for all operations',
      'Memory usage tracking to prevent browser crashes',
      'Slow operation warnings (operations over 1 second)',
      'Component render counts for optimization',
      'Network request monitoring for API calls'
    ],
    tips: [
      'Open with Ctrl+Shift+P anytime',
      'Red indicators show performance issues',
      'Clear cache if memory usage is high'
    ],
    related: ['keyboard-shortcuts', 'troubleshooting'],
    keywords: ['performance', 'speed', 'memory', 'monitoring', 'metrics']
  },
  {
    id: 'templates',
    title: 'Course Templates',
    summary: 'Pre-built course structures for common training topics.',
    details: [
      'Safety Training: Comprehensive safety topics for workplace training',
      'Compliance: Regulatory and compliance training structure',
      'Technical Skills: IT and technical training framework',
      'Customer Service: Soft skills and service training outline',
      'Custom: Start from scratch with your own topics'
    ],
    tips: [
      'Templates are starting points - customize them for your needs',
      'Add or remove topics after selecting a template',
      'Combine elements from multiple templates if needed'
    ],
    related: ['course-config'],
    keywords: ['template', 'preset', 'structure', 'framework', 'starter']
  },
  {
    id: 'murf-integration',
    title: 'Murf.ai Integration Guide',
    summary: 'Step-by-step guide for using Murf.ai for audio narration.',
    details: [
      'Create a free Murf.ai account at murf.ai',
      'Download the narration script from the Audio Narration step',
      'Create a new project in Murf and paste the script',
      'Select your preferred AI voice and adjust settings',
      'Generate audio for each narration block',
      'Download all audio files and create a ZIP archive',
      'Upload the ZIP file in the Audio Narration step'
    ],
    tips: [
      'Murf offers multiple voice options in various languages',
      'Adjust speed and pitch for optimal clarity',
      'Add pauses between sentences for better comprehension',
      'Generate samples with different voices before committing'
    ],
    related: ['audio-narration'],
    keywords: ['Murf', 'TTS', 'text-to-speech', 'voice', 'AI', 'narration']
  },

  // ========== BEST PRACTICES ==========
  {
    id: 'best-practices',
    title: 'Best Practices for Course Creation',
    summary: 'Guidelines for creating effective e-learning content.',
    details: [
      'Keep topics focused and concise (5-7 minutes of content each)',
      'Use clear learning objectives that are measurable',
      'Include relevant media to support visual learners',
      'Write assessment questions that test understanding, not memorization',
      'Provide immediate, constructive feedback on incorrect answers',
      'Ensure accessibility with captions and alt text',
      'Test your course before deployment'
    ],
    tips: [
      'Follow the ADDIE model: Analyze, Design, Develop, Implement, Evaluate',
      'Consider different learning styles in your content',
      'Keep technical jargon to a minimum unless necessary',
      'Use real-world examples and scenarios'
    ],
    related: ['course-config', 'activities-editor'],
    keywords: ['best practices', 'guidelines', 'effective', 'quality', 'tips']
  },
  {
    id: 'lms-upload',
    title: 'Uploading to Your LMS',
    summary: 'Guide for uploading SCORM packages to popular LMS platforms.',
    details: [
      'Moodle: Site Administration > Courses > Add SCORM package',
      'Canvas: Settings > Navigation > SCORM, then upload ZIP',
      'Blackboard: Content > Build Content > Content Package (SCORM)',
      'TalentLMS: Add Course > Add SCORM > Upload ZIP file',
      'Most LMS platforms accept SCORM 1.2 ZIP files directly',
      'Some platforms may require specific settings for grading'
    ],
    tips: [
      'Test with a small group before full deployment',
      'Check LMS documentation for specific requirements',
      'Verify completion and scoring settings after upload'
    ],
    warnings: [
      'Some LMS platforms have file size limits',
      'Ensure your LMS supports SCORM 1.2 standard'
    ],
    related: ['scorm-package'],
    keywords: ['LMS', 'upload', 'Moodle', 'Canvas', 'Blackboard', 'deploy']
  },

  // ========== FAQs ==========
  {
    id: 'faq-general',
    title: 'Frequently Asked Questions',
    summary: 'Common questions about SCORM Course Builder.',
    details: [
      'Q: What AI models work best? A: Claude 3.5 Sonnet, GPT-4, or Gemini Pro',
      'Q: Can I edit content after generation? A: Yes, all content is editable',
      'Q: What file formats are supported? A: JSON import, MP3 audio, VTT captions, JPG/PNG images',
      'Q: Is internet required? A: Only for media search and AI generation',
      'Q: Can I save my progress? A: Yes, projects are auto-saved locally',
      'Q: What SCORM version is supported? A: SCORM 1.2 for maximum compatibility'
    ],
    tips: [
      'Check the troubleshooting section for specific error solutions',
      'Join our community forum for additional support'
    ],
    related: ['troubleshooting', 'best-practices'],
    keywords: ['FAQ', 'questions', 'help', 'support', 'answers']
  },
  {
    id: 'project-management',
    title: 'Managing Your Projects',
    summary: 'Save, load, and organize your course projects.',
    details: [
      'Projects are automatically saved as you work',
      'Use File > Save to manually save your progress',
      'File > Save As to create a copy with a new name',
      'File > Open to load existing projects',
      'Recent projects appear on the dashboard',
      'Projects include all content, media, and settings'
    ],
    tips: [
      'Create project versions before major changes',
      'Use descriptive project names for easy identification',
      'Export your project files for backup'
    ],
    related: ['course-config', 'best-practices'],
    keywords: ['save', 'load', 'project', 'file', 'manage', 'organize']
  }
]

// Helper function to find topics by keywords
export function searchTopics(query: string): HelpTopic[] {
  const searchTerm = query.toLowerCase()
  return helpTopics.filter(topic => 
    topic.title.toLowerCase().includes(searchTerm) ||
    topic.summary.toLowerCase().includes(searchTerm) ||
    topic.keywords?.some(keyword => keyword.toLowerCase().includes(searchTerm)) ||
    topic.details.some(detail => detail.toLowerCase().includes(searchTerm))
  )
}

// Helper function to get topic by ID
export function getTopicById(id: string): HelpTopic | undefined {
  return helpTopics.find(topic => topic.id === id)
}

// Helper function to get related topics
export function getRelatedTopics(topicId: string): HelpTopic[] {
  const topic = getTopicById(topicId)
  if (!topic?.related) return []
  return topic.related.map(id => getTopicById(id)).filter(Boolean) as HelpTopic[]
}

// Map wizard steps to help topic IDs
export const stepToHelpTopic: Record<number, string> = {
  0: 'course-config',
  1: 'prompt-generator',
  2: 'json-import',
  3: 'media-enhancement',
  4: 'audio-narration',
  5: 'activities-editor',
  6: 'scorm-package'
}