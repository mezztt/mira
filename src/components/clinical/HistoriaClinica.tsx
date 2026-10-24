import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, dateTime, VITALS } from "../../config";
import type { ClinicalNote, MedDoc } from "../../config";
import { Empty, Field, Loading, Modal, Pill, strOrNull } from "../ui";
import TemplateBar from "./Plantillas";

interface RecordData { notes: ClinicalNote[]; chain_ok: boolean; documents: MedDoc[]; can_write: boolean }

const EMPTY = { reason: "", anamnesis: "", exam: "", diagnosis: "", diagnosis_code: "", plan: "" };

/** Historia clínica: evoluciones inalterables, enmiendas y signos vitales (Ley 26.529). */
export default function HistoriaClinica({ patientId, appointmentId, onSaved, onPrint }: {
  patientId: number; appointmentId?: number | null; onSaved?: (msg: string) => void; onPrint: () => void;
}) {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState("");
  const [writing, setWriting] = useState<{ amend?: ClinicalNote } | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(() => {
    appApi<RecordData>(`/patients/${patientId}/record`).then(setData).catch((e) => setError(e.message));
  }, [patientId]);
  useEffect(() => { load(); }, [load]);
  // si viene desde la sala de espera con un turno, abre la evolución directamente
  useEffect(() => { if (appointmentId && data?.can_write) setWriting({}); }, [appointmentId, data?.can_write]);

  const amendedBy = useMemo(() => {
    const m: Record<number, ClinicalNote[]> = {};
    (data?.notes || []).forEach((n) => { if (n.amends_id) (m[n.amends_id] ||= []).push(n); });
    return m;
  }, [data]);
  const byId = useMemo(() => Object.fromEntries((data?.notes || []).map((n) => [n.id, n])), [data]);

  if (error) return <div className="mr-note mr-note-error">{error}</div>;
  if (!data) return <Loading />;

  const q = filter.trim().toLowerCase();
  const notes = q ? data.notes.filter((n) => [n.reason, n.anamnesis, n.exam, n.diagnosis, n.plan, n.professional_name, n.diagnosis_code]
    .some((v) => (v || "").toLowerCase().includes(q))) : data.notes;

  return (
    <div>
      <div className="mr-toolbar">
        <div className="mr-row">
          {data.can_write
            ? <button className="primary-button" onClick={() => setWriting({})}>+ Nueva evolución</button>
            : <span className="mr-note mr-note-info">Solo los profesionales escriben en la historia clínica.</span>}
          <button className="secondary-button" onClick={onPrint} title="Copia de la historia clínica para entregar al paciente">Imprimir copia / PDF</button>
        </div>
        <div className="mr-row">
          <span className={`mr-chain ${data.chain_ok ? "is-ok" : "is-bad"}`} title="Cada evolución está encadenada con la anterior: si alguien la modificara por fuera del sistema, se detecta.">
            {data.chain_ok ? "✓ Registro íntegro" : "⚠ Se detectó una alteración"}
          </span>
          <input className="mr-search" placeholder="Buscar en la historia…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      {notes.length === 0 ? <Empty title={q ? "Nada coincide con la búsqueda" : "La historia clínica está vacía"}>
        {!q && data.can_write && "Escribí la primera evolución."}</Empty> : (
        <div className="mr-timeline">
          {notes.map((n) => (
            <article key={n.id} className={`mr-entry ${n.kind === "ENMIENDA" ? "is-amend" : ""}`}>
              <header>
                <div>
                  <strong>{n.kind === "ENMIENDA" ? "Enmienda" : n.reason || "Evolución"}</strong>
                  <small>{dateTime(n.created_at)} · {n.professional_name}{n.professional_specialty ? ` · ${n.professional_specialty}` : ""}{n.professional_license ? ` · MP ${n.professional_license}` : ""}</small>
                </div>
                <div className="mr-row">
                  {n.kind === "ENMIENDA" && n.amends_id && byId[n.amends_id] && <Pill tone="orange">Corrige la del {dateTime(byId[n.amends_id].created_at)}</Pill>}
                  {amendedBy[n.id] && <Pill tone="orange">Tiene enmienda</Pill>}
                  {n.diagnosis_code && <Pill tone="teal">{n.diagnosis_code}</Pill>}
                  {data.can_write && n.kind === "EVOLUCION" && <button className="mr-link" onClick={() => setWriting({ amend: n })}>Enmendar</button>}
                </div>
              </header>
              {Object.keys(n.vitals || {}).length > 0 && (
                <div className="mr-vitals" style={{ marginBottom: 10 }}>
                  {VITALS.filter((v) => n.vitals[v.key]).map((v) => (
                    <span key={v.key} className="mr-vital"><small>{v.label}</small>{n.vitals[v.key]} {v.unit}</span>
                  ))}
                </div>
              )}
              <dl>
                {n.kind === "ENMIENDA" && n.reason && <><dt>Motivo</dt><dd>{n.reason}</dd></>}
                {n.anamnesis && <><dt>Anamnesis</dt><dd>{n.anamnesis}</dd></>}
                {n.exam && <><dt>Examen físico</dt><dd>{n.exam}</dd></>}
                {n.diagnosis && <><dt>Diagnóstico</dt><dd>{n.diagnosis}</dd></>}
                {n.plan && <><dt>Plan / indicaciones</dt><dd>{n.plan}</dd></>}
              </dl>
              <footer>
                <span>Firmado por {n.author_name || n.professional_name}</span>
                <span className="mr-hash" title="Huella digital del registro">#{n.content_hash.slice(0, 12)}</span>
              </footer>
            </article>
          ))}
        </div>
      )}

      <p className="mr-legal" style={{ marginTop: 16 }}>
        Según la Ley 26.529, la historia clínica es inviolable: las evoluciones no se editan ni se borran.
        Para corregir algo se agrega una enmienda que queda vinculada a la original. Cada apertura queda registrada.
      </p>

      {writing && (
        <NoteForm patientId={patientId} amend={writing.amend} appointmentId={writing.amend ? null : appointmentId || null}
          onClose={() => setWriting(null)}
          onSaved={() => { setWriting(null); load(); onSaved?.(writing.amend ? "Enmienda guardada" : "Evolución guardada"); }} />
      )}
    </div>
  );
}

function NoteForm({ patientId, amend, appointmentId, onClose, onSaved }: {
  patientId: number; amend?: ClinicalNote; appointmentId: number | null; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState(() => amend ? {
    reason: "", anamnesis: amend.anamnesis || "", exam: amend.exam || "", diagnosis: amend.diagnosis || "",
    diagnosis_code: amend.diagnosis_code || "", plan: amend.plan || "",
  } : { ...EMPTY });
  const [vitals, setVitals] = useState<Record<string, string>>(amend ? { ...amend.vitals } : {});
  const [markDone, setMarkDone] = useState(!!appointmentId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof EMPTY, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setError("");
    if (amend && !f.reason.trim()) return setError("Contá brevemente qué se corrige");
    setSaving(true);
    try {
      const body = {
        appointment_id: appointmentId,
        reason: strOrNull(f.reason), anamnesis: strOrNull(f.anamnesis), exam: strOrNull(f.exam),
        diagnosis: strOrNull(f.diagnosis), diagnosis_code: strOrNull(f.diagnosis_code), plan: strOrNull(f.plan),
        vitals: Object.fromEntries(Object.entries(vitals).filter(([, v]) => v.trim())),
      };
      await appApi(amend ? `/patients/${patientId}/notes/${amend.id}/amend` : `/patients/${patientId}/notes`, { method: "POST", body });
      if (markDone && appointmentId) {
        await appApi(`/appointments/${appointmentId}/status`, { method: "POST", body: { status: "ATENDIDO" } }).catch(() => {});
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal eyebrow={amend ? "ENMIENDA" : "NUEVA EVOLUCIÓN"} title={amend ? `Corregir la evolución del ${dateTime(amend.created_at)}` : "Evolución"} onClose={onClose} size="wide"
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Firmar y guardar"}</button>
      </>}>
      <div className="product-form">
        {amend && <div className="mr-note mr-note-warn" style={{ marginBottom: 12 }}>La evolución original no se modifica: esta enmienda queda agregada y vinculada a ella.</div>}
        {!amend && (
          <TemplateBar kind="EVOLUCION" getPayload={() => ({ ...f })}
            onApply={(p) => setF((x) => {
              const next = { ...x };
              (Object.keys(EMPTY) as (keyof typeof EMPTY)[]).forEach((k) => { if (typeof p[k] === "string" && p[k]) next[k] = p[k]; });
              return next;
            })} />
        )}
        <Field label={amend ? "¿Qué se corrige?" : "Motivo de consulta"}>
          <input value={f.reason} onChange={(e) => set("reason", e.target.value)} placeholder={amend ? "Ej. error en la dosis indicada" : "Ej. control de presión"} autoFocus />
        </Field>
        <h4 className="mr-form-title">Signos vitales</h4>
        <div className="mr-vitals-form">
          {VITALS.map((v) => (
            <Field key={v.key} label={`${v.label} (${v.unit})`}>
              <input value={vitals[v.key] || ""} placeholder={v.placeholder} onChange={(e) => setVitals({ ...vitals, [v.key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <Field label="Anamnesis / enfermedad actual"><textarea rows={3} value={f.anamnesis} onChange={(e) => set("anamnesis", e.target.value)} /></Field>
        <Field label="Examen físico"><textarea rows={3} value={f.exam} onChange={(e) => set("exam", e.target.value)} /></Field>
        <div className="form-row">
          <Field label="Diagnóstico"><input value={f.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} /></Field>
          <Field label="Código CIE-10" hint="Opcional, ej. I10"><input value={f.diagnosis_code} onChange={(e) => set("diagnosis_code", e.target.value.toUpperCase())} maxLength={15} /></Field>
        </div>
        <Field label="Plan / indicaciones"><textarea rows={3} value={f.plan} onChange={(e) => set("plan", e.target.value)} /></Field>
        {appointmentId && (
          <div className="mr-inline-checks"><label><input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} /> Marcar el turno como atendido</label></div>
        )}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
