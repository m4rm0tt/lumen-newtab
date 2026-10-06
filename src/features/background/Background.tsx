// La miniature floue s'affiche au premier rendu, le temps que l'image sorte d'IndexedDB.
import { useEffect, useState } from 'preact/hooks';
import { settings } from '../../state/store';
import { presetById } from './presets';
import { readBootThumb } from './actions';
import { imageMissing } from '../../app/theme';
import { blobUrl } from '../../storage/blobs';
import type { BackgroundSettings } from '../../types';

function baseCss(bg: BackgroundSettings): string {
  switch (bg.type) {
    case 'color':
      return bg.color;
    case 'gradient':
      return `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`;
    default:
      return presetById(bg.preset).css;
  }
}

export function Background() {
  const bg = settings.value.background;
  const wantsImage = bg.type === 'image' || bg.type === 'url';
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const thumb = bg.type === 'image' ? readBootThumb(bg.imageId) : null;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (bg.type === 'image') {
      if (!bg.imageId) {
        setSrc(null);
        setFailed(true);
        return;
      }
      let alive = true;
      blobUrl(bg.imageId).then((u) => {
        if (!alive) return;
        setSrc(u);
        if (!u) setFailed(true);
      });
      return () => {
        alive = false;
      };
    }
    setSrc(bg.type === 'url' && bg.url ? bg.url : null);
    if (bg.type === 'url' && !bg.url) setFailed(true);
  }, [bg.type, bg.imageId, bg.url]);

  // Image absente (importée sur un autre appareil) : on le signale pour le contraste et les réglages.
  useEffect(() => {
    imageMissing.value = wantsImage && failed;
  }, [wantsImage, failed]);

  const showImage = wantsImage && !failed;
  const fallbackToPreset = wantsImage && failed;
  const base = fallbackToPreset ? presetById(bg.preset).css : baseCss(bg);
  const filter = `${bg.brightness !== 1 ? `brightness(${bg.brightness})` : ''} ${bg.blur ? `blur(${bg.blur}px)` : ''}`.trim();
  const scale = bg.blur ? 1 + Math.min(0.12, bg.blur / 200) : 1;
  const imgStyle = {
    objectFit: bg.fit,
    objectPosition: bg.position,
    filter: filter || undefined,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
  };

  return (
    <div class="bg" aria-hidden="true">
      <div class="bg-base" style={{ background: base, filter: !wantsImage && filter ? filter : undefined, transform: !wantsImage && scale !== 1 ? `scale(${scale})` : undefined }} />
      {!wantsImage && <div class="bg-grain" />}
      {showImage && thumb && !loaded && (
        <img class="bg-img bg-thumb" src={thumb} alt="" style={{ ...imgStyle, filter: `${filter} blur(24px)`.trim(), transform: 'scale(1.1)' }} />
      )}
      {showImage && src && (
        <img
          class={`bg-img ${loaded ? 'is-loaded' : ''}`}
          src={src}
          alt=""
          decoding="async"
          referrerpolicy="no-referrer"
          style={imgStyle}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {bg.overlayOpacity > 0 && (
        <div class="bg-overlay" style={{ background: bg.overlay === 'dark' ? '#000' : '#fff', opacity: String(bg.overlayOpacity) }} />
      )}
      <div class="bg-vignette" />
    </div>
  );
}
