import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  onPress: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcuts.find(s => {
        return (
          s.key === event.key &&
          (s.ctrlKey === undefined || s.ctrlKey === event.ctrlKey) &&
          (s.metaKey === undefined || s.metaKey === event.metaKey) &&
          (s.shiftKey === undefined || s.shiftKey === event.shiftKey)
        );
      });

      if (shortcut) {
        event.preventDefault();
        shortcut.onPress();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}
