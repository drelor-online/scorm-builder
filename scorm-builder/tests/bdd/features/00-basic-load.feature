Feature: Basic App Load Test
  
  @basic-load
  Scenario: App loads and renders
    Given I navigate to "http://localhost:1420"
    Then the React app should be mounted to #root
    And the CSS should be loaded