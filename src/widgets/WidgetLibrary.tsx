import { Globe } from 'lucide-preact';
import { Modal } from '../components/Modal';
import { Symbol } from '../components/Icon';
import { addWidget, widgets } from '../state/store';
import { CATEGORY_LABELS, WIDGETS } from './registry';
import { closeEditor, openEditor, toast } from '../app/ui';

export function WidgetLibrary() {
  const counts = new Map<string, number>();
  for (const w of widgets.value) counts.set(w.type, (counts.get(w.type) ?? 0) + 1);
  const categories = Object.keys(CATEGORY_LABELS).filter((c) => WIDGETS.some((w) => w.category === c));

  return (
    <Modal title="Ajouter un widget" onClose={closeEditor} width={640} class="library">
      {categories.map((cat) => (
        <section key={cat} class="lib-section">
          <h3 class="set-group-title">{CATEGORY_LABELS[cat]}</h3>
          <div class="lib-grid">
            {WIDGETS.filter((w) => w.category === cat).map((def) => {
              const n = counts.get(def.type) ?? 0;
              return (
                <button
                  key={def.type}
                  type="button"
                  class="lib-item"
                  onClick={() => {
                    const w = addWidget(def.type, def.defaultSize, structuredClone(def.defaultConfig));
                    closeEditor();
                    toast(`« ${def.name} » ajouté`);
                    const needsSetup = ['github', 'spotify', 'stocks', 'custom', 'rss'].includes(def.type);
                    if (needsSetup) setTimeout(() => openEditor({ kind: 'widget-settings', widgetId: w.id }), 60);
                    requestAnimationFrame(() => document.querySelector(`[data-dnd-item="${w.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
                  }}
                >
                  <span class="lib-icon">
                    <Symbol name={def.icon} size={20} />
                  </span>
                  <span class="lib-text">
                    <strong>
                      {def.name}
                      {n > 0 && <em class="lib-count">{n} actif{n > 1 ? 's' : ''}</em>}
                    </strong>
                    <small>{def.description}</small>
                    {(def.network || def.requirement) && (
                      <small class="lib-meta">
                        {def.network && (
                          <span>
                            <Globe size={11} /> Réseau
                          </span>
                        )}
                        {def.requirement && <span>{def.requirement}</span>}
                      </small>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </Modal>
  );
}
