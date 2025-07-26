Feature: Comprehensive Navigation Tests
  Test advanced navigation scenarios including complete workflows,
  unsaved changes handling, and browser navigation
  
  Background:
    Given I am on the dashboard page

  @stable @navigation @workflow
  Scenario: Complete workflow from start to finish
    When I click "Create New Project"
    And I enter "Complete Workflow Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Step 1: Course Seed Input
    When I enter "Complete Navigation Test" as the course title
    And I add a topic "Introduction to Testing"
    And I add a topic "Advanced Concepts"
    And I select difficulty level 3
    And I click the "Next" button
    Then I should see the AI Prompt Generator form
    
    # Step 2: AI Prompt Generator (skip)
    When I click "Skip AI Generation"
    Then I should see the JSON Import step
    
    # Step 3: JSON Import (skip)
    When I click "Skip JSON Import"
    Then I should see the Media Enhancement step
    
    # Step 4: Media Enhancement (skip)
    When I click "Skip Media"
    Then I should see the Audio Narration step
    
    # Step 5: Audio Narration (skip)
    When I click "Skip Narration"
    Then I should see the Activities step
    
    # Step 6: Activities (skip)
    When I click "Skip Activities"
    Then I should see the SCORM Export step
    
    # Verify we can navigate back
    When I click the "Back" button
    Then I should see the Activities step
    When I click the "Back" button
    Then I should see the Audio Narration step

  @stable @navigation @unsaved
  Scenario: Navigation with unsaved changes warning
    When I click "Create New Project"
    And I enter "Unsaved Changes Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Make changes without saving
    When I enter "Test Course with Changes" as the course title
    And I add a topic "Topic 1"
    And I wait for auto-save to complete
    
    # Try to navigate away
    When I click the dashboard navigation button
    Then I should see a confirmation dialog "You have unsaved changes"
    
    # Cancel navigation
    When I click "Cancel" in the dialog
    Then I should still be on the Course Seed Input form
    And the course title should be "Test Course with Changes"
    
    # Confirm navigation
    When I click the dashboard navigation button
    And I click "Leave" in the dialog
    Then I should be on the dashboard page

  @stable @navigation @step-indicator
  Scenario: Navigate using step indicators
    When I click "Create New Project"
    And I enter "Step Navigation Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Fill required data and navigate forward
    When I enter "Step Navigation Course" as the course title
    And I add a topic "Topic 1"
    And I click the "Next" button
    And I click "Skip AI Generation"
    And I click "Skip JSON Import"
    Then I should see the Media Enhancement step
    
    # Click step 2 indicator
    When I click on step indicator "2"
    Then I should see the AI Prompt Generator form
    
    # Click step 4 indicator
    When I click on step indicator "4"
    Then I should see the Media Enhancement step
    
    # Click step 1 indicator
    When I click on step indicator "1"
    Then I should see the Course Seed Input form
    And the course title should be "Step Navigation Course"

  @stable @navigation @persistence
  Scenario: Navigation state persists after page refresh
    When I click "Create New Project"
    And I enter "Persistence Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Navigate to step 3
    When I enter "Persistence Test Course" as the course title
    And I add a topic "Persistent Topic"
    And I click the "Next" button
    And I click "Skip AI Generation"
    Then I should see the JSON Import step
    
    # Refresh the page
    When I refresh the page
    Then I should see the JSON Import step
    
    # Navigate back and verify data
    When I click on step indicator "1"
    Then I should see the Course Seed Input form
    And the course title should be "Persistence Test Course"
    And I should have 1 topic entered

  @stable @navigation @error-recovery
  Scenario: Navigation continues after error recovery
    When I click "Create New Project"
    And I enter "Error Recovery Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Fill form and navigate
    When I enter "Error Recovery Course" as the course title
    And I add a topic "Recovery Topic"
    And I click the "Next" button
    Then I should see the AI Prompt Generator form
    
    # Simulate error and recovery
    When I trigger a mock save error
    Then I should see an error notification
    
    # Verify we can still navigate
    When I click the "Back" button
    Then I should see the Course Seed Input form
    And the course title should be "Error Recovery Course"
    
    # And forward again
    When I click the "Next" button
    Then I should see the AI Prompt Generator form

  @navigation @keyboard
  Scenario: Keyboard navigation through steps
    When I click "Create New Project"
    And I enter "Keyboard Nav Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Fill minimum required data
    When I enter "Keyboard Navigation" as the course title
    And I add a topic "Topic 1"
    
    # Use keyboard to navigate
    When I press "Alt+Right"
    Then I should see the AI Prompt Generator form
    
    When I press "Alt+Left"
    Then I should see the Course Seed Input form
    
    When I press "Alt+Right"
    And I press "Alt+Right"
    Then I should see the JSON Import step