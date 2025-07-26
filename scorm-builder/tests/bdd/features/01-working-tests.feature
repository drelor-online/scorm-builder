Feature: Working Test Suite
  Tests that are confirmed to work with our mock setup

  @working
  Scenario: Application loads dashboard successfully
    Given I navigate to the application
    Then I should see the Dashboard
    And I should see "SCORM Builder Projects" heading
    And I should see "Create New Project" button

  @working
  Scenario: Create new project and navigate to course seed
    Given I am on the dashboard page
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "My Test Project" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    And the form should have a course title input