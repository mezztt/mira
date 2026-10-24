import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { appApi, dateTime, longDate, shortDate, DOC_KINDS } from "../../config";
import type { MedDoc } from "../../config";
import { MiraLogo } from "../../components/Brand";
import { Loading } from "../../components/ui";

interface DocFull extends MedDoc {
  patient: { name: string; dni: string | null; birth_date: string | null; insurance: string | null; insurance_number: string | null };
  company: { name: string; address: string | null; city: string | null; phone: string | null; email: string | null };
}

export function PrintToolbar({ title }: { title: string }) {
  return (
    <div className="mr-print-toolbar">
      <button className="secondary-button" onClick={() => window.close()}>Cerrar</button>
      <span className="mr-muted" style={{ alignSelf: "center" }}>{title}</span>
      <button className="primary-button" onClick={() => window.print()}>Imprimir / guardar PDF</button>
    </div>
  );
}

export function SheetHead({ company, right }: { company: { name: string; address?: string | null; city?: string | null; phone?: string | null; email?: string | null; cuit?: string | null }; right: ReactNode }) {
  return (
    <div className="mr-sheet-head">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <MiraLogo size={40} />
        <div>
          <h1>{company.name}</h1>
          <small>{[company.address, company.city].filter(Boolean).join(", ")}</small>
          <small>{[company.phone, company.email, company.cuit ? `CUIT ${company.cuit}` : ""].filter(Boolean).join(" · ")}</small>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>{right}</div>
    </div>
  );
}

function PrintDocumento() {
  const { id } = useParams();
  const [d, setD] = useState<DocFull | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { appApi<DocFull>(`/documents/${id}`).then(setD).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => { if (d) document.title = `${DOC_KINDS[d.kind]} · ${d.patient.name}`; }, [d]);

  if (error) return <div className="mr-print-page"><div className="mr-note mr-note-error">{error}</div></div>;
  if (!d) return <Loading />;
  const date = new Date(d.created_at);
  // recetas y órdenes de estudios: la válida es la electrónica de una plataforma registrada; esto es una constancia
  const electronic = d.kind === "RECETA" || d.kind === "ESTUDIOS";

  return (
    <div className="mr-print-page">
      <PrintToolbar title={DOC_KINDS[d.kind]} />
      <div className="mr-sheet">
        <SheetHead company={d.company} right={<><strong>{(DOC_KINDS[d.kind] || d.kind).toUpperCase()}</strong>{electronic && <small>Constancia de indicación médica · no es receta electrónica</small>}<small>{longDate(date)}</small></>} />
        {electronic && (
          <div className="mr-rx-legal">
            <strong>Constancia de indicación médica.</strong>{" "}
            {d.kind === "RECETA"
              ? "Este impreso NO es una receta electrónica ni equivale a una: no sirve para retirar medicamentos. La receta válida para la dispensa es la electrónica emitida por una plataforma registrada (ReNaPDiS)."
              : "Este impreso NO es una orden electrónica ni equivale a una: no sirve para pedir estudios ni prácticas. La orden válida es la electrónica emitida por una plataforma registrada (ReNaPDiS)."}
            {(d.rx_number || d.rx_url) && (
              <span className="mr-rx-legal-num">
                {d.rx_number && <>N° de {d.kind === "RECETA" ? "receta" : "orden"} electrónica (CUIR): <b>{d.rx_number}</b></>}
                {d.rx_number && d.rx_url && " · "}
                {d.rx_url && <>Enlace: {d.rx_url}</>}
              </span>
            )}
          </div>
        )}
        <div className="mr-sheet-meta">
          <div><small>Paciente</small>{d.patient.name}</div>
          <div><small>DNI</small>{d.patient.dni || "—"}</div>
          <div><small>Cobertura</small>{d.patient.insurance || "Particular"}{d.patient.insurance_number ? ` · ${d.patient.insurance_number}` : ""}</div>
          <div><small>Nacimiento</small>{d.patient.birth_date ? shortDate(d.patient.birth_date) : "—"}</div>
        </div>
        {d.kind === "RECETA" && <div className="mr-rx">Rp/</div>}
        {d.title && <h2>{d.title}</h2>}
        {d.items.length > 0 && (
          <ol>
            {d.items.map((it, i) => <li key={i}><strong>{it.name}</strong>{it.detail ? <div>{it.detail}</div> : null}</li>)}
          </ol>
        )}
        {d.body && <p style={{ whiteSpace: "pre-line" }}>{d.body}</p>}
        {d.diagnosis && <p><strong>Diagnóstico:</strong> {d.diagnosis}</p>}
        <div className="mr-signature-line">
          <div>
            <strong>{d.professional_name}</strong><br />
            {d.professional_specialty}{d.professional_license ? ` · MP ${d.professional_license}` : ""}
          </div>
        </div>
        <div className="mr-sheet-foot">
          <span>Emitido {dateTime(d.created_at)} · registro #{d.id}</span>
          <span>MIRA · by Mezztt</span>
        </div>
        {electronic && (
          <p className="mr-legal" style={{ marginTop: 10 }}>Ley 27.553 · Decretos 98/2023 y 345/2024 · Res. 2214/2025. Este impreso no tiene el valor legal de la receta ni de la orden electrónica y no las reemplaza.</p>
        )}
      </div>
    </div>
  );
}

export default PrintDocumento;
