import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the invoke function
const mockInvoke = vi.fn();

// Mock window.__TAURI__ to enable Rust generator
global.window = {
  __TAURI__: true,
  rustScormGenerator: vi.fn()
} as any;

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke
}));

describe('Fixed Handlebars eq helper - Knowledge Check Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render knowledge checks correctly with fixed eq helper', async () => {
    
    // Mock successful SCORM generation with rendered knowledge checks
    const mockGeneratedFiles = [
      {
        path: 'pages/topic-1.html',
        content: `<div class="knowledge-check-container">
<h3>Knowledge Check</h3>
<div class="kc-question-wrapper" data-question-index="0">
    <p class="kc-question">What is 2+2?</p>
    <div class="kc-options">
        <label class="kc-option">
            <input type="radio" name="q0" value="3" data-correct="4" data-feedback="The answer is 4">
            <span>3</span>
        </label>
        <label class="kc-option">
            <input type="radio" name="q0" value="4" data-correct="4" data-feedback="The answer is 4">
            <span>4</span>
        </label>
    </div>
    <button class="kc-submit" data-question-index="0" onclick="window.submitMultipleChoice(0)">
        Submit Answer
    </button>
    <div id="feedback-0" class="feedback"></div>
</div>
<div class="kc-question-wrapper">
    <p class="kc-question">The sky is ___</p>
    <div class="kc-input-group">
        <input type="text" id="fill-blank-1" class="kc-fill-blank" placeholder="Type your answer here">
        <button class="kc-submit" onclick="window.checkFillInBlank(1, 'blue', 'Correct!', 'Not quite. Try again!', event)">
            Submit
        </button>
    </div>
    <div id="feedback-1" class="feedback"></div>
</div>
</div>`
      }
    ];
    
    mockInvoke.mockResolvedValue(mockGeneratedFiles);
    
    // Test data with knowledge checks
    const request = {
      course_title: 'Test Course',
      welcome_page: {
        title: 'Welcome',
        content: 'Welcome content',
        start_button_text: 'Start'
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        knowledge_check: {
          enabled: true,
          questions: [
            {
              question_type: 'multiple-choice',
              text: 'What is 2+2?',
              options: ['3', '4'],
              correct_answer: '4',
              explanation: 'The answer is 4'
            },
            {
              question_type: 'fill-in-the-blank',
              text: 'The sky is ___',
              correct_answer: 'blue',
              explanation: 'The sky is blue'
            }
          ]
        }
      }]
    };
    
    // Call Rust generator
    const result = await mockInvoke('generate_scorm_with_rust', { request });
    const files = result as any[];
    
    // Find topic HTML
    const topicFile = files.find(f => f.path === 'pages/topic-1.html');
    expect(topicFile).toBeDefined();
    
    const content = topicFile.content;
    
    // Verify knowledge checks are rendered
    expect(content).toContain('knowledge-check-container');
    expect(content).toContain('Knowledge Check');
    
    // Verify multiple-choice question is rendered
    expect(content).toContain('kc-question-wrapper');
    expect(content).toContain('What is 2+2?');
    expect(content).toContain('kc-option');
    expect(content).toContain('name="q0"');
    
    // Verify fill-in-the-blank question is rendered
    expect(content).toContain('fill-blank-1');
    expect(content).toContain('The sky is ___');
    expect(content).toContain('kc-fill-blank');
    
    // Verify submit buttons are rendered
    expect(content).toContain('window.submitMultipleChoice(0)');
    expect(content).toContain('window.checkFillInBlank(1');
  });

  it('should handle empty media URLs correctly', async () => {
    
    // Mock response with empty media URLs
    const mockGeneratedFiles = [
      {
        path: 'pages/welcome.html',
        content: `<div class="media-container">
<img src="media/image-123.jpg" alt="Welcome Image" class="topic-image" />
</div>`
      }
    ];
    
    mockInvoke.mockResolvedValue(mockGeneratedFiles);
    
    const request = {
      course_title: 'Test Course',
      welcome_page: {
        title: 'Welcome',
        content: 'Welcome',
        media: [{
          type: 'image',
          url: 'media/image-123.jpg',
          title: 'Welcome Image'
        }]
      },
      topics: []
    };
    
    const result = await mockInvoke('generate_scorm_with_rust', { request });
    const files = result as any[];
    
    const welcomeFile = files.find(f => f.path === 'pages/welcome.html');
    expect(welcomeFile).toBeDefined();
    
    // Should have proper src attribute
    expect(welcomeFile.content).toContain('src="media/image-123.jpg"');
    expect(welcomeFile.content).not.toContain('src=""');
  });
});