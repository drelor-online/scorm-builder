/**
 * Test data generator for comprehensive SCORM Builder testing
 * Provides realistic test data for all components of the application
 */

export interface TestCourseData {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  template: 'Technical' | 'Business' | 'Academic' | 'Creative';
  topics: string[];
  objectives: string[];
  duration: number; // minutes
}

export interface TestProjectData {
  name: string;
  course: TestCourseData;
  media: {
    images: Array<{ name: string; description: string; size: number }>;
    videos: Array<{ name: string; description: string; duration: number }>;
    audio: Array<{ name: string; description: string; duration: number }>;
  };
  activities: Array<{
    type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'essay';
    question: string;
    options?: string[];
    correctAnswer?: string | number;
    points: number;
  }>;
}

/**
 * Generate realistic course data for different domains
 */
export const generateCourseData = (domain: 'technical' | 'business' | 'academic' | 'healthcare' = 'technical'): TestCourseData => {
  const courseTemplates = {
    technical: {
      title: 'Advanced TypeScript Development',
      description: 'Comprehensive course covering advanced TypeScript concepts, design patterns, and best practices for enterprise development.',
      difficulty: 'Advanced' as const,
      template: 'Technical' as const,
      topics: [
        'TypeScript Fundamentals',
        'Advanced Type System',
        'Generic Programming',
        'Decorators and Metadata',
        'Module Systems',
        'Testing Strategies',
        'Performance Optimization',
        'Design Patterns'
      ],
      objectives: [
        'Understand advanced TypeScript type system features',
        'Implement complex generic constraints and conditional types',
        'Apply design patterns in TypeScript applications',
        'Optimize TypeScript applications for performance',
        'Write comprehensive test suites for TypeScript code'
      ],
      duration: 480 // 8 hours
    },
    business: {
      title: 'Digital Marketing Strategy',
      description: 'Learn to develop and execute effective digital marketing campaigns across multiple channels.',
      difficulty: 'Intermediate' as const,
      template: 'Business' as const,
      topics: [
        'Market Research and Analysis',
        'Content Marketing Strategy',
        'Social Media Marketing',
        'Search Engine Optimization',
        'Pay-Per-Click Advertising',
        'Email Marketing Campaigns',
        'Analytics and Reporting',
        'Customer Journey Mapping'
      ],
      objectives: [
        'Develop comprehensive digital marketing strategies',
        'Create engaging content for multiple platforms',
        'Analyze marketing performance using analytics tools',
        'Optimize campaigns for better ROI',
        'Understand customer behavior and preferences'
      ],
      duration: 360 // 6 hours
    },
    academic: {
      title: 'Environmental Science Fundamentals',
      description: 'Introduction to environmental science principles, ecosystems, and sustainability practices.',
      difficulty: 'Beginner' as const,
      template: 'Academic' as const,
      topics: [
        'Ecosystem Dynamics',
        'Climate Change Science',
        'Biodiversity Conservation',
        'Pollution and Remediation',
        'Sustainable Development',
        'Environmental Policy',
        'Resource Management',
        'Scientific Research Methods'
      ],
      objectives: [
        'Understand fundamental environmental science concepts',
        'Analyze environmental problems and solutions',
        'Evaluate sustainability practices',
        'Interpret environmental data and research',
        'Apply scientific methods to environmental studies'
      ],
      duration: 600 // 10 hours
    },
    healthcare: {
      title: 'Patient Safety and Quality Care',
      description: 'Essential training on patient safety protocols, quality improvement, and healthcare best practices.',
      difficulty: 'Expert' as const,
      template: 'Academic' as const,
      topics: [
        'Patient Safety Fundamentals',
        'Error Prevention Strategies',
        'Infection Control Protocols',
        'Medication Safety',
        'Communication Skills',
        'Quality Improvement Methods',
        'Regulatory Compliance',
        'Emergency Response Procedures'
      ],
      objectives: [
        'Implement evidence-based patient safety practices',
        'Recognize and prevent medical errors',
        'Follow proper infection control procedures',
        'Communicate effectively with patients and families',
        'Participate in quality improvement initiatives'
      ],
      duration: 420 // 7 hours
    }
  };

  return courseTemplates[domain];
};

/**
 * Generate test project with complete data
 */
export const generateTestProject = (domain: 'technical' | 'business' | 'academic' | 'healthcare' = 'technical'): TestProjectData => {
  const course = generateCourseData(domain);
  
  return {
    name: `Test Project - ${course.title}`,
    course,
    media: {
      images: [
        { name: 'course-banner.jpg', description: 'Main course banner image', size: 245760 }, // 240KB
        { name: 'module-intro.png', description: 'Module introduction graphic', size: 102400 }, // 100KB
        { name: 'diagram-1.svg', description: 'Technical diagram illustration', size: 15360 }, // 15KB
        { name: 'screenshot-example.png', description: 'Interface screenshot', size: 512000 } // 500KB
      ],
      videos: [
        { name: 'welcome-video.mp4', description: 'Course welcome and overview', duration: 180 }, // 3 minutes
        { name: 'topic-demo.mp4', description: 'Practical demonstration', duration: 420 }, // 7 minutes
        { name: 'case-study.mp4', description: 'Real-world case study', duration: 600 } // 10 minutes
      ],
      audio: [
        { name: 'welcome-narration.mp3', description: 'Welcome audio narration', duration: 45 },
        { name: 'topic1-audio.mp3', description: 'Topic 1 audio explanation', duration: 180 },
        { name: 'topic2-audio.mp3', description: 'Topic 2 audio explanation', duration: 165 },
        { name: 'conclusion-audio.mp3', description: 'Course conclusion audio', duration: 90 }
      ]
    },
    activities: [
      {
        type: 'multiple-choice',
        question: `What is the primary focus of ${course.topics[0]}?`,
        options: [
          'Basic concepts and terminology',
          'Advanced implementation techniques',
          'Historical background only',
          'Future predictions and trends'
        ],
        correctAnswer: 0,
        points: 10
      },
      {
        type: 'true-false',
        question: `${course.topics[1]} is essential for understanding the overall subject matter.`,
        correctAnswer: 'true',
        points: 5
      },
      {
        type: 'fill-blank',
        question: `The main objective of this course is to help students _______ the key concepts.`,
        correctAnswer: 'understand',
        points: 8
      },
      {
        type: 'essay',
        question: `Describe how you would apply the concepts from ${course.topics[2]} in a real-world scenario.`,
        points: 15
      }
    ]
  };
};

/**
 * Generate invalid/corrupted test data for edge case testing
 */
export const generateInvalidCourseData = () => ({
  invalidJson: {
    title: '', // Empty title
    description: 'A'.repeat(10000), // Extremely long description
    difficulty: 'InvalidLevel' as any, // Invalid difficulty
    template: null as any, // Null template
    topics: [], // Empty topics array
    objectives: [''], // Empty objective
    duration: -1 // Negative duration
  },
  corruptedJson: '{"title":"Test","description":broken json here}',
  oversizedJson: JSON.stringify({
    title: 'Test Course',
    description: 'X'.repeat(1000000), // 1MB description
    topics: Array(10000).fill('Topic'), // Huge topics array
    objectives: Array(5000).fill('Objective')
  }),
  specialCharacters: {
    title: '🚀 Course with Émojis & Spéciål Chåråcters 中文',
    description: 'Testing unicode: 🎓📚💻 and special chars: <>&"\'',
    topics: [
      'Topic with "quotes"',
      'Topic with <html>',
      'Topic with \\ backslashes',
      'Topic with / forward slashes',
      'Topic with | pipes'
    ]
  }
});

/**
 * Generate test media files with various characteristics
 */
export const generateTestMediaData = () => ({
  validFiles: [
    { name: 'test-image.jpg', type: 'image/jpeg', size: 245760, content: 'fake-jpeg-data' },
    { name: 'test-video.mp4', type: 'video/mp4', size: 5242880, content: 'fake-mp4-data' },
    { name: 'test-audio.mp3', type: 'audio/mpeg', size: 1048576, content: 'fake-mp3-data' }
  ],
  invalidFiles: [
    { name: 'corrupt-image.jpg', type: 'image/jpeg', size: 100, content: 'not-actually-jpeg' },
    { name: 'oversized-video.mp4', type: 'video/mp4', size: 104857600, content: 'fake-huge-video' }, // 100MB
    { name: 'no-extension', type: 'application/octet-stream', size: 1024, content: 'unknown-file' },
    { name: 'empty-file.mp3', type: 'audio/mpeg', size: 0, content: '' }
  ],
  edgeCases: [
    { name: 'file with spaces.jpg', type: 'image/jpeg', size: 1024, content: 'space-test' },
    { name: 'file-with-unicode-名前.png', type: 'image/png', size: 2048, content: 'unicode-test' },
    { name: 'UPPERCASE-FILE.MP3', type: 'audio/mpeg', size: 4096, content: 'case-test' }
  ]
});

/**
 * Generate realistic captions/subtitle data
 */
export const generateCaptionData = () => ({
  validVTT: `WEBVTT

1
00:00:00.000 --> 00:00:05.000
Welcome to our comprehensive course on advanced development techniques.

2
00:00:05.000 --> 00:00:10.000
In this module, we'll explore the fundamental concepts that form the foundation.

3
00:00:10.000 --> 00:00:15.000
Let's begin by examining the key principles you'll need to understand.`,

  invalidVTT: `WEBVTT

1
Invalid timestamp format
This caption has broken timing information.

2
00:00:05.000 --> 00:00:02.000
This caption has end time before start time.`,

  largeCaptionFile: `WEBVTT\n\n` + Array(1000).fill(0).map((_, i) => 
    `${i + 1}\n${String(Math.floor(i * 5 / 60)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}.000 --> ${String(Math.floor((i + 1) * 5 / 60)).padStart(2, '0')}:${String(((i + 1) * 5) % 60).padStart(2, '0')}.000\nCaption ${i + 1} with some descriptive text about the content.`
  ).join('\n\n')
});

/**
 * Generate performance test scenarios
 */
export const generatePerformanceTestData = () => ({
  largeProject: {
    ...generateTestProject('technical'),
    media: {
      images: Array(50).fill(0).map((_, i) => ({
        name: `large-image-${i}.jpg`,
        description: `Large test image ${i}`,
        size: 2097152 // 2MB each
      })),
      videos: Array(10).fill(0).map((_, i) => ({
        name: `large-video-${i}.mp4`,
        description: `Large test video ${i}`,
        duration: 1800 // 30 minutes each
      })),
      audio: Array(20).fill(0).map((_, i) => ({
        name: `audio-file-${i}.mp3`,
        description: `Audio file ${i}`,
        duration: 300 // 5 minutes each
      }))
    }
  },
  
  extremeLoad: {
    name: 'Extreme Load Test Project',
    course: {
      ...generateCourseData('technical'),
      topics: Array(100).fill(0).map((_, i) => `Topic ${i + 1}: Advanced Concept`),
      objectives: Array(50).fill(0).map((_, i) => `Objective ${i + 1}: Learn advanced skills`)
    }
  }
});