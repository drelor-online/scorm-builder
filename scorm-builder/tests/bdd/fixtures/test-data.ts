export const testData = {
  validCourse: {
    title: 'Introduction to TypeScript',
    audience: 'JavaScript developers learning TypeScript',
    duration: 30,
    topics: [
      'TypeScript Basics',
      'Types and Interfaces',
      'Classes and Modules',
      'Advanced Types',
      'TypeScript with React'
    ]
  },

  templates: {
    software: {
      name: 'Software Training',
      title: 'Software Application Training',
      audience: 'New users of the software',
      duration: 30,
      topics: [
        'Getting Started',
        'Basic Features',
        'Advanced Features',
        'Tips and Tricks',
        'Troubleshooting'
      ]
    }
  },

  aiResponse: {
    minimal: {
      title: 'Test Course',
      objectives: ['Learn basics'],
      welcomeMessage: 'Welcome!',
      topics: [{
        id: 'topic-1',
        title: 'Introduction',
        content: 'Basic introduction content'
      }],
      assessment: {
        questions: [{
          question: 'Test question?',
          options: ['Option A', 'Option B'],
          correctAnswer: 0
        }]
      }
    },
    
    complete: {
      title: 'Introduction to BDD Testing',
      objectives: [
        'Understand BDD principles and benefits',
        'Write effective Gherkin scenarios',
        'Implement step definitions',
        'Set up BDD test automation'
      ],
      welcomeMessage: 'Welcome to this comprehensive course on Behavior-Driven Development (BDD) Testing! This course will teach you how to bridge the gap between business requirements and test automation.',
      topics: [
        {
          id: 'topic-1',
          title: 'What is BDD?',
          content: `<h2>Understanding Behavior-Driven Development</h2>
          <p>Behavior-Driven Development (BDD) is a software development approach that evolved from Test-Driven Development (TDD). It emphasizes collaboration between developers, QA engineers, and business stakeholders.</p>
          <p>Key principles of BDD include:</p>
          <ul>
            <li>Writing tests in a business-readable language</li>
            <li>Focusing on the behavior of the system</li>
            <li>Encouraging collaboration across teams</li>
            <li>Creating living documentation</li>
          </ul>`
        },
        {
          id: 'topic-2',
          title: 'Writing Gherkin Scenarios',
          content: `<h2>The Gherkin Language</h2>
          <p>Gherkin is a business-readable, domain-specific language that describes software behavior without detailing implementation. It uses a simple syntax with keywords:</p>
          <ul>
            <li><strong>Feature:</strong> High-level description of a software feature</li>
            <li><strong>Scenario:</strong> A specific example of the feature</li>
            <li><strong>Given:</strong> Initial context or state</li>
            <li><strong>When:</strong> An action or event</li>
            <li><strong>Then:</strong> Expected outcome</li>
          </ul>`
        },
        {
          id: 'topic-3',
          title: 'Implementing Step Definitions',
          content: `<h2>Connecting Gherkin to Code</h2>
          <p>Step definitions are the glue between Gherkin scenarios and your automation code. Each Gherkin step is matched to a step definition using regular expressions or cucumber expressions.</p>
          <p>Best practices for step definitions:</p>
          <ul>
            <li>Keep them simple and focused</li>
            <li>Reuse common steps</li>
            <li>Use page objects for UI interactions</li>
            <li>Handle test data properly</li>
          </ul>`
        }
      ],
      assessment: {
        questions: [
          {
            question: 'What does BDD stand for?',
            options: [
              'Behavior-Driven Development',
              'Bug-Driven Development',
              'Business-Driven Development',
              'Browser-Driven Development'
            ],
            correctAnswer: 0
          },
          {
            question: 'Which of the following is NOT a Gherkin keyword?',
            options: [
              'Given',
              'When',
              'Then',
              'Should'
            ],
            correctAnswer: 3
          },
          {
            question: 'What connects Gherkin scenarios to automation code?',
            options: [
              'Feature files',
              'Step definitions',
              'Cucumber hooks',
              'Page objects'
            ],
            correctAnswer: 1
          }
        ]
      }
    }
  },

  media: {
    validImage: {
      name: 'course-banner.jpg',
      type: 'image/jpeg',
      size: 500000, // 500KB
      content: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='
    },
    
    largeImage: {
      name: 'large-image.jpg',
      type: 'image/jpeg',
      size: 15000000 // 15MB - too large
    },

    youtubeVideo: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      title: 'Sample Video'
    }
  },

  knowledgeCheck: {
    multipleChoice: {
      question: 'What is the main goal of BDD?',
      type: 'multiple-choice',
      options: [
        'Write more unit tests',
        'Improve collaboration between teams',
        'Reduce the number of bugs',
        'Speed up development'
      ],
      correctAnswer: 1,
      feedback: {
        correct: 'Correct! BDD focuses on improving collaboration.',
        incorrect: 'Not quite. BDD primarily aims to improve collaboration between teams.'
      }
    },

    trueFalse: {
      question: 'BDD requires writing tests before code.',
      type: 'true-false',
      options: ['True', 'False'],
      correctAnswer: 0,
      feedback: {
        correct: 'Correct! BDD follows a test-first approach.',
        incorrect: 'Actually, BDD does require writing tests (scenarios) before implementation.'
      }
    },

    fillInBlank: {
      question: 'The three main keywords in Gherkin are Given, _____, and Then.',
      type: 'fill-in-the-blank',
      correctAnswer: 'When',
      feedback: {
        correct: 'Correct! Given-When-Then is the standard format.',
        incorrect: 'The correct answer is "When". The pattern is Given-When-Then.'
      }
    }
  },

  scormConfig: {
    version12: {
      version: '1.2',
      passMark: 80,
      completionCriteria: 'visited',
      allowRetake: true,
      navigationMode: 'free'
    },
    
    version2004: {
      version: '2004',
      passMark: 70,
      completionCriteria: 'passed',
      allowRetake: false,
      navigationMode: 'linear'
    }
  }
}

// Helper function to create a file blob
export function createFileBlob(content: string, type: string): Blob {
  return new Blob([content], { type })
}

// Helper function to create an image file
export function createImageFile(name: string = 'test-image.jpg'): File {
  const blob = createFileBlob(testData.media.validImage.content, 'image/jpeg')
  return new File([blob], name, { type: 'image/jpeg' })
}

// Helper function to create course JSON
export function createCourseJSON(data: any = testData.aiResponse.complete): string {
  return JSON.stringify(data, null, 2)
}