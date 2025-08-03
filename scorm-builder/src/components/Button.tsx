import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'secondary', ...props }: ButtonProps) {
  const styles: React.CSSProperties = {
    padding: 'var(--spacing-sm) var(--spacing-md)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
  };

  if (variant === 'primary') {
    styles.backgroundColor = 'var(--primary-color)';
    styles.color = '#fff';
    styles.borderColor = 'var(--primary-color)';
  } else {
    styles.backgroundColor = 'var(--secondary-color)';
    styles.color = '#fff';
    styles.borderColor = 'var(--secondary-color)';
  }

  return <button style={styles} {...props} />;
}
