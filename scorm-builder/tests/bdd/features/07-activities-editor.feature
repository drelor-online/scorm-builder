Feature: Activities Editor Step
  As a course creator
  I want to edit knowledge checks and assessments
  So that I can customize the learning activities

  Background:
    Given I have completed the Audio Narration step
    And I am on the Activities Editor step
    And I can see all knowledge checks and assessment questions

  @knowledge-check-display
  Scenario: View all knowledge checks
    Then I should see sections for:
      | Section Type      | Count |
      | Knowledge Checks  | 5     |
      | Assessment Quiz   | 1     |
    
    And each knowledge check should show:
      | Element           | Visible |
      | Topic title       | Yes     |
      | Question text     | Yes     |
      | Answer options    | Yes     |
      | Correct answer    | Yes     |
      | Feedback messages | Yes     |

  @edit-question
  Scenario: Edit knowledge check question
    When I click "Edit" on the first knowledge check
    Then the question should become editable
    
    When I change the question to "What is the main purpose of HTML?"
    And I click "Save"
    Then the question should be updated
    And I should see "Question updated successfully"

  @edit-answer-options
  Scenario: Modify answer options
    When I edit a knowledge check
    And I change option 2 to "Styling web pages"
    And I add a fourth option "Creating databases"
    Then I should have 4 answer options
    
    When I try to remove all options
    Then I should see "Minimum 2 options required"

  @change-correct-answer
  Scenario: Update correct answer
    When I edit a knowledge check
    And the current correct answer is option 1
    And I select option 3 as correct
    Then option 3 should be marked as correct
    And the feedback should update accordingly

  @edit-feedback
  Scenario: Customize feedback messages
    When I edit feedback for a knowledge check
    And I set correct feedback to "Excellent! You understand HTML well."
    And I set incorrect feedback to "Not quite. HTML is a markup language."
    Then the feedback should be saved
    
    When I preview the knowledge check
    Then the appropriate feedback should display

  @question-validation
  Scenario: Validate question requirements
    When I try to save a question with empty text
    Then I should see "Question text is required"
    
    When I try to save with only one answer option
    Then I should see "At least 2 options required"
    
    When I try to save without selecting correct answer
    Then I should see "Please select the correct answer"

  @add-knowledge-check
  Scenario: Add knowledge check to topic without one
    Given "Topic 4" has no knowledge check
    When I click "Add Knowledge Check" for Topic 4
    Then a new question form should appear
    
    When I fill in the question details:
      | Field            | Value                               |
      | Question         | What is CSS used for?               |
      | Option 1         | Styling web pages                   |
      | Option 2         | Server programming                  |
      | Option 3         | Database queries                    |
      | Correct Answer   | Option 1                            |
    And I save the knowledge check
    Then Topic 4 should have a knowledge check

  @remove-knowledge-check
  Scenario: Remove a knowledge check
    When I click "Remove" on a knowledge check
    Then I should see "Remove this knowledge check?"
    
    When I confirm removal
    Then the knowledge check should be deleted
    And the topic should show "No knowledge check"

  @assessment-editing
  Scenario: Edit final assessment questions
    When I scroll to the Assessment section
    Then I should see all assessment questions
    
    When I edit assessment question 1
    And I update the question and options
    Then the assessment should be updated

  @add-assessment-questions
  Scenario: Add more assessment questions
    Given the assessment has 5 questions
    When I click "Add Question" in the assessment section
    Then a new question form should appear
    
    When I add the question details and save
    Then the assessment should have 6 questions

  @question-reordering
  Scenario: Reorder questions
    When I drag question 3 to position 1
    Then the questions should be reordered
    And question numbers should update
    
    When I use arrow buttons to move questions
    Then the order should change accordingly

  @import-export-questions
  Scenario: Import/Export question bank
    When I click "Export Questions"
    Then a JSON file should download with all questions
    
    When I click "Import Questions"
    And I upload a valid question bank file
    Then I should see preview of imported questions
    And option to merge or replace

  @preview-activities
  Scenario: Preview knowledge checks and assessment
    When I click "Preview Activities"
    Then I should see interactive preview
    
    When I answer a knowledge check
    Then I should see the feedback
    But scores should not be saved

  @bulk-editing
  Scenario: Bulk edit operations
    When I select multiple knowledge checks
    And I click "Bulk Edit"
    Then I can update common properties:
      | Feedback style     |
      | Points per question |
      | Time limits        |

  @question-types
  Scenario: Support different question types
    When I change question type to "Multiple Select"
    Then I can select multiple correct answers
    
    When I change to "True/False"
    Then only two options should be available
    
    When I change to "Fill in the Blank"
    Then I can define the blank position and answers

  @activity-settings
  Scenario: Configure activity settings
    When I click "Activity Settings"
    Then I can configure:
      | Setting                  | Options                    |
      | Randomize questions      | Yes/No                     |
      | Randomize options        | Yes/No                     |
      | Show feedback            | Immediate/After submission |
      | Allow retry              | Yes/No/Limited attempts    |
      | Time limit per question  | None/30s/60s/Custom       |

  @scoring-configuration
  Scenario: Set up scoring rules
    When I access "Scoring Configuration"
    Then I can set:
      | Points per knowledge check | 10  |
      | Points per assessment     | 20  |
      | Passing score            | 80% |
      | Partial credit           | Yes |

  @question-bank-categories
  Scenario: Organize questions by category
    When I assign categories to questions:
      | Question                    | Category     |
      | What is HTML?              | Fundamentals |
      | How to style with CSS?     | Styling      |
      | JavaScript syntax basics    | Programming  |
    Then I can filter questions by category
    And generate reports by category

  @accessibility-check
  Scenario: Ensure activity accessibility
    When I run accessibility check
    Then I should see warnings for:
      | Images without alt text in questions     |
      | Color-only correct answer indicators     |
      | Time limits without accommodations       |
    
    And suggestions to fix each issue

  @mobile-optimization
  Scenario: Optimize for mobile devices
    When I preview on mobile view
    Then questions should be readable
    And touch targets should be appropriately sized
    And options should stack vertically on small screens