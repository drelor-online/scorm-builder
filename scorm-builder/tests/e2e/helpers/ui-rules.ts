export interface UIIssue {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: { x: number; y: number; width?: number; height?: number };
  element: string;
  details?: any;
  fixSuggestion?: string;
  codeLocation?: string;
}

export interface UIRule {
  name: string;
  description: string;
  selector: string;
  priority: number;
  check: (elements: Element[]) => UIIssue[];
}

export const UI_RULES: UIRule[] = [
  {
    name: 'text_overflow',
    description: 'Detect text content that overflows container bounds',
    selector: 'p, span, div, h1, h2, h3, h4, h5, h6, label, button',
    priority: 1,
    check: (elements: Element[]): UIIssue[] => {
      const issues: UIIssue[] = [];
      
      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const hasOverflow = element.scrollWidth > element.clientWidth || 
                           element.scrollHeight > element.clientHeight;
        
        if (hasOverflow && rect.width > 0 && rect.height > 0) {
          const computedStyle = window.getComputedStyle(element);
          
          issues.push({
            type: 'text_overflow',
            description: `Text content overflows container by ${element.scrollWidth - element.clientWidth}px horizontally`,
            severity: element.scrollWidth - element.clientWidth > 20 ? 'high' : 'medium',
            location: { 
              x: Math.round(rect.x), 
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className ? `.${element.className.split(' ').join('.')}` : ''}`,
            details: {
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
              overflow: computedStyle.overflow,
              whiteSpace: computedStyle.whiteSpace,
              textContent: element.textContent?.slice(0, 100) + '...'
            },
            fixSuggestion: 'Add CSS: overflow-wrap: break-word; or word-break: break-word;',
            codeLocation: 'Check component CSS or add utility class'
          });
        }
      });
      
      return issues;
    }
  },

  {
    name: 'button_alignment',
    description: 'Detect misaligned buttons in button groups',
    selector: '.button-group button, .form-actions button, .dialog-actions button',
    priority: 2,
    check: (elements: Element[]): UIIssue[] => {
      const issues: UIIssue[] = [];
      
      if (elements.length < 2) return issues;
      
      // Group buttons by container
      const containers = new Map<Element, Element[]>();
      elements.forEach(button => {
        const container = button.parentElement;
        if (container) {
          if (!containers.has(container)) {
            containers.set(container, []);
          }
          containers.get(container)!.push(button);
        }
      });
      
      containers.forEach((buttons, container) => {
        if (buttons.length < 2) return;
        
        const rects = buttons.map(btn => btn.getBoundingClientRect());
        const avgY = rects.reduce((sum, rect) => sum + rect.y, 0) / rects.length;
        
        rects.forEach((rect, index) => {
          const yDiff = Math.abs(rect.y - avgY);
          if (yDiff > 5) { // 5px tolerance
            issues.push({
              type: 'button_alignment',
              description: `Button vertically misaligned by ${Math.round(yDiff)}px from group average`,
              severity: yDiff > 15 ? 'high' : 'medium',
              location: { 
                x: Math.round(rect.x), 
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              element: `${buttons[index].tagName.toLowerCase()}${buttons[index].className ? `.${buttons[index].className}` : ''}`,
              details: {
                expectedY: Math.round(avgY),
                actualY: Math.round(rect.y),
                deviation: Math.round(yDiff)
              },
              fixSuggestion: 'Ensure all buttons in group use flexbox with align-items: center',
              codeLocation: 'Check container CSS for proper alignment'
            });
          }
        });
      });
      
      return issues;
    }
  },

  {
    name: 'missing_button_labels',
    description: 'Detect buttons without accessible labels',
    selector: 'button, [role="button"]',
    priority: 1,
    check: (elements: Element[]): UIIssue[] => {
      const issues: UIIssue[] = [];
      
      elements.forEach(element => {
        const hasLabel = !!(
          element.getAttribute('aria-label') ||
          element.getAttribute('aria-labelledby') ||
          element.getAttribute('title') ||
          element.textContent?.trim()
        );
        
        if (!hasLabel) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            issues.push({
              type: 'missing_button_label',
              description: 'Button missing accessible label for screen readers',
              severity: 'high',
              location: { 
                x: Math.round(rect.x), 
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              element: `${element.tagName.toLowerCase()}${element.className ? `.${element.className}` : ''}`,
              details: {
                hasAriaLabel: !!element.getAttribute('aria-label'),
                hasTitle: !!element.getAttribute('title'),
                hasTextContent: !!element.textContent?.trim(),
                innerHTML: element.innerHTML.slice(0, 100)
              },
              fixSuggestion: 'Add aria-label="descriptive text" or title attribute',
              codeLocation: 'Add accessibility attributes to button element'
            });
          }
        }
      });
      
      return issues;
    }
  },

  {
    name: 'modal_focus_trap',
    description: 'Check if modals properly manage focus',
    selector: '[role="dialog"], .modal, .overlay',
    priority: 1,
    check: (elements: Element[]): UIIssue[] => {
      const issues: UIIssue[] = [];
      
      elements.forEach(modal => {
        const rect = modal.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) {
          issues.push({
            type: 'modal_no_focusable',
            description: 'Modal contains no focusable elements',
            severity: 'high',
            location: { 
              x: Math.round(rect.x), 
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            element: `${modal.tagName.toLowerCase()}${modal.className ? `.${modal.className}` : ''}`,
            details: {
              focusableCount: focusableElements.length
            },
            fixSuggestion: 'Add focusable elements or implement focus management',
            codeLocation: 'Modal component needs focus trap implementation'
          });
        }

        // Check if first element is focused
        const activeElement = document.activeElement;
        const firstFocusable = focusableElements[0];
        
        if (firstFocusable && activeElement !== firstFocusable) {
          issues.push({
            type: 'modal_focus_management',
            description: 'Modal opened but focus not set to first focusable element',
            severity: 'medium',
            location: { 
              x: Math.round(rect.x), 
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            element: `${modal.tagName.toLowerCase()}${modal.className ? `.${modal.className}` : ''}`,
            details: {
              currentFocus: activeElement?.tagName || 'none',
              expectedFocus: firstFocusable.tagName
            },
            fixSuggestion: 'Auto-focus first element when modal opens',
            codeLocation: 'Add useEffect to focus first element on modal open'
          });
        }
      });
      
      return issues;
    }
  },

  {
    name: 'color_contrast',
    description: 'Detect poor color contrast between text and background',
    selector: 'p, span, div, h1, h2, h3, h4, h5, h6, label, button, a',
    priority: 2,
    check: (elements: Element[]): UIIssue[] => {
      const issues: UIIssue[] = [];
      
      // Helper function to calculate luminance
      const getLuminance = (rgb: string): number => {
        const values = rgb.match(/\d+/g);
        if (!values || values.length < 3) return 1;
        
        const [r, g, b] = values.map(v => {
          const val = parseInt(v) / 255;
          return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      
      // Helper function to calculate contrast ratio
      const getContrastRatio = (color1: string, color2: string): number => {
        const lum1 = getLuminance(color1);
        const lum2 = getLuminance(color2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
      };
      
      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const style = window.getComputedStyle(element);
        const color = style.color;
        const backgroundColor = style.backgroundColor;
        
        // Skip if no background color or transparent
        if (!backgroundColor || backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
          return;
        }
        
        const contrastRatio = getContrastRatio(color, backgroundColor);
        const fontSize = parseFloat(style.fontSize);
        const fontWeight = style.fontWeight;
        
        // WCAG AA requirements: 4.5:1 for normal text, 3:1 for large text
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
        const requiredRatio = isLargeText ? 3 : 4.5;
        
        if (contrastRatio < requiredRatio) {
          issues.push({
            type: 'color_contrast',
            description: `Color contrast ratio ${contrastRatio.toFixed(2)}:1 below WCAG AA requirement of ${requiredRatio}:1`,
            severity: contrastRatio < 2 ? 'critical' : 'high',
            location: { 
              x: Math.round(rect.x), 
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            element: `${element.tagName.toLowerCase()}${element.className ? `.${element.className}` : ''}`,
            details: {
              color,
              backgroundColor,
              contrastRatio: Math.round(contrastRatio * 100) / 100,
              requiredRatio,
              isLargeText,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              textContent: element.textContent?.slice(0, 50)
            },
            fixSuggestion: `Increase contrast ratio to at least ${requiredRatio}:1`,
            codeLocation: 'Adjust color or background-color in CSS'
          });
        }
      });
      
      return issues;
    }
  },

  {
    name: 'form_field_labels',
    description: 'Detect form fields without proper labels',
    selector: 'input, select, textarea',
    priority: 1,
    check: (elements: Element[]): UIIssue[] => {
      const issues: UIIssue[] = [];
      
      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const input = element as HTMLInputElement;
        const hasLabel = !!(
          input.labels?.length ||
          element.getAttribute('aria-label') ||
          element.getAttribute('aria-labelledby') ||
          element.getAttribute('placeholder')
        );
        
        if (!hasLabel) {
          issues.push({
            type: 'form_field_missing_label',
            description: 'Form field missing accessible label',
            severity: 'high',
            location: { 
              x: Math.round(rect.x), 
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className ? `.${element.className.split(' ').join('.')}` : ''}`,
            details: {
              type: input.type,
              hasLabels: !!input.labels?.length,
              hasAriaLabel: !!element.getAttribute('aria-label'),
              hasPlaceholder: !!element.getAttribute('placeholder'),
              id: element.id
            },
            fixSuggestion: 'Add <label> element or aria-label attribute',
            codeLocation: 'Associate form field with label element'
          });
        }
      });
      
      return issues;
    }
  },

  {
    name: 'z_index_conflicts',
    description: 'Detect elements with potentially conflicting z-index values',
    selector: '*',
    priority: 3,
    check: (elements: Element[]): UIIssue[] => {
      const issues: UIIssue[] = [];
      const zIndexMap = new Map<number, Element[]>();
      
      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const style = window.getComputedStyle(element);
        const zIndex = parseInt(style.zIndex);
        
        if (!isNaN(zIndex) && zIndex > 0) {
          if (!zIndexMap.has(zIndex)) {
            zIndexMap.set(zIndex, []);
          }
          zIndexMap.get(zIndex)!.push(element);
        }
      });
      
      // Check for duplicate high z-index values
      zIndexMap.forEach((elementsAtZIndex, zIndex) => {
        if (elementsAtZIndex.length > 1 && zIndex > 1000) {
          elementsAtZIndex.forEach(element => {
            const rect = element.getBoundingClientRect();
            issues.push({
              type: 'z_index_conflict',
              description: `Multiple elements using high z-index value ${zIndex}`,
              severity: 'medium',
              location: { 
                x: Math.round(rect.x), 
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              element: `${element.tagName.toLowerCase()}${element.className ? `.${element.className}` : ''}`,
              details: {
                zIndex,
                conflictCount: elementsAtZIndex.length,
                position: window.getComputedStyle(element).position
              },
              fixSuggestion: 'Use CSS custom properties for z-index management',
              codeLocation: 'Establish z-index scale in design system'
            });
          });
        }
      });
      
      return issues;
    }
  },

  {
    name: 'responsive_breakpoints',
    description: 'Check for elements that break at common viewport sizes',
    selector: '.container, .grid, .flex, .form-group, .button-group',
    priority: 2,
    check: (elements: Element[]): UIIssue[] => {
      const issues: UIIssue[] = [];
      const currentWidth = window.innerWidth;
      
      // Common breakpoints to check
      const breakpoints = [320, 768, 1024, 1280];
      
      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        // Check if element is wider than viewport at common breakpoints
        breakpoints.forEach(breakpoint => {
          if (rect.width > breakpoint && currentWidth >= breakpoint) {
            issues.push({
              type: 'responsive_overflow',
              description: `Element width ${Math.round(rect.width)}px exceeds ${breakpoint}px breakpoint`,
              severity: rect.width > breakpoint * 1.1 ? 'high' : 'medium',
              location: { 
                x: Math.round(rect.x), 
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              element: `${element.tagName.toLowerCase()}${element.className ? `.${element.className}` : ''}`,
              details: {
                elementWidth: Math.round(rect.width),
                breakpoint,
                currentViewport: currentWidth,
                overflowAmount: Math.round(rect.width - breakpoint)
              },
              fixSuggestion: `Add responsive CSS or max-width constraint for ${breakpoint}px breakpoint`,
              codeLocation: 'Add media queries for responsive behavior'
            });
          }
        });
      });
      
      return issues;
    }
  }
];

export function runUIRules(): UIIssue[] {
  const allIssues: UIIssue[] = [];
  
  UI_RULES.forEach(rule => {
    try {
      const elements = Array.from(document.querySelectorAll(rule.selector));
      const issues = rule.check(elements);
      allIssues.push(...issues);
    } catch (error) {
      console.warn(`Error running UI rule ${rule.name}:`, error);
    }
  });
  
  // Sort by severity and priority
  return allIssues.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}