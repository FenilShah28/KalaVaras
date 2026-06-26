import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { practiceApi, type ProgressDashboard } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border-2 border-mist flex items-center gap-4">
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-indigo-deep font-devanagari-serif">{value}</div>
        <div className="text-xs text-ink/60 font-devanagari">{label}</div>
      </div>
    </div>
  );
}

/** Simple sparkline using inline SVG */
function Sparkline({ data }: { data: (number | null)[] }) {
  const valid = data.filter((d): d is number => d !== null);
  if (valid.length < 2) return <div className="text-xs text-ink/40">—</div>;
  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#E8593C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProgressPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dash, sessData] = await Promise.all([
          practiceApi.dashboard(),
          practiceApi.list({ limit: 10 } as any),
        ]);
        setDashboard(dash);
        setRecentSessions(sessData.sessions);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border-2 border-mist animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-indigo-deep font-devanagari-serif mb-2">
        {t('nav.progress')}
      </h1>
      <p className="text-ink/60 font-devanagari mb-8">
        {t('progress.greeting', { name: user?.nameMarathi || user?.nameEnglish })}
      </p>

      {/* ── Stats Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard icon="🎯" label={t('progress.totalSessions')} value={dashboard?.totalSessions ?? 0} />
        <StatCard icon="🎨" label={t('progress.cardsAttempted')} value={dashboard?.cardsAttempted ?? 0} />
        <StatCard icon="🔥" label={t('progress.currentStreak')} value={`${dashboard?.currentStreak ?? 0} ${t('progress.days')}`} />
        <StatCard icon="🏆" label={t('progress.longestStreak')} value={`${dashboard?.longestStreak ?? 0} ${t('progress.days')}`} />
      </div>

      {/* ── Streak Flame Banner ─────────────────────────────── */}
      {(dashboard?.currentStreak ?? 0) > 0 && (
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-saffron/20 to-gold/10 border-2 border-saffron/30 p-5 flex items-center gap-4">
          <div className="text-4xl">🔥</div>
          <div>
            <div className="font-bold text-saffron font-devanagari-serif">
              {dashboard?.currentStreak} {t('progress.dayStreak')}
            </div>
            <div className="text-sm text-ink/60 font-devanagari">{t('progress.keepItUp')}</div>
          </div>
        </div>
      )}

      {/* ── Recent Sessions Table ───────────────────────────── */}
      <div className="bg-white rounded-2xl border-2 border-mist overflow-hidden">
        <div className="px-5 py-4 border-b border-mist">
          <h2 className="font-bold text-indigo-deep font-devanagari-serif">{t('progress.recentSessions')}</h2>
        </div>
        {recentSessions.length === 0 ? (
          <div className="py-12 text-center text-ink/50 font-devanagari">
            <div className="text-4xl mb-3">📖</div>
            {t('progress.noSessions')}
          </div>
        ) : (
          <div className="divide-y divide-mist">
            {recentSessions.map(s => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-indigo-deep font-devanagari truncate">
                    {t('progress.attempt')} #{s.attemptNumber}
                  </div>
                  <div className="text-xs text-ink/50 font-devanagari">
                    {new Date(s.completedAt).toLocaleDateString('mr-IN')}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {s.deviationScore !== null && (
                    <div className="text-center">
                      <div className="text-xs text-ink/50">{t('progress.deviation')}</div>
                      <Sparkline data={[s.deviationScore]} />
                    </div>
                  )}
                  {s.rhythmAccuracy !== null && (
                    <div className="text-right">
                      <div className="text-xs text-ink/50">{t('progress.rhythm')}</div>
                      <div className="text-sm font-bold text-teal">
                        {Math.round((s.rhythmAccuracy ?? 0) * 100)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
