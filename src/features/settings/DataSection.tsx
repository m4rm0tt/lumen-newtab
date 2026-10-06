import { useEffect, useRef, useState } from 'preact/hooks';
import { Download, Upload } from 'lucide-preact';
import { doc, replaceDoc, resetEverything, settings, updateSettings } from '../../state/store';
import { Button, Group, Row, Switch } from '../../components/controls';
import { storageUsage, syncStatus } from '../../storage/persistence';
import { SYNC_BUDGET } from '../../storage/chunks';
import { applyImportSideData, buildExport, downloadJson, parseImport, type ParsedImport } from '../../storage/transfer';
import { toast } from '../../app/ui';
import { hasChromeStorage } from '../../storage/backend';

function kb(n: number) {
  return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} Ko`;
}

const STATUS: Record<string, string> = {
  off: 'Désactivée sur cet appareil',
  idle: 'En attente',
  saving: 'Enregistrement…',
  ok: 'À jour',
  'too-large': 'Configuration trop volumineuse',
  error: 'Erreur',
  unavailable: 'Indisponible hors extension',
};

export function DataSection() {
  const s = settings.value;
  const st = syncStatus.value;
  const [usage, setUsage] = useState<{ local: number; sync: number } | null>(null);
  const [withImages, setWithImages] = useState(false);
  const [pending, setPending] = useState<ParsedImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void storageUsage().then(setUsage);
  }, [st.state]);

  async function doExport() {
    try {
      const file = await buildExport(doc.value, withImages);
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(file, `lumen-${date}.json`);
    } catch {
      toast("L'export a échoué.", { tone: 'error' });
    }
  }

  async function onPick(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!f) return;
    try {
      setPending(await parseImport(f));
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    }
  }

  async function confirmImport() {
    if (!pending) return;
    try {
      await applyImportSideData(pending);
      const next = { ...pending.doc, settings: { ...pending.doc.settings, onboarded: true, sync: s.sync } };
      await replaceDoc(next);
      toast('Configuration importée');
    } catch {
      toast("L'import a échoué.", { tone: 'error' });
    }
    setPending(null);
  }

  const ratio = Math.min(1, st.bytes / SYNC_BUDGET);

  return (
    <>
      <Group
        title="Synchronisation"
        footer="Utilise Chrome Sync, sans compte Lumen ni serveur. Les raccourcis, groupes, widgets et réglages sont synchronisés ; les images importées, notes et tâches restent sur chaque appareil."
      >
        <Row label="Synchroniser avec Chrome" hint={hasChromeStorage ? STATUS[s.sync ? st.state : 'off'] : STATUS.unavailable}>
          <Switch label="Synchroniser avec Chrome" checked={s.sync} onChange={(v) => updateSettings('sync', v)} />
        </Row>
        {s.sync && hasChromeStorage && (
          <div class="pad">
            <div class="meter" role="meter" aria-valuemin={0} aria-valuemax={SYNC_BUDGET} aria-valuenow={st.bytes} aria-label="Quota de synchronisation utilisé">
              <span style={{ width: `${ratio * 100}%` }} class={ratio > 0.85 ? 'is-warn' : ''} />
            </div>
            <p class="muted small">
              {kb(st.bytes)} sur {kb(SYNC_BUDGET)} disponibles pour la synchronisation.
              {st.message && <> {st.message}</>}
            </p>
          </div>
        )}
      </Group>

      <Group title="Sauvegarde" footer="Le fichier exporté sert à sauvegarder votre tableau de bord ou à le transférer. Les jetons d'intégration (GitHub, Spotify, Finnhub) ne sont jamais exportés.">
        <Row label="Inclure les images importées" hint="Le fichier peut devenir volumineux">
          <Switch label="Inclure les images importées" checked={withImages} onChange={setWithImages} />
        </Row>
        <div class="pad inline-form">
          <Button small onClick={doExport}>
            <Download size={14} /> Exporter…
          </Button>
          <Button small onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Importer…
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" class="sr-only" onChange={onPick} />
        </div>
        {pending && (
          <div class="pad confirm-box">
            <p>
              Remplacer la configuration actuelle par celle du fichier ?<br />
              <small class="muted">
                {pending.summary.groups} groupes, {pending.summary.shortcuts} raccourcis, {pending.summary.widgets} widgets
                {pending.summary.images ? `, ${pending.summary.images} images` : ''}.
              </small>
            </p>
            <div class="inline-form">
              <Button small variant="ghost" onClick={() => setPending(null)}>
                Annuler
              </Button>
              <Button small variant="primary" onClick={confirmImport}>
                Remplacer
              </Button>
            </div>
          </div>
        )}
      </Group>

      <Group title="Stockage">
        {usage && (
          <Row label="Utilisé sur cet appareil" hint="Hors images (IndexedDB)">
            <span class="muted">{kb(usage.local)}</span>
          </Row>
        )}
        <Row label="Tout réinitialiser" hint="Raccourcis, groupes, widgets et réglages">
          <Button
            small
            variant="danger"
            onClick={() => {
              if (confirm('Réinitialiser tout le tableau de bord ? Pensez à exporter avant si besoin.')) {
                resetEverything();
                toast('Tableau de bord réinitialisé');
              }
            }}
          >
            Réinitialiser
          </Button>
        </Row>
      </Group>
    </>
  );
}
