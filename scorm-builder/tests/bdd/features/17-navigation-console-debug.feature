Feature: Debug Navigation Console Logs
  Check console logs to understand navigation failure
  
  @nav-console
  Scenario: Check console logs during navigation
    Given I am on the dashboard page
    When I capture console logs
    And I click "Create New Project"
    And I enter "Console Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    When I enter "Console Test Course" as the course title
    And I enter topics:
      | Topic A |
      | Topic B |
    And I select difficulty level 3
    And I wait for auto-save to complete
    And I click "Next →"
    And I wait for 2 seconds
    Then I check console logs for errors
    And I take a screenshot named "console-test-after-next"