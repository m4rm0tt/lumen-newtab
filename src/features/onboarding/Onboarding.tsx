// Présentation du premier lancement : un fond, quelques sites, trois astuces. « Passer » la ferme.
import { useState } from 'preact/hooks';
import { Check, ImagePlus } from 'lucide-preact';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/controls';
import { PRESETS } from '../background/presets';
import { setBackgroundFromFile } from '../background/actions';
import { addShortcut, groups, settings, updateSettings } from '../../state/store';
import { closeEditor } from '../../app/ui';
import { guessTitle } from '../../lib/url';
import { importersAvailable } from '../shortcuts/importers';
import { BookmarkImporter } from '../shortcuts/BookmarkImporter';
import { ShortcutIcon } from '../../components/ShortcutIcon';

const SUGGESTIONS = [
  'https://www.youtube.com/', 'https://mail.google.com/', 'https://github.com/', 'https://www.reddit.com/',
  'https://www.linkedin.com/', 'https://x.com/', 'https://www.instagram.com/', 'https://www.netflix.com/',
  'https://open.spotify.com/', 'https://www.twitch.tv/', 'https://www.notion.so/', 'https://www.figma.com/',
  'https://www.amazon.fr/', 'https://www.leboncoin.fr/', 'https://web.whatsapp.com/', 'https://discord.com/app',
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const bg = settings.value.background;
  const existing = new Set(groups.value.flatMap((g) => g.shortcuts.map((s) => s.url)));
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function finish() {
    const target = groups.value[0];
    if (target) for (const url of picked) if (!existing.has(url)) addShortcut(target.id, { url, title: guessTitle(url), icon: { kind: 'auto' } });
    updateSettings('onboarded', true);
    closeEditor();
  }

  const steps = ['Choisissez une ambiance', 'Vos sites favoris', 'Faites-en votre espace'];

  return (
    <Modal title={steps[step]} onClose={finish} width={560} class="onboarding">
      <div class="ob">
        <p class="ob-step" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} class={i === step ? 'is-on' : i < step ? 'is-done' : ''} />
          ))}
        </p>
        {step === 0 && (
          <>
            <p class="muted">Un fond intégré, ou n'importe quelle image ou GIF de votre ordinateur.</p>
            <div class="thumbs is-large">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  class={`thumb thumb-btn ${p.tone === 'light' ? 'is-light' : ''} ${bg.type === 'preset' && bg.preset === p.id ? 'is-on' : ''}`}
                  style={{ background: p.css }}
                  aria-label={p.name}
                  aria-pressed={bg.type === 'preset' && bg.preset === p.id}
                  onClick={() => updateSettings('background', { type: 'preset', preset: p.id })}
                >
                  <span class="thumb-name">{p.name}</span>
                </button>
              ))}
              <label class={`thumb thumb-btn is-upload ${bg.type === 'image' ? 'is-on' : ''}`}>
                <ImagePlus size={20} />
                <span class="thumb-name">Mon image</span>
                <input type="file" accept="image/*" class="sr-only" onChange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) void setBackgroundFromFile(f);
                }} />
              </label>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p class="muted">Cochez ce que vous ouvrez souvent. Vous pourrez tout réorganiser ensuite par glisser-déposer.</p>
            <div class="ob-sites">
              {SUGGESTIONS.map((url) => {
                const on = picked.has(url) || existing.has(url);
                return (
                  <button
                    key={url}
                    type="button"
                    class={`ob-site ${on ? 'is-on' : ''}`}
                    aria-pressed={on}
                    disabled={existing.has(url)}
                    onClick={() => {
                      const n = new Set(picked);
                      if (n.has(url)) n.delete(url);
                      else n.add(url);
                      setPicked(n);
                    }}
                  >
                    <span class="plate">
                      <ShortcutIcon icon={{ kind: 'auto' }} title={guessTitle(url)} url={url} size={36} />
                    </span>
                    <span>{guessTitle(url)}</span>
                    {on && <Check size={13} class="ob-check" />}
                  </button>
                );
              })}
            </div>
            {importersAvailable && (
              <div class="ob-bookmarks">
                <p>
                  <strong>Vous avez déjà des favoris dans Chrome ?</strong> Importez-les : chaque dossier devient un groupe.
                </p>
                <BookmarkImporter />
              </div>
            )}
          </>
        )}
        {step === 2 && (
          <ul class="ob-tips">
            <li>
              <strong>Glissez-déposez</strong> les icônes pour les ranger, ou sur un groupe pour les déplacer.
            </li>
            <li>
              <strong>Clic droit</strong> sur une icône, un groupe ou un widget pour le modifier.
            </li>
            <li>
              <strong>Réglages</strong> (en bas à droite) : fond, couleurs, horloge, widgets, synchronisation.
            </li>
            <li>
              <strong>Déposez une image</strong> n'importe où sur la page pour en faire votre fond.
            </li>
          </ul>
        )}
        <div class="ob-actions">
          <Button variant="ghost" onClick={finish}>
            {step < 2 ? 'Passer' : ''}
          </Button>
          {step < 2 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              Continuer
            </Button>
          ) : (
            <Button variant="primary" onClick={finish}>
              C'est parti
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
