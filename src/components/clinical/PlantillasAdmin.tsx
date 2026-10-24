import { useCallback, useEffect, useState } from "react";
import { appApi, canAccess, getSessionUser, DOC_KINDS } from "../../config";
import type { TemplateItem } from "../../config";
import { Empty, Field, Loading, Modal, Pill } from "../ui";

const ITEM_KINDS = ["RECETA", "ESTUDIOS"];
const itemsToText = (items: any): string => (Array.isArray(items) ? items.map((i) => `${i.name || ""}${i.detail ? ` | ${i.detail}` : ""}`).join("\n") : "");
const textToItems = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const [name, ...rest] = l.split("|");
  return { name: name.trim(), detail: rest.join("|").trim() || null };
}).filter((i) => i.name);

/** Administrar plantillas (textos habituales): crear, cambiar, compartir y borrar. Pestaña de Profesionales. */
export default function PlantillasAdmin({ show, fail }: { show: (m: string) => void; fail: (e: unknown) => void }) {
  const user = getSessionUser();
  const linked = !!user?.professional_id;
  const kinds: Record<string, string> = {
    ...(canAccess(user, "historia_clinica") ? { EVOLUCION: "Evolución" } : {}),
    ...(canAccess(user, "documentos") ? DOC_KINDS : {}),
  };
  const [items, setItems] = useState<TemplateItem[] | null>(null);
  const [editing, setEditing] = useState<TemplateItem | "new" | null>(null);

  const load = useCallback(() => { appApi<TemplateItem[]>("/templates").then(setItems).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);

  async function remove(t: TemplateItem) {
    if (!confirm(`¿Borrar la plantilla “${t.name}”?`)) return;
    try { await appApi(`/templates/${t.id}`, { method: "DELETE" }); show("Plantilla borrada"); load(); } catch (e) { fail(e); }
  }
  async function share(t: TemplateItem, shared: boolean) {
    try { await appApi(`/templates/${t.id}`, { method: "PUT", body: { shared } }); show(shared ? "Plantilla compartida" : "Ahora es solo tuya"); load(); } catch (e) { fail(e); }
  }

  return (
    <div>
      <div className="mr-toolbar">
        <button className="primary-button" onClick={() => setEditing("new")}>+ Nueva plantilla</button>
        <span className="mr-muted">Textos habituales para evoluciones y documentos. También se guardan desde el formulario con “Guardar como plantilla”.</span>
      </div>
      {!items ? <Loading /> : items.length === 0 ? (
        <Empty title="Todavía no hay plantillas">Guardá los textos que más repetís: se eligen con “Usar plantilla” al escribir una evolución o un documento.</Empty>
      ) : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>Plantilla</th><th>Para</th><th>Quién la ve</th><th></th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>{kinds[t.kind] || t.kind}</td>
                  <td>{t.shared ? <Pill tone="teal">Todo el consultorio</Pill> : <Pill tone="gray">Solo vos</Pill>}</td>
                  <td className="num">
                    {t.can_edit ? (
                      <div className="mr-row" style={{ justifyContent: "flex-end" }}>
                        <button className="mr-link" onClick={() => setEditing(t)}>Cambiar</button>
                        {t.shared ? linked && <button className="mr-link" onClick={() => share(t, false)}>Dejar de compartir</button>
                          : <button className="mr-link" onClick={() => share(t, true)}>Compartir</button>}
                        <button className="mr-link mr-link-danger" onClick={() => remove(t)}>Borrar</button>
                      </div>
                    ) : <small>La administra quien la creó</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <TemplateForm template={editing === "new" ? null : editing} kinds={kinds} linked={linked} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); show("Plantilla guardada"); }} />}
    </div>
  );
}

function TemplateForm({ template, kinds, linked, onClose, onSaved }: {
  template: TemplateItem | null; kinds: Record<string, string>; linked: boolean; onClose: () => void; onSaved: () => void;
}) {
  const p = template?.payload || {};
  const [kind, setKind] = useState(template?.kind || Object.keys(kinds)[0] || "EVOLUCION");
  const [name, setName] = useState(template?.name || "");
  const [shared, setShared] = useState(template ? template.shared : !linked);
  const [f, setF] = useState<Record<string, string>>({
    reason: p.reason || "", anamnesis: p.anamnesis || "", exam: p.exam || "", diagnosis: p.diagnosis || "",
    diagnosis_code: p.diagnosis_code || "", plan: p.plan || "", title: p.title || "", body: p.body || "", items: itemsToText(p.items),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const isNote = kind === "EVOLUCION";
  const withItems = ITEM_KINDS.includes(kind);

  async function save() {
    if (name.trim().length < 2) return setError("Ponele un nombre a la plantilla");
    setError("");
    setSaving(true);
    try {
      const payload = isNote
        ? { reason: f.reason, anamnesis: f.anamnesis, exam: f.exam, diagnosis: f.diagnosis, diagnosis_code: f.diagnosis_code, plan: f.plan }
        : { title: withItems ? "" : f.title, body: f.body, diagnosis: f.diagnosis, items: withItems ? textToItems(f.items) : [] };
      if (template) await appApi(`/templates/${template.id}`, { method: "PUT", body: { name: name.trim(), payload } });
      else await appApi("/templates", { method: "POST", body: { kind, name: name.trim(), payload, shared: linked ? shared : true } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow="PLANTILLAS" title={template ? template.name : "Nueva plantilla"} onClose={onClose} size="wide"
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar plantilla"}</button>
      </>}>
      <div className="product-form">
        <div className="form-row">
          <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ej. Control de rutina" autoFocus /></Field>
          <Field label="Para">
            <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={!!template}>
              {Object.entries(kinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        {!template && (linked ? (
          <div className="mr-inline-checks"><label><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Compartirla con todo el consultorio</label></div>
        ) : <small className="mr-hint">Queda compartida con todo el consultorio (tu usuario no está vinculado a un profesional).</small>)}

        {isNote ? (
          <>
            <Field label="Motivo de consulta"><input value={f.reason} onChange={(e) => set("reason", e.target.value)} maxLength={255} /></Field>
            <Field label="Anamnesis / enfermedad actual"><textarea rows={2} value={f.anamnesis} onChange={(e) => set("anamnesis", e.target.value)} /></Field>
            <Field label="Examen físico"><textarea rows={2} value={f.exam} onChange={(e) => set("exam", e.target.value)} /></Field>
            <div className="form-row">
              <Field label="Diagnóstico"><input value={f.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} maxLength={255} /></Field>
              <Field label="Código CIE-10"><input value={f.diagnosis_code} onChange={(e) => set("diagnosis_code", e.target.value.toUpperCase())} maxLength={15} /></Field>
            </div>
            <Field label="Plan / indicaciones"><textarea rows={3} value={f.plan} onChange={(e) => set("plan", e.target.value)} /></Field>
          </>
        ) : (
          <>
            {withItems
              ? <Field label={kind === "RECETA" ? "Medicamentos" : "Estudios"} hint="Uno por línea. Si querés agregar la indicación, ponela después de una barra: Amoxicilina 500 mg | 1 cada 8 h por 7 días">
                <textarea rows={4} value={f.items} onChange={(e) => set("items", e.target.value)} /></Field>
              : <Field label="Título"><input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={150} /></Field>}
            <Field label={withItems ? "Indicaciones / observaciones" : "Texto"}><textarea rows={withItems ? 3 : 6} value={f.body} onChange={(e) => set("body", e.target.value)} /></Field>
            <Field label="Diagnóstico"><input value={f.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} maxLength={255} /></Field>
          </>
        )}
        <small className="mr-hint">No pongas datos de un paciente en una plantilla: se usa para todos.</small>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
