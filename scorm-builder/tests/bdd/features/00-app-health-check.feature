Feature: Application Health Check
  As a developer
  I want to ensure the application loads correctly
  So that BDD tests can run properly

  @health-check @critical
  Scenario: Application loads without errors
    Given I navigate to "http://localhost:1420"
    Then the page should load successfully
    And I should not see any console errors
    And the React app should be mounted to #root

  @css-loading
  Scenario: CSS loads correctly
    Given I navigate to "http://localhost:1420"
    Then the CSS should be loaded
    And the body should have dark theme styles applied
    And the background color should be "#18181b"