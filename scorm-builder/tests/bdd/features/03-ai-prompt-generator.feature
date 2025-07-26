Feature: AI Prompt Generator Step
  As a course creator
  I want to generate effective AI prompts
  So that I can get quality course content

  Background:
    Given I have completed the Course Seed Input step
    And I am on the AI Prompt Generator step

  @prompt-generation
  Scenario: Generate comprehensive prompt
    Given my course configuration includes:
      | Field      | Value                    |
      | Title      | Advanced Python Programming |
      | Difficulty | 4                          |
      | Topics     | 10 topics                  |
    Then the generated prompt should include:
      | Element                    | Present |
      | Course title              | Yes     |
      | Difficulty level (4/5)    | Yes     |
      | All 10 topics             | Yes     |
      | JSON structure template   | Yes     |
      | Knowledge check format    | Yes     |
      | Assessment format         | Yes     |

  @copy-functionality
  Scenario: Copy prompt to clipboard
    When I click the "Copy Prompt" button
    Then the button should change to "✓ Copied!"
    And the prompt should be in my clipboard
    And after 3 seconds the button should revert to "📋 Copy Prompt"

  @prompt-customization
  Scenario: Edit generated prompt
    When I modify the prompt text
    And I add "Include real-world examples"
    Then the modified prompt should be preserved
    
    When I click "Copy Prompt"
    Then the modified version should be copied

  @prompt-sections
  Scenario: Verify prompt structure
    Then the prompt should contain these sections:
      | Section                  | Description                        |
      | Course Overview         | Title, difficulty, topic count     |
      | Topic List              | All topics formatted as list       |
      | JSON Structure          | Expected response format           |
      | Content Requirements    | HTML content, narration, duration  |
      | Knowledge Check Format  | Question structure with feedback   |
      | Assessment Format       | Final quiz question structure      |

  @navigation
  Scenario: Navigation with unsaved changes
    When I modify the prompt
    And I try to go back to the previous step
    Then I should see a confirmation dialog
    
    When I choose to discard changes
    Then I should return to Course Seed Input step
    
    When I return to AI Prompt Generator
    Then the original prompt should be restored

  @help-text
  Scenario: Instructions for AI usage
    Then I should see instructions including:
      | Step | Instruction                                    |
      | 1    | Copy this prompt using the button above       |
      | 2    | Paste it into your preferred AI chatbot       |
      | 3    | Copy the JSON response from the AI            |
      | 4    | Proceed to the next step to validate          |

  @responsive-design
  Scenario: Prompt display on different screen sizes
    When I resize the window to mobile size
    Then the prompt should remain readable
    And the copy button should remain accessible
    
    When I resize to tablet size
    Then the layout should adjust appropriately

  @special-templates
  Scenario: Template-specific prompt additions
    Given I used the "Safety" template in step 1
    Then the prompt should include safety-specific instructions:
      """
      Focus on workplace safety regulations and compliance.
      Include hazard identification and risk mitigation strategies.
      """

  @multi-language
  Scenario: Generate prompts for different languages
    Given my course title includes non-English characters
    When the prompt is generated
    Then it should handle unicode properly
    And maintain proper formatting

  @prompt-length
  Scenario: Handle very long course configurations
    Given I have a course with 50 topics
    Then the prompt should include all topics
    And remain within AI token limits
    And suggest splitting if too long