import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime, DOC_KINDS } from "../../config";
import type { MedDoc } from "../../config";
import { Empty, Field, Loading, Modal, Pill, strOrNull } from "../ui";
import TemplateBar from "./Plantillas";

const KIND_TONE: Record<string, string> = { RECETA: "teal", ESTUDIOS: "blue", CERTIFICADO: "violet", INDICACIONES: "green", DERIVACION: "orange" };
const ITEM_KINDS = ["RECETA", "ESTUDIOS"];
/** Recetas y órdenes de estudios: la válida es la electrónica de una plataforma registrada (ReNaPDiS). MIRA no lo es. */
const ELECTRONIC = ["RECETA", "ESTUDIOS"];

function ElectronicNote({ short }: { short?: boolean }) {
  return (
    <div className="mr-note mr-note-warn" style={{ marginBottom: 12 }}>
      <strong>MIRA no emite recetas ni órdenes electrónicas.</strong>{" "}
      {short
        ? "Lo que cargás acá queda en la historia clínica y se imprime como constancia. Si ya la hiciste en una plataforma registrada (ReNaPDiS), anotá abajo su número o enlace."
        : "Desde 2025, la receta válida para retirar medicamentos y la orden de estudios y prácticas son las electrónicas, hechas en una plataforma registrada (ReNaPDiS). Acá queda el registro en la historia clínica y una constancia para imprimir; el papel solo vale en los casos de excepción que fije cada provincia."}
    </div>
  );
}
const TEMPLATES: Record<string, string> = {
  CERTIFICADO: "Certifico que el/la paciente fue atendido/a en el día de la fecha y debe guardar reposo por ___ días.",
  INDICACIONES: "",
  DERIVACION: "Se deriva al/la paciente a ________ para evaluación por: ",
};

export default function Documentos({ patientId, canWrite, onSaved }: { patientId: number; canWrite: boolean; onSaved?: (msg: string) => void }) {
  const [docs, setDocs] = useState<MedDoc[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  const load = useCallback(() => {
    appApi<MedDoc[]>(`/patients/${patientId}/documents`).then(setDocs).catch((e) => setError(e.message));
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="mr-note mr-note-error">{error}</div>;
  if (!docs) return <Loading />;

  return (
    <div>
      <ElectronicNote />
      {canWrite && (
        <div className="mr-row" style={{ marginBottom: 14 }}>
          {Object.entries(DOC_KINDS).map(([k, l]) => (
            <button key={k} className={k === "RECETA" ? "primary-button" : "secondary-button"} onClick={() => setCreating(k)}>+ {l}</button>
          ))}
        </div>
      )}
      {docs.length === 0 ? <Empty title="No hay documentos">Recetas, pedidos de estudios, certificados, indicaciones y derivaciones quedan acá.</Empty> : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Contenido</th><th>Profesional</th><th></th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{dateTime(d.created_at)}</td>
                  <td><Pill tone={KIND_TONE[d.kind] || "gray"}>{DOC_KINDS[d.kind] || d.kind}</Pill>{d.rx_number && <small>Electrónica N° {d.rx_number}</small>}
                    {d.rx_url && <small><a className="mr-link" href={d.rx_url} target="_blank" rel="noopener noreferrer">Abrir la electrónica</a></small>}</td>
                  <td>
                    {d.title && <strong>{d.title}</strong>}
                    {d.items.length > 0 && <small>{d.items.map((i) => i.name).join(" · ")}</small>}
                    {d.body && <small>{d.body.slice(0, 90)}{d.body.length > 90 ? "…" : ""}</small>}
                  </td>
                  <td>{d.professional_name}</td>
                  <td className="num"><a className="secondary-button" href={`/print/documento/${d.id}`} target="_blank" rel="noreferrer">{ELECTRONIC.includes(d.kind) ? "Imprimir constancia" : "Imprimir"}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <DocForm patientId={patientId} kind={creating} onClose={() => setCreating(null)}
        onSaved={(d) => { setCreating(null); load(); onSaved?.(`${DOC_KINDS[d.kind]} guardado`); window.open(`/print/documento/${d.id}`, "_blank"); }} />}
    </div>
  );
}

function DocForm({ patientId, kind: initialKind, onClose, onSaved }: { patientId: number; kind: string; onClose: () => void; onSaved: (d: MedDoc) => void }) {
  const [kind, setKind] = useState(initialKind);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<{ name: string; detail: string }[]>([{ name: "", detail: "" }]);
  const [body, setBody] = useState(TEMPLATES[initialKind] || "");
  const [diagnosis, setDiagnosis] = useState("");
  const [rx, setRx] = useState("");
  const [rxUrl, setRxUrl] = useState("");
  const electronic = ELECTRONIC.includes(kind);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const withItems = ITEM_KINDS.includes(kind);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const d = await appApi<MedDoc>(`/patients/${patientId}/documents`, {
        method: "POST",
        body: {
          kind, title: strOrNull(title), body: strOrNull(body), diagnosis: strOrNull(diagnosis),
          rx_number: electronic ? strOrNull(rx) : null, rx_url: electronic ? strOrNull(rxUrl) : null,
          items: withItems ? items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), detail: strOrNull(i.detail) })) : [],
        },
      });
      onSaved(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal eyebrow="NUEVO DOCUMENTO" title={DOC_KINDS[kind]} onClose={onClose} size="wide"
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : electronic ? "Guardar e imprimir constancia" : "Guardar e imprimir"}</button>
      </>}>
      <div className="product-form">
        <div className="mr-seg" style={{ marginBottom: 12 }}>
          {Object.entries(DOC_KINDS).map(([k, l]) => (
            <button key={k} type="button" className={kind === k ? "is-on" : ""} onClick={() => { setKind(k); if (!body || Object.values(TEMPLATES).includes(body)) setBody(TEMPLATES[k] || ""); }}>{l}</button>
          ))}
        </div>
        <TemplateBar kind={kind}
          getPayload={() => ({
            title, body, diagnosis,
            items: withItems ? items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), detail: i.detail.trim() || null })) : [],
          })}
          onApply={(p) => {
            if (Array.isArray(p.items) && p.items.length) setItems(p.items.map((i: any) => ({ name: String(i.name || ""), detail: String(i.detail || "") })));
            if (typeof p.title === "string") setTitle(p.title);
            if (typeof p.body === "string") setBody(p.body);
            if (typeof p.diagnosis === "string") setDiagnosis(p.diagnosis);
          }} />
        {electronic && <ElectronicNote short />}
        {withItems ? (
          <Field label={kind === "RECETA" ? "Medicamentos (genérico, presentación y dosis)" : "Estudios solicitados"}>
            <div className="mr-doc-items">
              {items.map((it, i) => (
                <div key={i} className="mr-doc-item">
                  <input placeholder={kind === "RECETA" ? "Amoxicilina 500 mg comp. x 21" : "Hemograma completo"} value={it.name}
                    onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input placeholder={kind === "RECETA" ? "1 cada 8 h por 7 días" : "En ayunas"} value={it.detail}
                    onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} />
                  <button type="button" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ name: "", detail: "" }])} aria-label="Quitar">×</button>
                </div>
              ))}
              <button type="button" className="secondary-button" style={{ justifySelf: "start" }} onClick={() => setItems([...items, { name: "", detail: "" }])}>+ Agregar renglón</button>
            </div>
          </Field>
        ) : (
          <Field label="Título (opcional)"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "CERTIFICADO" ? "Certificado médico" : ""} /></Field>
        )}
        <Field label={withItems ? "Indicaciones / observaciones" : "Texto"}><textarea rows={withItems ? 3 : 6} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <Field label="Diagnóstico"><input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>
        {electronic && (
          <div className="form-row">
            <Field label={`N° de la ${kind === "RECETA" ? "receta" : "orden"} electrónica (CUIR)`} hint="El que te dio la plataforma registrada. Opcional.">
              <input value={rx} onChange={(e) => setRx(e.target.value)} maxLength={80} placeholder="Ej. 0123-4567-8901" />
            </Field>
            <Field label="Enlace a la electrónica" hint="Si la plataforma te da un enlace, pegalo acá. Opcional.">
              <input value={rxUrl} onChange={(e) => setRxUrl(e.target.value)} maxLength={500} placeholder="https://…" inputMode="url" />
            </Field>
          </div>
        )}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
