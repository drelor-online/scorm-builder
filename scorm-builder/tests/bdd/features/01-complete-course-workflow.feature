Feature: Complete SCORM Course Creation Workflow
  As a course creator
  I want to create a complete SCORM course from start to finish
  So that I can deploy it to an LMS

  Background:
    Given I have a clean browser state
    And the application is running at "http://localhost:1420"

  @critical @e2e
  Scenario: Create a basic SCORM course with all steps
    # Step 1: Course Seed Input
    Given I navigate to the SCORM Builder application
    When I enter the following course configuration:
      | Field       | Value                           |
      | Title       | Introduction to Web Development |
      | Difficulty  | 3                              |
      | Template    | Technical                      |
    And I enter the following topics:
      | HTML Fundamentals          |
      | CSS Styling Basics         |
      | JavaScript Introduction    |
      | Responsive Web Design      |
      | Web Accessibility          |
    Then I should see the course preview update
    When I wait for auto-save to complete
    And I click the Next button
    
    # Step 2: AI Prompt Generator
    Then I should be on the "AI Prompt Generator" step
    And I should see the generated prompt containing:
      | Course title     |
      | All topics       |
      | Difficulty level |
    When I copy the AI prompt
    Then I should see a success message "Copied!"
    When I click the Next button
    
    # Step 3: JSON Import Validator
    Then I should be on the "JSON Import Validator" step
    When I paste the following JSON response:
      """
      {
        "title": "Introduction to Web Development",
        "welcomePage": {
          "title": "Welcome to Web Development",
          "content": "<h2>Welcome!</h2><p>Get ready to learn web development.</p>",
          "narration": "Welcome to this comprehensive course on web development.",
          "duration": 2
        },
        "learningObjectivesPage": {
          "title": "Learning Objectives",
          "content": "<h2>What You'll Learn</h2><ul><li>HTML basics</li><li>CSS fundamentals</li></ul>",
          "narration": "By the end of this course, you will understand the basics of web development.",
          "duration": 2
        },
        "topics": [
          {
            "id": "topic-1",
            "title": "HTML Fundamentals",
            "content": "<h2>HTML Basics</h2><p>HTML is the foundation of web pages.</p>",
            "narration": "HTML, or HyperText Markup Language, is the standard markup language for web pages.",
            "duration": 3,
            "knowledgeCheck": {
              "question": "What does HTML stand for?",
              "options": ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language"],
              "correctAnswer": 0,
              "feedback": {
                "correct": "That's right! HTML stands for HyperText Markup Language.",
                "incorrect": "Not quite. HTML stands for HyperText Markup Language."
              }
            }
          }
        ],
        "assessment": {
          "questions": [
            {
              "question": "Which tag is used for the largest heading?",
              "options": ["<h1>", "<h6>", "<heading>", "<head>"],
              "correctAnswer": 0
            }
          ]
        }
      }
      """
    And I click the "Validate JSON" button
    Then I should see "JSON is valid!"
    When I click the Next button
    
    # Step 4: Media Enhancement Wizard
    Then I should be on the "Media Enhancement Wizard" step
    And I should see tabs for "Welcome", "Objectives", and topic pages
    When I click on the "Welcome" tab
    And I search for images with keyword "web development"
    And I select the first image from search results
    Then the welcome page should have an image
    When I click on the "HTML Fundamentals" tab
    And I upload a local image "html-diagram.png"
    Then the topic should have the uploaded image
    When I click the Next button
    
    # Step 5: Audio Narration Wizard
    Then I should be on the "Audio Narration Wizard" step
    And I should see the narration text for each page
    When I download the narration text file
    Then a text file should be downloaded
    When I upload the audio ZIP file "narration-audio.zip"
    Then all pages should show audio players
    When I upload the captions ZIP file "narration-captions.zip"
    Then all pages should show caption indicators
    When I click the Next button
    
    # Step 6: Activities Editor
    Then I should be on the "Activities Editor" step
    And I should see the knowledge check for "HTML Fundamentals"
    When I edit the knowledge check question
    And I change the question to "What is the purpose of HTML?"
    And I save the changes
    Then the knowledge check should be updated
    When I click the Next button
    
    # Step 7: SCORM Package Builder
    Then I should be on the "SCORM Package Builder" step
    When I select SCORM version "1.2"
    And I set the pass mark to "80%"
    And I click "Preview Course"
    Then I should see the course preview in an iframe
    When I close the preview
    And I click "Generate SCORM Package"
    Then I should see "Generating package..."
    And a SCORM package should be downloaded

  @validation
  Scenario: Validate required fields at each step
    Given I navigate to the SCORM Builder application
    
    # Test Course Seed validation
    When I click the Next button without entering any data
    Then I should see an error "Course title is required"
    And I should remain on the "Course Seed Input" step
    
    When I enter "Test Course" as the course title
    And I click the Next button
    Then I should see an error "At least one topic is required"
    
    # Test JSON validation
    When I complete the course seed input with valid data
    And I proceed to the "JSON Import Validator" step
    And I paste invalid JSON
    And I click the "Validate JSON" button
    Then I should see an error message about invalid JSON

  @navigation
  Scenario: Navigate between steps using the progress indicator
    Given I have completed steps 1 through 3
    When I click on step 1 in the progress indicator
    Then I should be on the "Course Seed Input" step
    And my previous data should be preserved
    
    When I click on step 3 in the progress indicator
    Then I should be on the "JSON Import Validator" step
    And the validated JSON should still be present

  @save-resume
  Scenario: Save and resume course creation
    Given I navigate to the SCORM Builder application
    When I create a course with title "My Saved Course"
    And I add topics and proceed to step 3
    And I save the project
    Then I should see "Project saved successfully"
    
    When I refresh the page
    Then I should be on the "JSON Import Validator" step
    And all my previous data should be loaded

  @media-features
  Scenario: Advanced media enhancement features
    Given I am on the "Media Enhancement Wizard" step
    
    # Test video embedding
    When I click on a topic tab
    And I paste a YouTube URL "https://youtube.com/watch?v=example"
    Then the topic should show an embedded video player
    
    # Test image removal
    When I add an image to a page
    And I click the "Remove Media" button
    And I confirm the removal
    Then the page should have no media

  @audio-features  
  Scenario: Audio narration with individual page controls
    Given I am on the "Audio Narration Wizard" step
    
    # Test individual audio upload
    When I click on the "Welcome" page audio section
    And I upload an individual audio file
    Then only the welcome page should have audio
    
    # Test audio playback
    When I click the play button
    Then the audio should start playing
    And the timestamp should update

  @scorm-options
  Scenario: Configure advanced SCORM options
    Given I am on the "SCORM Package Builder" step
    
    When I select SCORM version "2004"
    Then I should see SCORM 2004 specific options
    
    When I enable "Track detailed interactions"
    And I set completion criteria to "All pages visited"
    And I generate the package
    Then the manifest should include interaction tracking

  @error-recovery
  Scenario: Recover from errors gracefully
    Given I am creating a course
    
    # Test network error recovery
    When the network connection is lost
    And I try to search for images
    Then I should see "Network error. Please check your connection."
    
    When the network connection is restored
    And I retry the image search
    Then the search should complete successfully
    
    # Test invalid file upload
    When I try to upload an invalid audio file
    Then I should see "Invalid file format. Please upload a .mp3 or .wav file."

  @accessibility
  Scenario: Ensure accessibility features work
    Given I navigate to the SCORM Builder application
    
    # Test keyboard navigation
    When I press Tab key repeatedly
    Then focus should move through all interactive elements in order
    
    When I press Enter on the Next button
    Then I should proceed to the next step
    
    # Test screen reader announcements
    When an error occurs
    Then the error should be announced to screen readers
    
    When I complete a step successfully  
    Then success should be announced to screen readers