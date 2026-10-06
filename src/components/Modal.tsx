// <dialog> natif : on récupère le piège à focus et Échap sans rien écrire.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { X } from 'lucide-preact';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  width?: number;
  /** Masque le titre visuellement (il reste annoncé aux lecteurs d'écran). */
  hideTitle?: boolean;
  class?: string;
}

export function Modal({ title, onClose, children, footer, width = 460, hideTitle, class: cls }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    const d = ref.current;
    if (!d || closing.current) return;
    closing.current = true;
    d.classList.add('is-closing');
    const done = () => {
      d.close();
      onClose();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 140);
  }

  return (
    <dialog
      ref={ref}
      class={`modal ${cls ?? ''}`}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      aria-label={title}
      onMouseDown={(e) => {
        // Clic sur le voile (hors du contenu) : fermeture.
        if (e.target === ref.current) close();
      }}
    >
      <div class="modal-body">
        <header class={`modal-head ${hideTitle ? 'sr-only' : ''}`}>
          <h2>{title}</h2>
          <button type="button" class="icon-btn" aria-label="Fermer" onClick={close}>
            <X size={16} />
          </button>
        </header>
        <div class="modal-content">{children}</div>
        {footer && <footer class="modal-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
