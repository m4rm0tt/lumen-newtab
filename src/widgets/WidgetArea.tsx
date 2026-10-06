// Grille en placement automatique : on choisit l'ordre et la taille, le navigateur place.
// Chaque widget a sa frontière d'erreur.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Ellipsis, GripHorizontal, Settings2, Trash } from 'lucide-preact';
import type { WidgetInstance, WidgetSize } from '../types';
import { moveWidget, removeWidget, settings, updateWidget, widgets } from '../state/store';
import { getWidgetDef, loadWidget, normalizeConfig } from './registry';
import type { WidgetDefinition, WidgetModule } from './types';
import { arrange, drag, pointerDownDrag, registerDropHandler } from '../lib/dnd';
import { useFlip } from '../lib/flip';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { openMenu, type MenuEntry } from '../components/Menu';
import { Modal } from '../components/Modal';
import { Button, Row, Segmented } from '../components/controls';
import { Skeleton, WidgetError, WidgetMessage } from './kit';
import { closeEditor, openEditor, SIZE_LABELS, undoToast } from '../app/ui';
import { removeLocal } from '../state/local';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function WidgetArea() {
  const ref = useRef<HTMLDivElement>(null);
  useFlip(ref);
  const list = widgets.value;
  const d = drag.value;
  const items = arrange(list, (w) => w.id, 'widgets', d);
  const position = settings.value.layout.widgets;

  useEffect(
    () =>
      registerDropHandler('widget', (item, res) => {
        if ('container' in res) moveWidget(item.id, res.index);
      }),
    [],
  );

  if (list.length === 0) return null;

  return (
    <div
      ref={ref}
      class={`widgets is-${position}`}
      data-dnd-container="widgets"
      data-dnd-accept="widget"
      data-dnd-axis="grid"
      aria-label="Widgets"
    >
      {items.map((w) => (w === 'slot' ? null : <WidgetFrame key={w.id} instance={w} dragging={d?.item.id === w.id} />))}
    </div>
  );
}

function useModule(def: WidgetDefinition<any> | undefined) {
  const [mod, setMod] = useState<WidgetModule<any> | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!def) return;
    let alive = true;
    setError(false);
    loadWidget(def).then(
      (m) => alive && setMod(m),
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [def, attempt]);
  return { mod, error, retry: () => setAttempt((a) => a + 1) };
}

export function deleteWidget(w: WidgetInstance) {
  const def = getWidgetDef(w.type);
  const undo = removeWidget(w.id);
  // Les données locales (notes, tâches) ne sont effacées qu'à l'expiration de l'annulation.
  const timer = setTimeout(() => {
    if (!widgets.value.some((x) => x.id === w.id)) void removeLocal(def?.dataKeys?.(w.id) ?? []);
  }, 8000);
  undoToast(`Widget « ${def?.name ?? w.type} » retiré`, () => {
    clearTimeout(timer);
    undo();
  });
}

function widgetMenu(w: WidgetInstance, def: WidgetDefinition<any> | undefined): MenuEntry[] {
  const entries: MenuEntry[] = [];
  if (def) {
    entries.push({ label: 'Réglages…', icon: <Settings2 size={14} />, onSelect: () => openEditor({ kind: 'widget-settings', widgetId: w.id }) });
    if (def.sizes.length > 1) {
      entries.push({ type: 'separator' }, { type: 'label', label: 'Taille' });
      for (const s of def.sizes) {
        entries.push({ label: SIZE_LABELS[s], checked: w.size === s, onSelect: () => updateWidget(w.id, { size: s }) });
      }
    }
    entries.push({ type: 'separator' });
  }
  entries.push({ label: 'Retirer le widget', icon: <Trash size={14} />, danger: true, onSelect: () => deleteWidget(w) });
  return entries;
}

function WidgetFrame({ instance: w, dragging }: { instance: WidgetInstance; dragging: boolean }) {
  const def = getWidgetDef(w.type);
  const { mod, error, retry } = useModule(def);
  const config = def ? normalizeConfig(def, w.config) : {};
  const title = def ? (def.title?.(config) ?? def.name) : 'Widget inconnu';
  const setConfig = (patch: Record<string, unknown>) => updateWidget(w.id, { config: patch });
  const Comp = mod?.default;

  return (
    <article
      class={`widget card size-${w.size} ${dragging ? 'is-dragging' : ''}`}
      data-dnd-item={w.id}
      data-flip={w.id}
      aria-label={title}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('input, textarea, a')) return;
        openMenu(e, widgetMenu(w, def));
      }}
    >
      <header class="widget-head" onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        pointerDownDrag(e, { kind: 'widget', id: w.id, container: 'widgets' }, (e.currentTarget as HTMLElement).closest('article')!);
      }}>
        <span class="widget-grip" aria-hidden="true">
          <GripHorizontal size={12} />
        </span>
        <h2 class="widget-title">{title}</h2>
        <button type="button" class="icon-btn widget-more" aria-label={`Options du widget ${title}`} onClick={(e) => openMenu(e, widgetMenu(w, def))}>
          <Ellipsis size={15} />
        </button>
      </header>
      <div class="widget-body">
        {!def ? (
          <WidgetMessage title="Widget indisponible">Ce type de widget n'existe pas dans cette version de Lumen.</WidgetMessage>
        ) : error ? (
          <WidgetError message="Le module n'a pas pu être chargé." onRetry={retry} />
        ) : !Comp ? (
          <Skeleton />
        ) : (
          <ErrorBoundary fallback={(err, reset) => <WidgetError message={err.message || 'Erreur inattendue.'} onRetry={reset} />}>
            <Comp instance={w} config={config} setConfig={setConfig} size={w.size} openSettings={() => openEditor({ kind: 'widget-settings', widgetId: w.id })} />
          </ErrorBoundary>
        )}
      </div>
    </article>
  );
}

/** Fenêtre de réglages d'un widget : options propres + taille + retrait. */
export function WidgetSettings({ widgetId }: { widgetId: string }) {
  const w = widgets.value.find((x) => x.id === widgetId);
  const def = w ? getWidgetDef(w.type) : undefined;
  const { mod } = useModule(def);
  if (!w || !def) return null;
  const config = normalizeConfig(def, w.config);
  const Settings = mod?.Settings;
  return (
    <Modal
      title={`Réglages : ${def.name}`}
      onClose={closeEditor}
      width={520}
      footer={
        <>
          <Button
            variant="danger"
            class="push-left"
            onClick={() => {
              closeEditor();
              deleteWidget(w);
            }}
          >
            Retirer
          </Button>
          <Button variant="primary" onClick={closeEditor}>
            Terminé
          </Button>
        </>
      }
    >
      <div class="editor">
        {def.sizes.length > 1 && (
          <Row label="Taille">
            <Segmented<WidgetSize> label="Taille" value={w.size} options={def.sizes.map((s) => ({ value: s, label: SIZE_LABELS[s] }))} onChange={(s) => updateWidget(w.id, { size: s })} />
          </Row>
        )}
        {Settings ? <Settings instance={w} config={config} setConfig={(patch: Record<string, unknown>) => updateWidget(w.id, { config: patch })} /> : !mod ? <Skeleton lines={2} /> : null}
        {def.network && (
          <p class="muted small">
            Ce widget contacte : {def.network.join(', ')}. Aucune autre donnée ne quitte votre navigateur.
          </p>
        )}
      </div>
    </Modal>
  );
}
