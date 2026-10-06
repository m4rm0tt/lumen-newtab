import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, X } from 'lucide-preact';
import { useLocal } from '../state/local';
import { arrange, drag, pointerDownDrag, registerDropHandler } from '../lib/dnd';
import { useFlip } from '../lib/flip';
import { uid } from '../lib/id';
import { Row, Switch, TextField } from '../components/controls';
import type { WidgetProps, WidgetSettingsProps } from './types';
import { widgetKey } from './types';

interface Config {
  title: string;
  hideDone: boolean;
}

interface Item {
  id: string;
  text: string;
  done: boolean;
}

// Plusieurs widgets Tâches peuvent coexister : chacun s'enregistre auprès d'un aiguillage commun.
const todoDrops = new Map<string, (id: string, index: number) => void>();
registerDropHandler('todo', (item, res) => {
  if ('container' in res && res.container === item.container) todoDrops.get(res.container)?.(item.id, res.index);
});

export default function Todo({ instance, config }: WidgetProps<Config>) {
  const [data, setData] = useLocal<{ items: Item[] }>(widgetKey(instance.id), { items: [] }, 200);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  useFlip(listRef, 180);
  const container = `todo:${instance.id}`;
  const d = drag.value;

  useEffect(() => {
    todoDrops.set(container, (id, index) =>
      setData((prev) => {
        const items = [...prev.items];
        const from = items.findIndex((i) => i.id === id);
        if (from < 0) return prev;
        const [it] = items.splice(from, 1);
        // index est relatif à la liste visible ; on le convertit en index réel.
        const visible = items.filter((i) => !config.hideDone || !i.done);
        const anchor = visible[index];
        items.splice(anchor ? items.indexOf(anchor) : items.length, 0, it);
        return { items };
      }),
    );
    return () => void todoDrops.delete(container);
  }, [container, config.hideDone]);

  const visible = data.items.filter((i) => !config.hideDone || !i.done);
  const shown = arrange(visible, (i) => i.id, container, d);
  const remaining = data.items.filter((i) => !i.done).length;
  const doneCount = data.items.length - remaining;

  function add(e: Event) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setData((prev) => ({ items: [...prev.items, { id: uid('t_'), text: t.slice(0, 300), done: false }] }));
    setText('');
  }

  const toggle = (id: string) => setData((p) => ({ items: p.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) }));
  const remove = (id: string) => setData((p) => ({ items: p.items.filter((i) => i.id !== id) }));

  return (
    <div class="w-todo">
      <ul ref={listRef} class="w-todo-list" data-dnd-container={container} data-dnd-accept="todo" data-dnd-axis="y">
        {shown.map((it) =>
          it === 'slot' ? null : (
            <li
              key={it.id}
              class={`w-todo-item ${it.done ? 'is-done' : ''} ${d?.item.id === it.id ? 'is-dragging' : ''}`}
              data-dnd-item={it.id}
              data-flip={it.id}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                pointerDownDrag(e, { kind: 'todo', id: it.id, container });
              }}
            >
              <button type="button" class="w-check" role="checkbox" aria-checked={it.done} aria-label={it.done ? `Marquer « ${it.text} » comme à faire` : `Marquer « ${it.text} » comme fait`} onClick={() => toggle(it.id)}>
                {it.done && <Check size={11} strokeWidth={3} />}
              </button>
              <span class="w-todo-text">{it.text}</span>
              <button type="button" class="icon-btn w-todo-del" aria-label={`Supprimer « ${it.text} »`} onClick={() => remove(it.id)}>
                <X size={13} />
              </button>
            </li>
          ),
        )}
        {data.items.length === 0 && <li class="w-todo-empty">Rien à faire. Profitez-en.</li>}
      </ul>
      <form class="w-todo-add" onSubmit={add}>
        <input
          class="field is-quiet"
          value={text}
          placeholder="Ajouter une tâche…"
          aria-label="Nouvelle tâche"
          maxLength={300}
          onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </form>
      {doneCount > 0 && (
        <button type="button" class="w-todo-clear" onClick={() => setData((p) => ({ items: p.items.filter((i) => !i.done) }))}>
          Effacer {doneCount} terminée{doneCount > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  return (
    <>
      <label class="field-label">
        Titre
        <TextField value={config.title} onValue={(v) => setConfig({ title: v })} maxLength={40} />
      </label>
      <Row label="Masquer les tâches terminées">
        <Switch label="Masquer les tâches terminées" checked={config.hideDone} onChange={(v) => setConfig({ hideDone: v })} />
      </Row>
    </>
  );
}
