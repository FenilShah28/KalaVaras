import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const traditions = [
  { key: 'warli', emoji: '🌿' },
  { key: 'kolam', emoji: '✦' },
  { key: 'pichwai', emoji: '🪷' },
  { key: 'madhubani', emoji: '🦚' },
];

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleLanguage = () => {
    const next = i18n.language === 'mr' ? 'en' : 'mr';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 min-h-[40px] flex items-center
        ${location.pathname === to
          ? 'bg-white/20 text-white'
          : 'text-white/80 hover:text-white hover:bg-white/10'
        }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="bg-indigo-deep text-white px-4 py-3 flex items-center justify-between gap-4 shadow-lg sticky top-0 z-50">
      {/* Brand */}
      <Link to="/" className="text-xl font-bold font-devanagari-serif shrink-0 hover:opacity-90 transition-opacity">
        {t('app.name')}
      </Link>

      {/* Nav links — authenticated */}
      {isAuthenticated && (
        <nav className="hidden sm:flex items-center gap-1">
          {navLink('/library', t('nav.library'))}
          {navLink('/practice', t('nav.practice'))}
          {navLink('/progress', t('nav.progress'))}
          {user?.role === 'artisan' || user?.role === 'admin'
            ? navLink('/artisan', t('nav.artisan'))
            : null}
        </nav>
      )}

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          id="language-toggle"
          onClick={toggleLanguage}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors duration-200 min-h-[40px]"
          aria-label={t('onboarding.selectLanguage')}
        >
          {i18n.language === 'mr' ? 'EN' : 'मराठी'}
        </button>

        {isAuthenticated ? (
          <button
            id="btn-logout"
            onClick={handleLogout}
            className="px-3 py-2 bg-white/10 hover:bg-red-500/80 rounded-lg text-sm transition-colors duration-200 min-h-[40px]"
          >
            {t('auth.logout')}
          </button>
        ) : (
          <Link
            to="/login"
            className="px-4 py-2 bg-saffron hover:bg-saffron/90 rounded-lg text-sm font-semibold transition-colors duration-200 min-h-[40px] flex items-center"
          >
            {t('auth.login')}
          </Link>
        )}
      </div>
    </header>
  );
}
