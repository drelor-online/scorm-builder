Feature: Complete SCORM Creation Workflow
  As a course creator
  I want to create a complete SCORM package
  So that I can deploy it to an LMS

  Background:
    Given I am on the dashboard page
    And I have created a new project called "E2E Test Course"

  @e2e @critical
  Scenario: Create a complete SCORM package from scratch
    # Step 1: Course Seed Input
    Given I am on the Course Seed Input step
    When I enter "Introduction to Testing" as the course title
    And I select "Technology" as the template
    And I add the following topics:
      | Topic Name           |
      | What is Testing      |
      | Types of Testing     |
      | Best Practices       |
    And I set estimated time to "30" minutes
    And I set the number of questions to "5"
    And I click the "Next" button
    Then I should be on the JSON Import/Validator step

    # Step 2: JSON Import/Validator
    When I click "Skip JSON Import"
    Then I should be on the AI Prompt Generator step

    # Step 3: AI Prompt Generator
    When I review the generated prompt
    And I click "Copy Prompt"
    And I click the "Next" button
    Then I should be on the Course Content Editor step

    # Step 4: Course Content Editor
    When I paste the following content for module "What is Testing":
      """
      {
        "title": "What is Testing",
        "content": "Testing is the process of evaluating software to find defects.",
        "keyPoints": ["Quality assurance", "Bug detection", "User satisfaction"],
        "quiz": {
          "question": "What is the main purpose of testing?",
          "options": ["To find bugs", "To write code", "To design UI", "To deploy apps"],
          "correctAnswer": 0
        }
      }
      """
    And I click "Save Module"
    And I click the "Next" button
    Then I should be on the Audio Narration step

    # Step 5: Audio Narration
    When I select "Skip narration for now"
    And I click the "Next" button
    Then I should be on the Media Library step

    # Step 6: Media Library
    When I click "Skip media for now"
    And I click the "Next" button
    Then I should be on the Export SCORM step

    # Step 7: Export SCORM
    When I select "SCORM 1.2" as the export format
    And I set the passing score to "80"
    And I click "Generate SCORM Package"
    Then I should see "SCORM package generated successfully"
    And a SCORM package should be saved

  @e2e @quick
  Scenario: Quick SCORM creation with minimal steps
    Given I am on the Course Seed Input step
    When I enter "Quick Test Course" as the course title
    And I add a single topic "Overview"
    And I click the "Next" button
    And I skip through all optional steps
    And I reach the Export SCORM step
    And I click "Generate SCORM Package"
    Then I should see "SCORM package generated successfully"