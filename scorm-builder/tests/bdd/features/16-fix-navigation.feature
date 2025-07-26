Feature: Fix Navigation Test
  Test navigation with proper form filling
  
  @fix-nav
  Scenario: Navigate to AI Prompt with proper form fill
    Given I am on the dashboard page
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Fix Nav Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    When I enter "Navigation Test Course" as the course title
    And I enter topics:
      | Topic 1 |
      | Topic 2 |
      | Topic 3 |
    And I select difficulty level 3
    And I wait for auto-save to complete
    Then the course title should be "Navigation Test Course"
    And I should have 3 topics entered
    When I take a screenshot named "form-verified"
    And I click "Next →"
    And I wait for 3 seconds
    And I take a screenshot named "after-navigation-attempt"
    Then I should see the AI Prompt Generator form