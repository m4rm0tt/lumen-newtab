import { Plus, Trash } from 'lucide-preact';
import { addWidget, resetSettings, settings, updateSettings, widgets } from '../../state/store';
import { Button, Group, Row, Segmented, Select, Slider, Swatches, Switch, TextField } from '../../components/controls';
import { ACCENTS } from '../../lib/color';
import { LOCALES } from '../../lib/locale';
import { ENGINES, chromeSearchAvailable, isValidTemplate } from '../search/engines';
import { importersAvailable } from '../shortcuts/importers';
import { BookmarkImporter } from '../shortcuts/BookmarkImporter';
import { getWidgetDef } from '../../widgets/registry';
import { deleteWidget } from '../../widgets/WidgetArea';
import { Symbol } from '../../components/Icon';
import { openEditor, SIZE_LABELS } from '../../app/ui';
import { isExtension } from '../../storage/backend';

const pct = (v: number) => `${Math.round(v * 100)} %`;

export function GeneralSection() {
  const s = settings.value;
  return (
    <>
      <Group title="Langue et format">
        <Row label="Langue des dates" hint="Format de l'heure, des jours et des mois">
          <Select label="Langue des dates" value={s.locale} options={LOCALES} onChange={(v) => updateSettings('locale', v)} />
        </Row>
      </Group>
      <Group title="Interface">
        <Row label="Thème des menus et réglages">
          <Segmented
            label="Thème"
            value={s.theme}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
            ]}
            onChange={(v) => updateSettings('theme', v)}
          />
        </Row>
        <Row label="Réduire les animations" hint="Suit le réglage du système par défaut">
          <Switch label="Réduire les animations" checked={s.reduceMotion === 'on'} onChange={(v) => updateSettings('reduceMotion', v ? 'on' : 'system')} />
        </Row>
      </Group>
      <Group>
        <Row label="Revoir la présentation">
          <Button small onClick={() => openEditor({ kind: 'onboarding' })}>
            Ouvrir
          </Button>
        </Row>
        <Row label="Réglages par défaut" hint="Garde vos raccourcis, widgets et arrière-plan">
          <Button small variant="danger" onClick={() => confirm('Rétablir l’apparence et les réglages par défaut ?') && resetSettings()}>
            Rétablir
          </Button>
        </Row>
      </Group>
    </>
  );
}

export function AppearanceSection() {
  const s = settings.value;
  return (
    <>
      <Group title="Couleurs">
        <Row label="Accent" stacked>
          <Swatches label="Couleur d'accent" value={s.accent} colors={ACCENTS} onChange={(v) => updateSettings('accent', v ?? '#0A84FF')} />
        </Row>
        <Row label="Texte du tableau de bord" hint="« Auto » s'adapte à la luminosité du fond">
          <Segmented
            label="Couleur du texte"
            value={s.tone}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Foncé' },
            ]}
            onChange={(v) => updateSettings('tone', v)}
          />
        </Row>
        <Row label="Police">
          <Select
            label="Police"
            value={s.font}
            options={[
              { value: 'system', label: 'Système' },
              { value: 'rounded', label: 'Arrondie' },
              { value: 'serif', label: 'Serif' },
              { value: 'mono', label: 'Monospace' },
            ]}
            onChange={(v) => updateSettings('font', v)}
          />
        </Row>
      </Group>
      <Group title="Cartes et surfaces">
        <Row label="Style">
          <Segmented
            label="Style des cartes"
            value={s.cards.style}
            options={[
              { value: 'glass', label: 'Verre' },
              { value: 'solid', label: 'Opaque' },
              { value: 'clear', label: 'Invisible' },
            ]}
            onChange={(v) => updateSettings('cards', { style: v })}
          />
        </Row>
        {s.cards.style !== 'clear' && (
          <Row label="Opacité">
            <Slider label="Opacité des cartes" value={s.cards.opacity} min={0} max={1} step={0.05} format={pct} onChange={(v) => updateSettings('cards', { opacity: v })} />
          </Row>
        )}
        {s.cards.style === 'glass' && (
          <Row label="Flou">
            <Slider label="Flou des cartes" value={s.cards.blur} min={0} max={40} format={(v) => `${v} px`} onChange={(v) => updateSettings('cards', { blur: v })} />
          </Row>
        )}
        <Row label="Arrondi des coins">
          <Slider label="Arrondi" value={s.cards.radius} min={0} max={32} format={(v) => `${v} px`} onChange={(v) => updateSettings('cards', { radius: v })} />
        </Row>
      </Group>
      <Group title="Disposition">
        <Row label="Bloc principal">
          <Segmented
            label="Position du bloc principal"
            value={s.layout.hero}
            options={[
              { value: 'center', label: 'Centré' },
              { value: 'top', label: 'En haut' },
            ]}
            onChange={(v) => updateSettings('layout', { hero: v })}
          />
        </Row>
        <Row label="Largeur du contenu">
          <Segmented
            label="Largeur"
            value={s.layout.width}
            options={[
              { value: 'compact', label: 'Étroite' },
              { value: 'normal', label: 'Normale' },
              { value: 'wide', label: 'Large' },
            ]}
            onChange={(v) => updateSettings('layout', { width: v })}
          />
        </Row>
        <Row label="Espacement">
          <Slider label="Espacement" value={s.layout.spacing} min={0.6} max={1.6} step={0.1} format={pct} onChange={(v) => updateSettings('layout', { spacing: Math.round(v * 10) / 10 })} />
        </Row>
      </Group>
      <p class="set-reset">
        <button type="button" class="link-btn" onClick={() => (resetSettings('cards'), resetSettings('layout'))}>
          Rétablir les cartes et la disposition
        </button>
      </p>
    </>
  );
}

export function ClockSection() {
  const c = settings.value.clock;
  return (
    <>
      <Group title="Heure">
        <Row label="Afficher l'heure">
          <Switch label="Afficher l'heure" checked={c.enabled} onChange={(v) => updateSettings('clock', { enabled: v })} />
        </Row>
        {c.enabled && (
          <>
            <Row label="Format">
              <Segmented
                label="Format de l'heure"
                value={c.format}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: '24', label: '24 h' },
                  { value: '12', label: '12 h' },
                ]}
                onChange={(v) => updateSettings('clock', { format: v })}
              />
            </Row>
            <Row label="Secondes">
              <Switch label="Afficher les secondes" checked={c.seconds} onChange={(v) => updateSettings('clock', { seconds: v })} />
            </Row>
            <Row label="Taille">
              <Slider label="Taille de l'horloge" value={c.scale} min={0.5} max={2} step={0.05} format={pct} onChange={(v) => updateSettings('clock', { scale: v })} />
            </Row>
            <Row label="Graisse">
              <Segmented
                label="Graisse"
                value={c.weight}
                options={[
                  { value: 200, label: 'Fine' },
                  { value: 300, label: 'Légère' },
                  { value: 400, label: 'Normale' },
                  { value: 600, label: 'Grasse' },
                ]}
                onChange={(v) => updateSettings('clock', { weight: v })}
              />
            </Row>
          </>
        )}
      </Group>
      <Group title="Date et salutation">
        <Row label="Afficher la date">
          <Switch label="Afficher la date" checked={c.showDate} onChange={(v) => updateSettings('clock', { showDate: v })} />
        </Row>
        {c.showDate && (
          <Row label="Style de date">
            <Segmented
              label="Style de date"
              value={c.dateStyle}
              options={[
                { value: 'full', label: 'Complet' },
                { value: 'long', label: 'Avec année' },
                { value: 'short', label: 'Court' },
              ]}
              onChange={(v) => updateSettings('clock', { dateStyle: v })}
            />
          </Row>
        )}
        <Row label="Salutation" hint="« Bonjour », « Bonsoir »…">
          <Switch label="Afficher une salutation" checked={c.greeting} onChange={(v) => updateSettings('clock', { greeting: v })} />
        </Row>
        {c.greeting && (
          <Row label="Votre prénom">
            <TextField value={c.name} onValue={(v) => updateSettings('clock', { name: v.slice(0, 30) })} placeholder="Facultatif" maxLength={30} />
          </Row>
        )}
      </Group>
    </>
  );
}

export function SearchSection() {
  const s = settings.value.search;
  const engines = [
    ...(chromeSearchAvailable || !isExtension ? [{ value: 'chrome', label: 'Moteur de Chrome (recommandé)' }] : []),
    ...ENGINES.map((e) => ({ value: e.id, label: e.name })),
    { value: 'custom', label: 'Personnalisé…' },
  ];
  return (
    <>
      <Group title="Barre de recherche">
        <Row label="Afficher la recherche">
          <Switch label="Afficher la recherche" checked={s.enabled} onChange={(v) => updateSettings('search', { enabled: v })} />
        </Row>
        <Row label="Moteur">
          <Select label="Moteur de recherche" value={s.engine} options={engines} onChange={(v) => updateSettings('search', { engine: v })} />
        </Row>
        {s.engine === 'custom' && (
          <Row label="Adresse du moteur" hint="Utilisez %s à la place des mots recherchés" stacked>
            <TextField value={s.customUrl} onValue={(v) => updateSettings('search', { customUrl: v })} placeholder="https://exemple.com/search?q=%s" spellcheck={false} aria-invalid={!!s.customUrl && !isValidTemplate(s.customUrl)} />
          </Row>
        )}
        <Row label="Suggérer mes raccourcis" hint="Recherche locale, rien n'est envoyé">
          <Switch label="Suggérer mes raccourcis" checked={s.suggestShortcuts} onChange={(v) => updateSettings('search', { suggestShortcuts: v })} />
        </Row>
        <Row label="Ouvrir dans un nouvel onglet">
          <Switch label="Ouvrir les résultats dans un nouvel onglet" checked={s.newTab} onChange={(v) => updateSettings('search', { newTab: v })} />
        </Row>
      </Group>
      <Group
        title="Focus clavier"
        footer="Chrome place le curseur dans la barre d'adresse à l'ouverture d'un onglet : vous pouvez taper directement votre recherche. Cette option déplace le curseur dans la recherche de Lumen, mais la barre d'adresse affiche alors l'adresse de l'extension."
      >
        <Row label="Placer le curseur dans Lumen">
          <Switch label="Placer le curseur dans la recherche de Lumen" checked={s.grabFocus} onChange={(v) => updateSettings('search', { grabFocus: v })} />
        </Row>
      </Group>
    </>
  );
}

export function ShortcutsSection() {
  const s = settings.value.shortcuts;
  return (
    <>
      <Group title="Présentation">
        <Row label="Groupes">
          <Segmented
            label="Présentation des groupes"
            value={s.display}
            options={[
              { value: 'tabs', label: 'Onglets' },
              { value: 'sections', label: 'Tous visibles' },
            ]}
            onChange={(v) => updateSettings('shortcuts', { display: v })}
          />
        </Row>
        <Row label="Style des icônes">
          <Segmented
            label="Style des icônes"
            value={s.style}
            options={[
              { value: 'tile', label: 'Tuiles' },
              { value: 'plain', label: 'Épuré' },
            ]}
            onChange={(v) => updateSettings('shortcuts', { style: v })}
          />
        </Row>
        <Row label="Taille">
          <Slider label="Taille des raccourcis" value={s.size} min={40} max={88} step={2} format={(v) => `${v} px`} onChange={(v) => updateSettings('shortcuts', { size: v })} />
        </Row>
        <Row label="Colonnes" hint="0 = automatique">
          <Slider label="Nombre de colonnes" value={s.columns} min={0} max={12} format={(v) => (v === 0 ? 'Auto' : String(v))} onChange={(v) => updateSettings('shortcuts', { columns: v })} />
        </Row>
        <Row label="Afficher les noms">
          <Switch label="Afficher les noms" checked={s.labels} onChange={(v) => updateSettings('shortcuts', { labels: v })} />
        </Row>
        <Row label="Ouvrir dans un nouvel onglet">
          <Switch label="Ouvrir les raccourcis dans un nouvel onglet" checked={s.newTab} onChange={(v) => updateSettings('shortcuts', { newTab: v })} />
        </Row>
      </Group>
      {importersAvailable && (
        <Group title="Vos favoris Chrome" footer="Chrome vous demandera l'autorisation au premier import. Vos favoris ne sont lus qu'au moment de ce clic, puis copiés dans Lumen.">
          <div class="pad">
            <BookmarkImporter />
          </div>
        </Group>
      )}
      <Group title="Astuces">
        <ul class="tips">
          <li>Glissez une icône pour la déplacer, ou sur un onglet de groupe pour l'y ranger.</li>
          <li>Clic droit sur une icône ou un groupe pour plus d'options.</li>
          <li>Glissez un lien depuis une autre fenêtre pour créer un raccourci.</li>
          <li>Au clavier : flèches pour naviguer, Alt + flèches pour déplacer, E pour modifier, Suppr pour supprimer.</li>
        </ul>
      </Group>
    </>
  );
}

export function WidgetsSection() {
  const s = settings.value.layout;
  const list = widgets.value;
  return (
    <>
      <Group title="Emplacement">
        <Row label="Position des widgets" hint="Sur les petites fenêtres, ils passent sous les raccourcis">
          <Segmented
            label="Position des widgets"
            value={s.widgets}
            options={[
              { value: 'bottom', label: 'En bas' },
              { value: 'left', label: 'À gauche' },
              { value: 'right', label: 'À droite' },
            ]}
            onChange={(v) => updateSettings('layout', { widgets: v })}
          />
        </Row>
      </Group>
      <Group title={`Widgets actifs (${list.length})`}>
        {list.length === 0 && <p class="muted small pad">Aucun widget. Le tableau de bord reste minimal.</p>}
        <ul class="widget-list">
          {list.map((w) => {
            const def = getWidgetDef(w.type);
            return (
              <li key={w.id}>
                <span class="lib-icon is-small">
                  <Symbol name={def?.icon ?? 'puzzle'} size={15} />
                </span>
                <span class="grow">
                  {def?.title?.(w.config as never) ?? def?.name ?? w.type}
                  <small class="muted"> · {SIZE_LABELS[w.size]}</small>
                </span>
                <button type="button" class="link-btn" onClick={() => openEditor({ kind: 'widget-settings', widgetId: w.id })}>
                  Réglages
                </button>
                <button type="button" class="icon-btn" aria-label="Retirer" onClick={() => deleteWidget(w)}>
                  <Trash size={14} />
                </button>
              </li>
            );
          })}
        </ul>
        <div class="pad">
          <Button variant="primary" small onClick={() => openEditor({ kind: 'widget-library' })}>
            <Plus size={14} /> Ajouter un widget
          </Button>
        </div>
      </Group>
      {list.length === 0 && (
        <p class="muted small">
          Conseil : commencez par{' '}
          <button type="button" class="link-btn" onClick={() => addWidget('weather', 's', { place: null, unit: 'c' })}>
            la météo
          </button>{' '}
          ou{' '}
          <button type="button" class="link-btn" onClick={() => addWidget('notes', 't', { title: 'Notes' })}>
            un bloc-notes
          </button>
          .
        </p>
      )}
    </>
  );
}

export function AboutSection() {
  const version = isExtension ? chrome.runtime.getManifest().version : 'dev';
  return (
    <>
      <div class="about-hero">
        <img src="/icons/icon-128.png" alt="" width={64} height={64} />
        <h3>Lumen</h3>
        <p class="muted">Version {version}</p>
      </div>
      <Group title="Vie privée">
        <ul class="tips">
          <li>Aucun compte, aucun serveur Lumen, aucune statistique d'usage.</li>
          <li>Vos raccourcis et réglages restent dans Chrome (et Chrome Sync si activé).</li>
          <li>Les images importées ne quittent jamais cet appareil.</li>
          <li>Les widgets réseau ne contactent que le service affiché dans la bibliothèque, et seulement s'ils sont ajoutés.</li>
        </ul>
      </Group>
      <Group title="Raccourcis clavier">
        <ul class="kbd-list">
          <li><kbd>/</kbd> ou commencer à taper <span>Rechercher</span></li>
          <li><kbd>Alt</kbd> + <kbd>1</kbd>…<kbd>9</kbd> <span>Changer de groupe</span></li>
          <li><kbd>Alt</kbd> + <kbd>←</kbd> <kbd>→</kbd> <span>Déplacer l'élément sélectionné</span></li>
          <li><kbd>E</kbd> <span>Modifier le raccourci sélectionné</span></li>
          <li><kbd>Échap</kbd> <span>Fermer / annuler</span></li>
        </ul>
      </Group>
    </>
  );
}
