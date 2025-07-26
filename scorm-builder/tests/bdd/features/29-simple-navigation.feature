Feature: Simple Navigation Test
  Test basic navigation functionality step by step
  
  @stable @navigation @simple
  Scenario: Basic forward navigation
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Simple Nav Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
    # Fill minimum required data
    When I enter "Simple Navigation" as the course title
    And I add a topic "Test Topic"
    And I wait for 2 seconds
    
    # Debug: Check button state
    Then the Next button should be enabled
    
    # Try to navigate
    When I click the Next button with debug
    And I wait for 5 seconds
    Then I should see one of these:
      | AI Prompt Generator |
      | Generate AI Prompt  |
      | AI Content Creation |