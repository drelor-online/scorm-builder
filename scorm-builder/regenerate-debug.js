// This script is deprecated - the spaceEfficientScormGenerator has been removed
// Use the Rust SCORM generator instead via rustScormGenerator.ts

console.error('ERROR: This debug script uses the deprecated spaceEfficientScormGenerator');
console.error('The TypeScript SCORM generator has been removed in favor of the Rust implementation.');
console.error('Use the application UI or rustScormGenerator.ts to generate SCORM packages.');
process.exit(1);

/* Original code commented out for reference:
import { generateSpaceEfficientSCORM12 } from './src/services/spaceEfficientScormGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function regenerateDebugPackage() {
    console.log('Regenerating debug SCORM package with navigation fix...\n');

    const courseContent = {
        courseName: 'Debug Test Course',
        passMark: 80,
        navigationMode: 'linear',
        allowRetake: true,
        welcome: {
            title: 'Welcome',
            content: 'This is a test course for debugging navigation blocking.',
            startButtonText: 'Start Course'
        },
        learningObjectivesPage: {
            objectives: ['Test navigation blocking', 'Test fill-in-blank questions']
        },
        topics: [
            {
                id: 'topic-1',
                blockId: 'block-1',
                title: 'Topic with Fill-in-Blank',
                content: 'This topic has a fill-in-blank knowledge check.',
                knowledgeCheck: {
                    enabled: true,
                    questions: [{
                        type: 'fill-in-the-blank',
                        text: 'The capital of France is _____.',
                        correctAnswer: 'Paris',
                        explanation: 'Paris is the capital of France.'
                    }]
                }
            },
            {
                id: 'topic-2',
                blockId: 'block-2',
                title: 'Topic with Multiple Choice',
                content: 'This topic has a multiple choice knowledge check.',
                knowledgeCheck: {
                    enabled: true,
                    questions: [{
                        type: 'multiple-choice',
                        text: 'What is 2 + 2?',
                        options: ['3', '4', '5', '6'],
                        correctAnswer: '4',
                        explanation: 'Basic arithmetic: 2 + 2 = 4'
                    }]
                }
            },
            {
                id: 'topic-3',
                blockId: 'block-3',
                title: 'Topic without Knowledge Check',
                content: 'This topic has no knowledge check, so navigation should not be blocked.'
            }
        ],
        assessment: {
            questions: [{
                type: 'multiple-choice',
                text: 'Navigation should be blocked on pages with unanswered knowledge checks.',
                options: ['True', 'False'],
                correctAnswer: 'True',
                explanation: 'Correct! Navigation is blocked until knowledge checks are answered.'
            }]
        }
    };

    const outputPath = path.join(__dirname, 'test-output', 'scorm-debug');
    
    try {
        await generateSpaceEfficientSCORM12(courseContent, outputPath);
        console.log('✓ SCORM package regenerated successfully');
        console.log(`✓ Output location: ${outputPath}`);
        console.log('\nThe navigation fix has been applied:');
        console.log('- updateNavigationState() now runs AFTER page content loads');
        console.log('- This ensures the Next button is properly disabled on pages with knowledge checks\n');
        console.log('Test the fix:');
        console.log('1. Run: python -m http.server 8080');
        console.log('2. Open: http://localhost:8080/test-output/scorm-debug/');
        console.log('3. Navigate to Topic 1');
        console.log('4. The Next button should be disabled immediately');
        console.log('5. Try clicking Next - should show alert');
        console.log('6. Answer the question - Next button should enable');
    } catch (error) {
        console.error('Error regenerating package:', error);
    }
}

regenerateDebugPackage();