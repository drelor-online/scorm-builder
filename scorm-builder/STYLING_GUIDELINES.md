# SCORM Builder Styling Guidelines

## Overview
This document outlines the styling conventions and best practices for the SCORM Builder application. Following these guidelines ensures consistency, maintainability, and accessibility across the entire codebase.

## Core Principles

### 1. Use the Design System
Always use components from the design system (`src/components/DesignSystem/`) instead of creating ad-hoc UI elements.

```tsx
// ✅ Good
import { Button, Card, Alert } from './DesignSystem'

// ❌ Bad
<button style={{ padding: '10px', backgroundColor: '#3b82f6' }}>Click me</button>
```

### 2. CSS Modules Over Inline Styles
Use CSS modules for component-specific styling. Inline styles should be avoided except for truly dynamic values.

```tsx
// ✅ Good
import styles from './Component.module.css'
<div className={styles.container}>

// ❌ Bad
<div style={{ padding: '1rem', marginBottom: '2rem' }}>
```

### 3. Design Tokens
Use design tokens from `designTokens.ts` for consistent spacing, colors, and typography.

```css
/* ✅ Good */
.container {
  padding: var(--space-lg);
  color: var(--text-primary);
  border-radius: var(--radius-md);
}

/* ❌ Bad */
.container {
  padding: 16px;
  color: #e5e5e5;
  border-radius: 8px;
}
```

## Component Guidelines

### Buttons
Always use the `Button` component from the design system:

```tsx
import { Button } from './DesignSystem'

// Primary action
<Button variant="primary" onClick={handleSave}>Save</Button>

// Secondary action
<Button variant="secondary" onClick={handleCancel}>Cancel</Button>

// Danger action
<Button variant="danger" onClick={handleDelete}>Delete</Button>
```

### Cards
Use the `Card` component for content containers:

```tsx
import { Card } from './DesignSystem'

<Card title="Section Title" padding="large">
  {/* Content */}
</Card>
```

### Alerts and Notifications
Use the appropriate component for user feedback:

```tsx
// For inline messages
import { Alert } from './DesignSystem'
<Alert variant="info">Information message</Alert>

// For temporary notifications
import { Toast } from './Toast'
<Toast message="Success!" type="success" />
```

### Badges
Use the `Badge` component for status indicators and labels:

```tsx
import { Badge, QuestionTypeBadge, StatusBadge } from './DesignSystem'

// Generic badge
<Badge variant="primary">New</Badge>

// Question type badge
<QuestionTypeBadge type="multiple-choice" />

// Status badge
<StatusBadge status="active" />
```

## CSS Module Structure

### File Naming
CSS modules should be named `ComponentName.module.css`:

```
src/
  components/
    MyComponent.tsx
    MyComponent.module.css
    MyComponent.test.tsx
```

### Class Naming Convention
Use camelCase for CSS class names in modules:

```css
/* MyComponent.module.css */
.container { }
.headerTitle { }
.contentArea { }
.actionButton { }
```

### Organization
Group related styles together with comments:

```css
/* Layout */
.container { }
.sidebar { }
.mainContent { }

/* Typography */
.title { }
.subtitle { }
.bodyText { }

/* Interactive Elements */
.button { }
.buttonHover { }
.buttonActive { }
```

## Design Tokens

### Available Tokens
The following design tokens are available in `designTokens.ts`:

#### Colors
- `--color-primary`: Primary brand color
- `--color-success`: Success states
- `--color-warning`: Warning states
- `--color-danger`: Error states
- `--text-primary`: Primary text
- `--text-secondary`: Secondary text
- `--text-tertiary`: Tertiary text
- `--bg-primary`: Primary background
- `--bg-secondary`: Secondary background
- `--bg-tertiary`: Tertiary background

#### Spacing
- `--space-xs`: 0.25rem (4px)
- `--space-sm`: 0.5rem (8px)
- `--space-md`: 1rem (16px)
- `--space-lg`: 1.5rem (24px)
- `--space-xl`: 2rem (32px)
- `--space-2xl`: 3rem (48px)
- `--space-3xl`: 4rem (64px)

#### Typography
- `--font-size-xs`: 0.75rem
- `--font-size-sm`: 0.875rem
- `--font-size-base`: 1rem
- `--font-size-lg`: 1.125rem
- `--font-size-xl`: 1.25rem
- `--font-size-2xl`: 1.5rem
- `--font-size-3xl`: 1.875rem

#### Border Radius
- `--radius-sm`: 0.25rem
- `--radius-md`: 0.375rem
- `--radius-lg`: 0.5rem
- `--radius-xl`: 0.75rem
- `--radius-full`: 9999px

#### Shadows
- `--shadow-sm`: Small shadow
- `--shadow-md`: Medium shadow
- `--shadow-lg`: Large shadow
- `--shadow-xl`: Extra large shadow

## Responsive Design

### Breakpoints
Use consistent breakpoints for responsive design:

```css
/* Mobile first approach */
.container {
  padding: var(--space-md);
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: var(--space-lg);
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: var(--space-xl);
  }
}
```

### Grid Layouts
Use CSS Grid for complex layouts:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-lg);
}
```

## Accessibility

### Focus States
Always provide visible focus states:

```css
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Color Contrast
Ensure sufficient color contrast for text:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Use the design system colors which are pre-validated

### Keyboard Navigation
Ensure all interactive elements are keyboard accessible:

```tsx
<button
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  tabIndex={0}
>
```

## Migration Guide

### Converting Inline Styles to CSS Modules

1. Create a CSS module file:
```css
/* Component.module.css */
.container {
  display: flex;
  padding: var(--space-lg);
  background-color: var(--bg-secondary);
}
```

2. Import and use in component:
```tsx
import styles from './Component.module.css'

// Before
<div style={{ display: 'flex', padding: '1.5rem', backgroundColor: '#2a2a2a' }}>

// After
<div className={styles.container}>
```

### Replacing Custom Components with Design System

1. Identify custom implementations:
```tsx
// Custom button
<button className="custom-button">Click</button>

// Custom alert
<div className="alert-box">{message}</div>
```

2. Replace with design system components:
```tsx
import { Button, Alert } from './DesignSystem'

// Design system button
<Button variant="primary">Click</Button>

// Design system alert
<Alert variant="info">{message}</Alert>
```

## Testing

### Visual Regression
When modifying styles, ensure no unintended visual changes:

1. Take screenshots before changes
2. Apply styling changes
3. Compare screenshots
4. Update tests if changes are intentional

### Component Testing
Test style-related behavior:

```tsx
it('applies correct CSS classes', () => {
  const { container } = render(<Component />)
  expect(container.firstChild).toHaveClass(styles.container)
})

it('changes appearance on hover', () => {
  const button = screen.getByRole('button')
  fireEvent.mouseEnter(button)
  expect(button).toHaveClass(styles.buttonHover)
})
```

## Common Patterns

### Loading States
```tsx
import { LoadingSpinner } from './DesignSystem'

{isLoading ? (
  <LoadingSpinner />
) : (
  <Content />
)}
```

### Empty States
```tsx
import { EmptyState } from './DesignSystem'

<EmptyState
  icon="📁"
  title="No items found"
  description="Try adjusting your filters"
/>
```

### Form Fields
```tsx
import { FormField, Input } from './DesignSystem'

<FormField label="Name" error={errors.name}>
  <Input
    value={name}
    onChange={(e) => setName(e.target.value)}
    error={!!errors.name}
  />
</FormField>
```

## Performance Considerations

### CSS-in-JS vs CSS Modules
- Prefer CSS Modules for static styles (better performance)
- Use inline styles only for truly dynamic values
- Avoid style recalculation in render loops

### Optimization Tips
1. Use CSS containment for complex components
2. Minimize CSS specificity
3. Avoid deep nesting in CSS
4. Use CSS variables for theming
5. Lazy load heavy CSS for code-split components

## Maintenance

### Regular Audits
Perform regular style audits to:
- Remove unused CSS
- Consolidate duplicate styles
- Update deprecated patterns
- Ensure design token usage

### Documentation
Document any deviations from these guidelines with clear reasoning:

```tsx
// NOTE: Using inline style here because the value is calculated dynamically
// based on user scroll position
<div style={{ transform: `translateY(${scrollY}px)` }}>
```

## Resources

- [Design System Components](./src/components/DesignSystem/)
- [Design Tokens](./src/components/DesignSystem/designTokens.ts)
- [CSS Modules Documentation](https://github.com/css-modules/css-modules)
- [ARIA Guidelines](https://www.w3.org/WAI/ARIA/apg/)

## Version History

- v1.0.0 (2024-01) - Initial guidelines
- v1.1.0 (2024-01) - Added Badge component guidelines
- v1.2.0 (2024-01) - Added logger settings documentation