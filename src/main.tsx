// Premier rendu depuis le cache localStorage (synchrone), puis lecture du vrai stockage.
import { render } from 'preact';
import './styles/base.css';
import './styles/ui.css';
import './styles/dashboard.css';
import './styles/widgets.css';
import { App, preloadPanels } from './app/App';
import { defaultDoc } from './state/defaults';
import { applyRemote, doc, hydrate, referencedBlobIds, replaceDoc } from './state/store';
import { loadDoc, readBootCache, watchRemoteChanges } from './storage/persistence';
import { collectGarbage } from './storage/blobs';
import { startTheme } from './app/theme';
import { maybeGrabFocus, startKeyboard } from './app/keyboard';
import { protectedBlobIds } from './features/background/actions';

const boot = readBootCache();
if (boot) doc.value = boot;
startTheme();
render(<App />, document.getElementById('app')!);
document.documentElement.classList.add('is-ready');

async function init() {
  const { doc: stored } = await loadDoc();
  if (stored) {
    hydrate(stored);
  } else if (boot) {
    // Stockage vidé mais cache présent (rare) : on réécrit le cache dans le stockage.
    hydrate(boot);
    await replaceDoc(boot);
  } else {
    // Première installation.
    const fresh = defaultDoc();
    hydrate(fresh);
    await replaceDoc(fresh);
  }
  watchRemoteChanges(applyRemote);
  startKeyboard();
  maybeGrabFocus();

  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
  idle(async () => {
    preloadPanels();
    const keep = new Set([...referencedBlobIds(), ...(await protectedBlobIds())]);
    void collectGarbage(keep);
  });
}

void init();
