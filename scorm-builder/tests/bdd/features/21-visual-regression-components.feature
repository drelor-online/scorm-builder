Feature: Visual Regression Component Testing
  Test individual UI components for visual changes
  
  @visual @components
  Scenario: Test button states
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Component Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    When I capture visual regression screenshots for:
      | name                    | selector                      |
      | button-next-disabled    | [data-testid="next-button"]   |
      | difficulty-buttons      | .difficulty-button-group      |
      | template-select         | [data-testid="template-select"] |
    And I enter "Test Course" as the course title
    And I enter topics:
      | Topic 1 |
    When I capture visual regression screenshots for:
      | name                    | selector                      |
      | button-next-enabled     | [data-testid="next-button"]   |
    Then all visual regression screenshots should match baselines
    
  @visual @forms
  Scenario: Test form validation states
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Form Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    # Test empty required field
    When I click the course title input
    And I click outside the form
    And I capture screenshot "form-validation-error" with options:
      | selector | [data-testid="course-title-input"] |
    # Test filled field
    When I enter "Valid Title" as the course title
    And I capture screenshot "form-validation-success" with options:
      | selector | [data-testid="course-title-input"] |
    Then all visual regression screenshots should match baselines
    
  @visual @responsive
  Scenario: Test responsive layout
    Given I set the viewport to 1920x1080
    And I am on the dashboard page
    When I capture screenshot "dashboard-desktop" for visual regression
    Given I set the viewport to 768x1024
    When I capture screenshot "dashboard-tablet" for visual regression
    Given I set the viewport to 375x667
    When I capture screenshot "dashboard-mobile" for visual regression
    Then all visual regression screenshots should match baselines