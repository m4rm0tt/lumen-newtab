import { toasts, dismissToast } from '../app/ui';

export function ToastHost() {
  const list = toasts.value;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} class={`toast ${t.tone === 'error' ? 'is-error' : ''}`}>
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              class="toast-action"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
