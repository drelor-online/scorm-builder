export interface CourseSeedData {
  courseTitle: string
  difficulty: number
  customTopics: string[]
  template: CourseTemplate
  templateTopics: string[]
}

export type CourseTemplate = 
  'None' | 
  'How-to Guide' |
  'Corporate' |
  'Technical' |
  'Safety' |
  'Business Development' |
  'Human Resources'

export interface TemplateTopics {
  [key: string]: string[]
}

export const templateTopics: TemplateTopics = {
  'How-to Guide': [
    'Introduction and Overview',
    'Prerequisites and Requirements',
    'Step-by-Step Instructions',
    'Common Mistakes to Avoid',
    'Troubleshooting Tips',
    'Best Practices',
    'Advanced Techniques',
    'Tools and Resources',
    'Practice Exercises',
    'Summary and Next Steps'
  ],
  'Corporate': [
    'Company Mission and Values',
    'Organizational Structure',
    'Policies and Procedures',
    'Code of Conduct',
    'Benefits and Compensation',
    'Performance Management',
    'Career Development',
    'Corporate Culture',
    'Communication Standards',
    'Compliance Requirements'
  ],
  'Technical': [
    'Introduction and Overview',
    'Fundamental Concepts',
    'Key Requirements',
    'Applications and Use Cases',
    'Standards and Compliance',
    'Common Practices',
    'Implementation Guidelines',
    'Troubleshooting and Solutions',
    'Recent Updates and Changes',
    'Resources and References'
  ],
  'Safety': [
    'Safety Fundamentals',
    'Hazard Identification',
    'Risk Assessment',
    'Personal Protective Equipment',
    'Emergency Procedures',
    'Incident Reporting',
    'Safety Regulations',
    'Continuous Improvement',
    'Safety Training',
    'Safety Culture'
  ],
  'Business Development': [
    'Market Analysis',
    'Customer Segmentation',
    'Value Proposition',
    'Sales Strategy',
    'Partnership Opportunities',
    'Competitive Analysis',
    'Growth Metrics',
    'Strategic Planning',
    'Lead Generation',
    'Revenue Optimization'
  ],
  'Human Resources': [
    'Recruitment and Hiring',
    'Onboarding Process',
    'Employee Relations',
    'Training and Development',
    'Performance Reviews',
    'Compensation and Benefits',
    'HR Policies',
    'Workplace Culture',
    'Employee Engagement',
    'Organizational Development'
  ]
}

export interface CourseContent {
  welcomePage: Page;
  learningObjectivesPage: Page;
  topics: Topic[];
  assessment: Assessment;
}

export interface Page {
  id: string;
  title: string;
  content: string;
  narration: string;
  imageKeywords: string[];
  imagePrompts: string[];
  videoSearchTerms: string[];
  duration: number;
}

export interface Topic extends Page {
  knowledgeCheck: KnowledgeCheck;
}

export interface Assessment {
  questions: AssessmentQuestion[];
  passMark: number;
  narration: string;
}

export interface KnowledgeCheck {
  questions: AssessmentQuestion[];
}

export interface AssessmentQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-in-the-blank';
  question: string;
  options?: string[];
  correctAnswer: string;
  feedback: {
    correct: string;
    incorrect: string;
  };
}
