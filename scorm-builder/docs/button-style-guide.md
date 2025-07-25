# Button Style Guide - SCORM Course Builder

## Overview

This document defines the consistent button styling system used throughout the SCORM Course Builder application.

## Button Categories

### 1. Primary Actions
- **Usage**: Main CTAs, continue/next buttons, submit forms
- **Style**: Blue background (#3b82f6), white text
- **Size**: Large (0.75rem 2rem padding)
- **Examples**: "Continue to AI Prompt →", "Next →"

### 2. Secondary Actions
- **Usage**: Back buttons, cancel actions, alternative options
- **Style**: Transparent background, gray border (#52525b), light gray text
- **Size**: Medium (0.625rem 1.25rem padding)
- **Examples**: "← Back", "Cancel"

### 3. Tool Buttons
- **Usage**: Utility actions, file operations, clipboard actions
- **Style**: Gray background (#52525b), white text
- **Size**: Medium (0.625rem 1.25rem padding)
- **Examples**: "📋 Paste from Clipboard", "📁 Choose File"

### 4. Header Buttons
- **Usage**: Navigation bar actions
- **Style**: Transparent background, darker gray border (#3f3f46), muted text (#a1a1aa)
- **Size**: Medium with reduced padding (0.5rem 1rem)
- **Examples**: "Open", "Save", "Help", "Settings"

### 5. Form Submit Buttons
- **Usage**: Form validation, data submission
- **Style**: Primary style for enabled, gray for disabled
- **Size**: Medium (0.625rem 1.25rem padding)
- **Examples**: "Validate JSON", "Submit"

### 6. Toggle Buttons
- **Usage**: Multi-option selectors (difficulty levels)
- **Style**: Primary when selected, secondary when not
- **Size**: Small (0.5rem 1rem padding)
- **Examples**: Difficulty level buttons

## Implementation

### Using the Button Styles

```typescript
import { commonButtons, getButtonStyle } from '../styles/buttonStyles'

// Use predefined common buttons
<button style={commonButtons.primaryAction}>Next →</button>

// Or create custom combinations
<button style={getButtonStyle('tertiary', 'medium')}>Custom Button</button>
```

### Button Sizes
- **Small**: 0.5rem 1rem padding, 0.75rem font
- **Medium**: 0.625rem 1.25rem padding, 0.875rem font  
- **Large**: 0.75rem 2rem padding, 0.875rem font

### Button Variants
- **primary**: Blue background for main actions
- **secondary**: Bordered style for alternative actions
- **tertiary**: Gray background for utility actions
- **success**: Green background for success states
- **danger**: Red background for destructive actions

## Consistency Rules

1. **Navigation Flow**: Primary buttons always on the right, secondary (back) on the left
2. **Disabled States**: Reduce opacity to 0.6, change cursor to not-allowed
3. **Icons**: Use emojis sparingly, mainly for utility buttons
4. **Hover States**: All buttons have hover color transitions
5. **Focus States**: Maintain accessibility with proper focus indicators

## Visual Hierarchy

1. **Most Prominent**: Large primary buttons (Continue, Next)
2. **Standard Actions**: Medium buttons (Submit, Validate)
3. **Supporting Actions**: Tool buttons (Paste, Upload)
4. **Navigation**: Header buttons (consistent but subdued)
5. **Least Prominent**: Small toggle buttons

This system ensures visual consistency while maintaining clear hierarchy and user guidance throughout the application.