Feature: Minimal E2E Test
  Simplest possible end-to-end test

  @minimal-e2e
  Scenario: Basic project creation flow
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Minimal Test" as the project name
    And I click "Create" in the dialog
    Then I should see the Course Seed Input form
    
  @minimal-e2e @course-input
  Scenario: Enter course information
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Course Test" as the project name
    And I click "Create" in the dialog
    Then I should see the Course Seed Input form
    When I enter "Test Course" as the course title
    And I add a topic "Introduction"
    And I wait for auto-save to complete
    Then the course title should be "Test Course"
    And I should see 1 topics in the list
    Then the Next button should be enabled
    
    
  @minimal-e2e @isolated-steps
  Scenario: Test Course Seed Input step in isolation
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Isolated Test" as the project name
    And I click "Create" in the dialog
    Then I should see the Course Seed Input form
    When I enter "Isolated Test Course" as the course title
    And I add a topic "Topic 1"
    And I add a topic "Topic 2"
    And I add a topic "Topic 3"
    Then the course title should be "Isolated Test Course"
    And I should see 3 topics in the list
    And the Next button should be enabled
    
  @minimal-e2e @complete-flow
  Scenario: Complete E2E flow through all steps
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "E2E Test Project" as the project name
    And I click "Create" in the dialog
    Then I should see the Course Seed Input form
    
    # Step 1: Course Seed Input
    When I enter "Complete E2E Test Course" as the course title
    And I add a topic "Introduction to Testing"
    And I add a topic "Advanced Testing Concepts"
    And I add a topic "Summary and Review"
    And I wait for auto-save to complete
    And I click the Next button
    And I wait for 1 second
    
    # Step 2: AI Prompt Generator
    Then I should see the AI Prompt Generator form
    When I wait for 1 second
    And I click "Skip AI Generation"
    
    # Step 3: JSON Import/Validator
    Then I should see the JSON Import form
    When I click "Skip JSON Import"
    
    # Step 4: Course Content Editor
    Then I should see the Course Content Editor
    When I add basic content to the first module
    And I wait for 1 seconds
    And I click the "Next" button
    
    # Step 5: Audio Narration
    Then I should see the Audio Narration form
    When I click "Skip Narration"
    
    # Step 6: Media Library
    Then I should see the Media Library
    When I click "Skip Media"
    
    # Step 7: Export SCORM
    Then I should see the Export SCORM form
    When I select "SCORM 1.2" format
    And I click "Generate SCORM Package"
    Then I should eventually see "SCORM package generated successfully"