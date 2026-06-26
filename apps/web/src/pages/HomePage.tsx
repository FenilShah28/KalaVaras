import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';

const TRADITIONS = [
  { key: 'warli',     emoji: '🌿', colorClass: 'from-teal/20 to-teal/5',       border: 'border-teal/30',       text: 'text-teal' },
  { key: 'kolam',     emoji: '✦',  colorClass: 'from-saffron/20 to-saffron/5', border: 'border-saffron/30',   text: 'text-saffron' },
  { key: 'pichwai',   emoji: '🪷', colorClass: 'from-gold/20 to-gold/5',        border: 'border-gold/30',       text: 'text-amber-700' },
  { key: 'madhubani', emoji: '🦚', colorClass: 'from-indigo-deep/20 to-indigo-deep/5', border: 'border-indigo-deep/30', text: 'text-indigo-deep' },
];

export default function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-stone">
      {/* ── Hero Section ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-deep via-[#3d2580] to-[#1a0f3d] text-white">
        {/* Decorative background circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-saffron/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-teal/10 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-xs font-medium mb-6 backdrop-blur-sm border border-white/20">
            {t('home.tagBadge')}
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold font-devanagari-serif mb-6 leading-tight">
            {t('app.name')}
          </h1>
          <p className="text-xl text-white/80 font-devanagari mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('app.heroSubtitle')}
          </p>

          {isAuthenticated ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/library">
                <Button size="lg" variant="secondary" id="btn-hero-library">
                  {t('nav.library')} →
                </Button>
              </Link>
              <Link to="/practice">
                <Button size="lg" variant="ghost" id="btn-hero-practice">
                  {t('nav.practice')}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" variant="secondary" id="btn-hero-register">
                  {t('onboarding.getStarted')} →
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="ghost" id="btn-hero-login">
                  {t('auth.login')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Traditions Grid ───────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-indigo-deep font-devanagari-serif text-center mb-3">
          {t('home.traditionsTitle')}
        </h2>
        <p className="text-center text-ink/60 font-devanagari mb-10">
          {t('home.traditionsSubtitle')}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {TRADITIONS.map(tr => (
            <Link
              key={tr.key}
              to={`/library?tradition=${tr.key}`}
              id={`btn-tradition-${tr.key}`}
              className={`
                flex flex-col items-center gap-3 p-6 rounded-2xl
                bg-gradient-to-br ${tr.colorClass}
                border-2 ${tr.border}
                hover:shadow-lg hover:scale-105 transition-all duration-300 group
              `}
            >
              <span className="text-4xl">{tr.emoji}</span>
              <span className={`text-sm font-bold font-devanagari ${tr.text}`}>
                {t(`traditions.${tr.key}`)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="bg-white border-t border-mist py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-indigo-deep font-devanagari-serif text-center mb-10">
            {t('home.howItWorks')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '🎥', titleKey: 'home.step1Title', descKey: 'home.step1Desc' },
              { step: '02', icon: '📊', titleKey: 'home.step2Title', descKey: 'home.step2Desc' },
              { step: '03', icon: '🎓', titleKey: 'home.step3Title', descKey: 'home.step3Desc' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-deep/10 flex items-center justify-center text-2xl mx-auto mb-4">
                  {s.icon}
                </div>
                <div className="text-xs font-bold text-saffron mb-1">{s.step}</div>
                <h3 className="font-bold text-indigo-deep font-devanagari-serif mb-2">{t(s.titleKey)}</h3>
                <p className="text-sm text-ink/60 font-devanagari">{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Footer ───────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="bg-gradient-to-r from-saffron to-[#c94a2e] text-white py-12 text-center">
          <div className="max-w-2xl mx-auto px-6">
            <h2 className="text-2xl font-bold font-devanagari-serif mb-3">{t('home.ctaTitle')}</h2>
            <p className="text-white/80 font-devanagari mb-6">{t('home.ctaSubtitle')}</p>
            <Link to="/register">
              <Button variant="ghost" size="lg" id="btn-cta-register"
                className="border-white text-white hover:bg-white hover:text-saffron">
                {t('onboarding.getStarted')}
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
