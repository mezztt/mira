import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { appApi, dateTime, shortDate, longDate, FILE_CATEGORIES, VITALS } from "../../config";
import type { ClinicalNote, Patient } from "../../config";
import { Loading } from "../../components/ui";
import { PrintToolbar, SheetHead } from "./PrintDocumento";

interface FileRow { id: number; name: string; category: string; created_at: string; voided: boolean; note: string | null }
interface RecordData { patient: Patient; notes: ClinicalNote[]; chain_ok: boolean; files?: FileRow[] }
interface Company { name: string; address: string | null; city: string | null; phone: string | null; email: string | null; cuit: string | null }

function PrintHC() {
  const { id } = useParams();
  const [rec, setRec] = useState<RecordData | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    // copia=1: queda registrado en la auditoría como copia impresa para el paciente
    appApi<RecordData>(`/patients/${id}/record?copia=1`).then(setRec).catch((e) => setError(e.message));
    appApi<Company>("/company").then(setCompany).catch(() => {});
  }, [id]);
  useEffect(() => { if (rec) document.title = `Historia clínica · ${rec.patient.full_name}`; }, [rec]);

  if (error) return <div className="mr-print-page"><div className="mr-note mr-note-error">{error}</div></div>;
  if (!rec || !company) return <Loading />;
  const p = rec.patient;
  const notes = [...rec.notes].reverse(); // cronológico

  return (
    <div className="mr-print-page">
      <PrintToolbar title="Historia clínica" />
      <div className="mr-sheet">
        <SheetHead company={company} right={<><strong>HISTORIA CLÍNICA</strong><small>Copia del {longDate(new Date())}</small></>} />
        <div className="mr-sheet-meta">
          <div><small>Paciente</small>{p.last_name}, {p.first_name}</div>
          <div><small>DNI</small>{p.dni || "—"}</div>
          <div><small>Nacimiento</small>{p.birth_date ? `${shortDate(p.birth_date)} (${p.age} años)` : "—"}</div>
          <div><small>Cobertura</small>{p.insurance_name || "Particular"}{p.insurance_number ? ` · ${p.insurance_number}` : ""}</div>
          <div><small>Alergias</small>{p.allergies || "No informa"}</div>
          <div><small>Antecedentes</small>{[p.chronic, p.background].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        {notes.length === 0 ? <p>Sin evoluciones registradas.</p> : notes.map((n) => (
          <div key={n.id} className="mr-entry" style={{ marginBottom: 10, boxShadow: "none" }}>
            <header>
              <div><strong>{n.kind === "ENMIENDA" ? "Enmienda" : n.reason || "Evolución"}</strong>
                <small>{dateTime(n.created_at)} · {n.professional_name}{n.professional_license ? ` · MP ${n.professional_license}` : ""}</small></div>
              {n.diagnosis_code && <small>CIE-10 {n.diagnosis_code}</small>}
            </header>
            {Object.keys(n.vitals || {}).length > 0 && (
              <p style={{ margin: "0 0 6px", fontSize: 12.5 }}>{VITALS.filter((v) => n.vitals[v.key]).map((v) => `${v.label}: ${n.vitals[v.key]} ${v.unit}`).join(" · ")}</p>
            )}
            <dl>
              {n.kind === "ENMIENDA" && n.reason && <><dt>Corrige</dt><dd>{n.reason}</dd></>}
              {n.anamnesis && <><dt>Anamnesis</dt><dd>{n.anamnesis}</dd></>}
              {n.exam && <><dt>Examen</dt><dd>{n.exam}</dd></>}
              {n.diagnosis && <><dt>Diagnóstico</dt><dd>{n.diagnosis}</dd></>}
              {n.plan && <><dt>Plan</dt><dd>{n.plan}</dd></>}
            </dl>
            <footer><span>Registro #{n.id}</span><span className="mr-hash">{n.content_hash.slice(0, 16)}</span></footer>
          </div>
        ))}
        {rec.files && rec.files.length > 0 && (
          <>
            <h2>Estudios y archivos adjuntos</h2>
            <table>
              <thead><tr><th>Fecha</th><th>Archivo</th><th>Tipo</th><th>Nota</th></tr></thead>
              <tbody>
                {rec.files.map((f) => (
                  <tr key={f.id} style={f.voided ? { textDecoration: "line-through" } : undefined}>
                    <td>{dateTime(f.created_at)}</td><td>{f.name}{f.voided ? " (anulado)" : ""}</td>
                    <td>{FILE_CATEGORIES[f.category] || f.category}</td><td>{f.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: "#48616b", margin: "6px 0 0" }}>Los archivos se consultan en el sistema; no se incluyen en esta copia.</p>
          </>
        )}
        <div className="mr-sheet-foot">
          <span>{rec.chain_ok ? "Registro íntegro (verificación de cadena OK)" : "ATENCIÓN: la verificación de integridad falló"} · Copia para el paciente (Ley 26.529)</span>
          <span>MIRA · by Mezztt</span>
        </div>
      </div>
    </div>
  );
}

export default PrintHC;
