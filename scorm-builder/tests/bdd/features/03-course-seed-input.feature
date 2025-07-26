Feature: Course Seed Input
  As a course creator
  I want to input initial course information
  So that I can generate course structure

  Background:
    Given I am on the dashboard page
    And I have created a new project
    And I am on the Course Seed Input step

  @course-seed
  Scenario: Enter course information with template
    When I enter "Advanced JavaScript" as the course title
    And I select "Programming" as the template
    And I add the following topics:
      | Topic Name            |
      | ES6 Features          |
      | Async Programming     |
      | Modern Frameworks     |
      | Testing Strategies    |
    And I set estimated time to "120" minutes
    And I set the number of questions to "10"
    Then the "Next" button should be enabled
    When I click the "Next" button
    Then I should be on the JSON Import/Validator step

  @course-seed @validation
  Scenario: Validation prevents empty course title
    When I leave the course title empty
    And I add a topic "Test Topic"
    Then the "Next" button should be disabled
    And I should see "Course title is required"

  @course-seed @topics
  Scenario: Add and remove topics dynamically
    When I enter "Dynamic Topics Course" as the course title
    And I add a topic "First Topic"
    And I add a topic "Second Topic"
    And I add a topic "Third Topic"
    Then I should see 3 topics in the list
    When I remove topic "Second Topic"
    Then I should see 2 topics in the list
    And the "Next" button should be enabled

  @course-seed @template
  Scenario: Template selection pre-fills topics
    When I enter "Template Test Course" as the course title
    And I select "Customer Service" as the template
    Then I should see template topics populated
    And I should see at least 3 topics in the list
    And the "Next" button should be enabled

  @course-seed @settings
  Scenario: Course settings validation
    When I enter "Settings Test" as the course title
    And I add a topic "Test Topic"
    And I set estimated time to "0" minutes
    Then I should see "Estimated time must be greater than 0"
    When I set estimated time to "45" minutes
    And I set the number of questions to "0"
    Then I should see "Number of questions must be at least 1"
    When I set the number of questions to "5"
    Then the "Next" button should be enabled