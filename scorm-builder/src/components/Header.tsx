import React, { useState } from 'react';
import { Button } from './Button';

interface HeaderProps {
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function Header(props: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const styles: {
    header: React.CSSProperties;
    fileMenu: React.CSSProperties;
    menuItem: React.CSSProperties;
  } = {
    header: {
      display: 'flex',
      justifyContent: 'flex-end',
      padding: 'var(--spacing-md)',
      borderBottom: '1px solid var(--border-color)',
    },
    fileMenu: {
      position: 'relative',
    },
    menuItem: {
      display: 'block',
      width: '100%',
      padding: 'var(--spacing-sm) var(--spacing-md)',
      border: 'none',
      backgroundColor: 'transparent',
      textAlign: 'left',
      cursor: 'pointer',
    },
  };

  return (
    <header style={styles.header}>
      <div style={styles.fileMenu}>
        <Button onClick={() => setIsMenuOpen(!isMenuOpen)}>File</Button>
        {isMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              backgroundColor: 'var(--input-background-color)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)',
              zIndex: 1,
            }}
          >
            <button style={styles.menuItem} onClick={props.onSave}>Save</button>
            <button style={styles.menuItem} onClick={props.onSaveAs}>Save As</button>
            <button style={styles.menuItem} onClick={props.onOpen}>Open</button>
            <hr style={{ margin: 'var(--spacing-sm) 0' }} />
            <button style={styles.menuItem} onClick={props.onExport}>Export</button>
            <button style={styles.menuItem} onClick={props.onImport}>Import</button>
          </div>
        )}
      </div>
    </header>
  );
}
