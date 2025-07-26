Feature: JSON Import Validator Step
  As a course creator
  I want to validate and import AI-generated content
  So that I can ensure the course structure is correct

  Background:
    Given I have completed the AI Prompt Generator step
    And I am on the JSON Import Validator step

  @validation-success
  Scenario: Validate correct JSON structure
    When I paste valid JSON with all required fields
    And I click "Validate JSON"
    Then I should see "JSON is valid! ✓"
    And the validation details should show:
      | Check                    | Status |
      | Valid JSON syntax       | ✅     |
      | Required fields present | ✅     |
      | Welcome page found      | ✅     |
      | Objectives page found   | ✅     |
      | Topics array found      | ✅     |
      | Assessment found        | ✅     |

  @validation-errors
  Scenario: Handle invalid JSON syntax
    When I paste JSON with syntax errors:
      """
      {
        "title": "Test Course"
        "topics": []  // Missing comma
      }
      """
    And I click "Validate JSON"
    Then I should see "Invalid JSON syntax"
    And the error should highlight line 3

  @auto-fix
  Scenario: Auto-fix common JSON issues
    When I paste JSON with smart quotes:
      """
      {
        "title": "Test Course",
        "topics": []
      }
      """
    Then the validator should auto-fix the quotes
    And show "Fixed smart quotes in JSON"

  @missing-fields
  Scenario: Detect missing required fields
    When I paste JSON missing the assessment section
    And I click "Validate JSON"
    Then I should see warnings:
      | Warning                           |
      | Assessment section is missing     |
      | At least 3 questions recommended  |

  @structure-validation
  Scenario Outline: Validate content structure
    When I paste JSON with <issue>
    And I click "Validate JSON"
    Then I should see "<error_message>"

    Examples:
      | issue                        | error_message                          |
      | empty topics array          | At least one topic is required         |
      | missing narration text      | Narration is required for all pages    |
      | invalid HTML in content     | Invalid HTML detected in content       |
      | missing knowledge checks    | Knowledge checks missing for topics    |

  @import-methods
  Scenario: Multiple import methods
    # Paste from clipboard
    When I click "Paste from Clipboard"
    Then the JSON should be pasted into the textarea
    
    # Upload file
    When I click "Choose File"
    And I select "course-content.json"
    Then the file content should load in the textarea
    
    # Drag and drop
    When I drag a JSON file onto the textarea
    Then the file should be loaded

  @json-preview
  Scenario: Preview parsed content
    When I paste valid JSON and validate it
    Then I should see a preview showing:
      | Element      | Count |
      | Pages        | 7     |
      | Topics       | 5     |
      | Questions    | 8     |
      | Total Duration | 25 min |

  @edit-after-validation
  Scenario: Edit JSON after validation
    Given I have validated JSON successfully
    When I click "Clear JSON"
    Then I should see a confirmation dialog
    
    When I confirm clearing
    Then the textarea should be empty
    And the validation status should reset

  @large-content
  Scenario: Handle large JSON files
    When I upload a 5MB JSON file
    Then it should load without freezing
    And validation should complete within 5 seconds
    
    When the JSON has 100+ topics
    Then pagination should be shown in preview

  @error-recovery
  Scenario: Recover from malformed JSON
    When I paste severely malformed JSON
    And validation fails
    Then I should see "Try our JSON repair tool"
    
    When I click "Attempt Repair"
    Then common issues should be fixed
    And I should see what was changed

  @schema-compliance
  Scenario: Validate against expected schema
    When I paste JSON with unexpected fields
    Then I should see warnings about:
      | Unknown field 'customField' will be ignored |
      | Missing expected field 'duration'           |
    
    But validation should still pass if core fields are present

  @locked-state
  Scenario: Lock JSON after successful validation
    When JSON is successfully validated
    Then the textarea should be locked
    And show "JSON Validated ✓"
    
    When I click "Edit JSON"
    Then I should see a warning about re-validation
    And the lock should be removed