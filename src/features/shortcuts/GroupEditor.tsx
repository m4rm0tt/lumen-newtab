import { useState } from 'preact/hooks';
import type { IconRef } from '../../types';
import { Modal } from '../../components/Modal';
import { Button, Swatches, TextField } from '../../components/controls';
import { IconPicker } from '../../components/IconPicker';
import { GroupGlyph } from '../../components/Icon';
import { addGroup, groups, updateGroup } from '../../state/store';
import { closeEditor } from '../../app/ui';
import { ACCENTS } from '../../lib/color';
import { deleteGroup } from './Shortcuts';

export function GroupEditor({ groupId }: { groupId?: string }) {
  const g = groupId ? groups.value.find((x) => x.id === groupId) : undefined;
  const [name, setName] = useState(g?.name ?? '');
  const [icon, setIcon] = useState<IconRef>(g?.icon ?? { kind: 'symbol', name: 'folder' });
  const [accent, setAccent] = useState<string | undefined>(g?.accent);

  function save(e?: Event) {
    e?.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (g) updateGroup(g.id, { name: n, icon, accent });
    else addGroup({ name: n, icon, accent });
    closeEditor();
  }

  return (
    <Modal
      title={g ? 'Modifier le groupe' : 'Nouveau groupe'}
      onClose={closeEditor}
      footer={
        <>
          {g && (
            <Button
              variant="danger"
              class="push-left"
              onClick={() => {
                closeEditor();
                deleteGroup(g);
              }}
            >
              Supprimer
            </Button>
          )}
          <Button variant="ghost" onClick={closeEditor}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            {g ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form class="editor" onSubmit={save}>
        <label class="field-label">
          Nom
          <div class="field-with-glyph" style={accent ? ({ '--group-accent': accent } as Record<string, string>) : undefined}>
            <span class="field-glyph">
              <GroupGlyph icon={icon} size={16} />
            </span>
            <TextField value={name} onValue={setName} placeholder="Travail, Musique, Dev…" maxLength={40} autoFocus />
          </div>
        </label>
        <div class="field-label">
          Icône
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div class="field-label">
          Couleur
          <Swatches label="Couleur du groupe" value={accent} colors={ACCENTS} onChange={setAccent} allowNone />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
