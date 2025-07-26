Feature: SCORM Package Builder Step
  As a course creator
  I want to generate a SCORM package
  So that I can deploy my course to an LMS

  Background:
    Given I have completed all previous steps
    And I am on the SCORM Package Builder step
    And my course is ready for packaging

  @package-configuration
  Scenario: Configure SCORM package settings
    Then I should see package configuration options:
      | Setting              | Options                          |
      | SCORM Version       | 1.2, 2004 3rd Edition, 2004 4th |
      | Package Name        | Auto-filled from course title    |
      | Organization ID     | Auto-generated unique ID         |
      | Pass Mark           | Percentage slider (0-100)        |
      | Completion Criteria | Various options                  |

  @scorm-version-selection
  Scenario: Select SCORM version
    When I select "SCORM 1.2"
    Then I should see compatibility note "Widely supported, basic tracking"
    
    When I select "SCORM 2004"
    Then I should see "Advanced sequencing and navigation"
    And additional options should appear:
      | Sequencing rules      |
      | Navigation controls   |
      | Rollup rules         |

  @completion-criteria
  Scenario: Set completion criteria
    When I set completion criteria to "All pages visited"
    Then the package should track page visits
    
    When I select "Assessment passed"
    Then I must set a pass mark
    And the package should track quiz scores
    
    When I select "Time spent"
    And I set minimum time to "15 minutes"
    Then the package should track session time

  @pass-mark-configuration
  Scenario: Configure passing score
    When I set the pass mark to 80%
    Then the preview should show "80% required to pass"
    
    When I enable "Show score to learner"
    Then score display option should be included
    
    When I set "Allow infinite attempts"
    Then retry configuration should update

  @metadata-configuration
  Scenario: Add course metadata
    When I click "Edit Metadata"
    Then I can configure:
      | Field         | Value                            |
      | Description   | Comprehensive web development... |
      | Keywords      | HTML, CSS, JavaScript           |
      | Author        | John Doe                        |
      | Language      | en-US                           |
      | Duration      | 45 minutes                      |
      | Difficulty    | Intermediate                    |

  @preview-course
  Scenario: Preview complete course
    When I click "Preview Course"
    Then a preview window should open
    And I should see the course exactly as learners will
    
    When I navigate through the course
    Then all features should work:
      | Navigation between pages   |
      | Media playback            |
      | Knowledge checks          |
      | Assessment functionality  |
      | Progress tracking         |

  @preview-mobile
  Scenario: Preview on different devices
    When I select "Mobile Preview"
    Then the preview should show mobile layout
    And touch interactions should work
    
    When I select "Tablet Preview"
    Then the layout should adjust for tablet
    
    When I test orientation changes
    Then content should reflow properly

  @package-generation
  Scenario: Generate SCORM package
    When I click "Generate SCORM Package"
    Then I should see progress indicators:
      | Step                    | Status    |
      | Validating content      | ✓         |
      | Generating HTML files   | ✓         |
      | Creating manifest       | ✓         |
      | Packaging resources     | ✓         |
      | Creating ZIP file       | ✓         |
    
    And a ZIP file should download
    And the package should be named "Introduction_to_Web_Development_SCORM.zip"

  @package-validation
  Scenario: Validate SCORM package
    When package generation completes
    Then I should see "Package validated successfully"
    And validation should check:
      | Manifest XML validity           |
      | Required files present          |
      | Resource references valid       |
      | No broken links                |
      | Media files included correctly  |

  @error-handling
  Scenario: Handle packaging errors
    When an image file is missing
    Then I should see "Warning: Missing media file"
    And option to "Continue without media" or "Fix issues"
    
    When course title contains invalid characters
    Then they should be sanitized in package name

  @manifest-customization
  Scenario: Advanced manifest options
    When I click "Advanced Options"
    Then I can customize:
      | Mastery score override        |
      | Time limit enforcement        |
      | Prerequisites configuration   |
      | Custom parameters             |

  @resource-optimization
  Scenario: Optimize package size
    Given my course has large media files
    When I enable "Optimize for web delivery"
    Then images should be compressed
    And audio should be optimized
    And I should see size reduction: "Package size reduced by 40%"

  @multi-language-support
  Scenario: Configure language settings
    When I add Spanish translations
    Then the manifest should include:
      | Primary language: English    |
      | Additional language: Spanish |
    And language switching should be available

  @lms-specific-options
  Scenario: LMS-specific configurations
    When I select "Optimize for Moodle"
    Then Moodle-specific settings should apply
    
    When I select "Optimize for Cornerstone"
    Then package should include Cornerstone compatibility

  @package-contents-review
  Scenario: Review package contents
    When I click "Review Package Contents"
    Then I should see file tree:
      | imsmanifest.xml          |
      | /content/                |
      | /content/index.html      |
      | /content/pages/          |
      | /content/media/          |
      | /content/scripts/        |
      | /content/styles/         |

  @regenerate-package
  Scenario: Regenerate with changes
    Given I have generated a package
    When I go back to step 3 and make changes
    And return to SCORM Package Builder
    Then I should see "Course has changes. Regenerate package?"
    
    When I regenerate
    Then new package should include updates

  @download-source-files
  Scenario: Export source files
    When I click "Download Source Files"
    Then I should download an archive containing:
      | Original JSON structure    |
      | Media files               |
      | Audio files               |
      | Caption files             |
      | Configuration settings    |

  @package-testing-tools
  Scenario: Test package compatibility
    When I click "Test in SCORM Cloud"
    Then instructions should appear for:
      | Creating free SCORM Cloud account |
      | Uploading package for testing     |
      | Reviewing compatibility report    |

  @completion-certificate
  Scenario: Include completion certificate
    When I enable "Include Certificate"
    And I customize certificate template
    Then certificate.html should be added to package
    And trigger on course completion

  @analytics-configuration
  Scenario: Configure analytics tracking
    When I enable "Advanced Analytics"
    Then tracking should include:
      | Page view duration          |
      | Interaction details         |
      | Question-level analytics    |
      | Navigation patterns         |

  @final-summary
  Scenario: Show package summary
    After successful generation
    Then I should see summary:
      | Package size         | 15.2 MB              |
      | SCORM version       | 2004 4th Edition     |
      | Total pages         | 15                   |
      | Total duration      | 45 minutes           |
      | Media files         | 12 images, 5 audio   |
      | Assessment questions| 13                   |
      | Pass mark          | 80%                  |