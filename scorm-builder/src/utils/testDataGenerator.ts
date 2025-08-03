import { CourseContent, Topic, KnowledgeCheckQuestion, Assessment } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'

/**
 * Generates realistic test data for automated testing
 */
export class TestDataGenerator {
  private static courseTopics = {
    'Technical': [
      'Introduction to the Software',
      'User Interface Overview',
      'Core Features and Functions',
      'Advanced Settings',
      'Best Practices and Tips'
    ],
    'Corporate': [
      'Understanding Compliance Requirements',
      'Company Policies and Procedures',
      'Legal and Regulatory Framework',
      'Risk Management',
      'Reporting and Documentation',
      'Case Studies and Examples',
      'Compliance Certification'
    ],
    'Safety': [
      'Introduction to Cybersecurity',
      'Common Threats and Vulnerabilities',
      'Password Security',
      'Phishing and Social Engineering',
      'Data Protection Best Practices'
    ],
    'Human Resources': [
      'Understanding Customer Needs',
      'Effective Communication Skills',
      'Handling Difficult Situations',
      'Building Customer Relationships'
    ]
  }

  private static templates = Object.keys(this.courseTopics)

  /**
   * Generate a unique course title with timestamp
   */
  static generateCourseTitle(): string {
    const templates = [
      'Automated Test Course - {template} {timestamp}',
      'E2E Test - {template} Training {timestamp}',
      'Test Run - {template} Course {timestamp}'
    ]
    
    const template = this.templates[Math.floor(Math.random() * this.templates.length)]
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '-')
    const titleTemplate = templates[Math.floor(Math.random() * templates.length)]
    
    return titleTemplate
      .replace('{template}', template)
      .replace('{timestamp}', timestamp)
  }

  /**
   * Generate course seed data
   */
  static generateCourseSeedData(): CourseSeedData {
    const template = this.templates[Math.floor(Math.random() * this.templates.length)]
    const topics = this.courseTopics[template as keyof typeof this.courseTopics]
    
    return {
      courseTitle: this.generateCourseTitle(),
      difficulty: Math.floor(Math.random() * 3) + 2, // 2-4
      customTopics: topics,
      template: template as any, // Type assertion since CourseTemplate is not exported
      templateTopics: topics
    }
  }

  /**
   * Generate knowledge check questions for a topic
   */
  static generateKnowledgeCheckQuestions(topicTitle: string): KnowledgeCheckQuestion[] {
    const questions: KnowledgeCheckQuestion[] = []
    
    // Multiple choice question
    questions.push({
      id: `kc-${Date.now()}-1`,
      type: 'multiple-choice',
      question: `What is the main purpose of ${topicTitle}?`,
      options: [
        'To improve efficiency',
        'To reduce costs',
        'To ensure compliance',
        'All of the above'
      ],
      correctAnswer: '3'
    })
    
    // True/false question
    questions.push({
      id: `kc-${Date.now()}-2`,
      type: 'true-false',
      question: `${topicTitle} is essential for organizational success.`,
      correctAnswer: 'true'
    })
    
    return questions
  }

  /**
   * Generate assessment questions
   */
  static generateAssessmentQuestions(topics: string[]): Assessment {
    const questions: any[] = []
    
    // Add questions based on topics
    topics.forEach((topic, index) => {
      questions.push({
        id: `assess-${Date.now()}-${index}`,
        type: 'multiple-choice',
        question: `Which of the following best describes ${topic}?`,
        options: [
          'A critical business process',
          'An optional enhancement',
          'A temporary measure',
          'None of the above'
        ],
        correctAnswer: '0'
      })
    })
    
    // Add some true/false questions
    questions.push({
      id: `assess-${Date.now()}-tf1`,
      type: 'true-false',
      question: 'This course covered all essential aspects of the subject matter.',
      correctAnswer: 'true'
    })
    
    questions.push({
      id: `assess-${Date.now()}-tf2`,
      type: 'true-false',
      question: 'Additional training is required before implementation.',
      correctAnswer: 'false'
    })
    
    return {
      questions,
      passMark: 80,
      narration: null
    }
  }

  /**
   * Generate rich text content with formatting
   */
  static generateRichTextContent(topicTitle: string): string {
    const templates = [
      `<h2>${topicTitle}</h2>
<p>Welcome to this comprehensive section on <strong>${topicTitle}</strong>. In this module, we will explore the key concepts and practical applications.</p>
<h3>Key Learning Points</h3>
<ul>
  <li>Understanding the fundamentals</li>
  <li>Practical implementation strategies</li>
  <li>Best practices and guidelines</li>
  <li>Common challenges and solutions</li>
</ul>
<blockquote>
  <p><em>"Excellence is not a destination but a continuous journey that never ends."</em></p>
</blockquote>
<p>By the end of this section, you will have a thorough understanding of how to apply these concepts in real-world scenarios.</p>`,

      `<h2>Introduction to ${topicTitle}</h2>
<p>This section focuses on <strong>${topicTitle}</strong> and its importance in modern organizations.</p>
<h3>Why This Matters</h3>
<ol>
  <li><strong>Efficiency:</strong> Streamlines processes and reduces waste</li>
  <li><strong>Quality:</strong> Ensures consistent high-quality outcomes</li>
  <li><strong>Compliance:</strong> Meets regulatory requirements</li>
</ol>
<div style="background-color: #f0f8ff; padding: 15px; border-left: 4px solid #0066cc;">
  <p><strong>Important Note:</strong> Always follow your organization's specific guidelines when implementing these practices.</p>
</div>`,

      `<h2>Mastering ${topicTitle}</h2>
<p>Let's dive deep into <strong>${topicTitle}</strong> and discover how it can transform your work.</p>
<h3>Core Components</h3>
<table border="1" style="width: 100%; border-collapse: collapse;">
  <tr>
    <th style="padding: 10px;">Component</th>
    <th style="padding: 10px;">Description</th>
    <th style="padding: 10px;">Impact</th>
  </tr>
  <tr>
    <td style="padding: 10px;">Foundation</td>
    <td style="padding: 10px;">Basic understanding and principles</td>
    <td style="padding: 10px;">High</td>
  </tr>
  <tr>
    <td style="padding: 10px;">Application</td>
    <td style="padding: 10px;">Practical implementation</td>
    <td style="padding: 10px;">Critical</td>
  </tr>
</table>`
    ]
    
    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Generate complete course content JSON
   */
  static generateCourseContentJSON(seedData: CourseSeedData): CourseContent {
    const topics: Topic[] = seedData.customTopics.map((topicTitle, index) => ({
      id: `topic-${index}`,
      title: topicTitle,
      content: this.generateRichTextContent(topicTitle),
      narration: `Welcome to the section on ${topicTitle}. This module will provide you with essential knowledge and practical skills.`,
      imageKeywords: [topicTitle.toLowerCase(), 'training', 'education'],
      imagePrompts: [`Professional setting showing ${topicTitle}`, `Infographic about ${topicTitle}`],
      videoSearchTerms: [`${topicTitle} tutorial`, `${topicTitle} explained`],
      duration: Math.floor(Math.random() * 5) + 3, // 3-7 minutes
      knowledgeCheck: {
        questions: this.generateKnowledgeCheckQuestions(topicTitle)
      }
    }))
    
    return {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: `<h1>Welcome to ${seedData.courseTitle}</h1>
<p>This comprehensive training course will equip you with the knowledge and skills needed to excel in your role.</p>
<h2>What You'll Learn</h2>
<p>Throughout this course, you will explore ${seedData.customTopics.length} key topics that form the foundation of this subject area.</p>`,
        narration: `Welcome to ${seedData.courseTitle}. We're excited to guide you through this comprehensive learning experience.`,
        imageKeywords: ['welcome', 'introduction', 'training'],
        imagePrompts: ['Modern office training environment', 'Diverse team in a learning setting'],
        videoSearchTerms: ['corporate training introduction'],
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: `<h1>Learning Objectives</h1>
<p>By the end of this course, you will be able to:</p>
<ul>
${seedData.customTopics.map(topic => `  <li>Understand and apply key concepts of ${topic}</li>`).join('\n')}
  <li>Implement best practices in real-world scenarios</li>
  <li>Demonstrate proficiency through assessment completion</li>
</ul>`,
        narration: 'Let\'s review the learning objectives for this course. These objectives will guide your learning journey.',
        imageKeywords: ['objectives', 'goals', 'learning'],
        imagePrompts: ['Learning objectives checklist', 'Target and goals visualization'],
        videoSearchTerms: ['setting learning objectives'],
        duration: 2
      },
      objectives: seedData.customTopics.map(topic => `Understand and apply ${topic}`),
      topics,
      assessment: this.generateAssessmentQuestions(seedData.customTopics)
    }
  }

  /**
   * Generate a canvas-based test image
   */
  static async generateTestImage(text: string = 'Test Image'): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')!
    
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 800, 600)
    gradient.addColorStop(0, '#4f46e5')
    gradient.addColorStop(1, '#7c3aed')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 800, 600)
    
    // Add some shapes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.arc(
        Math.random() * 800,
        Math.random() * 600,
        Math.random() * 100 + 50,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
    
    // Add text
    ctx.fillStyle = 'white'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 400, 300)
    
    // Add timestamp
    ctx.font = '24px Arial'
    ctx.fillText(new Date().toLocaleTimeString(), 400, 350)
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    })
  }

  /**
   * Generate mock audio data
   */
  static generateMockAudio(durationMs: number = 3000): Blob {
    // Create a simple sine wave audio
    const sampleRate = 44100
    const samples = (sampleRate * durationMs) / 1000
    const buffer = new Float32Array(samples)
    
    // Generate a pleasant tone (440Hz - A4 note)
    const frequency = 440
    for (let i = 0; i < samples; i++) {
      buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.1
    }
    
    // Convert to WAV format (simplified)
    const length = buffer.length * 2 // 16-bit
    const arrayBuffer = new ArrayBuffer(44 + length)
    const view = new DataView(arrayBuffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // fmt chunk size
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // Mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true) // block align
    view.setUint16(34, 16, true) // bits per sample
    writeString(36, 'data')
    view.setUint32(40, length, true)
    
    // Convert float samples to 16-bit PCM
    let offset = 44
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]))
      view.setInt16(offset, sample * 0x7FFF, true)
      offset += 2
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }

  /**
   * Get sample YouTube URLs for testing
   */
  static getTestYouTubeUrls(): string[] {
    return [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      'https://www.youtube.com/watch?v=9bZkp7q19f0',
      'https://www.youtube.com/watch?v=kJQP7kiw5Fk'
    ]
  }

  /**
   * Get test image URLs (using placeholder service)
   */
  static getTestImageUrls(): string[] {
    return [
      'https://via.placeholder.com/800x600/4f46e5/ffffff?text=Training+Image+1',
      'https://via.placeholder.com/800x600/7c3aed/ffffff?text=Training+Image+2',
      'https://via.placeholder.com/800x600/ec4899/ffffff?text=Training+Image+3',
      'https://via.placeholder.com/800x600/10b981/ffffff?text=Training+Image+4'
    ]
  }
}