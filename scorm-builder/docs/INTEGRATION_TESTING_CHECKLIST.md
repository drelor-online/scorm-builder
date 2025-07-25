# SCORM Builder Integration Testing Checklist

## Overview
This checklist covers all integrated features to ensure they work correctly together in the SCORM Builder application.

## ✅ Pre-Test Setup
- [ ] Clear browser cache and localStorage
- [ ] Have sample images and videos ready for testing
- [ ] Prepare a JSON file with course content
- [ ] Have API keys ready (optional)

## 🔄 Complete Workflow Test

### 1. Course Configuration
- [ ] Enter course title "Integration Test Course"
- [ ] Select difficulty level (Medium)
- [ ] Add 5-10 learning topics
- [ ] Select a template (e.g., "Corporate")
- [ ] Click "Add Template Topics" and verify topics are added
- [ ] Open Template Editor
  - [ ] Verify template loads correctly
  - [ ] Make a small edit
  - [ ] Save the template
  - [ ] Verify it persists in localStorage
- [ ] Continue to AI Prompt

### 2. AI Prompt Generation
- [ ] Verify prompt includes all course details
- [ ] Copy prompt to clipboard
- [ ] Verify clipboard notification appears
- [ ] Continue to JSON Import

### 3. JSON Import & Validation
- [ ] Paste valid JSON content
- [ ] Click "Validate JSON"
- [ ] Verify validation success message
- [ ] Click "Preview Course"
  - [ ] Verify SCORM player preview opens
  - [ ] Navigate through pages with arrow keys
  - [ ] Test font size controls
  - [ ] Test high contrast mode
  - [ ] Close preview
- [ ] Continue to Media Enhancement

### 4. Media Enhancement
- [ ] Navigate through all course pages
- [ ] Search for images (if API key configured)
- [ ] Add 2-3 images to different pages
- [ ] Switch to Media Library tab
  - [ ] Verify previously added images appear
  - [ ] Add an image from library to a page
- [ ] Upload a local image
- [ ] Remove an image and confirm deletion
- [ ] Continue to Audio Narration

### 5. Audio Narration
- [ ] Download narration text file
- [ ] Verify all narration content is included
- [ ] Edit narration for one page
- [ ] If available, upload audio ZIP file
- [ ] If available, upload captions ZIP file
- [ ] Continue to Activities Editor

### 6. Activities Editor
- [ ] Review knowledge check questions
- [ ] Edit a question
- [ ] Change question type
- [ ] Remove a knowledge check question
- [ ] Review assessment questions
- [ ] Edit an assessment question
- [ ] Verify changes are saved
- [ ] Continue to SCORM Package Builder

### 7. SCORM Package Builder
- [ ] Select SCORM 2004 version
- [ ] Click "Preview Course"
  - [ ] Verify full SCORM player preview
  - [ ] Check all media is displayed
  - [ ] Verify questions appear correctly
- [ ] Generate SCORM Package
- [ ] Download the package
- [ ] Verify ZIP file contains all assets

## 💾 Data Persistence Tests

### Save/Load Project
- [ ] Save project at step 3 (JSON Import)
- [ ] Refresh the page
- [ ] Open saved project
- [ ] Verify all data is restored correctly
- [ ] Continue from where you left off

### Media Library Persistence
- [ ] Add 3-4 images to Media Library
- [ ] Close and reopen the application
- [ ] Go to Media Enhancement step
- [ ] Verify Media Library items persist

### Custom Templates
- [ ] Create a custom template in Template Editor
- [ ] Save it with a unique name
- [ ] Start a new project
- [ ] Verify custom template appears in dropdown

## 📦 Export/Import Tests

### Full Export
- [ ] Create a project with:
  - [ ] Custom template
  - [ ] Media library items
  - [ ] All steps completed
- [ ] Export the project
- [ ] Verify ZIP file downloads

### Full Import
- [ ] Clear all data (new incognito window)
- [ ] Import the exported project
- [ ] Verify all data is restored:
  - [ ] Course configuration
  - [ ] Media library
  - [ ] Custom templates
  - [ ] Current step

## ⌨️ Keyboard Shortcuts
- [ ] Press Ctrl/Cmd + S to save
- [ ] Press Ctrl/Cmd + O to open
- [ ] Press Ctrl/Cmd + / for help
- [ ] Press Ctrl/Cmd + , for settings
- [ ] Press Esc to close modals

## 🔍 Feature Discovery
- [ ] Click "Discover" button in header
- [ ] Verify feature list appears
- [ ] Click on 2-3 features
- [ ] Verify "NEW" badges disappear
- [ ] Close and reopen Feature Discovery
- [ ] Verify viewed features don't show "NEW"

## 🎯 Edge Cases

### Unsaved Changes
- [ ] Make changes without saving
- [ ] Try to open another project
- [ ] Verify unsaved changes warning appears
- [ ] Test "Save and Continue"
- [ ] Test "Discard Changes"

### Large Content
- [ ] Import JSON with 20+ topics
- [ ] Add media to most topics
- [ ] Verify performance remains acceptable
- [ ] Generate SCORM package
- [ ] Verify all content is included

### Network Issues
- [ ] Disconnect from internet
- [ ] Verify app continues to work
- [ ] Verify appropriate error messages for API calls

## 🐛 Known Issues to Verify Fixed
- [ ] Template Editor saves templates correctly
- [ ] Media Library persists across sessions
- [ ] Export includes all project data
- [ ] Course Preview shows SCORM player view
- [ ] SCORM 2004 option is available and works

## 📊 Performance Checks
- [ ] Page transitions are smooth
- [ ] Media uploads are responsive
- [ ] Preview loads quickly
- [ ] SCORM generation completes in reasonable time
- [ ] No memory leaks during extended use

## ✅ Sign-off
- [ ] All critical features tested
- [ ] No blocking issues found
- [ ] Performance is acceptable
- [ ] Data integrity maintained
- [ ] User experience is smooth

---

**Tester:** _______________________  
**Date:** _______________________  
**Version:** _______________________  
**Notes:** _______________________