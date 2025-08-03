# Transitions & Animations System

## Overview

The SCORM Builder application now includes a comprehensive transitions and animations system that enhances user experience through smooth, performant micro-interactions. All animations respect the user's motion preferences for accessibility.

## Core Principles

1. **Subtle & Purposeful**: Animations should enhance, not distract
2. **Performance First**: Use CSS transforms and opacity for best performance
3. **Accessibility**: Respect `prefers-reduced-motion` setting
4. **Consistency**: Use standardized timing functions and durations

## Available Animations

### Base Transitions

```css
.transition-all       /* All properties */
.transition-colors    /* Color changes */
.transition-opacity   /* Opacity changes */
.transition-transform /* Transform changes */
.transition-shadow    /* Shadow changes */
```

### Duration Modifiers

```css
.duration-75   /* 75ms */
.duration-100  /* 100ms */
.duration-150  /* 150ms (default) */
.duration-200  /* 200ms */
.duration-300  /* 300ms */
.duration-500  /* 500ms */
```

### Animation Classes

```css
.animate-fadeIn       /* Fade in */
.animate-fadeInUp     /* Fade in from below */
.animate-fadeInDown   /* Fade in from above */
.animate-slideInRight /* Slide from right */
.animate-slideInLeft  /* Slide from left */
.animate-scaleIn      /* Scale up */
.animate-bounce       /* Bounce effect */
.animate-pulse        /* Pulse effect */
.animate-spin         /* Continuous rotation */
.animate-ping         /* Ping effect */
.animate-shake        /* Error shake */
.animate-success      /* Success checkmark */
```

### Hover Effects

```css
.hover-scale  /* Scale on hover */
.hover-lift   /* Lift with shadow */
.hover-glow   /* Glow effect */
```

### Focus Effects

```css
.focus-ring   /* Focus outline */
.focus-scale  /* Scale on focus */
```

### Interactive Effects

```css
.button-press    /* Scale down on click */
.smooth-scroll   /* Smooth scrolling */
```

## Usage Examples

### Button with Transitions

```tsx
<Button className="transition-all button-press hover-lift focus-ring">
  Click Me
</Button>
```

### Animated Cards

```tsx
<div className="stagger-children">
  {items.map((item, index) => (
    <Card 
      key={item.id}
      className="animate-fadeInUp"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {item.content}
    </Card>
  ))}
</div>
```

### Loading States

```tsx
<Icon icon={RefreshCw} className={isLoading ? 'animate-spin' : ''} />
```

### Notifications

```tsx
<Alert className="animate-fadeInDown notification-slide">
  Success message!
</Alert>
```

### Modal Animations

```tsx
<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  className="animate-scaleIn"
>
  Modal content
</Modal>
```

## Stagger Animations

For lists or grids, use stagger animations for elegant sequential entry:

```tsx
<div className="stagger-children">
  <div>First item (0.1s delay)</div>
  <div>Second item (0.15s delay)</div>
  <div>Third item (0.2s delay)</div>
  {/* Up to 8 children supported */}
</div>
```

## Special Effects

### Loading Shimmer

```tsx
<div className="loading-shimmer" style={{
  width: '200px',
  height: '40px',
  borderRadius: '8px'
}} />
```

### Accordion Transitions

```tsx
<div className={`accordion-content ${isOpen ? 'expanded' : 'collapsed'}`}>
  Content
</div>
```

## Component Integration

The following components have animations built-in:

- **Button**: Press effect, hover lift, focus ring
- **Card**: Hover effects for interactive cards
- **Modal**: Scale and fade animations
- **Alert**: Slide down notification
- **IconButton**: Tooltip fade, press effect
- **LoadingSpinner**: Continuous rotation

## Performance Guidelines

1. **Use transform and opacity**: These properties are GPU-accelerated
2. **Avoid animating layout properties**: Width, height, padding can cause reflows
3. **Use will-change sparingly**: Only for elements that will definitely animate
4. **Batch animations**: Use stagger for multiple elements instead of individual delays

## Accessibility

All animations automatically disable when users have enabled "Reduce Motion" in their system preferences:

```css
@media (prefers-reduced-motion: reduce) {
  /* All animations reduced to 0.01ms */
}
```

## Demo Component

View all animations in action:

```tsx
import { TransitionsDemo } from '@/components/DesignSystem'

// In your app
<TransitionsDemo />
```

## Best Practices

1. **Entry Animations**: Use fadeInUp for content entering the viewport
2. **Hover States**: Add hover-lift to interactive elements
3. **Loading States**: Use animate-spin for loading indicators
4. **Error States**: Use animate-shake for validation errors
5. **Success States**: Use animate-success for completion feedback
6. **Lists**: Use stagger-children for sequential animations
7. **Modals**: Use scale animations for overlay content

## Future Enhancements

- Page transition animations
- Gesture-based animations
- Scroll-triggered animations
- Advanced easing functions
- Animation composition utilities