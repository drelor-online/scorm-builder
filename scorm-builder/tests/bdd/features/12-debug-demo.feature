Feature: Debug and Screenshot Demo
  Demonstrates the new debug and screenshot capabilities
  
  @debug @screenshot
  Scenario: Capture screenshots during navigation
    Given I am on the dashboard page
    When I take a screenshot named "dashboard-initial"
    And I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I take a screenshot named "project-dialog"
    And I enter "Debug Test Project" in the project name input
    And I take a screenshot before "create-button-click"
    And I click the Create button in the new project dialog
    And I take a screenshot after "create-button-click"
    Then I should see the Course Seed Input form
    When I capture the current page state
    
  @debug @errors
  Scenario: Check for JavaScript errors
    Given I am on the dashboard page
    When I capture the current page state
    Then I should see no JavaScript errors
    
  @debug @form
  Scenario: Debug form inputs
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Form Debug Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    When I log all form inputs
    And I log all visible buttons
    And I enter "Test Course" as the course title
    And I add a topic "Introduction"
    When I debug auto-save
    And I wait for network idle
    Then I take a screenshot named "form-filled"