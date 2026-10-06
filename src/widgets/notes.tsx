import { useLocal } from '../state/local';
import { TextField } from '../components/controls';
import type { WidgetProps, WidgetSettingsProps } from './types';
import { widgetKey } from './types';

interface Config {
  title: string;
}

export default function Notes({ instance }: WidgetProps<Config>) {
  const [data, setData, loaded] = useLocal<{ text: string }>(widgetKey(instance.id), { text: '' });
  return (
    <textarea
      class="w-notes"
      value={data.text}
      placeholder={loaded ? 'Écrivez ici… (enregistré automatiquement)' : ''}
      aria-label="Notes"
      spellcheck
      onInput={(e) => setData({ text: (e.currentTarget as HTMLTextAreaElement).value })}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  return (
    <label class="field-label">
      Titre
      <TextField value={config.title} onValue={(v) => setConfig({ title: v })} maxLength={40} />
    </label>
  );
}
