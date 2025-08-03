/**
 * Test script to verify navigation blocking fix
 */

const fs = require('fs');
const path = require('path');
const { generateSpaceEfficientSCORM12 } = require('./src/services/spaceEfficientScormGenerator');

async function testNavigationFix() {
    console.log('Testing navigation blocking fix...\n');

    const courseContent = {
        courseName: 'Navigation Fix Test',
        passMark: 80,
        navigationMode: 'linear',
        allowRetake: true,
        welcome: {
            title: 'Welcome',
            content: 'Testing navigation blocking',
            startButtonText: 'Start'
        },
        learningObjectivesPage: {
            objectives: ['Test navigation blocking']
        },
        topics: [{
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
        }, {
            id: 'topic-2',
            blockId: 'block-2',
            title: 'Topic without Knowledge Check',
            content: 'This topic has no knowledge check.'
        }],
        assessment: {
            questions: []
        }
    };

    const outputPath = path.join(__dirname, 'test-output', 'nav-fix-test');
    
    try {
        await generateSpaceEfficientSCORM12(courseContent, outputPath);
        console.log('✓ SCORM package generated successfully\n');

        // Check navigation.js
        const navJsPath = path.join(outputPath, 'scripts', 'navigation.js');
        const navJs = fs.readFileSync(navJsPath, 'utf8');

        // Check if updateNavigationState is in the promise chain
        const promiseChainMatch = navJs.match(/initializePageAudio\(pageId\);[\s\S]*?updateNavigationState\(\);[\s\S]*?\}\)/);
        if (promiseChainMatch) {
            console.log('✓ updateNavigationState() is now inside the promise chain');
            console.log('  This ensures it runs AFTER page content is loaded\n');
        } else {
            console.log('✗ updateNavigationState() is NOT in the promise chain');
            console.log('  Navigation blocking may not work correctly\n');
        }

        // Check topic-1.html
        const topicPath = path.join(outputPath, 'pages', 'topic-1.html');
        const topicHtml = fs.readFileSync(topicPath, 'utf8');

        if (topicHtml.includes('data-has-knowledge-check="true"')) {
            console.log('✓ Topic page has knowledge check flag');
        }

        if (topicHtml.includes('type="text"')) {
            console.log('✓ Fill-in-blank input field generated');
        }

        if (topicHtml.includes('checkFillInBlank')) {
            console.log('✓ Submit button calls checkFillInBlank function');
        }

        console.log('\nTest complete! Check test-output/nav-fix-test/index.html in browser');
        console.log('1. Navigate to Topic 1');
        console.log('2. Try clicking Next without answering - should show alert');
        console.log('3. Next button should be disabled visually');

    } catch (error) {
        console.error('Error:', error);
    }
}

testNavigationFix();