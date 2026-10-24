import { useCallback, useEffect, useState } from "react";
import { appApi, getSessionUser } from "../../config";
import type { TemplateItem } from "../../config";

/**
 * Plantillas (textos habituales) dentro de un formulario: elegir una para rellenar los campos,
 * guardar lo escrito como plantilla y administrar las propias (renombrar, compartir, borrar).
 * Las plantillas no tienen datos del paciente.
 */
export default function TemplateBar({ kind, getPayload, onApply }: {
  kind: string;                                   // EVOLUCION | RECETA | ESTUDIOS | CERTIFICADO | INDICACIONES | DERIVACION
  getPayload: () => Record<string, any>;          // lo que hay escrito ahora en el formulario
  onApply: (payload: Record<string, any>) => void;
}) {
  const user = getSessionUser();
  const linked = !!user?.professional_id;
  const isAdmin = user?.role === "ADMINISTRADOR";
  const canSave = linked || isAdmin;
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [picked, setPicked] = useState("");
  const [panel, setPanel] = useState<"" | "save" | "manage">("");
  const [name, setName] = useState("");
  const [shared, setShared] = useState(!linked);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    appApi<TemplateItem[]>(`/templates?kind=${kind}`).then(setItems).catch(() => setItems([]));
  }, [kind]);
  useEffect(() => { load(); setPicked(""); }, [load]);

  const fail = (e: unknown) => setMsg({ text: e instanceof Error ? e.message : "No se pudo guardar", error: true });

  function apply(id: string) {
    setPicked(id);
    const t = items.find((x) => String(x.id) === id);
    if (t) { onApply(t.payload); setMsg({ text: `Plantilla “${t.name}” aplicada. Revisá y ajustá lo que haga falta.`, error: false }); }
  }

  async function save() {
    if (name.trim().length < 2) return setMsg({ text: "Ponele un nombre a la plantilla", error: true });
    setBusy(true);
    try {
      await appApi("/templates", { method: "POST", body: { kind, name: name.trim(), payload: getPayload(), shared: linked ? shared : true } });
      setName(""); setPanel(""); load();
      setMsg({ text: "Plantilla guardada", error: false });
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function update(t: TemplateItem, body: Record<string, unknown>, ok: string) {
    try {
      await appApi(`/templates/${t.id}`, { method: "PUT", body });
      setRenaming(null); load();
      setMsg({ text: ok, error: false });
    } catch (e) { fail(e); }
  }

  async function remove(t: TemplateItem) {
    if (!confirm(`¿Borrar la plantilla “${t.name}”?`)) return;
    try {
      await appApi(`/templates/${t.id}`, { method: "DELETE" });
      load();
      setMsg({ text: "Plantilla borrada", error: false });
    } catch (e) { fail(e); }
  }

  return (
    <div className="mr-template-bar">
      <div className="mr-row">
        <select className="mr-select" value={picked} onChange={(e) => apply(e.target.value)} aria-label="Usar plantilla" disabled={items.length === 0}>
          <option value="">{items.length ? "Usar plantilla…" : "Todavía no hay plantillas"}</option>
          {items.map((t) => <option key={t.id} value={t.id}>{t.name}{t.shared ? " · compartida" : ""}</option>)}
        </select>
        {canSave && <button type="button" className="secondary-button" onClick={() => { setPanel(panel === "save" ? "" : "save"); setMsg(null); }}>Guardar como plantilla</button>}
        {items.length > 0 && <button type="button" className="mr-link" onClick={() => { setPanel(panel === "manage" ? "" : "manage"); setMsg(null); }}>Mis plantillas</button>}
      </div>

      {panel === "save" && (
        <div className="mr-template-panel">
          <div className="mr-row">
            <input className="mr-search" style={{ flex: 1, minWidth: 180 }} placeholder="Nombre de la plantilla (ej. Control de rutina)" value={name}
              onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Nombre de la plantilla" />
            <button type="button" className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar plantilla"}</button>
          </div>
          {linked ? (
            <div className="mr-inline-checks">
              <label><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Compartirla con todo el consultorio</label>
            </div>
          ) : <small className="mr-hint">Queda compartida con todo el consultorio (tu usuario no está vinculado a un profesional).</small>}
          <small className="mr-hint">Se guarda lo que está escrito ahora en el formulario. No pongas datos del paciente en una plantilla.</small>
        </div>
      )}

      {panel === "manage" && (
        <div className="mr-template-panel">
          <ul className="mr-list">
            {items.map((t) => (
              <li key={t.id}>
                <div className="mr-list-main">
                  {renaming?.id === t.id ? (
                    <div className="mr-row">
                      <input className="mr-search" value={renaming.name} onChange={(e) => setRenaming({ id: t.id, name: e.target.value })} maxLength={120} aria-label="Nuevo nombre" autoFocus />
                      <button type="button" className="secondary-button" onClick={() => update(t, { name: renaming.name.trim() }, "Plantilla renombrada")}>Guardar nombre</button>
                      <button type="button" className="mr-link" onClick={() => setRenaming(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <strong>{t.name}</strong>
                      <small>{t.shared ? "Compartida con todo el consultorio" : "Solo para vos"}{t.shared && t.professional_name ? ` · ${t.professional_name}` : ""}</small>
                    </>
                  )}
                </div>
                {t.can_edit && renaming?.id !== t.id && (
                  <div className="mr-row">
                    <button type="button" className="mr-link" onClick={() => setRenaming({ id: t.id, name: t.name })}>Renombrar</button>
                    {t.shared
                      ? linked && <button type="button" className="mr-link" onClick={() => update(t, { shared: false }, "Ahora es solo tuya")}>Dejar de compartir</button>
                      : <button type="button" className="mr-link" onClick={() => update(t, { shared: true }, "Plantilla compartida")}>Compartir</button>}
                    <button type="button" className="mr-link mr-link-danger" onClick={() => remove(t)}>Borrar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {msg && <small className={msg.error ? "mr-template-msg is-error" : "mr-template-msg"} role="status">{msg.text}</small>}
    </div>
  );
}
