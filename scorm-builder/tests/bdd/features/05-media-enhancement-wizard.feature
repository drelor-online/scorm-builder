Feature: Media Enhancement Wizard Step
  As a course creator
  I want to add images and videos to my course
  So that it becomes more engaging and visual

  Background:
    Given I have completed the JSON Import step
    And I am on the Media Enhancement Wizard step
    And I have API keys configured for image search

  @page-navigation
  Scenario: Navigate between course pages
    Then I should see tabs for:
      | Welcome           |
      | Learning Objectives |
      | Topic 1           |
      | Topic 2           |
      | Topic 3           |
    
    When I click on "Topic 2" tab
    Then I should see the content for Topic 2
    And the tab should be highlighted
    
    When I use arrow keys to navigate
    Then I should move between tabs

  @image-search
  Scenario: Search and add images from web
    When I click on the "Welcome" tab
    And I search for "professional training"
    And I click "Search"
    Then I should see image results
    And each image should show:
      | Preview thumbnail |
      | Image title      |
      | Source info      |
    
    When I click on the first image
    Then it should be added to the welcome page
    And I should see "Image added successfully"

  @suggested-keywords
  Scenario: Use AI-suggested keywords
    When I'm on a topic page about "Python Programming"
    Then I should see suggested keywords:
      | python code     |
      | programming    |
      | software development |
    
    When I click a suggested keyword
    Then it should populate the search field
    And trigger a new search

  @local-upload
  Scenario: Upload local images
    When I click "Upload Image"
    And I select "diagram.png" from my computer
    Then the image should upload
    And be displayed in the content area
    
    When I upload an invalid file type
    Then I should see "Please upload an image file (PNG, JPG, GIF)"

  @video-embedding
  Scenario: Embed YouTube videos
    When I paste "https://youtube.com/watch?v=abc123"
    And I click "Embed Video"
    Then I should see a video player
    And the video should be responsive
    
    When I paste an invalid YouTube URL
    Then I should see "Please enter a valid YouTube URL"

  @media-replacement
  Scenario: Replace existing media
    Given a page already has an image
    When I search and select a new image
    Then I should see "Replace existing image?"
    
    When I confirm replacement
    Then the old image should be replaced
    And I should see "Image updated"

  @media-removal
  Scenario: Remove media from pages
    Given a page has an image
    When I click "Remove Media" button
    Then I should see "Are you sure?"
    
    When I confirm removal
    Then the media should be removed
    And the page should show "No media"

  @bulk-operations
  Scenario: Add images to multiple pages
    When I click "Bulk Add Images"
    And I select pages:
      | Welcome    |
      | Topic 1    |
      | Topic 3    |
    And I search for "technology"
    And I assign images to each page
    Then all selected pages should have images

  @preview-mode
  Scenario: Preview pages with media
    When I add images to several pages
    And I click "Preview"
    Then I should see the course content with:
      | Embedded images at correct size |
      | Proper image alignment         |
      | Alt text for accessibility     |

  @image-optimization
  Scenario: Handle large images
    When I upload a 10MB image
    Then I should see "Optimizing image..."
    And the image should be resized
    And file size should be under 1MB

  @api-limits
  Scenario: Handle API rate limits
    Given I've made many image searches
    When I hit the API rate limit
    Then I should see "Search limit reached. Try again in X minutes"
    And local upload should still work

  @responsive-images
  Scenario: Ensure images work on all devices
    When I add an image to a page
    Then it should have responsive sizing
    And look good on:
      | Desktop (1920x1080) |
      | Tablet (768x1024)   |
      | Mobile (375x667)    |

  @accessibility
  Scenario: Add alt text to images
    When I add an image
    Then I should be prompted for alt text
    
    When I enter "Diagram showing code structure"
    Then the alt text should be saved
    And appear in the generated HTML

  @error-handling
  Scenario: Handle search failures gracefully
    When the image search API is down
    And I try to search
    Then I should see "Search temporarily unavailable"
    And "Try uploading a local image instead"
    
    When I click "Retry"
    Then it should attempt the search again