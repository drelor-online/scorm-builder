# Tauri Icon Setup - SCORM Course Builder

## Overview
The Tauri application has been configured to use the custom green/black striped app icon design. The icon has been removed from the header and should now appear as the program icon.

## What's Been Done

### 1. Tauri Configuration Updated
- Updated `src-tauri/tauri.conf.json` with:
  - Product name: "SCORM Course Builder"
  - Enhanced window settings (minimum size, centering, etc.)
  - Icon configuration pointing to proper icon files

### 2. Icon Files Prepared
- Copied `app-icon.svg` to `src-tauri/icons/`
- Created generation script and documentation
- Icon design: Green and black horizontal stripes (#241f20, #8fbb40, #439c45)

### 3. Header Updated
- Removed app icon from header (it should only be the program icon)
- Removed Entrust logo (visibility issues in dark theme)
- Clean header with just "SCORM Course Builder" title

## Next Steps to Complete Icon Setup

### Option 1: Using ImageMagick (Recommended)
```bash
cd src-tauri/icons
magick app-icon.svg -resize 32x32 32x32.png
magick app-icon.svg -resize 128x128 128x128.png
magick app-icon.svg -resize 256x256 128x128@2x.png
magick app-icon.svg -resize 512x512 icon.png
magick app-icon.svg -resize 256x256 icon.ico
```

### Option 2: Online Converter
1. Go to https://convertio.co/svg-png/
2. Upload `src-tauri/icons/app-icon.svg`
3. Convert to PNG at sizes: 32x32, 128x128, 256x256, 512x512
4. Rename 256x256 to `128x128@2x.png` and 512x512 to `icon.png`
5. Convert one PNG to ICO format for Windows

### Option 3: Run the Generation Script
```bash
cd src-tauri/icons
node generate-icons.js
# Follow the instructions provided by the script
```

## Testing the Icon
After generating the PNG/ICO files:
1. Run `npm run tauri build` or `npm run tauri dev`
2. Check that the application window shows the green/black striped icon
3. On Windows: Check taskbar and system tray
4. On macOS: Check dock and Applications folder
5. On Linux: Check application menu and taskbar

## Files Modified
- `src-tauri/tauri.conf.json` - Updated configuration
- `src-tauri/icons/app-icon.svg` - Source icon file
- `src-tauri/icons/generate-icons.js` - Generation script
- `src-tauri/icons/generate-icons.md` - Documentation
- `src/components/TestDarkTheme.tsx` - Removed icon from header

## Current Status
✅ Tauri configuration updated
✅ Icon files prepared
✅ Header cleaned up
⏳ PNG/ICO generation needed (manual step)
⏳ Build and test needed

The green/black striped design will now appear as the program icon in the taskbar, dock, and application menus instead of in the header.