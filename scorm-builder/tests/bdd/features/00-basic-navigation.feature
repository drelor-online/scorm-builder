Feature: Basic Navigation
  As a user
  I want to navigate through the application
  So that I can create a SCORM course

  Scenario: Application loads successfully
    Given I navigate to the application
    Then I should see the Dashboard
    And I should see "SCORM Builder Projects" heading
    And I should see "Create New Project" button

  @fixed
  Scenario: Navigate to Course Seed Input
    Given I navigate to the application
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Test Project" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input step
    And the form should have a course title input
    And the Next button should be disabled

  Scenario: Enable Next button with valid input
    Given I am on the Course Seed Input step
    When I enter "Test Course" as the course title
    And I enter the following topics:
      | Introduction |
      | Main Content |
      | Summary      |
    Then the Next button should be enabled