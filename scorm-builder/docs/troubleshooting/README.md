# SCORM Builder Troubleshooting Guide

## Common Issues and Solutions

### Media Upload Issues

#### Problem: "File upload failed" error
**Symptoms:**
- Error message appears when trying to upload images, videos, or audio
- Upload progress stops or fails

**Solutions:**
1. **Check file size**: Maximum file sizes are:
   - Images: 10MB
   - Videos: 100MB
   - Audio: 50MB

2. **Verify file format**: Supported formats:
   - Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.webp`
   - Videos: `.mp4`, `.webm`, `.ogg`
   - Audio: `.mp3`, `.wav`, `.ogg`, `.m4a`

3. **Check available disk space**: Ensure sufficient space on your system drive

4. **Clear browser cache**: Sometimes cached data can interfere with uploads

**Debug steps:**
```javascript
// Open browser console (F12) and check for errors
// Look for specific error messages in red
```

#### Problem: "Media not displaying" after upload
**Symptoms:**
- Media uploads successfully but shows as broken image/video
- Blob URLs not working

**Solutions:**
1. **Refresh the page**: Forces recreation of blob URLs
2. **Check browser console** for Content Security Policy errors
3. **Verify media service is connected**:
   ```javascript
   // In browser console:
   window.testMediaService && window.testMediaService()
   ```

### YouTube Video Issues

#### Problem: "Invalid YouTube URL"
**Symptoms:**
- Error when trying to add YouTube video
- Video URL not accepted

**Solutions:**
1. **Use standard YouTube URLs**:
   - ✅ `https://www.youtube.com/watch?v=VIDEO_ID`
   - ✅ `https://youtu.be/VIDEO_ID`
   - ❌ Playlist URLs not supported
   - ❌ Shortened URLs may not work

2. **Check video availability**:
   - Video must be public or unlisted
   - Age-restricted videos may not work
   - Regional restrictions apply

### Performance Issues

#### Problem: "Application running slowly"
**Symptoms:**
- Lag when navigating between pages
- Slow media loading
- UI freezing

**Solutions:**
1. **Clear media cache**:
   ```javascript
   // In browser console:
   localStorage.clear()
   // Then refresh the page
   ```

2. **Reduce number of open projects**: Close unused projects from dashboard

3. **Check system resources**:
   - Close other applications
   - Ensure at least 4GB RAM available
   - Check CPU usage

4. **Enable performance monitoring**:
   ```javascript
   // In browser console:
   window.enablePerformanceMonitoring = true
   ```

### Project Loading Issues

#### Problem: "Failed to load project"
**Symptoms:**
- Project won't open from dashboard
- Loading spinner stuck
- Error message about corrupted data

**Solutions:**
1. **Try opening in a new window**: Right-click project → "Open in new window"

2. **Export and re-import project**:
   - From dashboard, export the project as `.zip`
   - Create new project and import the exported file

3. **Check project file integrity**:
   ```javascript
   // In browser console:
   window.validateProject && window.validateProject('project-id')
   ```

### SCORM Generation Issues

#### Problem: "SCORM package generation failed"
**Symptoms:**
- Error during package creation
- Incomplete or corrupted `.zip` file
- Missing files in package

**Solutions:**
1. **Ensure all required content exists**:
   - Welcome page content
   - Learning objectives
   - At least one topic with content
   - Assessment questions

2. **Check for special characters**: Remove or escape special characters in:
   - Course title
   - Topic titles
   - File names

3. **Verify media files are uploaded**: All referenced media must be uploaded before generation

4. **Try regenerating**:
   - Clear any partial downloads
   - Click "Generate SCORM Package" again
   - Wait for completion message

### Browser Compatibility Issues

#### Problem: "Feature not working in my browser"
**Supported Browsers:**
- Chrome/Edge (Chromium): Version 90+
- Firefox: Version 88+
- Safari: Version 14+

**Common Issues by Browser:**

**Safari:**
- May have issues with blob URLs
- Solution: Enable "Develop" menu and disable local file restrictions

**Firefox:**
- May block some media operations
- Solution: Check privacy settings and allow media access

**Edge:**
- Ensure running Chromium version (not legacy Edge)

### Network and Connectivity Issues

#### Problem: "Network error" or "Connection failed"
**Symptoms:**
- Errors when saving
- Media upload failures
- Sync issues

**Solutions:**
1. **Check internet connection**: Some features require internet for:
   - YouTube video validation
   - External image URLs
   - Murf AI integration

2. **Check firewall/antivirus**: May block Tauri application
   - Add exception for SCORM Builder
   - Temporarily disable to test

3. **Use offline mode**: Most features work offline except:
   - YouTube videos
   - External media URLs
   - AI features

### Data Recovery

#### Problem: "Lost work" or "Data not saved"
**Prevention:**
- Enable auto-save (Settings → Auto-save interval)
- Look for recovery files in app data directory
- Regular manual saves (Ctrl+S)

**Recovery Steps:**
1. **Check auto-save data**:
   ```javascript
   // In browser console:
   window.checkAutoSaveData && window.checkAutoSaveData()
   ```

2. **Look for backup files**:
   - Windows: `%APPDATA%/scorm-builder/backups/`
   - Mac: `~/Library/Application Support/scorm-builder/backups/`
   - Linux: `~/.config/scorm-builder/backups/`

3. **Use project export regularly**: Export projects as backup

### Debug Mode

Enable debug mode for detailed logging:

1. **Via Settings:**
   - Open Settings (gear icon)
   - Enable "Debug Mode"
   - Check browser console for detailed logs

2. **Via Console:**
   ```javascript
   // Enable debug logging
   localStorage.setItem('debug', 'scorm-builder:*')
   
   // Enable specific modules
   localStorage.setItem('debug', 'scorm-builder:media,scorm-builder:storage')
   
   // Disable debug logging
   localStorage.removeItem('debug')
   ```

### Error Codes Reference

| Code | Meaning | Solution |
|------|---------|----------|
| MEDIA_001 | Invalid file type | Check supported formats |
| MEDIA_002 | File too large | Reduce file size |
| MEDIA_003 | Upload failed | Retry, check connection |
| STORAGE_001 | Save failed | Check disk space |
| STORAGE_002 | Load failed | Verify file exists |
| SCORM_001 | Generation failed | Check content completeness |
| AUTH_001 | API key invalid | Update in settings |

### Getting Help

If issues persist:

1. **Collect diagnostic info**:
   ```javascript
   // In browser console:
   window.generateDiagnosticReport && window.generateDiagnosticReport()
   ```

2. **Check application logs**:
   - Windows: `%APPDATA%/scorm-builder/logs/`
   - Mac: `~/Library/Logs/scorm-builder/`
   - Linux: `~/.config/scorm-builder/logs/`

3. **Report issues**:
   - Include diagnostic report
   - Steps to reproduce
   - Screenshots if applicable
   - Browser and OS version

### Performance Tips

1. **Optimize media before upload**:
   - Compress images (use PNG for screenshots, JPEG for photos)
   - Reduce video resolution (720p recommended)
   - Compress audio (128kbps MP3 sufficient)

2. **Work with smaller projects**:
   - Split large courses into modules
   - Archive completed projects
   - Regular cleanup of unused media

3. **System optimization**:
   - Close unnecessary browser tabs
   - Disable browser extensions during use
   - Use dedicated browser profile

### Known Limitations

1. **File path length**: Maximum 260 characters on Windows
2. **Project size**: Recommended maximum 500MB per project
3. **Concurrent operations**: Avoid multiple uploads simultaneously
4. **Special characters**: Avoid in file names: `< > : " | ? * \`

### Preventive Measures

1. **Regular backups**: Export projects weekly
2. **Update regularly**: Check for application updates
3. **Monitor disk space**: Keep 10% free space
4. **Test SCORM packages**: Validate in LMS before deployment