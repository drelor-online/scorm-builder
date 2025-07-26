Feature: Export SCORM Package
  As a course creator
  I want to export my course as a SCORM package
  So that I can deploy it to any LMS

  Background:
    Given I am on the dashboard page
    And I have created a complete course
    And I am on the Export SCORM step

  @export @scorm-version
  Scenario: Choose SCORM version
    When I see the export options
    Then I should see version choices:
      | Version     | Description                      |
      | SCORM 1.2   | Best compatibility               |
      | SCORM 2004  | Advanced features                |
    When I select "SCORM 1.2"
    Then compatibility notes should show:
      | Works with most LMS platforms |
      | Limited to single SCO         |
      | Basic tracking capabilities   |

  @export @settings
  Scenario: Configure export settings
    When I configure SCORM settings:
      | Setting              | Value          |
      | Passing Score        | 80%            |
      | Max Attempts         | 3              |
      | Time Limit           | No limit       |
      | Completion Criteria  | View all pages |
      | Launch Mode          | Normal         |
    Then the settings should be validated
    And I should see estimated package size

  @export @metadata
  Scenario: Add course metadata
    When I click "Edit Metadata"
    And I fill in:
      | Field             | Value                         |
      | Course Identifier | INTRO-PYTHON-101             |
      | Version           | 1.0.0                        |
      | Language          | en-US                        |
      | Description       | Introduction to Python basics |
      | Keywords          | python, programming, basics   |
    Then the metadata should be saved
    And included in the manifest

  @export @preview
  Scenario: Preview before export
    When I click "Preview SCORM Package"
    Then a preview window should open
    And I should be able to:
      | Navigate through all modules |
      | Test quiz functionality      |
      | Verify media playback        |
      | Check scoring calculations   |

  @export @generate
  Scenario: Generate SCORM package
    Given all settings are configured
    When I click "Generate SCORM Package"
    Then I should see "Generating package..."
    And a progress bar showing:
      | Compiling content     |
      | Processing media      |
      | Creating manifest     |
      | Zipping package       |
    When generation completes
    Then I should see "Package ready!"
    And download should start automatically

  @export @validation
  Scenario: Validate SCORM package
    When package generation completes
    Then I should see validation results:
      | Check                    | Status |
      | Manifest valid           | ✅     |
      | All files included       | ✅     |
      | No broken links          | ✅     |
      | Media properly referenced| ✅     |
    And option to "Download Validation Report"

  @export @errors
  Scenario: Handle export errors
    Given there is missing required content
    When I click "Generate SCORM Package"
    Then I should see specific errors:
      | Module 3 has no content        |
      | Quiz questions incomplete      |
      | Missing course objectives      |
    And links to fix each issue

  @export @multi-format
  Scenario: Export in multiple formats
    When I click "Advanced Export"
    Then I should see format options:
      | SCORM 1.2 package        |
      | SCORM 2004 package       |
      | Web-ready HTML           |
      | PDF document             |
    When I select multiple formats
    Then each should be generated
    And available for download