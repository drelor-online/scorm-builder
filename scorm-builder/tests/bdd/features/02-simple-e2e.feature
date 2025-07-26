Feature: Simple E2E SCORM Creation
  As a course creator
  I want to create a simple SCORM package
  So that I can test the basic workflow

  @e2e @simple
  Scenario: Create a minimal SCORM package
    # Start and create project
    Given I am on the dashboard page
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Simple E2E Test" as the project name
    And I click "Create" in the dialog
    Then I should see the Course Seed Input form

    # Course Seed Input
    When I enter "Basic Test Course" as the course title
    And I add a topic "Introduction"
    And I click the "Next" button
    Then I should be on the JSON Import/Validator step

    # Skip JSON Import
    When I click "Skip JSON Import"
    Then I should be on the AI Prompt Generator step

    # Skip AI Prompt (just proceed)
    When I click the "Next" button
    Then I should be on the Course Content Editor step

    # Add minimal content
    When I enter basic content for the module
    And I click the "Next" button
    Then I should be on the Audio Narration step

    # Skip Audio
    When I click "Skip narration for now"
    Then I should be on the Media Library step

    # Skip Media
    When I click "Skip media for now"
    Then I should be on the Export SCORM step

    # Export
    When I click "Generate SCORM Package"
    Then I should see "Generating SCORM package..."
    And I should see "SCORM package generated successfully"