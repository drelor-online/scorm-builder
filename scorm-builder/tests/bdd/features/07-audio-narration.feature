Feature: Audio Narration
  As a course creator
  I want to add audio narration to my course
  So that learners can listen to the content

  Background:
    Given I am on the dashboard page
    And I have created a new project
    And I have reached the Audio Narration step
    And I have course content ready

  @audio-narration @tts
  Scenario: Generate narration using text-to-speech
    When I select module "Introduction"
    And I click "Generate Narration"
    And I select voice "Professional Female"
    And I set speed to "Normal"
    And I click "Generate Audio"
    Then I should see "Generating audio..."
    And audio should be generated within 30 seconds
    And I should be able to play the audio

  @audio-narration @upload
  Scenario: Upload custom audio files
    When I select module "Welcome"
    And I click "Upload Audio"
    And I select "welcome-narration.mp3"
    Then the audio should be uploaded
    And I should see the waveform
    And playback controls should be available

  @audio-narration @edit
  Scenario: Edit narration text
    When I select a module with content
    Then I should see the narration script
    When I click "Edit Script"
    And I modify the text for better speech
    And I click "Update Script"
    Then the changes should be saved
    And I can regenerate audio with new script

  @audio-narration @sync
  Scenario: Sync audio with content
    Given I have generated audio for a module
    When I click "Sync with Content"
    Then I should see timing markers
    And I can adjust when audio segments play
    And preview the synchronized presentation

  @audio-narration @voice-selection
  Scenario: Choose different voices
    When I click "Change Voice"
    Then I should see available voices:
      | Voice Type        | Language |
      | Professional Male | English  |
      | Professional Female | English |
      | Casual Male       | English  |
      | Casual Female     | English  |
    When I select a different voice
    And regenerate audio
    Then the new voice should be used

  @audio-narration @skip
  Scenario: Skip narration for specific modules
    When I select module "Quiz"
    And I click "Skip Narration"
    Then the module should be marked as "No narration"
    And I can proceed to the next module

  @audio-narration @batch
  Scenario: Generate narration for all modules
    When I click "Generate All"
    Then I should see progress for each module
    And successful generations should be marked
    And failed ones should show retry option