import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, dateTime } from "../../config";
import type { ToothEntry } from "../../config";
import { Empty, Loading, Pill, Seg } from "../ui";

// Numeración FDI, en el orden en que se ve el odontograma (derecha del paciente a la izquierda de la pantalla)
const PERM_UP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const PERM_DOWN = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const TEMP_UP = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const TEMP_DOWN = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

const SURFACE_CONDS: Record<string, string> = { CARIES: "Caries", OBTURACION: "Obturación / arreglo", SELLADOR: "Sellador" };
const TOOTH_CONDS: Record<string, string> = {
  EXTRACCION: "Extracción", AUSENTE: "Ausente", CORONA: "Corona", ENDODONCIA: "Endodoncia",
  IMPLANTE: "Implante", PROTESIS: "Prótesis", PERNO: "Perno", FRACTURA: "Fractura",
};
const ALL_LABELS: Record<string, string> = { ...SURFACE_CONDS, ...TOOTH_CONDS, SANO: "Sano / limpiar" };
const STATUS_LABEL: Record<string, string> = { PENDIENTE: "A realizar", REALIZADO: "Realizado", EXISTENTE: "Existente" };
const SURF_NAMES: Record<string, string> = { O: "Oclusal / incisal", M: "Mesial", D: "Distal", V: "Vestibular", L: "Lingual / palatino" };

interface Data { current: ToothEntry[]; history: ToothEntry[]; can_write: boolean }
interface Draft { tooth: number; surface: string | null; condition: string; status: string; notes: string | null }

const colorClass = (status: string) => (status === "PENDIENTE" ? "c-red" : "c-blue");

/** caras según cuadrante: arriba V en el maxilar superior, L en el inferior; mesial hacia la línea media */
function faceLayout(tooth: number) {
  const q = Math.floor(tooth / 10);
  const upper = [1, 2, 5, 6].includes(q);
  const rightSide = [1, 4, 5, 8].includes(q); // lado derecho del paciente = izquierda de la pantalla
  return { top: upper ? "V" : "L", bottom: upper ? "L" : "V", left: rightSide ? "D" : "M", right: rightSide ? "M" : "D" };
}

function Tooth({ n, entries, selected, onClick }: { n: number; entries: ToothEntry[]; selected: boolean; onClick: () => void }) {
  const L = faceLayout(n);
  const face = (s: string) => {
    const e = entries.find((x) => x.surface === s);
    return `face ${e ? colorClass(e.status) : ""}`;
  };
  const whole = entries.filter((x) => !x.surface);
  const mark = (c: string) => whole.find((x) => x.condition === c);
  const ext = mark("EXTRACCION") || mark("AUSENTE");
  const crown = mark("CORONA");
  const endo = mark("ENDODONCIA");
  const letters = whole.filter((x) => ["IMPLANTE", "PROTESIS", "PERNO", "FRACTURA"].includes(x.condition));
  const stroke = (e?: ToothEntry) => (e?.status === "PENDIENTE" ? "#d03b3b" : "#2f6fd0");
  return (
    <button type="button" className={`mr-tooth ${selected ? "is-sel" : ""}`} onClick={onClick} title={`Pieza ${n}`}>
      <b>{n}</b>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <polygon className={face(L.top)} points="2,2 34,2 25,11 11,11" />
        <polygon className={face(L.bottom)} points="2,34 34,34 25,25 11,25" />
        <polygon className={face(L.left)} points="2,2 11,11 11,25 2,34" />
        <polygon className={face(L.right)} points="34,2 25,11 25,25 34,34" />
        <rect className={face("O")} x="11" y="11" width="14" height="14" />
        {crown && <circle cx="18" cy="18" r="16.5" fill="none" stroke={stroke(crown)} strokeWidth="2.4" />}
        {endo && <line x1="18" y1="3" x2="18" y2="33" stroke={stroke(endo)} strokeWidth="3" />}
        {ext && <g stroke={stroke(ext)} strokeWidth="3" strokeLinecap="round"><line x1="4" y1="4" x2="32" y2="32" /><line x1="32" y1="4" x2="4" y2="32" /></g>}
      </svg>
      <b style={{ minHeight: 14, color: letters.some((x) => x.status === "PENDIENTE") ? "var(--mr-red-text)" : "var(--mr-blue-text)" }}>
        {letters.map((x) => ({ IMPLANTE: "I", PROTESIS: "P", PERNO: "Pe", FRACTURA: "F" } as Record<string, string>)[x.condition]).join(" ")}
      </b>
    </button>
  );
}

export default function Odontograma({ patientId, onSaved }: { patientId: number; onSaved?: (msg: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [dentition, setDentition] = useState<"perm" | "temp" | "mixta">("perm");
  const [sel, setSel] = useState<number | null>(null);
  const [cond, setCond] = useState("CARIES");
  const [surfaces, setSurfaces] = useState<string[]>(["O"]);
  const [status, setStatus] = useState("PENDIENTE");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    appApi<Data>(`/patients/${patientId}/odontogram`).then((d) => {
      setData(d);
      if (d.current.some((e) => e.tooth > 50)) setDentition((x) => (x === "perm" ? "mixta" : x));
    }).catch((e) => setError(e.message));
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  // lo actual + lo que está por guardarse (como vista previa)
  const preview = useMemo(() => {
    const map = new Map<string, ToothEntry>();
    (data?.current || []).forEach((e) => map.set(`${e.tooth}-${e.surface || "X"}`, e));
    drafts.forEach((d, i) => {
      if (d.condition === "SANO") {
        [...map.keys()].filter((k) => k.startsWith(`${d.tooth}-`) && (!d.surface || k === `${d.tooth}-${d.surface}`)).forEach((k) => map.delete(k));
      } else {
        map.set(`${d.tooth}-${d.surface || "X"}`, { id: -1 - i, tooth: d.tooth, surface: d.surface, condition: d.condition, status: d.status as ToothEntry["status"], notes: d.notes, professional_name: null, created_at: "" });
      }
    });
    const byTooth: Record<number, ToothEntry[]> = {};
    map.forEach((e) => { (byTooth[e.tooth] ||= []).push(e); });
    return byTooth;
  }, [data, drafts]);

  if (error) return <div className="mr-note mr-note-error">{error}</div>;
  if (!data) return <Loading />;

  const isSurface = cond in SURFACE_CONDS;
  function addDraft() {
    if (!sel) return;
    const base = { tooth: sel, condition: cond, status: cond === "SANO" ? "REALIZADO" : status, notes: notes.trim() || null };
    const list: Draft[] = isSurface ? surfaces.map((s) => ({ ...base, surface: s })) : [{ ...base, surface: null }];
    setDrafts([...drafts, ...list]);
    setNotes("");
  }
  async function save() {
    setSaving(true);
    try {
      const d = await appApi<Data>(`/patients/${patientId}/odontogram`, { method: "POST", body: { entries: drafts } });
      setData(d);
      setDrafts([]);
      onSaved?.("Odontograma guardado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const rows = dentition === "perm" ? [[PERM_UP], [PERM_DOWN]] : dentition === "temp" ? [[TEMP_UP], [TEMP_DOWN]] : [[PERM_UP], [TEMP_UP], [TEMP_DOWN], [PERM_DOWN]];
  const selEntries = sel ? data.history.filter((e) => e.tooth === sel) : [];

  return (
    <div>
      <div className="mr-toolbar">
        <Seg value={dentition} onChange={setDentition} options={[["perm", "Permanente"], ["temp", "Temporaria"], ["mixta", "Mixta"]]} />
        <div className="mr-odonto-legend">
          <span><i style={{ background: "#e05252" }} />A realizar</span>
          <span><i style={{ background: "#2f6fd0" }} />Realizado / existente</span>
          <span>✕ extracción/ausente · ◯ corona · │ endodoncia · I implante · P prótesis</span>
        </div>
      </div>

      <div className={data.can_write ? "mr-odonto-panel" : ""}>
        <div className="mr-card">
          <div className="mr-odonto">
            {rows.map(([teeth], i) => (
              <div key={i} className="mr-odonto-row">
                <div className="mr-odonto-half">{teeth.slice(0, teeth.length / 2).map((n) => <Tooth key={n} n={n} entries={preview[n] || []} selected={sel === n} onClick={() => setSel(n)} />)}</div>
                <div className="mr-odonto-half">{teeth.slice(teeth.length / 2).map((n) => <Tooth key={n} n={n} entries={preview[n] || []} selected={sel === n} onClick={() => setSel(n)} />)}</div>
              </div>
            ))}
          </div>
          {drafts.length > 0 && (
            <div className="mr-sticky-actions">
              <span><strong>{drafts.length} cambio(s) sin guardar</strong></span>
              <div className="mr-row">
                <button className="secondary-button" onClick={() => setDrafts([])}>Descartar</button>
                <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar odontograma"}</button>
              </div>
            </div>
          )}
        </div>

        {data.can_write && (
          <div className="mr-card">
            {!sel ? <Empty title="Elegí una pieza">Tocá un diente para cargar caries, arreglos, extracciones, etc.</Empty> : (
              <div className="mr-stack">
                <h2>Pieza {sel}</h2>
                <div className="mr-cond-grid">
                  {Object.entries(ALL_LABELS).map(([k, l]) => (
                    <button key={k} type="button" className={`mr-cond ${cond === k ? "is-on" : ""}`} onClick={() => setCond(k)}>{l}</button>
                  ))}
                </div>
                {isSurface && (
                  <div>
                    <small className="mr-muted">Caras</small>
                    <div className="mr-surface-pick" style={{ marginTop: 6 }}>
                      {["O", "M", "D", "V", "L"].map((s) => (
                        <button key={s} type="button" title={SURF_NAMES[s]} className={surfaces.includes(s) ? "is-on" : ""}
                          onClick={() => setSurfaces(surfaces.includes(s) ? surfaces.filter((x) => x !== s) : [...surfaces, s])}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {cond !== "SANO" && (
                  <Seg value={status} onChange={setStatus} options={Object.entries(STATUS_LABEL) as [string, string][]} />
                )}
                <input className="mr-search" placeholder="Nota (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <button className="primary-button" onClick={addDraft} disabled={isSurface && surfaces.length === 0}>Agregar a la pieza {sel}</button>
                {selEntries.length > 0 && (
                  <ul className="mr-list">
                    {selEntries.slice(0, 8).map((e) => (
                      <li key={e.id}><div className="mr-list-main">
                        <strong>{ALL_LABELS[e.condition] || e.condition}{e.surface ? ` · ${e.surface}` : ""}</strong>
                        <small>{STATUS_LABEL[e.status]} · {dateTime(e.created_at)} · {e.professional_name}</small>
                      </div></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mr-card" style={{ marginTop: 16 }}>
        <div className="mr-card-head"><div><h2>Historial odontológico</h2><p>Todo lo cargado, en orden. No se borra: para corregir, se carga el estado nuevo.</p></div></div>
        {data.history.length === 0 ? <Empty title="Sin registros todavía" /> : (
          <div className="mr-table-wrap">
            <table className="mr-table">
              <thead><tr><th>Fecha</th><th>Pieza</th><th>Cara</th><th>Hallazgo</th><th>Estado</th><th>Profesional</th><th>Nota</th></tr></thead>
              <tbody>
                {data.history.map((e) => (
                  <tr key={e.id}>
                    <td>{dateTime(e.created_at)}</td><td><strong>{e.tooth}</strong></td><td>{e.surface || "—"}</td>
                    <td>{ALL_LABELS[e.condition] || e.condition}</td>
                    <td><Pill tone={e.status === "PENDIENTE" ? "red" : "blue"}>{STATUS_LABEL[e.status]}</Pill></td>
                    <td>{e.professional_name}</td><td>{e.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
