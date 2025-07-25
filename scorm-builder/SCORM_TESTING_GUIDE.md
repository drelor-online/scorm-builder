# SCORM Package Testing Guide

## Important: Testing SCORM Packages Locally

When testing SCORM packages that have been exported as ZIP files and extracted locally, you may encounter several issues due to browser security restrictions:

### Common Issues When Testing from file:// Protocol

1. **Captions Not Displaying**
   - **Cause**: CORS (Cross-Origin Resource Sharing) restrictions prevent loading VTT caption files
   - **Error**: `Unsafe attempt to load URL file:///path/to/captions.vtt`
   - **Solution**: Test on a web server or LMS

2. **Audio Duration Not Showing**
   - **Cause**: Some browsers restrict metadata loading for local audio files
   - **Solution**: Use a local web server or upload to LMS

3. **Images Not Loading**
   - **Cause**: Security restrictions on local file access
   - **Solution**: Ensure correct file paths and test on a web server

### Proper Testing Methods

#### Option 1: Use a Local Web Server
```bash
# Using Python 3
cd /path/to/extracted/scorm/package
python -m http.server 8000

# Using Node.js
npx http-server -p 8000

# Then open: http://localhost:8000
```

#### Option 2: Use an LMS
Upload the SCORM package to a Learning Management System such as:
- Moodle
- SCORM Cloud
- Canvas
- Blackboard

#### Option 3: Browser Extensions
Some browser extensions can help bypass CORS restrictions for development:
- "CORS Unblock" for Chrome
- "CORS Everywhere" for Firefox
- **Note**: Only use these for testing, not production

### Browser-Specific Notes

**Chrome**: Most restrictive with local files. Always requires a web server for full functionality.

**Firefox**: More permissive but still blocks cross-origin requests for captions.

**Safari**: Similar restrictions to Chrome.

**Edge**: Based on Chromium, same restrictions as Chrome.

### Verifying Your SCORM Package

To properly verify all features are working:

1. **Check Media Files**
   - Ensure all audio files play
   - Verify images display correctly
   - Confirm video embeds work

2. **Test Captions**
   - Enable captions and verify synchronization
   - Check caption file paths are correct

3. **Validate Interactions**
   - Test all knowledge checks
   - Verify navigation blocking works
   - Ensure answer feedback displays

4. **SCORM Communication**
   - Check completion tracking
   - Verify score reporting
   - Test bookmarking/resume functionality

### Troubleshooting Checklist

- [ ] Are you testing on a web server (not file://)?
- [ ] Do all file paths use relative references?
- [ ] Are file extensions correct (.mp3, .vtt, .jpg)?
- [ ] Is the manifest file properly formatted?
- [ ] Are there any console errors?

## Best Practices

1. Always test in an environment similar to production
2. Use relative paths for all media references
3. Include all media files in the package
4. Test on multiple browsers
5. Validate SCORM compliance before deployment

## Need Help?

If you continue to experience issues:
1. Check browser console for specific errors
2. Verify file paths in the generated HTML
3. Ensure all media files are included in the package
4. Test on SCORM Cloud for compliance verification