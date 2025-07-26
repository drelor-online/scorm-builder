Feature: Stable Navigation Tests
  Focused set of navigation tests that reliably pass
  
  Background:
    Given I am on the dashboard page
  
  @stable @navigation
  Scenario: Create project with dialog
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Navigation Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
  
  @stable @navigation
  Scenario: Fill course seed and navigate
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Course Nav Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    When I enter "Test Course" as the course title
    And I add a topic "Introduction"
    And I add a topic "Main Content"
    Then the Next button should be enabled
  
  @navigation @back
  Scenario: Navigate back from AI Prompt
    When I click "Create New Project"
    Then I should see a dialog with title "Create New Project"
    When I enter "Back Nav Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    When I fill the course seed form with auto-save:
      | Course Title | Back Navigation Test |
      | Topics       | Topic 1, Topic 2     |
      | Difficulty   | 3                    |
    And I wait for auto-save to complete
    When I click "Next →"
    And I wait for 2 seconds
    Then I should be on the "AI Prompt Generator" step
    When I click the Back button
    Then I should see the Course Seed Input form
    And the course title should be "Back Navigation Test"