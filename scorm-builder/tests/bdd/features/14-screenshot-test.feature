Feature: Screenshot Test
  Simple test to verify screenshot functionality
  
  @screenshot-test
  Scenario: Test screenshot capture
    Given I am on the dashboard page
    When I take a screenshot named "test-manual"
    Then I should see "SCORM Builder Projects"