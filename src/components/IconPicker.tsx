import { useState } from 'preact/hooks';
import { ImagePlus } from 'lucide-preact';
import type { IconRef } from '../types';
import { SYMBOL_NAMES, Symbol } from './Icon';
import { Segmented, TextField } from './controls';
import { putBlob } from '../storage/blobs';
import { downscale, isAcceptedImage } from '../lib/image';
import { normalizeUrl } from '../lib/url';
import { toast } from '../app/ui';

const EMOJI = [
  '⭐️', '❤️', '🏠', '💼', '💻', '🧑‍💻', '🛠️', '📚', '🎓', '🧠', '💡', '🧪', '📈', '💰', '🪙', '🛒',
  '🎵', '🎧', '🎬', '📺', '🎮', '📷', '🎨', '✍️', '📰', '💬', '📧', '📅', '⏰', '✈️', '🗺️', '🚗',
  '🌍', '🌿', '🌸', '☀️', '🌙', '🔥', '⚡️', '❄️', '☕️', '🍕', '🍷', '🏋️', '⚽️', '🏀', '🎾', '🧘',
  '🐶', '🐱', '🦊', '🐼', '🚀', '🎯', '🏆', '🎁', '🔒', '🔑', '🧩', '🗂️', '📌', '✅', '👀', '✨',
];

type Mode = 'auto' | 'symbol' | 'emoji' | 'image' | 'monogram';

interface Props {
  value: IconRef;
  onChange: (icon: IconRef) => void;
  /** Raccourcis : propose aussi favicon automatique, monogramme et image. */
  forShortcut?: boolean;
}

function modeOf(icon: IconRef): Mode {
  if (icon.kind === 'symbol') return 'symbol';
  if (icon.kind === 'emoji') return 'emoji';
  if (icon.kind === 'image' || icon.kind === 'url') return 'image';
  if (icon.kind === 'monogram') return 'monogram';
  return 'auto';
}

export function IconPicker({ value, onChange, forShortcut }: Props) {
  const [mode, setMode] = useState<Mode>(modeOf(value));
  const [emojiInput, setEmojiInput] = useState(value.kind === 'emoji' ? value.value : '');
  const [urlInput, setUrlInput] = useState(value.kind === 'url' ? value.src : '');

  const modes: { value: Mode; label: string }[] = forShortcut
    ? [
        { value: 'auto', label: 'Auto' },
        { value: 'monogram', label: 'Lettre' },
        { value: 'symbol', label: 'Symbole' },
        { value: 'emoji', label: 'Emoji' },
        { value: 'image', label: 'Image' },
      ]
    : [
        { value: 'symbol', label: 'Symbole' },
        { value: 'emoji', label: 'Emoji' },
      ];

  function pickMode(m: Mode) {
    setMode(m);
    if (m === 'auto') onChange({ kind: 'auto' });
    if (m === 'monogram') onChange({ kind: 'monogram', text: value.kind === 'monogram' ? value.text : undefined });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isAcceptedImage(file)) {
      toast('Format non pris en charge.', { tone: 'error' });
      return;
    }
    try {
      const small = await downscale(file, 128);
      const id = await putBlob(small, file.name);
      onChange({ kind: 'image', blobId: id });
    } catch {
      toast("Impossible d'importer cette image.", { tone: 'error' });
    }
  }

  return (
    <div class="icon-picker">
      <Segmented label="Type d'icône" value={mode} options={modes} onChange={pickMode} />

      {mode === 'auto' && <p class="muted small">Lumen utilise l'icône que Chrome connaît pour ce site, sinon une lettre colorée. Aucune requête réseau.</p>}

      {mode === 'monogram' && (
        <TextField
          value={value.kind === 'monogram' ? value.text ?? '' : ''}
          onValue={(v) => onChange({ kind: 'monogram', text: v.slice(0, 3) || undefined })}
          placeholder="1 à 3 caractères (vide = automatique)"
          maxLength={3}
          aria-label="Lettres du monogramme"
        />
      )}

      {mode === 'symbol' && (
        <div class="icon-grid" role="listbox" aria-label="Symboles">
          {SYMBOL_NAMES.map((n) => {
            const on = value.kind === 'symbol' && value.name === n;
            return (
              <button key={n} type="button" role="option" aria-selected={on} title={n} class={`icon-cell ${on ? 'is-on' : ''}`} onClick={() => onChange({ kind: 'symbol', name: n })}>
                <Symbol name={n} size={18} />
              </button>
            );
          })}
        </div>
      )}

      {mode === 'emoji' && (
        <>
          <div class="icon-grid" role="listbox" aria-label="Emoji">
            {EMOJI.map((e) => {
              const on = value.kind === 'emoji' && value.value === e;
              return (
                <button key={e} type="button" role="option" aria-selected={on} class={`icon-cell is-emoji ${on ? 'is-on' : ''}`} onClick={() => onChange({ kind: 'emoji', value: e })}>
                  {e}
                </button>
              );
            })}
          </div>
          <TextField
            value={emojiInput}
            onValue={(v) => {
              setEmojiInput(v);
              const first = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v.trim()))[0]?.segment;
              if (first) onChange({ kind: 'emoji', value: first });
            }}
            placeholder="…ou tapez n'importe quel emoji"
            aria-label="Emoji personnalisé"
          />
        </>
      )}

      {mode === 'image' && (
        <div class="stack">
          <label class="dropzone is-compact">
            <ImagePlus size={18} />
            <span>{value.kind === 'image' ? 'Remplacer l’image' : 'Choisir une image'}</span>
            <input type="file" accept="image/*" class="sr-only" onChange={(e) => onFile((e.currentTarget as HTMLInputElement).files?.[0])} />
          </label>
          <TextField
            value={urlInput}
            onValue={(v) => {
              setUrlInput(v);
              const u = normalizeUrl(v);
              if (u && /^https?:/.test(u)) onChange({ kind: 'url', src: u });
            }}
            placeholder="…ou l'adresse d'une image (https://…)"
            aria-label="Adresse d'une image"
          />
          <p class="muted small">Une image importée reste sur cet appareil. Une adresse est chargée depuis son site.</p>
        </div>
      )}
    </div>
  );
}
