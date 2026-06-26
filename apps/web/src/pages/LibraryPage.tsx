import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cardsApi, type StrokeCard } from '../utils/api';

const TRADITIONS = ['warli', 'kolam', 'pichwai', 'madhubani'] as const;
const TRADITION_EMOJI: Record<string, string> = {
  warli: '🌿', kolam: '✦', pichwai: '🪷', madhubani: '🦚',
};
const DIFFICULTY_DOTS = (d?: number | null) =>
  Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={`inline-block w-2 h-2 rounded-full ${i < (d ?? 0) ? 'bg-saffron' : 'bg-mist'}`} />
  ));

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-mist animate-pulse">
      <div className="h-4 bg-mist rounded w-1/3 mb-3" />
      <div className="h-5 bg-mist rounded w-2/3 mb-2" />
      <div className="h-4 bg-mist rounded w-1/2 mb-4" />
      <div className="flex gap-1 mt-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="w-2 h-2 rounded-full bg-mist" />)}</div>
    </div>
  );
}

export default function LibraryPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMr = i18n.language === 'mr';

  const [cards, setCards] = useState<StrokeCard[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tradition = searchParams.get('tradition') || '';
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page') || '1');

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await cardsApi.list({
        page,
        limit: 12,
        tradition: tradition || undefined,
        search: search || undefined,
      });
      setCards(result.cards);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, tradition, search]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-indigo-deep font-devanagari-serif mb-6">
        {t('nav.library')}
      </h1>

      {/* ── Filters ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            id="library-search"
            type="search"
            placeholder={t('library.search')}
            value={search}
            onChange={e => setFilter('search', e.target.value)}
            className="w-full pl-4 pr-4 py-2.5 rounded-xl border-2 border-mist focus:border-indigo-deep focus:outline-none text-sm font-devanagari bg-white min-h-[48px]"
          />
        </div>

        {/* Tradition filter pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            id="filter-all"
            onClick={() => setFilter('tradition', '')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all min-h-[48px] ${!tradition ? 'bg-indigo-deep text-white' : 'bg-white border-2 border-mist text-ink/70 hover:border-indigo-deep/40'}`}
          >
            {t('library.all')}
          </button>
          {TRADITIONS.map(tr => (
            <button
              key={tr}
              id={`filter-${tr}`}
              onClick={() => setFilter('tradition', tradition === tr ? '' : tr)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all min-h-[48px] flex items-center gap-1 ${tradition === tr ? 'bg-indigo-deep text-white' : 'bg-white border-2 border-mist text-ink/70 hover:border-indigo-deep/40'}`}
            >
              {TRADITION_EMOJI[tr]} {t(`traditions.${tr}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────── */}
      {error && (
        <div role="alert" className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── Cards Grid ────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)
          : cards.length === 0
            ? (
              <div className="col-span-full text-center py-16 text-ink/50 font-devanagari">
                <div className="text-5xl mb-4">🎨</div>
                {t('library.noCards')}
              </div>
            )
            : cards.map(card => (
              <Link
                key={card.id}
                to={`/library/${card.id}`}
                id={`card-${card.id}`}
                className="group bg-white rounded-2xl p-5 border-2 border-mist hover:border-indigo-deep/40 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-ink/50 uppercase tracking-wide font-devanagari">
                    {TRADITION_EMOJI[card.tradition]} {t(`traditions.${card.tradition}`)}
                  </span>
                  {card.visibility !== 'public' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-mist text-ink/50">
                      {t(`visibility.${card.visibility}`)}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-indigo-deep font-devanagari-serif group-hover:text-saffron transition-colors line-clamp-2">
                  {isMr ? card.nameMarathi : (card.nameEnglish || card.nameMarathi)}
                </h2>
                {(isMr ? null : card.descriptionMarathi) && (
                  <p className="text-xs text-ink/60 mt-1 font-devanagari line-clamp-2">
                    {card.descriptionMarathi}
                  </p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-0.5">{DIFFICULTY_DOTS(card.difficulty)}</div>
                  <span className="text-xs text-ink/40">👁 {card.viewCount}</span>
                </div>
              </Link>
            ))}
      </div>

      {/* ── Pagination ────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              id={`page-${p}`}
              onClick={() => setFilter('page', String(p))}
              className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${p === page ? 'bg-indigo-deep text-white' : 'bg-white border-2 border-mist text-ink/70 hover:border-indigo-deep/40'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
