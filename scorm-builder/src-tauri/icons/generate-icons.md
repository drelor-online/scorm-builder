# Icon Generation Instructions

To generate the proper icon formats from the app-icon.svg file, you can use the following tools:

## Option 1: Using ImageMagick (Recommended)
```bash
# Install ImageMagick first
# Windows: Download from https://imagemagick.org/script/download.php#windows
# macOS: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# Generate PNG icons from SVG
magick app-icon.svg -resize 32x32 32x32.png
magick app-icon.svg -resize 128x128 128x128.png
magick app-icon.svg -resize 256x256 128x128@2x.png
magick app-icon.svg -resize 512x512 icon.png

# Generate ICO for Windows
magick app-icon.svg -resize 256x256 icon.ico

# Generate ICNS for macOS (requires png2icns or iconutil)
# On macOS: iconutil -c icns -o icon.icns app-icon.iconset/
```

## Option 2: Using Online Converters
1. Upload app-icon.svg to https://convertio.co/svg-png/
2. Convert to PNG at different sizes (32x32, 128x128, 256x256, 512x512)
3. Use https://convertio.co/png-ico/ for ICO format
4. Use https://convertio.co/png-icns/ for ICNS format

## Option 3: Using Node.js Script
```bash
npm install sharp svg2png
node generate-icons.js
```

## Current App Icon Design
The app-icon.svg contains:
- Green and black horizontal stripes
- 200x200 viewBox
- Colors: #241f20 (dark), #8fbb40 (light green), #439c45 (darker green)
- Perfect for representing the SCORM Course Builder brand