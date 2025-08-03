import React from 'react';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const styles: React.CSSProperties = {
    padding: 'var(--spacing-sm)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)',
    backgroundColor: 'var(--input-background-color)',
    color: 'var(--text-color)',
    width: '100%',
  };

  return <input style={styles} {...props} />;
}
