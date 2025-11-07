
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = "px-4 py-2 rounded-md font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg";

  const variantClasses = {
    primary: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:opacity-90 focus:ring-emerald-400',
    secondary: 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/10 focus:ring-white/20',
    ghost: 'bg-transparent text-emerald-400 hover:bg-emerald-500/10 focus:ring-emerald-500 !shadow-none',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;