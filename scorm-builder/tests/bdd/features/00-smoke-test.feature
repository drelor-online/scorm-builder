Feature: Smoke Test
  As a developer
  I want to ensure the application loads
  So that I can run more tests

  Scenario: Application loads without errors
    When I open the application URL
    Then the page should load successfully
    And I should see the main container