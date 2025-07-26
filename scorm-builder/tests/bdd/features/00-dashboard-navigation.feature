Feature: Dashboard Navigation
  
  @dashboard @fixed
  Scenario: Navigate from dashboard to course creation
    Given I am on the dashboard page
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Test Project" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form