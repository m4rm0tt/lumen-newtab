import type { ButtonHTMLAttributes, ComponentChildren, CSSProperties, InputHTMLAttributes } from 'preact';
import { useId } from 'preact/hooks';
import { Check, Plus } from 'lucide-preact';

export function Row({ label, hint, children, stacked }: { label: ComponentChildren; hint?: ComponentChildren; children: ComponentChildren; stacked?: boolean }) {
  return (
    <div class={`row ${stacked ? 'is-stacked' : ''}`}>
      <div class="row-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div class="row-control">{children}</div>
    </div>
  );
}

export function Group({ title, children, footer }: { title?: string; children: ComponentChildren; footer?: ComponentChildren }) {
  return (
    <section class="set-group">
      {title && <h3 class="set-group-title">{title}</h3>}
      <div class="set-group-body">{children}</div>
      {footer && <p class="set-group-foot">{footer}</p>}
    </section>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} class="switch" onClick={() => onChange(!checked)}>
      <span class="switch-thumb" />
    </button>
  );
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  label: string;
}

export function Slider({ value, min, max, step = 1, onChange, format, label }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div class="slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={format ? format(value) : String(value)}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
      />
      <output>{format ? format(value) : value}</output>
    </div>
  );
}

interface SegOption<T> {
  value: T;
  label: ComponentChildren;
  title?: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void; label: string }) {
  const name = useId();
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={String(o.value)} class={`seg ${o.value === value ? 'is-on' : ''}`} title={o.title}>
          <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function Select<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <select class="select" value={value} aria-label={label} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onInput' | 'value'> & {
  value: string;
  onValue: (v: string) => void;
};

export function TextField({ value, onValue, class: cls, ...rest }: InputProps) {
  // Preact 11 type les <input> par rôle ARIA : on relaie les attributs tels quels.
  const attrs = rest as Record<string, unknown>;
  return <input {...attrs} class={`field ${cls ?? ''}`} value={value} onInput={(e) => onValue((e.currentTarget as HTMLInputElement).value)} />;
}

export function Swatches({ value, colors, onChange, label, allowNone }: { value?: string; colors: { name: string; value: string }[]; onChange: (v: string | undefined) => void; label: string; allowNone?: boolean }) {
  const custom = value && !colors.some((c) => c.value.toLowerCase() === value.toLowerCase());
  return (
    <div class="swatches" role="radiogroup" aria-label={label}>
      {allowNone && (
        <button type="button" role="radio" aria-checked={!value} class="swatch is-none" title="Automatique" aria-label="Automatique" onClick={() => onChange(undefined)} />
      )}
      {colors.map((c) => {
        const on = value?.toLowerCase() === c.value.toLowerCase();
        return (
          <button key={c.value} type="button" role="radio" aria-checked={on} class="swatch" title={c.name} aria-label={c.name} style={{ background: c.value }} onClick={() => onChange(c.value)}>
            {on && <Check size={12} strokeWidth={3} />}
          </button>
        );
      })}
      <label class={`swatch is-custom ${custom ? 'is-on' : ''}`} title="Couleur personnalisée" style={custom ? { background: value } : undefined}>
        {custom ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={2.5} />}
        <input type="color" aria-label="Couleur personnalisée" value={value ?? '#0a84ff'} onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)} />
      </label>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; small?: boolean };

export function Button({ variant = 'secondary', small, class: cls, type = 'button', ...rest }: BtnProps) {
  return <button {...rest} type={type as 'button'} class={`btn btn-${variant} ${small ? 'is-small' : ''} ${cls ?? ''}`} />;
}
