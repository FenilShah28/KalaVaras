import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cardsApi, type StrokeCard } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

const TRADITIONS = ['warli', 'kolam', 'pichwai', 'madhubani'] as const;
const TRADITION_EMOJI: Record<string, string> = {
  warli: '🌿', kolam: '✦', pichwai: '🪷', madhubani: '🦚',
};

type View = 'list' | 'create';

function CreateCardForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    tradition: 'warli' as string,
    nameMarathi: '',
    nameEnglish: '',
    descriptionMarathi: '',
    difficulty: 1,
    visibility: 'community' as string,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameMarathi.trim()) { setError(t('errors.nameTooShort')); return; }
    setError('');
    setLoading(true);
    try {
      await cardsApi.create({
        tradition: form.tradition,
        nameMarathi: form.nameMarathi,
        nameEnglish: form.nameEnglish || undefined,
        descriptionMarathi: form.descriptionMarathi || undefined,
        difficulty: form.difficulty,
        visibility: form.visibility,
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-mist p-6 space-y-5">
      <h2 className="text-lg font-bold text-indigo-deep font-devanagari-serif">{t('artisan.newCard')}</h2>

      {error && <div role="alert" className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

      {/* Tradition */}
      <div>
        <p className="text-sm font-semibold text-ink/80 mb-2 font-devanagari">{t('artisan.tradition')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TRADITIONS.map(tr => (
            <button key={tr} type="button" onClick={() => set('tradition', tr)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-devanagari transition-all min-h-[48px]
                ${form.tradition === tr ? 'border-indigo-deep bg-indigo-deep/5 text-indigo-deep font-bold' : 'border-mist hover:border-indigo-deep/30 text-ink/70'}`}>
              {TRADITION_EMOJI[tr]} {t(`traditions.${tr}`)}
            </button>
          ))}
        </div>
      </div>

      <Input label={t('artisan.nameMarathi')} id="card-name-mr" value={form.nameMarathi}
        onChange={e => set('nameMarathi', e.target.value)} required />
      <Input label={t('artisan.nameEnglish')} id="card-name-en" value={form.nameEnglish}
        onChange={e => set('nameEnglish', e.target.value)} />
      <div>
        <label className="text-sm font-semibold text-ink/80 font-devanagari">{t('artisan.description')}</label>
        <textarea
          id="card-desc"
          rows={3}
          value={form.descriptionMarathi}
          onChange={e => set('descriptionMarathi', e.target.value)}
          className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-mist focus:border-indigo-deep focus:outline-none text-sm font-devanagari bg-white resize-none"
        />
      </div>

      {/* Difficulty */}
      <div>
        <p className="text-sm font-semibold text-ink/80 mb-2 font-devanagari">{t('artisan.difficulty')}</p>
        <div className="flex gap-2">
          {[1,2,3,4,5].map(d => (
            <button key={d} type="button" onClick={() => set('difficulty', d)}
              className={`w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all ${form.difficulty === d ? 'border-saffron bg-saffron text-white' : 'border-mist text-ink/50 hover:border-saffron/40'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="text-sm font-semibold text-ink/80 font-devanagari">{t('artisan.visibility')}</label>
        <select
          id="card-visibility"
          value={form.visibility}
          onChange={e => set('visibility', e.target.value)}
          className="mt-1 w-full min-h-[48px] px-4 py-3 rounded-xl border-2 border-mist focus:border-indigo-deep focus:outline-none text-sm font-devanagari bg-white"
        >
          {['private', 'community', 'public', 'research'].map(v => (
            <option key={v} value={v}>{t(`visibility.${v}`)}</option>
          ))}
        </select>
      </div>

      <Button type="submit" fullWidth loading={loading} id="btn-create-card">{t('artisan.createCard')}</Button>
    </form>
  );
}

export default function ArtisanPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('list');
  const [cards, setCards] = useState<StrokeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadCards = async () => {
    setLoading(true);
    try {
      const result = await cardsApi.list({ limit: 50, ownerId: user?.id } as any);
      setCards(result.cards);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCards(); }, []);

  const handlePublish = async (id: string) => {
    await cardsApi.publish(id);
    loadCards();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('artisan.confirmDelete'))) return;
    await cardsApi.delete(id);
    loadCards();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-indigo-deep font-devanagari-serif">{t('nav.artisan')}</h1>
        <Button id="btn-new-card" onClick={() => setView(v => v === 'create' ? 'list' : 'create')} variant={view === 'create' ? 'ghost' : 'primary'}>
          {view === 'create' ? t('common.cancel') : `+ ${t('artisan.newCard')}`}
        </Button>
      </div>

      {view === 'create' && (
        <div className="mb-8">
          <CreateCardForm onCreated={() => { setView('list'); loadCards(); }} />
        </div>
      )}

      {/* ── My Cards ─────────────────────────────────────────── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="bg-white rounded-2xl p-5 border border-mist h-32 animate-pulse" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-ink/50 font-devanagari">
          <div className="text-5xl mb-3">🎨</div>
          {t('artisan.noCards')}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map(card => (
            <div key={card.id} className="bg-white rounded-2xl p-5 border-2 border-mist hover:border-indigo-deep/30 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-ink/50 font-devanagari mb-1">
                    {TRADITION_EMOJI[card.tradition]} {t(`traditions.${card.tradition}`)}
                  </div>
                  <h2 className="font-bold text-indigo-deep font-devanagari-serif truncate">{card.nameMarathi}</h2>
                </div>
                <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
                  card.visibility === 'public' ? 'bg-teal/10 text-teal' :
                  card.visibility === 'community' ? 'bg-indigo-deep/10 text-indigo-deep' :
                  'bg-mist text-ink/50'
                }`}>{t(`visibility.${card.visibility}`)}</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                {card.visibility !== 'public' && (
                  <Button size="sm" variant="secondary" id={`btn-publish-${card.id}`} onClick={() => handlePublish(card.id)}>
                    {t('artisan.publish')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" id={`btn-delete-${card.id}`} onClick={() => handleDelete(card.id)}>
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
