import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'artisan' ? '/artisan' : '/library');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-mist p-8">
          <h1 className="text-2xl font-bold text-indigo-deep font-devanagari-serif mb-1">
            {t('auth.login')}
          </h1>
          <p className="text-ink/60 text-sm mb-8 font-devanagari">{t('auth.loginSubtitle')}</p>

          {error && (
            <div
              role="alert"
              className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Input
              label={t('auth.email')}
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              label={t('auth.password')}
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-indigo-deep hover:underline font-devanagari"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              id="btn-login-submit"
            >
              {t('auth.login')}
            </Button>
          </form>

          <p className="text-center text-sm text-ink/60 mt-6 font-devanagari">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-indigo-deep font-semibold hover:underline">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
