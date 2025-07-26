Feature: Stable Auto-save Tests
  Test auto-save functionality and indicators
  
  Background:
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "AutoSave Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
  @stable @autosave
  Scenario: Auto-save indicator shows correct status
    Then the auto-save indicator should show "No draft"
    When I enter "Test Course" as the course title
    And I wait for auto-save to complete
    Then the auto-save indicator should show "All changes saved"
    
  @stable @autosave
  Scenario: Auto-save triggers after form changes
    When I enter "Auto Save Test Course" as the course title
    And I wait for 100ms
    Then the auto-save indicator should show "Saving..."
    When I wait for auto-save to complete
    Then the auto-save indicator should show "All changes saved"
    
  @stable @autosave
  Scenario: Auto-save handles multiple rapid changes
    When I enter "First Title" as the course title
    And I immediately enter "Second Title" as the course title
    And I immediately enter "Final Title" as the course title
    And I wait for auto-save to complete
    Then the course title should be "Final Title"
    And the auto-save indicator should show "All changes saved"
    
  @stable @autosave
  Scenario: Topics are auto-saved
    When I enter "Topic Save Test" as the course title
    And I add a topic "Topic 1"
    And I wait for auto-save to complete
    Then the auto-save indicator should show "All changes saved"
    When I add a topic "Topic 2"
    And I wait for auto-save to complete
    Then I should have 2 topics entered
    And the auto-save indicator should show "All changes saved"