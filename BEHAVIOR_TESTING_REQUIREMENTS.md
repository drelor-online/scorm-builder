General comments:
Native dialogs should not be used, use consistent confirmation dialogs across the application
There should be consistent padding styles, button styles, etc.  There shouldn't be any text fields that overrun card edges, there should always be padding so that elements don't touch each other or edges of pages or cards.
Whether it is a modal window or main page, if the content overflows, the user needs to be able to scroll.

Project Dashboard:
Here is how I would expect my experience to be on the initial dashboard page:
If there are any existing project files in the user's save file default folder, they are presented on the screen with the option to delete them (all destructive actions require confirmation), or open them.
There should be an option to change the default storage folder on the project dashboard page.  If the user changes the folder, the program will then look for files in that folder and display them.
In addition to any existing projects, the user should have the option to Create a New Project.
If no projects exist in the project folder, the user should be instructed to create their first project.
There should be helpful instructions on the screen if no project exists (they shouldn't be bragging about features, it should just be basic helpful information about what the program is for).
If the user chooses to create a new project or their first project, they should be prompted to enter a title for the project and hit a Create button, at which point the scormproj file is created based on that name and placed in the user's set default project folder.
If the user opens a project, it should be like opening a project at any other time (except if the program was just opened there won't need to be any confirmation about losing unsaved data of the current project).
There should be helpful tooltips and consistent styling with the rest of the program.
A user should be able to drag and drop a .scormproj file onto the screen to open it.

General comments about the top bar above main pages:
Open should re-open the dashboard page.  If a user selects a project to open, they should be alerted that it can erase unsaved project data (only if there IS unsaved project data).
Save should save every detail at the project that hasn't been saved from every page that contributes data/media/etc. to the file.
Save As... should open a dialog to save the file as a .scormproj file of a different name, always defaulting to the default scormproj folder.
The autosave indicator should work ON EVERY PAGE - you should be able to save from the course seed to the scorm generation page.
The help button should open a help page in a modal window that is slim, efficient and informative.
The Settings window should contain ways for users to enter and save their API keys and contain settings for every other possible settings needed for the app (including things like default project folder).
The Preview course button should open a course preview that looks and operates EXACTLY like the SCORM generated package at the end based on the currently entered data in the entire project.  It doesn't matter what page you're on, if you entered data on further pages that should be considered too.
The back button should appear on every "main" page except the course seed input and should NOT cause any data to be lost.  If this requires a confirmation for the user to save, so be it but either way no data should be lost by going back.
The Next button should go to the next workflow main page and only be enabled if there if required fields are filled or required actions are completed.
The project progress indicator should allow free flow back and forth between project elements that have already been accessed/opened.  If a step has been reached, it should remain blue, even if a user goes back to a previous step.  Going back doesn't "undo" a step being reached and one should be able to go forward again with that information.
The one exception to the above is that if a user tries to clear a json that has been entered on the JSON validation page, they should be warned that this will erase the data on the following pages.  They should be alerted that data should be changed on the following pages if they wish to modify the content.
There should be text on the progress indicator indicating both the number and short description of that step (doesn't need to be full page title).

Course Seed Input Page:
The user must enter a course title, at least one topic, select a difficulty and may optionally choose a template.
If a template is selected, the user may then choose to add the template topics by a link that appears below.
If the user chooses to add template topics by clicking that button, it should add them to the topics box.  It should first check if there's any topics entered in the box and ask the user if they're sure they want to add template topics because existing topics will be cleared (and then clear the topics before adding the new template topics).
The user should enter one topic per line in the topics box.
The manage templates button should open a dialog that this feature will be implemented in a future release (there is currently code for it, but it needs work).

AI Prompt Page:
This page is pretty straightforward.  It should have basic information about the course and give the appropriate prompt based on the information provided on the Course Seed Input page.
There should be a button for the user to copy the prompt to the clipboard and when the user presses it, it should do just that and give the user feedback that it has been copied to the clipboard.

JSON Import & Validation Page:
This page should generally open up empty for the first time open in a project.
The user can either paste from their clipboard with a button press or choose a json file from their drive with a button press.
When the user presses the button to Validate their JSON file, if it fails validation, the user should be told EXACTLY what is wrong and where.  Easy fixes should be done automatically and reported to the user.
If the JSON passes validation, it should be "locked in" and the text input box for JSON is disabled and can only be cleared by a "Clear" button that appears after the text box is disabled.
Pressing the clear button should delete all project information modified in the following pages and the user should be alerted to that if they hit the button and given the option to cancel.

Media Enhancement Page:
The media enhancement page should have buttons for previous topic and next topic allowing you to navigate through all the topic content and add 1 piece of media to each content page (including the welcome and learning objectives pages).
The user should be able to press a button which allows them to edit the text content of the page in a rich text editor which will be sort of a WYSIWIG editor that converts back to HTML on the backend for passing on to the SCORM package ultimately.
The content text editor should have typical rich text editor buttons for headings, lists, fonts, font sizes, etc.
Below the text content should be a preview of the selected media with a button allowing the user to remove the media and a confirmation dialog if they choose to do so confirming their choice.
Below the preview should be the Google Image search section which has paginated 16:9 results from the Google search using the provided API key and CSE ID in the settings.  Clicking on an image opens a larger preview of the image asking if the user wants to select the image or cancel.
If media has already been selected, it should ask the user if they want to replace the current selected media or not in a dialog.
The youtube video search should work similarly (make sure it has proper API calls for youtube with the youtube API key in the settings).
Following that, the user would have the option of uploading a file or using the suggested AI prompt with external links to AI image generators.  There should be a button to copy the AI prompt and instructions on how to use the external generators to create an image and use the uploader to upload it.
When the project is saved, media added to each topic SHOULD BE SAVED TO THE .scormproj file.  Images should be downloaded and added to the file, uploaded images should be added to the file and Youtube videos should be stored in such a way that when reloaded there will be no issues showing the embedded video (though there's no need to download the video itself).

Audio Narration Page:
I believe the functionality of this page as it stands is working as expected but I want to ensure that audio and captions are being saved appropriately to the .scormproj files when the project is saved.

Activities Editor Page:
I believe the functionality of this page as it stands is working as expected but I just want to ensure that the question data is getting saved appropriately to the .scormproj file.

Generate SCORM Package page:
The course title should be automatically brought in based on the course title provided at the beginning.
When a user hits the Generate SCORM Package button, it should call the Tauri/Rust backend code to Generate the SCORM package.  Examine the current SCORM Generator "frontend" code to see how it is created and come up with tests to re-create this in the Tauri/Rust backend code.

