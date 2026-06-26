import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n/i18n.ts';

/**
 * Application entry point.
 * - Loads i18n before rendering (Marathi default)
 * - Suspense boundary for async i18n loading
 * - StrictMode enabled for development quality checks
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-stone">
        <div className="text-center">
          <div className="animate-warli-spin w-12 h-12 border-4 border-indigo-deep border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-ink font-devanagari">लोड होत आहे...</p>
        </div>
      </div>
    }>
      <App />
    </Suspense>
  </React.StrictMode>,
);
