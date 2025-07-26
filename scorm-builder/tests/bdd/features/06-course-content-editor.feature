Feature: Course Content Editor
  As a course creator
  I want to edit and organize course content
  So that I can create engaging learning modules

  Background:
    Given I am on the dashboard page
    And I have created a new project
    And I have reached the Course Content Editor step
    And I have 3 modules to edit

  @content-editor
  Scenario: Edit module content
    When I select module "Introduction"
    And I enter the following content:
      """
      # Welcome to the Course
      
      This course will teach you the fundamentals.
      
      ## Learning Objectives
      - Understand basic concepts
      - Apply knowledge practically
      - Solve real-world problems
      """
    And I click "Save Module"
    Then the module should be marked as complete
    And I should see a success message

  @content-editor @formatting
  Scenario: Use rich text formatting
    When I select module "Advanced Topics"
    And I use the toolbar to:
      | Action         | Text              |
      | Bold           | Important concept |
      | Italic         | emphasis          |
      | Code           | const x = 10;     |
      | Bullet List    | Key points        |
    Then the formatted content should be displayed correctly

  @content-editor @images
  Scenario: Add images to content
    When I select module "Visual Learning"
    And I click "Add Image"
    And I upload "diagram.png"
    Then the image should appear in the content
    And I can resize the image
    And I can add alt text "Process flow diagram"

  @content-editor @preview
  Scenario: Preview module as learner
    When I have edited a module
    And I click "Preview as Learner"
    Then I should see the module in learner view
    And I should not see editing controls
    And the content should have proper styling

  @content-editor @navigation
  Scenario: Navigate between modules
    Given I am editing module 1
    When I click "Next Module"
    Then I should be on module 2
    When I click "Previous Module"
    Then I should be on module 1
    And my changes should be auto-saved

  @content-editor @validation
  Scenario: Validate content requirements
    When I try to save an empty module
    Then I should see "Module content cannot be empty"
    When I add content less than 50 words
    Then I should see a warning "Content seems too short"
    When I add sufficient content
    Then validation should pass

  @content-editor @auto-save
  Scenario: Auto-save functionality
    When I type content in a module
    And I wait 3 seconds
    Then I should see "Auto-saved"
    When I refresh the page
    And I return to the same module
    Then my content should be preserved