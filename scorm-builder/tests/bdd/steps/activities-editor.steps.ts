import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

// Activities Editor Navigation
Given('I am on the Activities Editor step', async function (this) {
  await this.navigateToStep('Activities Editor');
  await this.page.waitForSelector('h2:has-text("Activities Editor")', { timeout: 10000 });
});

When('I navigate to the Activities Editor', async function (this) {
  await this.navigateToStep('Activities Editor');
});

// Question Types
When('I add a multiple choice question', async function (this) {
  const addButton = await this.page.locator('button:has-text("Add Question"), button:has-text("Add Multiple Choice")').first();
  await addButton.click();
  await this.page.waitForTimeout(500);
});

When('I add a true/false question', async function (this) {
  const addButton = await this.page.locator('button:has-text("Add True/False"), button:has-text("True or False")').first();
  await addButton.click();
  await this.page.waitForTimeout(500);
});

When('I add a fill in the blank question', async function (this) {
  const addButton = await this.page.locator('button:has-text("Fill in the Blank"), button:has-text("Add Blank")').first();
  await addButton.click();
  await this.page.waitForTimeout(500);
});

When('I add a matching question', async function (this) {
  const addButton = await this.page.locator('button:has-text("Matching"), button:has-text("Add Matching")').first();
  await addButton.click();
  await this.page.waitForTimeout(500);
});

// Question Content
When('I set the question text to {string}', async function (this, questionText) {
  const questionInput = await this.page.locator('input[placeholder*="question"], textarea[placeholder*="question"], .question-text').first();
  await questionInput.clear();
  await questionInput.fill(questionText);
  await this.page.waitForTimeout(300);
});

When('I add answer option {string}', async function (this, answerText) {
  const addOptionButton = await this.page.locator('button:has-text("Add Option"), button:has-text("Add Answer")').first();
  await addOptionButton.click();
  
  const newOptionInput = await this.page.locator('input[placeholder*="answer"], .answer-input').last();
  await newOptionInput.fill(answerText);
  await this.page.waitForTimeout(300);
});

When('I mark answer {string} as correct', async function (this, answerText) {
  const answerRow = await this.page.locator(`.answer-option:has-text("${answerText}"), .option-row:has-text("${answerText}")`).first();
  const correctCheckbox = await answerRow.locator('input[type="checkbox"], input[type="radio"]').first();
  await correctCheckbox.check();
  await this.page.waitForTimeout(300);
});

When('I set the correct answer to {string}', async function (this, correctAnswer) {
  if (correctAnswer.toLowerCase() === 'true' || correctAnswer.toLowerCase() === 'false') {
    // For true/false questions
    const radioButton = await this.page.locator(`input[value="${correctAnswer}"], label:has-text("${correctAnswer}") input`).first();
    await radioButton.check();
  } else {
    // For text input
    const correctAnswerInput = await this.page.locator('input[placeholder*="correct answer"], .correct-answer-input').first();
    await correctAnswerInput.fill(correctAnswer);
  }
  await this.page.waitForTimeout(300);
});

// Feedback
When('I add feedback {string} for correct answers', async function (this, feedback) {
  const feedbackInput = await this.page.locator('textarea[placeholder*="correct feedback"], .correct-feedback').first();
  await feedbackInput.fill(feedback);
  await this.page.waitForTimeout(300);
});

When('I add feedback {string} for incorrect answers', async function (this, feedback) {
  const feedbackInput = await this.page.locator('textarea[placeholder*="incorrect feedback"], .incorrect-feedback').first();
  await feedbackInput.fill(feedback);
  await this.page.waitForTimeout(300);
});

// Question Management
When('I delete question {int}', async function (this, questionNumber) {
  const questions = await this.page.locator('.question-item, .question-card');
  const targetQuestion = questions.nth(questionNumber - 1);
  const deleteButton = await targetQuestion.locator('button:has-text("Delete"), button.delete-question').first();
  await deleteButton.click();
  
  // Confirm deletion if needed
  const confirmButton = await this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
  if (await confirmButton.isVisible({ timeout: 1000 })) {
    await confirmButton.click();
  }
  
  await this.page.waitForTimeout(500);
});

When('I duplicate question {int}', async function (this, questionNumber) {
  const questions = await this.page.locator('.question-item, .question-card');
  const targetQuestion = questions.nth(questionNumber - 1);
  const duplicateButton = await targetQuestion.locator('button:has-text("Duplicate"), button.duplicate-question').first();
  await duplicateButton.click();
  await this.page.waitForTimeout(500);
});

When('I move question {int} up', async function (this, questionNumber) {
  const questions = await this.page.locator('.question-item, .question-card');
  const targetQuestion = questions.nth(questionNumber - 1);
  const moveUpButton = await targetQuestion.locator('button[aria-label*="up"], button.move-up').first();
  await moveUpButton.click();
  await this.page.waitForTimeout(500);
});

When('I move question {int} down', async function (this, questionNumber) {
  const questions = await this.page.locator('.question-item, .question-card');
  const targetQuestion = questions.nth(questionNumber - 1);
  const moveDownButton = await targetQuestion.locator('button[aria-label*="down"], button.move-down').first();
  await moveDownButton.click();
  await this.page.waitForTimeout(500);
});

// Knowledge Check vs Assessment
When('I switch to knowledge check mode', async function (this) {
  const modeToggle = await this.page.locator('button:has-text("Knowledge Check"), input[value="knowledge-check"]').first();
  if (await modeToggle.getAttribute('type') === 'radio' || await modeToggle.getAttribute('type') === 'checkbox') {
    await modeToggle.check();
  } else {
    await modeToggle.click();
  }
  await this.page.waitForTimeout(500);
});

When('I switch to assessment mode', async function (this) {
  const modeToggle = await this.page.locator('button:has-text("Assessment"), input[value="assessment"]').first();
  if (await modeToggle.getAttribute('type') === 'radio' || await modeToggle.getAttribute('type') === 'checkbox') {
    await modeToggle.check();
  } else {
    await modeToggle.click();
  }
  await this.page.waitForTimeout(500);
});

// Settings
When('I set the passing score to {int}%', async function (this, score) {
  const scoreInput = await this.page.locator('input[placeholder*="passing score"], input[name*="passing"]').first();
  await scoreInput.fill(String(score));
  await this.page.waitForTimeout(300);
});

When('I enable question randomization', async function (this) {
  const randomizeCheckbox = await this.page.locator('input[type="checkbox"][name*="random"], label:has-text("Randomize") input').first();
  await randomizeCheckbox.check();
  await this.page.waitForTimeout(300);
});

When('I set the maximum attempts to {int}', async function (this, attempts) {
  const attemptsInput = await this.page.locator('input[placeholder*="attempts"], input[name*="attempts"]').first();
  await attemptsInput.fill(String(attempts));
  await this.page.waitForTimeout(300);
});

// Validation
Then('I should see {int} questions in the editor', async function (this, expectedCount) {
  const questions = await this.page.locator('.question-item, .question-card');
  await expect(questions).toHaveCount(expectedCount, { timeout: 5000 });
});

Then('question {int} should have text {string}', async function (this, questionNumber, expectedText) {
  const questions = await this.page.locator('.question-item, .question-card');
  const targetQuestion = questions.nth(questionNumber - 1);
  const questionText = await targetQuestion.locator('.question-text, h3, h4').first();
  await expect(questionText).toHaveText(expectedText);
});

Then('I should see a validation error for missing correct answer', async function (this) {
  const errorMessage = await this.page.locator('.error:has-text("correct answer"), .validation-error:has-text("answer")').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

Then('I should see a validation error for duplicate questions', async function (this) {
  const errorMessage = await this.page.locator('.error:has-text("duplicate"), .validation-error:has-text("same")').first();
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

// Preview
When('I preview the knowledge check', async function (this) {
  const previewButton = await this.page.locator('button:has-text("Preview"), button:has-text("Test")').first();
  await previewButton.click();
  await this.page.waitForTimeout(1000);
});

Then('I should see the knowledge check in preview mode', async function (this) {
  const previewContainer = await this.page.locator('.preview-mode, .knowledge-check-preview, .assessment-preview').first();
  await expect(previewContainer).toBeVisible({ timeout: 5000 });
});

// Import/Export
When('I import questions from JSON', async function (this) {
  const importButton = await this.page.locator('button:has-text("Import"), button:has-text("Load Questions")').first();
  await importButton.click();
  
  // Assuming there's a file input that appears
  const fileInput = await this.page.locator('input[type="file"][accept*="json"]');
  const filePath = './fixtures/questions.json';
  await fileInput.setInputFiles(filePath);
  
  await this.page.waitForTimeout(1000);
});

When('I export questions to JSON', async function (this) {
  const exportButton = await this.page.locator('button:has-text("Export"), button:has-text("Download Questions")').first();
  await exportButton.click();
  await this.page.waitForTimeout(1000);
});

// Question Bank
When('I add question to the question bank', async function (this) {
  const addToBankButton = await this.page.locator('button:has-text("Add to Bank"), button:has-text("Save to Bank")').first();
  await addToBankButton.click();
  await this.page.waitForTimeout(500);
});

When('I load a question from the question bank', async function (this) {
  const loadFromBankButton = await this.page.locator('button:has-text("Question Bank"), button:has-text("Browse Bank")').first();
  await loadFromBankButton.click();
  
  // Select first question from bank
  const firstQuestion = await this.page.locator('.bank-question-item').first();
  await firstQuestion.click();
  
  const selectButton = await this.page.locator('button:has-text("Select"), button:has-text("Add Selected")').first();
  await selectButton.click();
  
  await this.page.waitForTimeout(500);
});

// Scoring
Then('the total points should be {int}', async function (this, expectedPoints) {
  const pointsDisplay = await this.page.locator('.total-points, .score-display').first();
  const text = await pointsDisplay.textContent();
  expect(text).toContain(String(expectedPoints));
});

When('I set question {int} point value to {int}', async function (this, questionNumber, points) {
  const questions = await this.page.locator('.question-item, .question-card');
  const targetQuestion = questions.nth(questionNumber - 1);
  const pointsInput = await targetQuestion.locator('input[placeholder*="points"], input[name*="points"]').first();
  await pointsInput.fill(String(points));
  await this.page.waitForTimeout(300);
});

// Categories/Tags
When('I add tag {string} to question {int}', async function (this, tag, questionNumber) {
  const questions = await this.page.locator('.question-item, .question-card');
  const targetQuestion = questions.nth(questionNumber - 1);
  const tagInput = await targetQuestion.locator('input[placeholder*="tag"], .tag-input').first();
  await tagInput.fill(tag);
  await tagInput.press('Enter');
  await this.page.waitForTimeout(300);
});

When('I filter questions by tag {string}', async function (this, tag) {
  const filterInput = await this.page.locator('input[placeholder*="filter"], input[placeholder*="search"]').first();
  await filterInput.fill(tag);
  await this.page.waitForTimeout(500);
});

// Explanations
When('I add explanation {string} to question {int}', async function (this, explanation, questionNumber) {
  const questions = await this.page.locator('.question-item, .question-card');
  const targetQuestion = questions.nth(questionNumber - 1);
  const explanationInput = await targetQuestion.locator('textarea[placeholder*="explanation"], .explanation-input').first();
  await explanationInput.fill(explanation);
  await this.page.waitForTimeout(300);
});

// Validation for specific question types
Then('the matching question should have {int} pairs', async function (this, expectedPairs) {
  const matchingPairs = await this.page.locator('.matching-pair, .match-item');
  await expect(matchingPairs).toHaveCount(expectedPairs, { timeout: 5000 });
});

When('I add matching pair {string} to {string}', async function (this, leftItem, rightItem) {
  const addPairButton = await this.page.locator('button:has-text("Add Pair"), button:has-text("Add Match")').first();
  await addPairButton.click();
  
  const leftInput = await this.page.locator('.left-item input, input[placeholder*="term"]').last();
  await leftInput.fill(leftItem);
  
  const rightInput = await this.page.locator('.right-item input, input[placeholder*="definition"]').last();
  await rightInput.fill(rightItem);
  
  await this.page.waitForTimeout(300);
});