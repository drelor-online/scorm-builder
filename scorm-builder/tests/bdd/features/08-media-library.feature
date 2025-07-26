Feature: Media Library
  As a course creator
  I want to manage media assets for my course
  So that I can enhance the learning experience

  Background:
    Given I am on the dashboard page
    And I have created a new project
    And I have reached the Media Library step

  @media-library @upload
  Scenario: Upload multiple media files
    When I click "Upload Media"
    And I select the following files:
      | Filename          | Type  | Size  |
      | intro-video.mp4   | Video | 25MB  |
      | diagram-1.png     | Image | 2MB   |
      | background.jpg    | Image | 1MB   |
    Then the files should start uploading
    And I should see upload progress
    And successful uploads should appear in the library

  @media-library @organize
  Scenario: Organize media by modules
    Given I have uploaded 10 media files
    When I drag "intro-video.mp4" to module "Introduction"
    Then the file should be associated with that module
    And show a module tag
    When I filter by module "Introduction"
    Then I should only see media for that module

  @media-library @preview
  Scenario: Preview media files
    When I click on an image file
    Then I should see a preview modal
    And I should see the following image details:
      | Property   | Value       |
      | Dimensions | 1920x1080   |
      | Size       | 2.5MB       |
      | Format     | PNG         |
    And I should see the following options:
      | Option        |
      | Edit alt text |
      | Resize image  |
      | Delete file   |

  @media-library @search
  Scenario: Search and filter media
    Given I have 50+ media files
    When I search for "diagram"
    Then I should see only files matching "diagram"
    When I filter by type "Video"
    Then I should see only video files
    When I sort by "Date uploaded"
    Then files should be ordered by upload date

  @media-library @edit
  Scenario: Edit media properties
    When I select an image
    And I click "Edit Properties"
    And I update:
      | Property     | Value                    |
      | Alt text     | Flow chart showing process |
      | Caption      | Figure 1: Process Flow    |
      | Module       | Module 2                  |
    And I click "Save"
    Then the properties should be updated

  @media-library @optimization
  Scenario: Optimize media for SCORM
    When I select a large image
    And I click "Optimize"
    Then I should see optimization options:
      | Resize to max 1024px |
      | Compress (85% quality) |
      | Convert to WebP       |
    When I apply optimizations
    Then the file size should be reduced
    And quality should be acceptable

  @media-library @stock
  Scenario: Use stock media
    When I click "Browse Stock Media"
    And I search for "business"
    Then I should see stock images
    When I select a stock image
    And click "Add to Library"
    Then it should be downloaded and added