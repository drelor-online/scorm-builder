Feature: Debug Navigation Issues
  Investigate why navigation to AI Prompt Generator fails
  
  @debug-nav
  Scenario: Debug navigation to AI Prompt with screenshots
    Given I am on the dashboard page
    When I take a screenshot named "nav-1-dashboard"
    And I click "Create New Project"
    And I take a screenshot named "nav-2-after-create-click"
    Then I should see a dialog with title "Create New Project"
    When I enter "Debug Nav Test" in the project name input
    And I click the Create button in the new project dialog
    And I take a screenshot named "nav-3-after-dialog"
    Then I should see the Course Seed Input form
    When I fill the course seed form with auto-save:
      | Course Title | Debug Navigation Test |
      | Topics       | Topic 1, Topic 2      |
      | Difficulty   | 3                     |
    And I take a screenshot named "nav-4-form-filled"
    And I wait for auto-save to complete
    And I log all visible buttons
    When I debug the form validation state
    And I take a screenshot before "clicking-next"
    When I click "Next →"
    And I take a screenshot after "clicking-next-immediate"
    And I wait for 1 seconds
    And I take a screenshot after "clicking-next-1s"
    And I wait for 2 seconds
    And I take a screenshot after "clicking-next-3s"
    Then I capture the current page state