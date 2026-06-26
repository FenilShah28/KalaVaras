import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';

// ── Lazy-loaded pages (code splitting) ───────────────────────────────
const HomePage      = lazy(() => import('./pages/HomePage'));
const LoginPage     = lazy(() => import('./pages/LoginPage'));
const RegisterPage  = lazy(() => import('./pages/RegisterPage'));
const LibraryPage   = lazy(() => import('./pages/LibraryPage'));
const PracticePage  = lazy(() => import('./pages/PracticePage'));
const ProgressPage  = lazy(() => import('./pages/ProgressPage'));
const ArtisanPage   = lazy(() => import('./pages/ArtisanPage'));

// ── Loading fallback ──────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-deep/20 border-t-indigo-deep rounded-full animate-spin" />
        <p className="text-sm text-ink/50 font-devanagari">लोड होत आहे…</p>
      </div>
    </div>
  );
}

// ── Route guards ──────────────────────────────────────────────────────

/** Redirect authenticated users away from auth pages */
function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  if (!isInitialized) return <PageLoader />;
  return isAuthenticated ? <Navigate to="/library" replace /> : <>{children}</>;
}

/** Require authentication */
function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  if (!isInitialized) return <PageLoader />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Require artisan or admin role */
function ArtisanRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitialized, user } = useAuth();
  if (!isInitialized) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'artisan' && user?.role !== 'admin') return <Navigate to="/library" replace />;
  return <>{children}</>;
}

// ── App shell ─────────────────────────────────────────────────────────
function AppShell() {
  // Initialize auth (silent refresh) on mount via the hook
  useAuth();

  return (
    <div className="min-h-screen bg-stone flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />

            {/* Auth pages — redirect away if already logged in */}
            <Route path="/login" element={
              <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>
            } />
            <Route path="/register" element={
              <PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>
            } />

            {/* Protected — any authenticated user */}
            <Route path="/library" element={
              <PrivateRoute><LibraryPage /></PrivateRoute>
            } />
            <Route path="/practice" element={
              <PrivateRoute><PracticePage /></PrivateRoute>
            } />
            <Route path="/progress" element={
              <PrivateRoute><ProgressPage /></PrivateRoute>
            } />

            {/* Protected — artisan/admin only */}
            <Route path="/artisan" element={
              <ArtisanRoute><ArtisanPage /></ArtisanRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-mist py-4 text-center text-xs text-ink/40 font-devanagari">
        © 2025 KalaVaras · कलावारस
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
