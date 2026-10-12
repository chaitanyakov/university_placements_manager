import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Height & padding: 36px default height for 'md'
    let sizeClasses = 'h-9 px-3.5 text-sm';
    if (size === 'sm') sizeClasses = 'h-7 px-2.5 text-xs';
    if (size === 'lg') sizeClasses = 'h-10 px-4 text-sm font-medium';

    // Variants:
    // primary: solid green (#1F4D3F, hover #173C31)
    // secondary: white + border (#E4DFD3), text #1C1F1D, hover #FAF8F3
    // destructive: red text with subtle hover
    // ghost: transparent, hover #FAF8F3
    let variantClasses = 'bg-[#1F4D3F] text-white hover:bg-[#173C31] border border-transparent';

    if (variant === 'secondary' || variant === 'outline') {
      variantClasses =
        'bg-[#FFFFFF] text-[#1C1F1D] border border-[#E4DFD3] hover:bg-[#FAF8F3] hover:border-[#DDD8CE]';
    } else if (variant === 'destructive') {
      variantClasses =
        'bg-white text-[#9E2A2B] border border-[#F6C6CA] hover:bg-[#FCECEE] hover:border-[#E8A5A9]';
    } else if (variant === 'ghost') {
      variantClasses =
        'bg-transparent text-[#1C1F1D] hover:bg-[#FAF8F3] hover:text-[#173C31] border border-transparent';
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center gap-2 rounded-[6px] font-medium transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2501F] focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap cursor-pointer ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
