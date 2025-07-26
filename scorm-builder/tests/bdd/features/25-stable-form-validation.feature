Feature: Stable Form Validation Tests
  Test form validation and constraints without navigation
  
  Background:
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Validation Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
  
  @stable @validation
  Scenario: Course title is required
    When I click the course title input
    And I click outside the form
    Then the Next button should be disabled
    When I enter "Valid Course Title" as the course title
    Then the Next button should be disabled
    # Still disabled because topics are required
    
  @stable @validation
  Scenario: Topics are required
    When I enter "Test Course" as the course title
    Then the Next button should be disabled
    When I add a topic "Topic 1"
    Then the Next button should be enabled
    
  @stable @validation
  Scenario: Course title character limit
    When I enter a course title with 100 characters
    Then the character count should show "100/100 characters"
    When I try to enter more characters
    Then the course title should be truncated to 100 characters
    
  @stable @validation
  Scenario: Multiple topics can be added
    When I enter "Multi-Topic Course" as the course title
    And I add a topic "Introduction"
    And I add a topic "Core Concepts"
    And I add a topic "Advanced Topics"
    And I add a topic "Summary"
    Then I should have 4 topics entered
    And the Next button should be enabled
    
  @stable @validation
  Scenario: Empty topics are filtered out
    When I enter "Topic Filter Test" as the course title
    And I enter topics:
      | Valid Topic 1 |
      |               |
      | Valid Topic 2 |
      |               |
      | Valid Topic 3 |
    Then I should have 3 topics entered
    
  @stable @validation
  Scenario: Difficulty level selection
    When I select difficulty level 1
    Then the difficulty "Basic" should be selected
    When I select difficulty level 5
    Then the difficulty "Expert" should be selected
    When I select difficulty level 3
    Then the difficulty "Medium" should be selected