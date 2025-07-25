import React, { useState } from 'react'
import { Button, ButtonProps } from './Button'

export interface LoadingButtonProps extends ButtonProps {
  loadingText?: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  children,
  loadingText,
  onClick,
  disabled,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick || isLoading) return

    setIsLoading(true)
    try {
      await onClick(e)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      {...props}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? (loadingText || 'Saving...') : children}
    </Button>
  )
}