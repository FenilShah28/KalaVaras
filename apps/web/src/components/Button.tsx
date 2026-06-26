import { type ReactNode, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-indigo-deep text-white hover:bg-indigo-deep/90 focus-visible:ring-indigo-deep active:scale-[0.98]',
  secondary:
    'bg-saffron text-white hover:bg-saffron/90 focus-visible:ring-saffron active:scale-[0.98]',
  ghost:
    'bg-transparent text-indigo-deep hover:bg-indigo-deep/10 focus-visible:ring-indigo-deep border border-indigo-deep/30',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 active:scale-[0.98]',
};

const sizes: Record<Size, string> = {
  sm: 'text-sm px-4 py-2 min-h-[40px]',
  md: 'text-base px-6 py-3 min-h-[48px]',
  lg: 'text-lg px-8 py-4 min-h-[56px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
