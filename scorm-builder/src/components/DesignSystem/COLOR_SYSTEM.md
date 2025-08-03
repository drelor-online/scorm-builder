# SCORM Builder Color System

## Overview

The SCORM Builder uses a comprehensive color system based on design tokens that ensures consistency across the application. All colors are defined in a single source of truth and are accessible through CSS variables, JavaScript/TypeScript utilities, and React components.

## Color Scales

Each color has a scale from 50 (lightest) to 900 (darkest):

### Primary (Blue)
- `primary-50`: #eff6ff (Lightest)
- `primary-100`: #dbeafe
- `primary-200`: #bfdbfe
- `primary-300`: #93c5fd
- `primary-400`: #60a5fa
- **`primary-500`: #3b82f6 (Main)**
- **`primary-600`: #2563eb (Hover)**
- **`primary-700`: #1d4ed8 (Active)**
- `primary-800`: #1e40af
- `primary-900`: #1e3a8a (Darkest)

### Secondary (Gray)
- `secondary-50`: #fafafa (Lightest)
- `secondary-100`: #f4f4f5
- `secondary-200`: #e4e4e7
- `secondary-300`: #d4d4d8
- `secondary-400`: #a1a1aa
- **`secondary-500`: #71717a (Main)**
- **`secondary-600`: #52525b (Hover)**
- **`secondary-700`: #3f3f46 (Active)**
- `secondary-800`: #27272a
- `secondary-900`: #18181b (Darkest)

### Success (Green)
- **`success-500`: #22c55e (Main)**
- **`success-600`: #16a34a (Hover)**
- **`success-700`: #15803d (Active)**

### Danger (Red)
- **`danger-500`: #ef4444 (Main)**
- **`danger-600`: #dc2626 (Hover)**
- **`danger-700`: #b91c1c (Active)**

### Warning (Amber)
- **`warning-500`: #f59e0b (Main)**
- **`warning-600`: #d97706 (Hover)**
- **`warning-700`: #b45309 (Active)**

## Semantic Colors

### Backgrounds
- `bg-primary`: #09090b - Main app background
- `bg-secondary`: #18181b - Card backgrounds
- `bg-tertiary`: #27272a - Elevated surfaces
- `bg-quaternary`: #3f3f46 - Hover states
- `bg-overlay`: rgba(0, 0, 0, 0.75) - Modal overlays

### Text
- `text-primary`: #f4f4f5 - Main text
- `text-secondary`: #d4d4d8 - Secondary text
- `text-tertiary`: #a1a1aa - Muted text
- `text-quaternary`: #71717a - Very muted text
- `text-inverse`: #09090b - Text on light backgrounds

### Borders
- `border-light`: #27272a - Subtle borders
- `border-default`: #3f3f46 - Default borders
- `border-medium`: #52525b - Emphasized borders
- `border-dark`: #71717a - Strong borders
- `border-focus`: #3b82f6 - Focus rings

## Usage

### CSS Variables

All colors are available as CSS variables:

```css
/* Using color scales */
.element {
  background-color: var(--color-primary-500);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

/* Using semantic aliases */
.button-primary {
  background-color: var(--color-primary);
}

.button-primary:hover {
  background-color: var(--color-primary-hover);
}
```

### JavaScript/TypeScript

Import colors from the design tokens:

```typescript
import { colors } from '@/utils/designTokens'

const styles = {
  backgroundColor: colors.primary,
  color: colors.textPrimary,
  borderColor: colors.borderDefault
}
```

Or use the legacy COLORS constant:

```typescript
import { COLORS } from '@/constants/colors'

const styles = {
  backgroundColor: COLORS.primary,
  color: COLORS.text
}
```

### React Components

Design System components automatically use the correct colors:

```tsx
import { Button, Card } from '@/components/DesignSystem'

// Variants automatically apply correct colors
<Button variant="primary">Primary Button</Button>
<Button variant="success">Success Button</Button>
<Button variant="danger">Danger Button</Button>

<Card variant="glass">
  Glass card with proper colors
</Card>
```

## Activity Colors

Special colors for different activity types:

- Multiple Choice: `#3b82f6` (Primary blue)
- True/False: `#8b5cf6` (Purple)
- Fill in the Blank: `#10b981` (Emerald)
- Drag and Drop: `#f59e0b` (Amber)
- Scenario: `#ec4899` (Pink)

## Alert Colors

Alert colors with proper opacity for backgrounds:

- **Info**: Background rgba(59, 130, 246, 0.1), Text #93c5fd
- **Success**: Background rgba(34, 197, 94, 0.1), Text #86efac
- **Warning**: Background rgba(245, 158, 11, 0.1), Text #fcd34d
- **Danger**: Background rgba(239, 68, 68, 0.1), Text #fca5a5

## Best Practices

1. **Use semantic colors**: Prefer semantic names like `--color-primary` over specific values
2. **Maintain contrast**: Ensure text has sufficient contrast against backgrounds (WCAG AA minimum)
3. **Use the scale**: Use lighter/darker shades from the scale for hover and active states
4. **Be consistent**: Use the same color tokens for similar UI elements
5. **Avoid hardcoding**: Never hardcode color values; always use tokens

## Migration Guide

If you find hardcoded colors in the codebase:

1. Identify the closest match in the design tokens
2. Replace with the appropriate CSS variable or JS constant
3. Test the visual appearance remains consistent
4. Update any related hover/active states

Example migration:
```css
/* Before */
.button {
  background-color: #3b82f6;
}

/* After */
.button {
  background-color: var(--color-primary);
}
```