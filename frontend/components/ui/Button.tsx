import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outlined' | 'ghost';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-1 font-bold text-[13px] rounded-full transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#7b78ff] text-white shadow-[0_8px_18px_rgba(123,120,255,.22)] hover:bg-[#6763eb] hover:-translate-y-0.5 px-5 py-2.5',
    outlined:
      'bg-[#eeedff] text-[#6663dd] hover:bg-[#e3e1ff] px-5 py-2.5',
    ghost: 'text-[#6d6a82] hover:bg-[#f0effa] hover:text-[#7b78ff] px-4 py-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  );
};
