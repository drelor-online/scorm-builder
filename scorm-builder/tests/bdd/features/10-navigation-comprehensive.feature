Feature: Comprehensive Navigation Tests
  Test all navigation scenarios including forward, backward, refresh, and resume

  Background:
    Given I am on the dashboard page

  @navigation @backward @fixed
  Scenario: Navigate backward through workflow steps
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Backward Nav Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Navigate forward
    When I fill the course seed form with auto-save:
      | Course Title | Backward Navigation Test |
      | Topics       | Topic 1, Topic 2         |
      | Difficulty   | 3                        |
    And I click the Next button
    Then I should be on the "AI Prompt Generator" step
    
    # Navigate backward
    When I click the Back button
    Then I should see the Course Seed Input form
    And the course title should be "Backward Navigation Test"
    And I should see 2 topics in the list
    
    # Navigate forward again
    When I click the Next button
    Then I should be on the "AI Prompt Generator" step

  @navigation @multi-step-backward @fixed
  Scenario: Navigate backward multiple steps
    When I create a project and navigate to step 3
    Then I should be on the "JSON Import" step
    
    # Go back two steps
    When I click the Back button
    Then I should be on the "AI Prompt Generator" step
    When I click the Back button
    Then I should see the Course Seed Input form
    
    # Verify data persistence
    And the course data should be preserved

  @navigation @direct @fixed
  Scenario: Navigate directly to specific steps using step indicators
    When I create a project with minimal data
    And I click on step indicator "3"
    Then I should be on the "JSON Import" step
    
    When I click on step indicator "5"
    Then I should be on the "Audio Narration" step
    
    When I click on step indicator "1"
    Then I should see the Course Seed Input form

  @navigation @refresh
  Scenario: Refresh browser during workflow
    When I create a project and navigate to step 2
    Then I should be on the "AI Prompt Generator" step
    
    # Refresh the page
    When I refresh the page
    And I wait for 2 seconds
    Then I should be on the "AI Prompt Generator" step
    And the course data should be preserved

  @navigation @refresh-with-changes
  Scenario: Refresh with unsaved changes
    When I create a project and navigate to step 2
    And I make changes to the AI prompt
    And I refresh the page
    Then I should see a browser warning about unsaved changes

  @navigation @resume @fixed
  Scenario: Resume project from dashboard
    # Create and partially complete a project
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Resume Test Project" in the project name input
    And I click the Create button in the new project dialog
    And I fill the course seed form with auto-save:
      | Course Title | Resume Test Course |
      | Topics       | Topic A, Topic B   |
      | Difficulty   | 4                  |
    And I click the Next button
    And I wait for 1 second
    
    # Go back to dashboard
    When I click the dashboard link
    Then I should see the dashboard
    And I should see "Resume Test Project" in the project list
    
    # Resume the project
    When I click "Resume Test Project"
    Then I should be on the "AI Prompt Generator" step
    And the course title should be "Resume Test Course"

  @navigation @unsaved-changes
  Scenario: Navigate with unsaved changes warning
    When I create a project and navigate to step 4
    Then I should be on the "Course Content Editor" step
    
    # Make changes
    When I edit the content of module 1
    And I try to navigate to the dashboard
    Then I should see a confirmation dialog "You have unsaved changes"
    
    When I click "Cancel" in the dialog
    Then I should remain on the "Course Content Editor" step
    
    When I try to navigate to the dashboard
    And I click "Discard Changes" in the dialog
    Then I should see the dashboard

  @navigation @keyboard
  Scenario: Navigate using keyboard shortcuts
    When I create a project with minimal data
    Then I should see the Course Seed Input form
    
    # Use keyboard shortcuts
    When I press "Alt+Right"
    Then I should be on the "AI Prompt Generator" step
    
    When I press "Alt+Left"
    Then I should see the Course Seed Input form
    
    When I press "Ctrl+S"
    Then the project should be saved

  @navigation @step-validation @fixed
  Scenario: Prevent navigation with invalid data
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Validation Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Try to navigate without required data
    When I click the Next button
    Then I should see an error "Please enter a course title"
    And I should remain on the Course Seed Input form
    
    # Enter title but no topics
    When I enter "Test Course" as the course title
    And I click the Next button
    Then I should see an error "Please add at least one topic"
    And I should remain on the Course Seed Input form

  @navigation @quick-complete
  Scenario: Quick complete with skip buttons
    When I create a project with minimal data
    And I navigate through all steps using skip buttons
    Then I should be on the "Export SCORM" step
    And all steps should be marked as completed