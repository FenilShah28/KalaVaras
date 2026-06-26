/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      /**
       * Colour tokens from Document 3 Section 3.2 — Design System.
       * These are the exact hex values specified in the product spec.
       */
      colors: {
        'indigo-deep': '#2D1B69',   // Primary brand, headers, CTAs
        'saffron': '#E8593C',        // Accent, section markers, alerts
        'gold': '#D4AF37',           // Highlight, achievement badges, Pichwai motifs
        'teal': '#0F6E56',           // Success states, cross-references, Warli accent
        'stone': '#F4F3F0',          // Background surfaces, card fills
        'ink': '#1A1A1A',            // Body text
        'mist': '#E8E6E0',           // Borders, dividers
      },
      fontFamily: {
        /** Marathi body text */
        'devanagari': ['"Noto Sans Devanagari"', 'sans-serif'],
        /** Marathi headings */
        'devanagari-serif': ['"Noto Serif Devanagari"', 'serif'],
        /** English body text */
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        /** English headings */
        'display': ['"Playfair Display"', 'serif'],
        /** Technique notation and rhythm data */
        'mono': ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        /** 16px base size as specified in Doc 3 */
        'base': ['1rem', { lineHeight: '1.7' }],
        /** Slightly larger for Devanagari readability on mobile */
        'base-mr': ['1.0625rem', { lineHeight: '1.7' }], // 17px for <480px
      },
      animation: {
        /** Warli motif loader — only looping animation allowed */
        'warli-spin': 'warli-spin 2s ease-in-out infinite',
        /** Entrance animation — spring physics handled by Framer Motion */
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        'warli-spin': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(180deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      screens: {
        /** Custom breakpoints from Doc 3 Section 3.4 */
        'xs': '480px',    // Tablet starts
        'sm': '480px',
        'md': '768px',    // Desktop small
        'lg': '1200px',   // Desktop large — full portfolio layer
      },
      spacing: {
        /** 48px minimum touch target as specified */
        'touch': '3rem',
      },
    },
  },
  plugins: [],
};
