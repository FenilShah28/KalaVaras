import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Accessible form input with label, error state, and hint text.
 * 48px minimum height for touch compliance.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-ink/80 font-devanagari"
        >
          {label}
          {props.required && <span className="text-saffron ml-1" aria-hidden="true">*</span>}
        </label>

        <input
          ref={ref}
          id={inputId}
          aria-describedby={[error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ')}
          aria-invalid={!!error}
          className={`
            w-full min-h-[48px] px-4 py-3 rounded-xl border-2 bg-white
            text-ink font-devanagari text-base transition-colors duration-150
            focus:outline-none focus:border-indigo-deep
            ${error
              ? 'border-red-400 focus:border-red-500'
              : 'border-mist hover:border-indigo-deep/40'
            }
            ${className}
          `}
          {...props}
        />

        {error && (
          <p id={errorId} role="alert" className="text-sm text-red-600 mt-1">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-ink/50 mt-1">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
