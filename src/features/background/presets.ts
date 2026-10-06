// Fonds intégrés en CSS pur. `tone` sert à choisir la couleur du texte.
export interface Preset {
  id: string;
  name: string;
  tone: 'dark' | 'light';
  css: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'crepuscule',
    name: 'Crépuscule',
    tone: 'dark',
    css: `radial-gradient(120% 90% at 15% 10%, #6d5dfc 0%, transparent 55%),
      radial-gradient(90% 80% at 85% 20%, #f0569a 0%, transparent 55%),
      radial-gradient(120% 100% at 50% 110%, #ff9a5a 0%, transparent 60%),
      linear-gradient(160deg, #1b1446 0%, #3a1c5c 50%, #5b2148 100%)`,
  },
  {
    id: 'aube',
    name: 'Aube',
    tone: 'light',
    css: `radial-gradient(90% 80% at 10% 15%, #ffd6c2 0%, transparent 60%),
      radial-gradient(80% 70% at 90% 10%, #f8c6e8 0%, transparent 60%),
      radial-gradient(110% 90% at 60% 100%, #c9d4ff 0%, transparent 65%),
      linear-gradient(180deg, #fff3ea 0%, #f3e9ff 100%)`,
  },
  {
    id: 'lagune',
    name: 'Lagune',
    tone: 'dark',
    css: `radial-gradient(100% 90% at 20% 20%, #1fb6c9 0%, transparent 55%),
      radial-gradient(90% 90% at 85% 30%, #2563eb 0%, transparent 60%),
      radial-gradient(100% 80% at 50% 110%, #0ea5a4 0%, transparent 60%),
      linear-gradient(170deg, #062a3f 0%, #0b3b5e 60%, #08304a 100%)`,
  },
  {
    id: 'foret',
    name: 'Forêt',
    tone: 'dark',
    css: `radial-gradient(100% 80% at 80% 10%, #5c8f4e 0%, transparent 55%),
      radial-gradient(110% 90% at 10% 90%, #1f5e4a 0%, transparent 60%),
      linear-gradient(165deg, #12261c 0%, #1c3a2a 55%, #0f2119 100%)`,
  },
  {
    id: 'ambre',
    name: 'Ambre',
    tone: 'dark',
    css: `radial-gradient(90% 80% at 75% 20%, #f59e0b 0%, transparent 55%),
      radial-gradient(100% 90% at 15% 85%, #b4472a 0%, transparent 60%),
      linear-gradient(160deg, #2a160b 0%, #4a2412 60%, #2b130b 100%)`,
  },
  {
    id: 'brume',
    name: 'Brume',
    tone: 'light',
    css: `radial-gradient(90% 80% at 20% 10%, #e3ecf7 0%, transparent 60%),
      radial-gradient(90% 80% at 90% 90%, #d9def0 0%, transparent 60%),
      linear-gradient(180deg, #f4f6fa 0%, #e6eaf2 100%)`,
  },
  {
    id: 'graphite',
    name: 'Graphite',
    tone: 'dark',
    css: `radial-gradient(90% 70% at 50% 0%, #3a3a40 0%, transparent 65%),
      linear-gradient(180deg, #1d1d20 0%, #121214 100%)`,
  },
  {
    id: 'nuit',
    name: 'Nuit',
    tone: 'dark',
    css: `radial-gradient(70% 50% at 50% 0%, rgba(80, 110, 255, 0.35) 0%, transparent 70%),
      radial-gradient(60% 50% at 100% 100%, rgba(170, 70, 255, 0.25) 0%, transparent 70%),
      linear-gradient(180deg, #05060c 0%, #0a0b16 100%)`,
  },
];

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export const GRADIENT_SUGGESTIONS: { from: string; to: string; angle: number }[] = [
  { from: '#4F46E5', to: '#EC4899', angle: 135 },
  { from: '#0EA5E9', to: '#22C55E', angle: 135 },
  { from: '#F97316', to: '#DB2777', angle: 160 },
  { from: '#0F172A', to: '#334155', angle: 180 },
  { from: '#FDE68A', to: '#FCA5A5', angle: 135 },
  { from: '#A7F3D0', to: '#BFDBFE', angle: 135 },
];
