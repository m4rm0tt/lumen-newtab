import { useMemo, useState } from 'preact/hooks';
import type { IconRef } from '../../types';
import { Modal } from '../../components/Modal';
import { Button, Row, Select, Swatches, TextField } from '../../components/controls';
import { IconPicker } from '../../components/IconPicker';
import { ShortcutIcon, usesColoredPlate } from '../../components/ShortcutIcon';
import { addShortcut, findShortcut, groups, moveShortcut, removeShortcut, updateShortcut } from '../../state/store';
import { guessTitle, normalizeUrl } from '../../lib/url';
import { closeEditor, toast, undoToast } from '../../app/ui';
import { ACCENTS } from '../../lib/color';

interface Props {
  groupId: string;
  shortcutId?: string;
  initialUrl?: string;
  index?: number;
}

export function ShortcutEditor({ groupId, shortcutId, initialUrl, index }: Props) {
  const existing = useMemo(() => (shortcutId ? findShortcut(shortcutId) : null), [shortcutId]);
  const sc = existing?.shortcut;
  const [url, setUrl] = useState(sc?.url ?? initialUrl ?? '');
  const [title, setTitle] = useState(sc?.title ?? (initialUrl ? guessTitle(normalizeUrl(initialUrl) ?? initialUrl) : ''));
  const [titleTouched, setTitleTouched] = useState(!!sc);
  const [icon, setIcon] = useState<IconRef>(sc?.icon ?? { kind: 'auto' });
  const [color, setColor] = useState<string | undefined>(sc?.color);
  const [target, setTarget] = useState(existing?.group.id ?? groupId);
  const [showMore, setShowMore] = useState(!!sc && (sc.icon.kind !== 'auto' || !!sc.color));

  const normalized = normalizeUrl(url);
  const valid = !!normalized;
  const previewTitle = title.trim() || (normalized ? guessTitle(normalized) : 'Nouveau');

  function onUrl(v: string) {
    setUrl(v);
    if (!titleTouched) {
      const n = normalizeUrl(v);
      setTitle(n ? guessTitle(n) : '');
    }
  }

  function save(e?: Event) {
    e?.preventDefault();
    if (!normalized) return;
    const data = { url: normalized, title: previewTitle, icon, color };
    if (sc) {
      updateShortcut(sc.id, data);
      if (target !== existing!.group.id) moveShortcut(sc.id, target);
    } else {
      addShortcut(target, data, index);
      const g = groups.value.find((x) => x.id === target);
      if (g && target !== groupId) toast(`Ajouté à « ${g.name} »`);
    }
    closeEditor();
  }

  function remove() {
    if (!sc) return;
    const undo = removeShortcut(sc.id);
    closeEditor();
    undoToast(`« ${sc.title} » supprimé`, undo);
  }

  const colored = usesColoredPlate(icon) || (icon.kind === 'auto' && !!color);

  return (
    <Modal
      title={sc ? 'Modifier le raccourci' : 'Nouveau raccourci'}
      onClose={closeEditor}
      footer={
        <>
          {sc && (
            <Button variant="danger" onClick={remove} class="push-left">
              Supprimer
            </Button>
          )}
          <Button variant="ghost" onClick={closeEditor}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {sc ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </>
      }
    >
      <form class="editor" onSubmit={save}>
        <div class="editor-preview">
          <span class={`plate ${colored ? 'is-colored' : ''}`} style={color ? ({ '--plate': color } as Record<string, string>) : undefined}>
            <ShortcutIcon icon={icon} title={previewTitle} url={normalized ?? 'https://example.com'} color={color} size={64} />
          </span>
          <span class="editor-preview-label">{previewTitle}</span>
        </div>
        <label class="field-label">
          Adresse
          <TextField
            value={url}
            onValue={onUrl}
            placeholder="exemple.com"
            autoFocus
            inputMode="url"
            spellcheck={false}
            aria-invalid={url.length > 0 && !valid}
          />
        </label>
        {url.length > 3 && !valid && <p class="field-error">Cette adresse ne semble pas valide.</p>}
        <label class="field-label">
          Nom
          <TextField
            value={title}
            onValue={(v) => {
              setTitle(v);
              setTitleTouched(true);
            }}
            placeholder={normalized ? guessTitle(normalized) : 'Nom affiché'}
            maxLength={60}
          />
        </label>
        {groups.value.length > 1 && (
          <Row label="Groupe">
            <Select label="Groupe" value={target} options={groups.value.map((g) => ({ value: g.id, label: g.name }))} onChange={setTarget} />
          </Row>
        )}
        {!showMore ? (
          <button type="button" class="link-btn" onClick={() => setShowMore(true)}>
            Personnaliser l'icône et la couleur…
          </button>
        ) : (
          <>
            <div class="field-label">
              Icône
              <IconPicker value={icon} onChange={setIcon} forShortcut />
            </div>
            <div class="field-label">
              Couleur de la tuile
              <Swatches label="Couleur de la tuile" value={color} colors={ACCENTS} onChange={setColor} allowNone />
            </div>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
