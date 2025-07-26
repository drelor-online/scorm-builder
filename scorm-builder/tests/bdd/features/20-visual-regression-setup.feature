Feature: Visual Regression Setup
  Establish baseline screenshots for visual regression testing
  
  @visual @baseline
  Scenario: Capture dashboard baseline
    Given I am on the dashboard page
    When I capture screenshot "dashboard-empty" for visual regression
    Then the screenshot "dashboard-empty" should match the baseline
    
  @visual @baseline
  Scenario: Capture project dialog baseline
    Given I am on the dashboard page
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I capture screenshot "project-dialog" with options:
      | fullPage | false                          |
      | selector | .modal-content                 |
    Then the screenshot "project-dialog" should match the baseline
    
  @visual @baseline
  Scenario: Capture course seed form baseline
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Visual Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    When I capture screenshot "course-seed-empty" masking dynamic content
    Then the screenshot "course-seed-empty" should match the baseline
    
  @visual @baseline
  Scenario: Capture filled form baseline
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Visual Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    When I enter "Visual Regression Course" as the course title
    And I enter topics:
      | Introduction to Testing |
      | Visual Regression Basics |
      | Advanced Techniques |
    And I select difficulty level 3
    When I capture screenshot "course-seed-filled" masking dynamic content
    Then the screenshot "course-seed-filled" should match the baseline