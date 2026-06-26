import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../utils/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

const TRADITIONS = ['warli', 'kolam', 'pichwai', 'madhubani'] as const;
const TRADITION_LABELS: Record<string, { mr: string; en: string; emoji: string }> = {
  warli:     { mr: 'वारली',     en: 'Warli',     emoji: '🌿' },
  kolam:     { mr: 'कोलम',     en: 'Kolam',     emoji: '✦' },
  pichwai:   { mr: 'पिछवाई',   en: 'Pichwai',   emoji: '🪷' },
  madhubani: { mr: 'मधुबनी',   en: 'Madhubani', emoji: '🦚' },
};

type Step = 'role' | 'details' | 'confirm';
type Role = 'artisan' | 'apprentice';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isMr = i18n.language === 'mr';

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    nameMarathi: '', nameEnglish: '',
    village: '', district: 'Pune',
    traditions: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const toggleTradition = (t: string) =>
    setForm(f => ({
      ...f,
      traditions: f.traditions.includes(t)
        ? f.traditions.filter(x => x !== t)
        : [...f.traditions, t],
    }));

  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = t('errors.invalidEmail');
    if (form.password.length < 8) e.password = t('errors.passwordTooShort');
    if (!/[A-Z]/.test(form.password)) e.password = t('errors.passwordUppercase');
    if (!/[0-9]/.test(form.password)) e.password = t('errors.passwordDigit');
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",./<>?]/.test(form.password)) e.password = t('errors.passwordSpecial');
    if (form.password !== form.confirmPassword) e.confirmPassword = t('errors.passwordMismatch');
    if (form.nameMarathi.length < 2) e.nameMarathi = t('errors.nameTooShort');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setServerError('');
    setLoading(true);
    try {
      await authApi.register({
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        nameMarathi: form.nameMarathi,
        nameEnglish: form.nameEnglish || undefined,
        role: role!,
        village: form.village || undefined,
        district: form.district || undefined,
        traditions: form.traditions.length > 0 ? form.traditions : undefined,
      });
      setDone(true);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">✉️</div>
          <h1 className="text-2xl font-bold text-indigo-deep font-devanagari-serif mb-3">
            {t('auth.checkEmail')}
          </h1>
          <p className="text-ink/70 font-devanagari mb-8">{t('auth.verifyEmailSent')}</p>
          <Button onClick={() => navigate('/login')} fullWidth>{t('auth.goToLogin')}</Button>
        </div>
      </div>
    );
  }

  // ── Step 1: Role selection ──────────────────────────────────────────
  if (step === 'role') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-indigo-deep font-devanagari-serif mb-2 text-center">
            {t('onboarding.iAmA')}
          </h1>
          <p className="text-ink/60 text-sm text-center mb-8 font-devanagari">{t('onboarding.chooseRole')}</p>
          <div className="space-y-4">
            {(['artisan', 'apprentice'] as Role[]).map(r => (
              <button
                key={r}
                id={`btn-role-${r}`}
                onClick={() => { setRole(r); setStep('details'); }}
                className="w-full p-6 bg-white rounded-2xl shadow-md hover:shadow-xl border-2 border-transparent hover:border-saffron transition-all duration-300 text-left group"
              >
                <div className="text-3xl mb-2">{r === 'artisan' ? '🎨' : '📖'}</div>
                <div className="text-xl font-bold text-indigo-deep font-devanagari-serif group-hover:text-saffron transition-colors">
                  {t(`onboarding.${r === 'artisan' ? 'iAmArtisan' : 'iAmLearning'}`)}
                </div>
                <div className="text-sm text-ink/60 mt-1 font-devanagari">
                  {t(`onboarding.${r === 'artisan' ? 'artisanDesc' : 'apprenticeDesc'}`)}
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-ink/60 mt-6 font-devanagari">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-indigo-deep font-semibold hover:underline">{t('auth.login')}</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Details form ────────────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-mist p-8">
          {/* Back button */}
          <button onClick={() => setStep('role')} className="text-sm text-ink/50 hover:text-indigo-deep mb-6 flex items-center gap-1 transition-colors">
            ← {t('common.back')}
          </button>

          <h1 className="text-2xl font-bold text-indigo-deep font-devanagari-serif mb-1">
            {t('auth.register')}
          </h1>
          <p className="text-ink/60 text-sm mb-6 font-devanagari">
            {role === 'artisan' ? '🎨' : '📖'} {t(`onboarding.${role === 'artisan' ? 'iAmArtisan' : 'iAmLearning'}`)}
          </p>

          {serverError && (
            <div role="alert" className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {serverError}
            </div>
          )}

          <div className="space-y-4">
            <Input label={t('auth.nameMarathi')} id="reg-name-mr" value={form.nameMarathi}
              onChange={e => set('nameMarathi', e.target.value)} error={errors.nameMarathi} required />
            <Input label={t('auth.nameEnglish')} id="reg-name-en" value={form.nameEnglish}
              onChange={e => set('nameEnglish', e.target.value)} />
            <Input label={t('auth.email')} id="reg-email" type="email" autoComplete="email"
              value={form.email} onChange={e => set('email', e.target.value)} error={errors.email} required />
            <Input label={t('auth.password')} id="reg-password" type="password" autoComplete="new-password"
              value={form.password} onChange={e => set('password', e.target.value)} error={errors.password}
              hint={t('auth.passwordHint')} required />
            <Input label={t('auth.confirmPassword')} id="reg-confirm" type="password" autoComplete="new-password"
              value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
              error={errors.confirmPassword} required />
            <Input label={t('auth.village')} id="reg-village" value={form.village}
              onChange={e => set('village', e.target.value)} />

            {/* Traditions multi-select */}
            <div>
              <p className="text-sm font-semibold text-ink/80 font-devanagari mb-2">{t('auth.traditions')}</p>
              <div className="grid grid-cols-2 gap-2">
                {TRADITIONS.map(tr => (
                  <button key={tr} type="button" id={`btn-tradition-${tr}`}
                    onClick={() => toggleTradition(tr)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-devanagari transition-all duration-150 min-h-[48px]
                      ${form.traditions.includes(tr)
                        ? 'border-indigo-deep bg-indigo-deep/5 text-indigo-deep font-semibold'
                        : 'border-mist hover:border-indigo-deep/40 text-ink/70'}`}
                  >
                    <span>{TRADITION_LABELS[tr]!.emoji}</span>
                    <span>{isMr ? TRADITION_LABELS[tr]!.mr : TRADITION_LABELS[tr]!.en}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button fullWidth size="lg" loading={loading}
            onClick={() => { if (validateDetails()) handleSubmit(); }}
            className="mt-8" id="btn-register-submit">
            {t('auth.createAccount')}
          </Button>
        </div>
      </div>
    </div>
  );
}
