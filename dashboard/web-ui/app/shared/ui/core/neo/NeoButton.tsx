import React from 'react';
import { Loader2 } from 'lucide-react';

interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const NeoButton: React.FC<NeoButtonProps> = ({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    disabled,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-black uppercase transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 border-2 border-black shadow-neo-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-[#f8fafc] rounded-none";

    const variants = {
        primary: "bg-black text-white hover:-translate-y-0.5 hover:shadow-neo active:translate-y-0 active:shadow-none",
        secondary: "bg-white text-black hover:-translate-y-0.5 hover:bg-[#ecfeff] hover:shadow-neo active:translate-y-0 active:shadow-none",
        danger: "bg-[#fb7185] text-black hover:-translate-y-0.5 hover:bg-[#fecaca] hover:shadow-neo active:translate-y-0 active:shadow-none",
        success: "bg-[#86efac] text-black hover:-translate-y-0.5 hover:bg-[#4ade80] hover:shadow-neo active:translate-y-0 active:shadow-none",
        warning: "bg-[#f9a8d4] text-black hover:-translate-y-0.5 hover:bg-[#f472b6] hover:shadow-neo active:translate-y-0 active:shadow-none",
        ghost: "border-transparent bg-transparent text-black shadow-none hover:border-black hover:bg-[#ecfeff] hover:shadow-neo-sm active:shadow-none"
    };

    const sizes = {
        sm: "text-xs px-3 py-1.5 h-8 gap-1.5",
        md: "text-sm px-4 py-2 h-10 gap-2",
        lg: "text-base px-6 py-3 h-12 gap-2.5"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <>
                    {leftIcon}
                    {children}
                    {rightIcon}
                </>
            )}
        </button>
    );
};
