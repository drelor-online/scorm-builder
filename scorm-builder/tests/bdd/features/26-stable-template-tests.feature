Feature: Stable Template Selection Tests
  Test template selection and auto-population features
  
  Background:
    Given I am on the dashboard page
    When I click "Create New Project"
    And I enter "Template Test" in the project name input
    And I click the Create button in the new project dialog
    Then I should see the Course Seed Input form
    
  @stable @templates
  Scenario: Default template selection
    Then the selected template should be "None"
    And the template dropdown should contain:
      | Choose a template...      |
      | How-to Guide              |
      | Corporate                 |
      | Technical                 |
      | Safety                    |
      | Business Development      |
      | Human Resources           |
      
  @stable @templates
  Scenario: Template selection persists
    When I select template "Corporate"
    Then the selected template should be "Corporate"
    When I enter "Corporate Training" as the course title
    And I add a topic "Company Overview"
    Then the selected template should be "Corporate"
    
  @stable @templates @visual
  Scenario: Template dropdown visual consistency
    When I capture screenshot "template-dropdown-closed" with options:
      | selector | [data-testid="template-select"] |
    When I click the template dropdown
    And I capture screenshot "template-dropdown-open" with options:
      | selector | [data-testid="template-select"] |
    Then all visual regression screenshots should match baselines
    
  @stable @templates
  Scenario: Manage templates button exists
    Then I should see the "Manage Templates" button
    And the "Manage Templates" button should be enabled