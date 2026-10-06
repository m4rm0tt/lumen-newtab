import { useEffect, useState } from 'preact/hooks';
import { ImagePlus, TriangleAlert, X } from 'lucide-preact';
import { settings, updateSettings } from '../../state/store';
import { Group, Row, Segmented, Select, Slider, Swatches, TextField } from '../../components/controls';
import { GRADIENT_SUGGESTIONS, PRESETS } from '../background/presets';
import { applyImage, getRecents, removeRecent, setBackgroundFromFile, type RecentImage } from '../background/actions';
import { imageMissing } from '../../app/theme';
import { normalizeUrl } from '../../lib/url';
import type { Anchor, BackgroundType } from '../../types';

const pct = (v: number) => `${Math.round(v * 100)} %`;

const POSITIONS: { value: Anchor; label: string }[] = [
  { value: 'center', label: 'Centre' },
  { value: 'top', label: 'Haut' },
  { value: 'bottom', label: 'Bas' },
  { value: 'left', label: 'Gauche' },
  { value: 'right', label: 'Droite' },
  { value: 'top left', label: 'Haut gauche' },
  { value: 'top right', label: 'Haut droite' },
  { value: 'bottom left', label: 'Bas gauche' },
  { value: 'bottom right', label: 'Bas droite' },
];

const BASE_COLORS = [
  { name: 'Nuit', value: '#1C1C1E' },
  { name: 'Ardoise', value: '#334155' },
  { name: 'Marine', value: '#1E3A5F' },
  { name: 'Prune', value: '#3B1F4A' },
  { name: 'Forêt', value: '#1F3A2C' },
  { name: 'Sable', value: '#E9E2D6' },
  { name: 'Nuage', value: '#EEF1F5' },
];

export function BackgroundSection() {
  const bg = settings.value.background;
  const [recents, setRecents] = useState<RecentImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState(bg.url);

  const refresh = () => getRecents().then(setRecents);
  useEffect(() => void refresh(), [bg.imageId]);

  async function onFiles(files: FileList | null | undefined) {
    const f = files?.[0];
    if (f && (await setBackgroundFromFile(f))) void refresh();
  }

  const set = (patch: Partial<typeof bg>) => updateSettings('background', patch);

  return (
    <>
      <label
        class={`dropzone ${dragOver ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          void onFiles(e.dataTransfer?.files);
        }}
      >
        <ImagePlus size={22} strokeWidth={1.6} />
        <strong>Glissez une image ou un GIF ici</strong>
        <span class="muted small">ou cliquez pour choisir un fichier · reste sur cet appareil</span>
        <input type="file" accept="image/*" class="sr-only" onChange={(e) => void onFiles((e.currentTarget as HTMLInputElement).files)} />
      </label>

      {bg.type === 'image' && imageMissing.value && (
        <p class="notice">
          <TriangleAlert size={14} /> L'image choisie a été importée sur un autre appareil. Un fond intégré la remplace ici.
        </p>
      )}

      {recents.length > 0 && (
        <Group title="Vos images">
          <div class="thumbs">
            {recents.map((r) => (
              <div key={r.id} class={`thumb ${bg.type === 'image' && bg.imageId === r.id ? 'is-on' : ''}`}>
                <button type="button" class="thumb-btn" title={r.name} aria-label={`Utiliser ${r.name}`} onClick={() => applyImage(r)} style={{ backgroundImage: `url("${r.thumb}")` }}>
                  {r.type === 'image/gif' && <span class="thumb-badge">GIF</span>}
                </button>
                <button
                  type="button"
                  class="thumb-del"
                  aria-label={`Oublier ${r.name}`}
                  onClick={async () => {
                    await removeRecent(r.id);
                    void refresh();
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </Group>
      )}

      <Group title="Fonds intégrés">
        <div class="thumbs">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              class={`thumb thumb-btn ${p.tone === 'light' ? 'is-light' : ''} ${bg.type === 'preset' && bg.preset === p.id ? 'is-on' : ''}`}
              style={{ background: p.css }}
              title={p.name}
              aria-label={p.name}
              aria-pressed={bg.type === 'preset' && bg.preset === p.id}
              onClick={() => set({ type: 'preset', preset: p.id })}
            >
              <span class="thumb-name">{p.name}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Autre type de fond">
        <Row label="Type">
          <Segmented<BackgroundType>
            label="Type de fond"
            value={bg.type === 'preset' || bg.type === 'image' ? ('none' as BackgroundType) : bg.type}
            options={[
              { value: 'color', label: 'Couleur' },
              { value: 'gradient', label: 'Dégradé' },
              { value: 'url', label: 'Adresse' },
            ]}
            onChange={(v) => set({ type: v })}
          />
        </Row>
        {bg.type === 'color' && (
          <Row label="Couleur" stacked>
            <Swatches label="Couleur de fond" value={bg.color} colors={BASE_COLORS} onChange={(v) => set({ color: v ?? '#1C1C1E' })} />
          </Row>
        )}
        {bg.type === 'gradient' && (
          <>
            <div class="thumbs is-small pad">
              {GRADIENT_SUGGESTIONS.map((g, i) => (
                <button
                  key={i}
                  type="button"
                  class="thumb thumb-btn"
                  aria-label={`Dégradé ${i + 1}`}
                  style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
                  onClick={() => set({ gradient: g })}
                />
              ))}
            </div>
            <Row label="Couleurs">
              <span class="color-pair">
                <input type="color" aria-label="Première couleur" value={bg.gradient.from} onInput={(e) => set({ gradient: { ...bg.gradient, from: (e.currentTarget as HTMLInputElement).value } })} />
                <input type="color" aria-label="Seconde couleur" value={bg.gradient.to} onInput={(e) => set({ gradient: { ...bg.gradient, to: (e.currentTarget as HTMLInputElement).value } })} />
              </span>
            </Row>
            <Row label="Angle">
              <Slider label="Angle du dégradé" value={bg.gradient.angle} min={0} max={360} step={5} format={(v) => `${v}°`} onChange={(v) => set({ gradient: { ...bg.gradient, angle: v } })} />
            </Row>
          </>
        )}
        {bg.type === 'url' && (
          <Row label="Adresse de l'image" hint="Chargée depuis son site à chaque ouverture" stacked>
            <TextField
              value={urlInput}
              onValue={(v) => {
                setUrlInput(v);
                const u = normalizeUrl(v);
                if (u && /^https?:/.test(u)) set({ url: u });
              }}
              placeholder="https://…/image.jpg"
              spellcheck={false}
            />
          </Row>
        )}
      </Group>

      <Group title="Ajustements">
        {(bg.type === 'image' || bg.type === 'url') && (
          <>
            <Row label="Remplissage">
              <Segmented
                label="Remplissage"
                value={bg.fit}
                options={[
                  { value: 'cover', label: 'Remplir' },
                  { value: 'contain', label: 'Adapter' },
                ]}
                onChange={(v) => set({ fit: v })}
              />
            </Row>
            <Row label="Point focal">
              <Select label="Point focal" value={bg.position} options={POSITIONS} onChange={(v) => set({ position: v })} />
            </Row>
          </>
        )}
        <Row label="Luminosité">
          <Slider label="Luminosité" value={bg.brightness} min={0.3} max={1.3} step={0.05} format={pct} onChange={(v) => set({ brightness: v })} />
        </Row>
        <Row label="Flou">
          <Slider label="Flou du fond" value={bg.blur} min={0} max={40} format={(v) => `${v} px`} onChange={(v) => set({ blur: v })} />
        </Row>
        <Row label="Voile">
          <Segmented
            label="Couleur du voile"
            value={bg.overlay}
            options={[
              { value: 'dark', label: 'Sombre' },
              { value: 'light', label: 'Clair' },
            ]}
            onChange={(v) => set({ overlay: v })}
          />
        </Row>
        <Row label="Intensité du voile" hint="Améliore la lisibilité du texte">
          <Slider label="Intensité du voile" value={bg.overlayOpacity} min={0} max={0.8} step={0.02} format={pct} onChange={(v) => set({ overlayOpacity: v })} />
        </Row>
      </Group>
    </>
  );
}
