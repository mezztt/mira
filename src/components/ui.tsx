// Piezas de interfaz compartidas por todas las pantallas de MIRA
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";

/** Encabezado estándar de cada pantalla */
export function PageHeader({ eyebrow, title, subtitle, children }: {
  eyebrow?: string; title: string; subtitle?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="products-header">
      <div>
        {eyebrow && <span className="dashboard-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="products-header-actions mr-row">{children}</div>}
    </div>
  );
}

/** Ventana modal */
export function Modal({ title, eyebrow, onClose, children, size, footer }: {
  title: ReactNode; eyebrow?: string; onClose: () => void; children: ReactNode;
  size?: "wide" | "xl"; footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className={`product-modal ${size === "wide" ? "mr-modal-wide" : size === "xl" ? "mr-modal-xl" : ""}`}
        onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            {eyebrow && <span className="dashboard-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}

export function Pill({ tone = "gray", children }: { tone?: string; children: ReactNode }) {
  return <span className={`mr-pill mr-pill-${tone}`}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="mr-empty"><strong>{title}</strong>{children}</div>;
}

export function Loading({ text = "Cargando..." }: { text?: string }) {
  return <div className="products-loading"><div className="products-loading-spinner" /><span>{text}</span></div>;
}

export function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="mr-switch-row" onClick={(e) => { e.preventDefault(); onChange(!on); }}>
      <button type="button" className={`mr-switch ${on ? "is-on" : ""}`} role="switch" aria-checked={on}><span /></button>
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void }) {
  return (
    <div className="mr-seg">
      {options.map(([k, label]) => (
        <button key={k} type="button" className={value === k ? "is-on" : ""} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void }) {
  return (
    <div className="mr-tabs" role="tablist">
      {options.map(([k, label]) => (
        <button key={k} type="button" role="tab" className={value === k ? "is-on" : ""} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

/** Mensajito abajo de la pantalla (reemplaza los alert) */
export function useFlash() {
  const [flash, setFlash] = useState<{ text: string; error: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string, error = false) => {
    setFlash({ text, error });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(null), error ? 5200 : 3000);
  }, []);
  const fail = useCallback((e: unknown) => show(e instanceof Error ? e.message : "Ocurrió un error", true), [show]);
  const node = flash ? <div className={`mr-flash ${flash.error ? "is-error" : "is-ok"}`} role="status">{flash.text}</div> : null;
  return { show, fail, node };
}

/** refreshKey que entrega el layout: cambia cuando llega un aviso nuevo */
export function useRefreshKey(): number {
  const ctx = useOutletContext<{ refreshKey?: number } | undefined>();
  return ctx?.refreshKey ?? 0;
}

/** Hook para inputs controlados con objetos */
export function useForm<T extends Record<string, any>>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setForm((f) => ({ ...f, [key]: value })), []);
  return { form, setForm, set };
}

export function Field({ label, children, hint, wide }: { label: ReactNode; children: ReactNode; hint?: ReactNode; wide?: boolean }) {
  return (
    <div className="form-group" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <label>{label}</label>
      {children}
      {hint && <small className="mr-hint">{hint}</small>}
    </div>
  );
}

/** "" -> null, "12" -> 12 */
export function numOrNull(v: string | number | null | undefined): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
export function strOrNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}
