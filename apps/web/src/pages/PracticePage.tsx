import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cardsApi, practiceApi, type StrokeCard } from '../utils/api';
import { Button } from '../components/Button';

const TRADITION_EMOJI: Record<string, string> = {
  warli: '🌿', kolam: '✦', pichwai: '🪷', madhubani: '🦚',
};

type PracticeState = 'idle' | 'recording' | 'submitting' | 'done';

interface Point {
  x: number;
  y: number;
  t: number;
}

/** Circular score ring */
function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = ((1 - value) * circ).toFixed(1);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={72} height={72} className="-rotate-90">
        <circle cx={36} cy={36} r={r} fill="none" stroke="#E8E6E0" strokeWidth={6} />
        <circle
          cx={36} cy={36} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={`${circ}`}
          strokeDashoffset={dash}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="text-lg font-bold text-indigo-deep" style={{ marginTop: -52 }}>{pct}%</div>
      <div className="text-xs text-ink/60 font-devanagari mt-8">{label}</div>
    </div>
  );
}

interface GuidePath {
  points: { x: number; y: number }[];
  draw: (ctx: CanvasRenderingContext2D) => void;
}

function getGuidePath(cardName: string, tradition: string, width: number, height: number): GuidePath {
  const name = cardName.toLowerCase();
  
  if (name.includes('circle') || name.includes('गोल') || name.includes('round')) {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.25;
    const pts: { x: number; y: number }[] = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
    return {
      points: pts,
      draw: (ctx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
  }
  
  if (name.includes('spiral') || name.includes('गुंडाळी') || name.includes('tiger') || (tradition === 'warli' && name.includes('sun'))) {
    const cx = width / 2;
    const cy = height / 2;
    const pts: { x: number; y: number }[] = [];
    const steps = 80;
    const a = 8, b = 2.5;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 6; // 3 full loops
      const r = a + b * theta;
      pts.push({ x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r });
    }
    return {
      points: pts,
      draw: (ctx) => {
        ctx.beginPath();
        if (pts.length > 0) {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
        }
        ctx.stroke();
      }
    };
  }

  if (name.includes('triangle') || name.includes('त्रिकोण') || tradition === 'warli') {
    // Warli triangle body / torso shape
    const topX = width / 2, topY = height * 0.25;
    const leftX = width * 0.25, leftY = height * 0.75;
    const rightX = width * 0.75, rightY = height * 0.75;
    const pts: { x: number; y: number }[] = [];
    const stepsPerEdge = 25;
    
    // Top to Bottom-Left
    for (let i = 0; i < stepsPerEdge; i++) {
      const t = i / stepsPerEdge;
      pts.push({ x: topX + (leftX - topX) * t, y: topY + (leftY - topY) * t });
    }
    // Bottom-Left to Bottom-Right
    for (let i = 0; i < stepsPerEdge; i++) {
      const t = i / stepsPerEdge;
      pts.push({ x: leftX + (rightX - leftX) * t, y: leftY + (rightY - leftY) * t });
    }
    // Bottom-Right to Top
    for (let i = 0; i <= stepsPerEdge; i++) {
      const t = i / stepsPerEdge;
      pts.push({ x: rightX + (topX - rightX) * t, y: rightY + (topY - rightY) * t });
    }
    return {
      points: pts,
      draw: (ctx) => {
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.stroke();
      }
    };
  }

  if (name.includes('lotus') || name.includes('कमळ') || tradition === 'pichwai' || tradition === 'kolam') {
    // Pichwai lotus petal or Kolam curve
    const cx = width / 2;
    const startY = height * 0.75;
    const peakY = height * 0.25;
    const leftControlX = width * 0.15, rightControlX = width * 0.85;
    const pts: { x: number; y: number }[] = [];
    const steps = 30;

    // Left half curve
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = (1-t)*(1-t)*cx + 2*(1-t)*t*leftControlX + t*t*cx;
      const y = (1-t)*(1-t)*startY + 2*(1-t)*t*((startY+peakY)/2) + t*t*peakY;
      pts.push({ x, y });
    }
    // Right half curve
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1-t)*(1-t)*cx + 2*(1-t)*t*rightControlX + t*t*cx;
      const y = (1-t)*(1-t)*peakY + 2*(1-t)*t*((startY+peakY)/2) + t*t*startY;
      pts.push({ x, y });
    }
    return {
      points: pts,
      draw: (ctx) => {
        ctx.beginPath();
        ctx.moveTo(cx, startY);
        ctx.quadraticCurveTo(leftControlX, (startY + peakY) / 2, cx, peakY);
        ctx.quadraticCurveTo(rightControlX, (startY + peakY) / 2, cx, startY);
        ctx.stroke();
      }
    };
  }

  // Default curve (Quadratic)
  const x0 = width * 0.2, y0 = height * 0.7;
  const x1 = width * 0.5, y1 = height * 0.2;
  const x2 = width * 0.8, y2 = height * 0.7;
  const pts: { x: number; y: number }[] = [];
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y2;
    pts.push({ x, y });
  }
  return {
    points: pts,
    draw: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x1, y1, x2, y2);
      ctx.stroke();
    }
  };
}

export default function PracticePage() {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';

  const [cards, setCards] = useState<StrokeCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<StrokeCard | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState>('idle');
  const [timer, setTimer] = useState(0);
  const [result, setResult] = useState<{ deviationScore: number; rhythmAccuracy: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Interactive drawing & camera states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await cardsApi.list({ limit: 50 });
        setCards(data.cards);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Practice timer
  useEffect(() => {
    if (practiceState !== 'recording') return;
    const id = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [practiceState]);

  // Webcam stream management
  useEffect(() => {
    if (practiceState !== 'recording') {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(s => {
        setStream(s);
      })
      .catch(err => {
        console.warn('Webcam not available or permission denied:', err);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [practiceState]);

  // Attach stream to video tag
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, practiceState]);

  // Render ghost path and existing drawing points on canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw reference ghost path (dotted guide curve)
    ctx.strokeStyle = '#E8593C'; // Saffron color
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 6]);
    
    if (selectedCard) {
      const guide = getGuidePath(
        selectedCard.nameEnglish || selectedCard.nameMarathi,
        selectedCard.tradition,
        canvas.width,
        canvas.height
      );
      guide.draw(ctx);
    } else {
      ctx.beginPath();
      ctx.moveTo(canvas.width * 0.2, canvas.height * 0.7);
      ctx.quadraticCurveTo(canvas.width * 0.5, canvas.height * 0.2, canvas.width * 0.8, canvas.height * 0.7);
      ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // Draw user path
    if (points.length > 0) {
      ctx.strokeStyle = '#0F6E56'; // Teal color
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
  };

  // Redraw whenever points change
  useEffect(() => {
    drawCanvas();
  }, [points, practiceState]);

  const handleStart = (card: StrokeCard) => {
    setSelectedCard(card);
    setTimer(0);
    setResult(null);
    setError('');
    setPoints([]);
    setPracticeState('recording');
  };

  // Helper to calculate score relative to reference path
  const evaluatePracticeRun = (): { deviationScore: number; rhythmAccuracy: number } => {
    const canvas = canvasRef.current;
    const width = canvas?.width ?? 400;
    const height = canvas?.height ?? 300;

    if (!selectedCard) {
      return { deviationScore: 0.999, rhythmAccuracy: 0.1 };
    }

    // Dynamic guide path based on current card
    const guide = getGuidePath(
      selectedCard.nameEnglish || selectedCard.nameMarathi,
      selectedCard.tradition,
      width,
      height
    );
    const refPoints = guide.points;

    if (points.length === 0) {
      return { deviationScore: 0.999, rhythmAccuracy: 0.1 };
    }

    // Dynamic deviation calculations (distance to closest reference points)
    let totalDistance = 0;
    for (const rp of refPoints) {
      let minDistance = Infinity;
      for (const up of points) {
        const d = Math.sqrt((rp.x - up.x) ** 2 + (rp.y - up.y) ** 2);
        if (d < minDistance) minDistance = d;
      }
      totalDistance += minDistance;
    }
    const avgDistance = totalDistance / refPoints.length;

    // Map avg distance to a deviation score (lower is better, capped at 1.0)
    // Capping deviation score so Math.max(0, 1 - deviation) yields accurate matching
    const deviationScore = Math.min(1.0, avgDistance / 100);

    // Rhythm calculation (consistency of drawing speed)
    let rhythmAccuracy = 0.5;
    if (points.length > 2) {
      const speeds: number[] = [];
      for (let i = 1; i < points.length; i++) {
        const dt = points[i].t - points[i - 1].t;
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dt > 0) speeds.push(dist / dt);
      }
      if (speeds.length > 0) {
        const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
        const variance = speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / speeds.length;
        const stdDev = Math.sqrt(variance);
        rhythmAccuracy = Math.max(0.1, Math.min(0.95, 1 - stdDev / (avgSpeed + 0.1)));
      }
    }

    return {
      deviationScore: parseFloat(deviationScore.toFixed(3)),
      rhythmAccuracy: parseFloat(rhythmAccuracy.toFixed(3)),
    };
  };

  const handleStop = async () => {
    if (!selectedCard) return;
    setPracticeState('submitting');

    const scores = evaluatePracticeRun();

    try {
      await practiceApi.submit({
        strokeCardId: selectedCard.id,
        deviationScore: scores.deviationScore,
        rhythmAccuracy: scores.rhythmAccuracy,
        durationSeconds: timer,
      });
      setResult(scores);
      setPracticeState('done');
    } catch (err) {
      setError((err as Error).message);
      setPracticeState('idle');
    }
  };

  const handleReset = () => {
    setPracticeState('idle');
    setSelectedCard(null);
    setResult(null);
    setTimer(0);
    setPoints([]);
  };

  // Drawing handlers (mouse and touch)
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Handle touch vs mouse
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setPoints([{ ...coords, t: Date.now() }]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    setPoints(pts => [...pts, { ...coords, t: Date.now() }]);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const filteredCards = cards.filter(c =>
    !search || c.nameMarathi.includes(search) || c.nameEnglish?.toLowerCase().includes(search.toLowerCase()),
  );

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Recording / Done Screen ────────────────────────────────────────
  if (practiceState === 'recording' || practiceState === 'submitting' || practiceState === 'done') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl border-2 border-mist overflow-hidden flex flex-col md:flex-row">
          
          {/* Left panel: Reference rhythm and session parameters */}
          <div className="w-full md:w-1/3 bg-stone p-6 border-b md:border-b-0 md:border-r border-mist flex flex-col justify-between">
            <div>
              <div className="text-3xl mb-2">{TRADITION_EMOJI[selectedCard?.tradition ?? 'warli']}</div>
              <h2 className="text-xl font-bold text-indigo-deep font-devanagari-serif mb-2">
                {isMr ? selectedCard?.nameMarathi : (selectedCard?.nameEnglish || selectedCard?.nameMarathi)}
              </h2>
              <p className="text-xs text-ink/60 font-devanagari mb-6">
                {t(`traditions.${selectedCard?.tradition}`)} · {t('artisan.difficulty')}: {selectedCard?.difficulty}/5
              </p>

              {/* Master reference curve diagram representation */}
              <div className="border border-mist rounded-xl p-3 bg-white mb-6">
                <p className="text-xs font-semibold text-indigo-deep font-devanagari mb-2">📈 {t('practice.accuracy')}</p>
                <div className="h-16 flex items-center justify-center border-2 border-dashed border-mist rounded-lg bg-stone text-xs text-ink/40 font-mono">
                  ~~~~ WAVEFORM PROFILE ~~~~
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-center md:text-left">
                <p className="text-xs text-ink/50 font-devanagari">{t('practice.duration')}</p>
                <p className="text-3xl font-bold text-indigo-deep font-mono mt-1">{fmt(timer)}</p>
              </div>

              {practiceState !== 'done' ? (
                <Button
                  fullWidth size="lg"
                  variant={practiceState === 'submitting' ? 'ghost' : 'danger'}
                  loading={practiceState === 'submitting'}
                  onClick={handleStop}
                  id="btn-stop-practice"
                >
                  {practiceState === 'submitting' ? t('practice.submitting') : t('practice.stopRecording')}
                </Button>
              ) : (
                <Button fullWidth onClick={handleReset} id="btn-practice-again">
                  {t('practice.practiceAgain')}
                </Button>
              )}
            </div>
          </div>

          {/* Right panel: Active Practice Area (Webcam / Canvas) */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center bg-stone/40 min-h-[350px]">
            {practiceState !== 'done' ? (
              <div className="w-full max-w-lg aspect-[4/3] bg-ink rounded-2xl relative shadow-lg overflow-hidden border-2 border-mist">
                
                {/* Webcam background stream */}
                {stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 text-center p-4">
                    <span className="text-3xl mb-2">📷</span>
                    <p className="text-xs font-devanagari">webcam not active</p>
                    <p className="text-[10px] opacity-75 mt-1 font-devanagari">using slate background for tracing</p>
                  </div>
                )}

                {/* Overlaid drawing canvas & ghost path guide */}
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="absolute inset-0 w-full h-full cursor-crosshair z-10 touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />

                {/* Status dot overlay */}
                <div className="absolute top-4 right-4 bg-saffron text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 z-20 shadow animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white block" />
                  REC
                </div>
                
                {/* Visual guideline hint */}
                <div className="absolute bottom-4 left-4 right-4 bg-indigo-deep/90 text-white text-[11px] px-3 py-1.5 rounded-lg text-center font-devanagari z-20 pointer-events-none shadow">
                  Trace the dotted orange stroke guideline with your cursor / finger
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-mist shadow text-center">
                <h3 className="text-lg font-bold text-indigo-deep font-devanagari-serif mb-6">🎯 Practice Metrics</h3>
                
                <div className="flex justify-center gap-12 mb-8">
                  <ScoreRing
                    value={1 - (result?.deviationScore ?? 0)}
                    label={t('practice.accuracy')}
                    color="#0F6E56"
                  />
                  <ScoreRing
                    value={result?.rhythmAccuracy ?? 0}
                    label={t('practice.rhythm')}
                    color="#E8593C"
                  />
                </div>

                <div className="bg-stone rounded-xl p-4 mb-6 text-sm text-ink/75 font-devanagari">
                  {t('practice.sessionSaved')} · {fmt(timer)}
                </div>

                {error && <p className="text-red-600 text-sm mb-4 font-devanagari">{error}</p>}

                <Button fullWidth onClick={() => { handleReset(); }} id="btn-practice-done">
                  {t('common.done')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Card Selection Screen ──────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-indigo-deep font-devanagari-serif mb-2">
        {t('nav.practice')}
      </h1>
      <p className="text-ink/60 font-devanagari mb-6">{t('practice.chooseCard')}</p>

      {/* Search */}
      <input
        id="practice-search"
        type="search"
        placeholder={t('library.search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full mb-6 px-4 py-3 rounded-xl border-2 border-mist focus:border-indigo-deep focus:outline-none text-sm font-devanagari bg-white min-h-[48px]"
      />

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-mist h-24 animate-pulse" />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-16 text-ink/50 font-devanagari">
          <div className="text-5xl mb-3">🎨</div>
          {t('library.noCards')}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredCards.map(card => (
            <button
              key={card.id}
              id={`btn-practice-${card.id}`}
              onClick={() => handleStart(card)}
              className="text-left bg-white rounded-2xl p-5 border-2 border-mist hover:border-saffron hover:shadow-lg transition-all duration-300 group"
            >
              <div className="text-xs text-ink/50 font-devanagari mb-1">
                {TRADITION_EMOJI[card.tradition]} {t(`traditions.${card.tradition}`)}
              </div>
              <h2 className="font-bold text-indigo-deep font-devanagari-serif group-hover:text-saffron transition-colors">
                {isMr ? card.nameMarathi : (card.nameEnglish || card.nameMarathi)}
              </h2>
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={`w-2 h-2 rounded-full ${i < (card.difficulty ?? 0) ? 'bg-saffron' : 'bg-mist'}`} />
                  ))}
                </div>
                <span className="text-xs text-saffron font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('practice.start')} →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
