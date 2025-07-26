Feature: Audio Narration Wizard Step
  As a course creator
  I want to add narration audio and captions to my course
  So that learners can listen to the content

  Background:
    Given I have completed the Media Enhancement step
    And I am on the Audio Narration Wizard step
    And I can see narration text for all pages

  @narration-display
  Scenario: View narration text for all pages
    Then I should see tabs for each course page:
      | Welcome             |
      | Learning Objectives |
      | Topic 1            |
      | Topic 2            |
      | Topic 3            |
    
    When I click on the "Topic 2" tab
    Then I should see the narration text for Topic 2
    And the text should match what was imported from JSON

  @download-narration
  Scenario: Download narration text file
    When I click "Download Narration Text"
    Then a text file should download containing:
      | Page number and title for each section |
      | Full narration text for each page      |
      | Separator lines between pages          |
    
    And the file should be named "course-narration.txt"

  @individual-audio-upload
  Scenario: Upload audio for individual pages
    When I click on the "Welcome" page tab
    And I click "Upload Audio" for this page
    And I select "welcome-narration.mp3"
    Then I should see an audio player for the welcome page
    And the player should show the audio duration
    
    When I click play
    Then the audio should start playing
    And I should see playback controls

  @bulk-audio-upload
  Scenario: Upload audio files in bulk via ZIP
    When I click "Upload Audio ZIP"
    And I select "narration-audio.zip" containing:
      | welcome.mp3    |
      | objectives.mp3 |
      | topic-1.mp3   |
      | topic-2.mp3   |
      | topic-3.mp3   |
    Then I should see "Processing audio files..."
    And audio players should appear for all pages
    
    When the ZIP has incorrectly named files
    Then I should see suggestions for correct naming

  @audio-file-validation
  Scenario: Validate audio file formats
    When I try to upload "narration.wav"
    Then it should be accepted
    
    When I try to upload "narration.m4a"
    Then I should see "Converting to compatible format..."
    
    When I try to upload "document.pdf"
    Then I should see "Invalid file type. Please upload audio files only"

  @caption-upload
  Scenario: Upload caption files
    Given I have uploaded audio for all pages
    When I click "Upload Captions ZIP"
    And I select "captions.zip" containing VTT files
    Then captions should be associated with each audio
    And I should see "CC" indicator on audio players
    
    When I enable captions during playback
    Then synchronized text should appear below the player

  @individual-caption-upload
  Scenario: Upload captions for individual pages
    Given the welcome page has audio
    When I click "Add Captions" for the welcome page
    And I upload "welcome.vtt"
    Then captions should be added to that page only

  @auto-generation-prompt
  Scenario: Prompt for AI audio generation
    When I click "Generate with AI"
    Then I should see instructions for:
      | Using text-to-speech services    |
      | Recommended AI voice services     |
      | Export settings for compatibility |

  @audio-preview
  Scenario: Preview course with audio
    Given I have uploaded audio for all pages
    When I click "Preview with Audio"
    Then a preview modal should open
    And audio should auto-play when navigating pages
    And playback controls should be visible

  @audio-editing
  Scenario: Edit narration text
    When I click "Edit" for a page's narration
    Then the text should become editable
    
    When I make changes and save
    Then I should see "Narration updated"
    And be prompted to re-upload audio for that page

  @duration-calculation
  Scenario: Calculate and display course duration
    Given pages have the following audio durations:
      | Page       | Duration |
      | Welcome    | 2:30     |
      | Objectives | 1:45     |
      | Topic 1    | 5:20     |
      | Topic 2    | 4:15     |
      | Topic 3    | 6:00     |
    Then the total duration should show "19:50"
    And each page should show its individual duration

  @missing-audio-warnings
  Scenario: Warn about missing audio
    Given only 3 of 5 pages have audio
    Then I should see a warning: "2 pages missing audio"
    And the pages without audio should be highlighted
    
    When I try to proceed to the next step
    Then I should see "Some pages are missing audio. Continue anyway?"

  @audio-synchronization
  Scenario: Ensure audio matches narration text
    When audio duration significantly differs from expected
    Then I should see a warning:
      | Page     | Text Length | Audio Duration | Status    |
      | Topic 1  | 500 words   | 1:20          | Too short |
      | Topic 2  | 200 words   | 8:00          | Too long  |

  @audio-replacement
  Scenario: Replace existing audio
    Given a page already has audio
    When I upload a new audio file for that page
    Then I should see "Replace existing audio?"
    
    When I confirm replacement
    Then the old audio should be replaced
    And any associated captions should be cleared

  @accessibility-features
  Scenario: Accessibility for audio content
    When I upload audio without captions
    Then I should see a warning about accessibility
    
    When I provide captions for all audio
    Then the warning should disappear
    And all audio players should have CC options

  @file-size-limits
  Scenario: Handle large audio files
    When I upload an audio file larger than 10MB
    Then I should see "Compressing audio..."
    And the file should be optimized
    And quality should be maintained

  @error-recovery
  Scenario: Handle upload errors gracefully
    When the audio upload fails due to network error
    Then I should see "Upload failed. Retry?"
    And the retry should resume from where it failed
    
    When a corrupt ZIP file is uploaded
    Then I should see which files couldn't be processed
    And valid files should still be imported