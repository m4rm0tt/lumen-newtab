import { useState } from 'preact/hooks';
import { Bookmark, Check } from 'lucide-preact';
import { Button } from '../../components/controls';
import { importBookmarkFolders, importersAvailable, listBookmarkFolders, type BookmarkFolder } from './importers';
import { toast } from '../../app/ui';

export function BookmarkImporter({ onDone }: { onDone?: () => void }) {
  const [folders, setFolders] = useState<BookmarkFolder[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  if (!importersAvailable) return null;

  async function open() {
    setBusy(true);
    const list = await listBookmarkFolders();
    setBusy(false);
    if (list === null) {
      toast('Accès aux favoris refusé : rien n’a été importé.');
      return;
    }
    setFolders(list);
    // Présélectionne la barre de favoris, le dossier le plus utilisé en général.
    setPicked(new Set(list.slice(0, 1).map((f) => f.id)));
  }

  async function run() {
    if (!folders) return;
    setBusy(true);
    try {
      const s = await importBookmarkFolders(folders.filter((f) => picked.has(f.id)));
      if (s.shortcuts === 0) toast('Ces favoris sont déjà dans vos raccourcis.');
      else toast(`${s.shortcuts} favori${s.shortcuts > 1 ? 's' : ''} importé${s.shortcuts > 1 ? 's' : ''} dans ${s.groups} groupe${s.groups > 1 ? 's' : ''}`);
      setFolders(null);
      onDone?.();
    } catch {
      toast('L’import des favoris a échoué.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setPicked(n);
  }

  if (!folders) {
    return (
      <Button small onClick={open} disabled={busy}>
        <Bookmark size={14} /> Importer mes favoris…
      </Button>
    );
  }

  const total = folders.filter((f) => picked.has(f.id)).reduce((n, f) => n + f.count, 0);

  return (
    <div class="bm-import">
      {folders.length === 0 ? (
        <p class="muted small">Aucun dossier de favoris ne contient de liens.</p>
      ) : (
        <>
          <p class="muted small">Chaque dossier coché devient un groupe de raccourcis.</p>
          <ul class="check-list" role="group" aria-label="Dossiers de favoris">
            {folders.map((f) => {
              const on = picked.has(f.id);
              return (
                <li key={f.id}>
                  <button type="button" role="checkbox" aria-checked={on} class={`check-row ${on ? 'is-on' : ''}`} onClick={() => toggle(f.id)}>
                    <span class="check-box">{on && <Check size={11} strokeWidth={3} />}</span>
                    <span class="check-text">
                      <span class="truncate">{f.title}</span>
                      <small class="muted truncate">
                        {f.path !== f.title ? `${f.path} · ` : ''}
                        {f.count} lien{f.count > 1 ? 's' : ''}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div class="inline-form">
        <Button small variant="ghost" onClick={() => setFolders(null)}>
          Annuler
        </Button>
        <Button small variant="primary" onClick={run} disabled={busy || picked.size === 0}>
          Importer{picked.size ? ` ${picked.size} dossier${picked.size > 1 ? 's' : ''} (${total})` : ''}
        </Button>
      </div>
    </div>
  );
}
