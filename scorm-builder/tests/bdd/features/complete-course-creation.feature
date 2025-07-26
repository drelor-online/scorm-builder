Feature: Complete Course Creation Flow
  As a course creator
  I want to create a complete SCORM course from start to finish
  So that learners can take my course in an LMS

  Background:
    Given I have a clean project state
    And I have valid API keys configured

  @critical @e2e
  Scenario: Create a basic course with all steps
    # Step 1: Course Seed Input
    Given I start creating a new course
    When I enter the following course details:
      | Field    | Value                        |
      | Title    | Introduction to BDD Testing  |
      | Audience | QA Engineers and Developers  |
      | Duration | 30                          |
    And I add the following topics:
      | Topic Name                    |
      | What is BDD?                  |
      | Writing Gherkin Scenarios     |
      | Implementing Step Definitions |
    And I proceed to the next step

    # Step 2: AI Prompt Generator
    Then I should be on the AI Prompt Generator step
    When I select the "Professional" template
    And I enable "Include examples"
    And I enable "Include objectives"
    And I enable "Include assessments"
    And I generate the AI prompt
    Then the prompt should contain "Introduction to BDD Testing"
    And the prompt should contain all 3 topics
    When I paste the following AI response:
      """
      {
        "title": "Introduction to BDD Testing",
        "objectives": [
          "Understand BDD principles",
          "Write effective Gherkin scenarios",
          "Implement step definitions"
        ],
        "welcomeMessage": "Welcome to BDD Testing!",
        "topics": [
          {
            "id": "topic-1",
            "title": "What is BDD?",
            "content": "Behavior-Driven Development is..."
          },
          {
            "id": "topic-2",
            "title": "Writing Gherkin Scenarios",
            "content": "Gherkin is a business-readable language..."
          },
          {
            "id": "topic-3",
            "title": "Implementing Step Definitions",
            "content": "Step definitions connect Gherkin to code..."
          }
        ],
        "assessment": {
          "questions": [
            {
              "question": "What does BDD stand for?",
              "options": [
                "Behavior-Driven Development",
                "Bug-Driven Development",
                "Business-Driven Development"
              ],
              "correctAnswer": 0
            }
          ]
        }
      }
      """
    And I proceed to the next step

    # Step 3: JSON Validation
    Then I should be on the JSON Import Validator step
    And the JSON should be automatically validated
    And I should see "Validation successful"
    When I proceed to the next step

    # Step 4: Media Enhancement
    Then I should be on the Media Enhancement Wizard step
    When I navigate to the "Welcome" page tab
    And I upload an image "welcome-banner.jpg" for the welcome page
    And I navigate to the "Topics" tab
    And I generate AI images for all topics using default keywords
    And I wait for image generation to complete
    Then all topics should have images
    When I proceed to the next step

    # Step 5: Audio Narration
    Then I should be on the Audio Narration Wizard step
    When I select "Browser TTS" as the provider
    And I select "Microsoft David" as the voice
    And I generate audio for the welcome page
    And I generate audio for all topics
    And I wait for audio generation to complete
    Then all pages should have audio files
    And all pages should have caption files
    When I proceed to the next step

    # Step 6: Activities Editor
    Then I should be on the Activities Editor step
    When I add a knowledge check to "What is BDD?" with:
      | Field         | Value                               |
      | Question      | What is the main goal of BDD?       |
      | Type          | multiple-choice                     |
      | Option 1      | Write more tests                    |
      | Option 2      | Improve collaboration              |
      | Option 3      | Reduce bugs                         |
      | Correct       | 2                                   |
      | Feedback      | BDD focuses on collaboration!       |
    And I configure the assessment pass mark to 80%
    When I proceed to the next step

    # Step 7: SCORM Package Builder
    Then I should be on the SCORM Package Builder step
    When I click "Preview Course"
    Then I should see the course preview in an iframe
    And the preview should be navigable
    When I select SCORM version "1.2"
    And I click "Generate SCORM Package"
    And I wait for package generation to complete
    Then a SCORM package should be downloaded
    And the package should contain:
      | File                    |
      | imsmanifest.xml        |
      | index.html             |
      | pages/welcome.html     |
      | pages/topic-1.html     |
      | pages/assessment.html  |
      | media/images/          |
      | media/audio/           |
      | scripts/navigation.js  |
      | styles/main.css        |

  @save-resume
  Scenario: Save and resume course creation
    Given I have started creating a course
    And I have completed steps 1 through 3
    When I save the project as "BDD Course Draft"
    And I close the application
    And I reopen the application
    And I open the project "BDD Course Draft"
    Then I should be on step 4
    And all previous data should be preserved:
      | Step | Data                          |
      | 1    | Course title and topics       |
      | 2    | Generated AI prompt           |
      | 3    | Validated course structure    |

  @validation
  Scenario: Navigation validation prevents skipping steps
    Given I am on step 1
    When I try to navigate directly to step 4
    Then I should remain on step 1
    And I should see "Please complete the current step"
    When I complete step 1 with valid data
    And I try to navigate to step 4
    Then I should be redirected to step 2
    And I should see "Please complete all previous steps"

  @error-recovery
  Scenario: Recover from API errors gracefully
    Given I am on the Audio Narration step
    And the ElevenLabs API is unavailable
    When I try to generate audio with ElevenLabs
    Then I should see an error "Failed to generate audio. Please check your API key or try again later."
    And I should be able to switch to "Browser TTS"
    And I should be able to continue with course creation

  @media-limits
  Scenario: Handle media size limits
    Given I am on the Media Enhancement step
    When I try to upload an image larger than 10MB
    Then I should see an error "Image must be less than 10MB"
    And the image should not be uploaded
    When I upload an image of 5MB
    Then the image should be uploaded successfully
    And I should see a preview of the image