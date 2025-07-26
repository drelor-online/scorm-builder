Feature: Failure Screenshot Demo
  Demonstrates automatic screenshot capture on test failure
  
  @debug @failure
  Scenario: Intentional failure to test screenshot
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Failure Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    # This will fail and trigger a screenshot
    Then I should see "This text does not exist on the page"