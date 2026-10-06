// On stocke l'heure de fin, pas le temps restant : le décompte continue d'un onglet à l'autre
// et après fermeture.
import { useEffect, useState } from 'preact/hooks';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-preact';
import { useLocal } from '../state/local';
import { Row, Segmented, Slider, Switch } from '../components/controls';
import type { WidgetProps, WidgetSettingsProps } from './types';
import { widgetKey } from './types';

interface Config {
  focus: number;
  short: number;
  long: number;
  sound: boolean;
}

type Phase = 'focus' | 'short' | 'long';

export interface TimerState {
  mode: 'timer' | 'pomodoro';
  /** Durée totale de la phase en cours (ms). */
  duration: number;
  /** Heure de fin si en marche. */
  endsAt: number | null;
  /** Temps restant si en pause (ms). */
  remaining: number;
  phase: Phase;
  /** Nombre de sessions de concentration terminées. */
  cycles: number;
  /** Heure de fin déjà signalée (évite plusieurs sonneries entre onglets). */
  notified: number | null;
}

const PRESETS = [1, 5, 10, 15, 25, 45];

export function remainingMs(s: TimerState, now = Date.now()): number {
  return s.endsAt ? Math.max(0, s.endsAt - now) : s.remaining;
}

export function nextPhase(s: TimerState, c: Config): { phase: Phase; duration: number; cycles: number } {
  if (s.phase === 'focus') {
    const cycles = s.cycles + 1;
    const phase: Phase = cycles % 4 === 0 ? 'long' : 'short';
    return { phase, duration: (phase === 'long' ? c.long : c.short) * 60000, cycles };
  }
  return { phase: 'focus', duration: c.focus * 60000, cycles: s.cycles };
}

function chime() {
  try {
    const ctx = new AudioContext();
    const notes = [880, 1174.66, 1567.98];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
    });
    setTimeout(() => void ctx.close(), 2000);
  } catch {
    /* audio indisponible */
  }
}

function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PHASE_LABEL: Record<Phase, string> = { focus: 'Concentration', short: 'Pause courte', long: 'Pause longue' };

export default function Timer({ instance, config, size }: WidgetProps<Config>) {
  const initial: TimerState = { mode: 'timer', duration: 5 * 60000, endsAt: null, remaining: 5 * 60000, phase: 'focus', cycles: 0, notified: null };
  const [st, setSt] = useLocal<TimerState>(widgetKey(instance.id), initial, 0);
  const [now, setNow] = useState(Date.now());
  const running = !!st.endsAt;
  const left = remainingMs(st, now);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  // Fin de décompte.
  useEffect(() => {
    if (!st.endsAt || left > 0 || st.notified === st.endsAt) return;
    const ended = st.endsAt;
    if (config.sound && document.visibilityState === 'visible') chime();
    setSt((prev) => {
      if (prev.notified === ended) return prev;
      if (prev.mode === 'pomodoro') {
        const n = nextPhase(prev, config);
        return { ...prev, ...n, endsAt: null, remaining: n.duration, notified: ended };
      }
      return { ...prev, endsAt: null, remaining: 0, notified: ended };
    });
  }, [left, st.endsAt]);

  // Titre de l'onglet pendant le décompte.
  useEffect(() => {
    if (!running) return;
    const original = document.title;
    document.title = `${fmt(left)} · ${st.mode === 'pomodoro' ? PHASE_LABEL[st.phase] : 'Minuteur'}`;
    return () => {
      document.title = original;
    };
  }, [running, Math.ceil(left / 1000)]);

  const start = () => setSt((p) => ({ ...p, endsAt: Date.now() + (p.remaining > 0 ? p.remaining : p.duration), remaining: 0 }));
  const pause = () => setSt((p) => ({ ...p, remaining: remainingMs(p), endsAt: null }));
  const reset = () => setSt((p) => ({ ...p, endsAt: null, remaining: p.duration, notified: null }));
  const setDuration = (min: number) => setSt((p) => ({ ...p, mode: 'timer', duration: min * 60000, remaining: min * 60000, endsAt: null }));
  const setMode = (mode: 'timer' | 'pomodoro') =>
    setSt((p) =>
      mode === 'pomodoro'
        ? { ...p, mode, phase: 'focus', duration: config.focus * 60000, remaining: config.focus * 60000, endsAt: null, cycles: 0 }
        : { ...p, mode, duration: 5 * 60000, remaining: 5 * 60000, endsAt: null },
    );
  const skip = () =>
    setSt((p) => {
      const n = nextPhase(p, config);
      return { ...p, ...n, endsAt: null, remaining: n.duration };
    });

  const progress = st.duration > 0 ? 1 - left / st.duration : 0;
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div class={`w-timer size-${size}`}>
      <Segmented
        label="Mode"
        value={st.mode}
        options={[
          { value: 'timer', label: 'Minuteur' },
          { value: 'pomodoro', label: 'Pomodoro' },
        ]}
        onChange={setMode}
      />
      <div class="w-timer-main">
        <div class="w-timer-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={R} class="ring-bg" />
            <circle cx="50" cy="50" r={R} class="ring-fg" stroke-dasharray={C} stroke-dashoffset={C * (1 - Math.min(1, Math.max(0, progress)))} />
          </svg>
          <div class="w-timer-text">
            <span class="w-timer-time" role="timer" aria-live="off">
              {fmt(left)}
            </span>
            {st.mode === 'pomodoro' && <span class="w-timer-phase">{PHASE_LABEL[st.phase]}</span>}
          </div>
        </div>
        <div class="w-timer-actions">
          {running ? (
            <button type="button" class="round-btn is-primary" aria-label="Pause" onClick={pause}>
              <Pause size={16} />
            </button>
          ) : (
            <button type="button" class="round-btn is-primary" aria-label="Démarrer" onClick={start} disabled={st.duration === 0}>
              <Play size={16} />
            </button>
          )}
          <button type="button" class="round-btn" aria-label="Réinitialiser" onClick={reset}>
            <RotateCcw size={15} />
          </button>
          {st.mode === 'pomodoro' && (
            <button type="button" class="round-btn" aria-label="Phase suivante" onClick={skip}>
              <SkipForward size={15} />
            </button>
          )}
        </div>
      </div>
      {st.mode === 'timer' && !running && (
        <div class="chips" role="group" aria-label="Durées rapides">
          {PRESETS.map((m) => (
            <button key={m} type="button" class={`chip ${st.duration === m * 60000 ? 'is-on' : ''}`} onClick={() => setDuration(m)}>
              {m} min
            </button>
          ))}
        </div>
      )}
      {st.mode === 'pomodoro' && <p class="w-timer-cycles">{st.cycles} session{st.cycles > 1 ? 's' : ''} terminée{st.cycles > 1 ? 's' : ''}</p>}
    </div>
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  return (
    <>
      <Row label="Concentration">
        <Slider label="Durée de concentration" value={config.focus} min={5} max={90} step={5} format={(v) => `${v} min`} onChange={(v) => setConfig({ focus: v })} />
      </Row>
      <Row label="Pause courte">
        <Slider label="Pause courte" value={config.short} min={1} max={30} format={(v) => `${v} min`} onChange={(v) => setConfig({ short: v })} />
      </Row>
      <Row label="Pause longue" hint="Toutes les 4 sessions">
        <Slider label="Pause longue" value={config.long} min={5} max={60} step={5} format={(v) => `${v} min`} onChange={(v) => setConfig({ long: v })} />
      </Row>
      <Row label="Son à la fin">
        <Switch label="Son à la fin" checked={config.sound} onChange={(v) => setConfig({ sound: v })} />
      </Row>
    </>
  );
}
