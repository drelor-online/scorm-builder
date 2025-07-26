Feature: Course Seed Input
  As a course creator
  I want to provide basic course information
  So that I can generate a structured course

  Background:
    Given I am on the Course Seed Input step
    And the application is in a clean state

  Scenario: Successfully create course with minimum required fields
    When I enter "Introduction to TypeScript" as the course title
    And I enter "Junior developers new to TypeScript" as the target audience
    And I set the course duration to 15 minutes
    And I add the topic "TypeScript Basics"
    And I click the Next button
    Then I should proceed to the AI Prompt Generator step
    And the course data should be saved

  Scenario: Validation prevents proceeding with empty title
    When I leave the course title empty
    And I enter "Developers" as the target audience
    And I add the topic "Testing"
    And I click the Next button
    Then I should see an error "Course title is required"
    And I should remain on the Course Seed Input step

  Scenario: Validation prevents proceeding with empty audience
    When I enter "Test Course" as the course title
    And I leave the target audience empty
    And I add the topic "Testing"
    And I click the Next button
    Then I should see an error "Target audience is required"
    And I should remain on the Course Seed Input step

  Scenario: Validation prevents proceeding without topics
    When I enter "Test Course" as the course title
    And I enter "Developers" as the target audience
    And I do not add any topics
    And I click the Next button
    Then I should see an error "At least one topic is required"
    And I should remain on the Course Seed Input step

  Scenario: Duration validation enforces minimum and maximum
    When I enter valid title and audience
    And I add a valid topic
    And I set the course duration to 3 minutes
    Then I should see an error "Duration must be between 5 and 90 minutes"
    When I set the course duration to 95 minutes
    Then I should see an error "Duration must be between 5 and 90 minutes"
    When I set the course duration to 30 minutes
    Then I should not see any duration error

  Scenario: Add and remove topics
    When I enter valid title and audience
    And I add the topic "Introduction"
    And I add the topic "Advanced Concepts"
    And I add the topic "Best Practices"
    Then I should see 3 topics in the list
    When I remove the topic "Advanced Concepts"
    Then I should see 2 topics in the list
    And the topics should be "Introduction" and "Best Practices"

  Scenario: Prevent duplicate topics
    When I enter valid title and audience
    And I add the topic "JavaScript Basics"
    And I try to add the topic "JavaScript Basics" again
    Then I should see an error "Topic already exists"
    And I should see only 1 topic in the list

  Scenario: Maximum topics limit
    When I enter valid title and audience
    And I add 20 different topics
    And I try to add another topic
    Then I should see an error "Maximum 20 topics allowed"
    And I should see 20 topics in the list

  Scenario: Use a course template
    When I click the "Use Template" button
    And I select the "Software Training" template
    Then the course title should be "Software Application Training"
    And the target audience should be "New users of the software"
    And the duration should be 30 minutes
    And I should see 5 predefined topics

  Scenario: Character limits are enforced
    When I enter a course title with 101 characters
    Then the course title should be truncated to 100 characters
    When I enter a target audience with 201 characters
    Then the target audience should be truncated to 200 characters
    When I enter a topic with 101 characters
    Then the topic should be truncated to 100 characters

  Scenario: Auto-save triggers after changes
    When I enter "Test Course" as the course title
    And I wait for 2 seconds
    Then I should see the auto-save indicator showing "Saving..."
    And after save completes I should see "Saved"

  Scenario: Preview shows course structure
    When I enter "Preview Test Course" as the course title
    And I enter "QA Engineers" as the target audience
    And I set the course duration to 45 minutes
    And I add the topic "Introduction"
    And I add the topic "Main Content"
    And I click the "Preview" button
    Then I should see the course preview panel
    And the preview should show:
      | Field    | Value                |
      | Title    | Preview Test Course  |
      | Audience | QA Engineers         |
      | Duration | 45 minutes           |
      | Topics   | 2 topics             |