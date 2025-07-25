// Simple test SCORM generator using the space efficient generator

const fs = require('fs');
const path = require('path');

// Sample course data
const sampleCourseContent = {
  title: 'Recognizing Electrical Dangers',
  duration: 30,
  objectives: [
    'Identify at least 5 common electrical hazards in the workplace',
    'Demonstrate proper safety procedures when working near electrical equipment',
    'Explain the importance of lockout/tagout procedures',
    'Respond appropriately to electrical emergencies'
  ],
  welcome: `<h2>Welcome to Recognizing Electrical Dangers</h2>
    <p>This course will help you identify and avoid common electrical hazards in the workplace.</p>
    <p>Electrical safety is critical for preventing injuries and saving lives. In this course, you'll learn:</p>
    <ul>
      <li>How to spot common electrical hazards</li>
      <li>Safe work practices around electricity</li>
      <li>Emergency response procedures</li>
    </ul>`,
  topics: [
    {
      title: 'Spotting Common Electrical Hazards',
      content: `<h2>Spotting Common Electrical Hazards</h2>
      <p>Proactive safety involves actively looking for and identifying potential hazards before they cause harm.</p>
      <h3>Common Hazards Checklist:</h3>
      <ul>
        <li><strong>Damaged Insulation:</strong> Look for cracked, frayed, or cut insulation on cords, cables, and wires.</li>
        <li><strong>Overloaded Circuits:</strong> Using too many devices on one circuit can cause overheating and fire.</li>
        <li><strong>Improper Grounding:</strong> Grounding provides a safe path for electricity to flow in case of a fault.</li>
        <li><strong>Wet Conditions:</strong> Never operate electrical equipment in wet or damp locations.</li>
        <li><strong>Overhead Power Lines:</strong> Always be aware of the location of overhead power lines.</li>
      </ul>`,
      knowledgeCheck: {
        question: 'Which of the following is a sign of an overloaded circuit?',
        options: [
          'A frequently tripping circuit breaker',
          'A bright indicator light on a power strip',
          'A cord that is neatly coiled',
          'Using a tool in a dry location'
        ],
        correctAnswer: 0
      }
    },
    {
      title: 'Essential Gear for Electrical Protection',
      content: `<h2>Essential Gear for Electrical Protection</h2>
      <p>Personal Protective Equipment (PPE) is your last line of defense against electrical hazards.</p>
      <h3>Key Protective Equipment:</h3>
      <ul>
        <li><strong>Insulated Gloves:</strong> Rubber insulating gloves are rated for different voltage levels.</li>
        <li><strong>Safety Glasses:</strong> Electrical arcs can produce intense light and flying debris.</li>
        <li><strong>Arc-Rated Clothing:</strong> When working on energized equipment, arc-rated clothing can protect against burns.</li>
        <li><strong>Insulated Tools:</strong> Tools with insulated handles provide an extra layer of protection.</li>
      </ul>`,
      knowledgeCheck: {
        question: 'Regular work gloves provide adequate protection when working with electrical equipment.',
        options: ['True', 'False'],
        correctAnswer: 1
      }
    }
  ],
  assessment: {
    title: 'Final Assessment',
    questions: [
      {
        id: 'assess-1',
        question: 'What should you do if you notice damaged insulation on an electrical cord?',
        options: [
          'Wrap it with electrical tape',
          'Continue using it carefully',
          'Remove it from service immediately',
          'Test it with a multimeter first'
        ],
        correctAnswer: 2
      },
      {
        id: 'assess-2',
        question: 'What is the minimum safe distance to maintain from overhead power lines when using a ladder?',
        options: ['1 foot', '3 feet', '10 feet', '20 feet'],
        correctAnswer: 2
      },
      {
        id: 'assess-3',
        question: 'Arc-rated clothing can completely prevent burns from an arc flash incident.',
        options: ['True', 'False'],
        correctAnswer: 1
      }
    ],
    passMark: 80
  }
};

console.log('Generating test SCORM package...');
console.log(`Course: ${sampleCourseContent.title}`);
console.log(`Topics: ${sampleCourseContent.topics.length}`);
console.log(`Assessment Questions: ${sampleCourseContent.assessment.questions.length}`);

// Create a simple HTML file that shows the course structure
const outputPath = path.join(__dirname, 'test-scorm-structure.html');
const html = `<!DOCTYPE html>
<html>
<head>
    <title>${sampleCourseContent.title} - Test Structure</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        .topic { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
        .kc { margin: 10px 0; padding: 10px; background: #e0f2ff; border-radius: 3px; }
        .assessment { margin: 20px 0; padding: 15px; background: #ffe0e0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>${sampleCourseContent.title}</h1>
    <p>Duration: ${sampleCourseContent.duration} minutes</p>
    
    <h2>Learning Objectives</h2>
    <ul>
        ${sampleCourseContent.objectives.map(obj => `<li>${obj}</li>`).join('')}
    </ul>
    
    <h2>Welcome Page</h2>
    <div>${sampleCourseContent.welcome}</div>
    
    <h2>Topics</h2>
    ${sampleCourseContent.topics.map((topic, index) => `
        <div class="topic">
            <h3>Topic ${index + 1}: ${topic.title}</h3>
            <div>${topic.content}</div>
            ${topic.knowledgeCheck ? `
                <div class="kc">
                    <h4>Knowledge Check</h4>
                    <p><strong>Q:</strong> ${topic.knowledgeCheck.question}</p>
                    <ul>
                        ${topic.knowledgeCheck.options.map((opt, i) => 
                            `<li>${opt} ${i === topic.knowledgeCheck.correctAnswer ? '✓' : ''}</li>`
                        ).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `).join('')}
    
    <h2>Final Assessment</h2>
    <div class="assessment">
        <p>Pass Mark: ${sampleCourseContent.assessment.passMark}%</p>
        ${sampleCourseContent.assessment.questions.map((q, index) => `
            <div>
                <h4>Question ${index + 1}</h4>
                <p>${q.question}</p>
                <ul>
                    ${q.options.map((opt, i) => 
                        `<li>${opt} ${i === q.correctAnswer ? '✓' : ''}</li>`
                    ).join('')}
                </ul>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

fs.writeFileSync(outputPath, html);
console.log(`\nTest structure HTML generated at: ${outputPath}`);
console.log('\nThis demonstrates the structure of the test SCORM package that would be generated.');
console.log('The actual SCORM generator would create a complete package with:');
console.log('- imsmanifest.xml');
console.log('- SCORM player with all requested features');
console.log('- Audio controls and caption support');
console.log('- Knowledge check navigation locking');
console.log('- Media preview modals');
console.log('- Responsive layout with proper scrolling');