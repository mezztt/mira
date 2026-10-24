import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, getSessionUser, shortDate } from "../../../config";
import type { InsuranceItem, PatientLite } from "../../../config";
import { Empty, Loading, PageHeader, Pill, useFlash } from "../../../components/ui";
import PatientForm from "../../../components/PatientForm";
import ImportModal, { PATIENT_IMPORT_FIELDS } from "../../../components/ImportModal";

const PAGE = 50;

function Pacientes() {
  const navigate = useNavigate();
  const user = getSessionUser();
  const [q, setQ] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [inactive, setInactive] = useState(false);
  const [data, setData] = useState<{ total: number; items: PatientLite[] } | null>(null);
  const [page, setPage] = useState(0);
  const [insurances, setInsurances] = useState<InsuranceItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reload, setReload] = useState(0);
  const { show, node: flash } = useFlash();
  const canImport = user?.role === "ADMINISTRADOR" || user?.role === "RECEPCION";

  useEffect(() => { appApi<InsuranceItem[]>("/insurances").then(setInsurances).catch(() => {}); }, [reload]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const params = new URLSearchParams({ q: q.trim(), limit: String(PAGE), offset: String(page * PAGE) });
      if (insuranceId) params.set("insurance_id", insuranceId);
      if (inactive) params.set("include_inactive", "true");
      appApi<{ total: number; items: PatientLite[] }>(`/patients?${params}`).then(setData).catch(() => setData({ total: 0, items: [] }));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, insuranceId, inactive, page, reload]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="PACIENTES" title="Pacientes" subtitle={data ? `${data.total} pacientes${insuranceId || q ? " encontrados" : ""}` : "Nómina de pacientes del consultorio"}>
        {canImport && <button className="secondary-button" onClick={() => setImporting(true)}>Importar desde Excel</button>}
        <button className="primary-button" onClick={() => setCreating(true)}>+ Nuevo paciente</button>
      </PageHeader>

      <div className="mr-toolbar">
        <input className="mr-search" style={{ flex: 1, maxWidth: 460 }} placeholder="Buscar por nombre, apellido, DNI o teléfono…" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }} autoFocus />
        <div className="mr-filters">
          <select value={insuranceId} onChange={(e) => { setInsuranceId(e.target.value); setPage(0); }}>
            <option value="">Todas las coberturas</option>
            {insurances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          {user?.role === "ADMINISTRADOR" && (
            <label className="mr-inline-checks" style={{ paddingTop: 0 }}>
              <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Ver inactivos
            </label>
          )}
        </div>
      </div>

      {!data ? <Loading /> : data.items.length === 0 ? (
        <Empty title={q ? "No encontramos pacientes con esa búsqueda" : "Todavía no hay pacientes"}>
          Se crean solos al dar un turno, o cargalos con “Nuevo paciente”{canImport ? " o “Importar desde Excel”" : ""}.
        </Empty>
      ) : (
        <>
          <div className="mr-table-wrap">
            <table className="mr-table">
              <thead><tr><th>Paciente</th><th>DNI</th><th>Edad</th><th>Cobertura</th><th>Contacto</th><th></th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="is-click" onClick={() => navigate(`/app/pacientes/${p.id}`)}>
                    <td><strong>{p.full_name}</strong>{p.birth_date && <small>Nació {shortDate(p.birth_date)}</small>}</td>
                    <td>{p.dni || "—"}</td>
                    <td>{p.age !== null ? `${p.age} años` : "—"}</td>
                    <td>{p.insurance_name || "Particular"}{p.insurance_number && <small>Afiliado {p.insurance_number}</small>}</td>
                    <td>{p.phone || "—"}{p.email && <small>{p.email}</small>}</td>
                    <td className="num">
                      {p.allergies && <Pill tone="red">Alergias</Pill>}{" "}
                      {p.source === "WEB" && <Pill tone="blue">Web</Pill>}{" "}
                      {!p.active && <Pill tone="gray">Inactivo</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > PAGE && (
            <div className="mr-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Anteriores</button>
              <span className="mr-muted">Página {page + 1} de {Math.ceil(data.total / PAGE)}</span>
              <button className="secondary-button" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)}>Siguientes ›</button>
            </div>
          )}
        </>
      )}

      {creating && (
        <PatientForm insurances={insurances} onClose={() => setCreating(false)}
          onSaved={(p) => { setCreating(false); navigate(`/app/pacientes/${p.id}`); }} />
      )}
      {importing && (
        <ImportModal title="Importar pacientes" what="pacientes" fields={PATIENT_IMPORT_FIELDS} endpoint="/patients/import"
          matchHint="Si el DNI ya existe se actualiza ese paciente (sin borrar lo que ya tenía); si la obra social no existe, se crea."
          onClose={() => setImporting(false)}
          onDone={(summary) => { setImporting(false); setPage(0); setReload((n) => n + 1); show(`Importación lista: ${summary}`); }} />
      )}
      {flash}
    </section>
  );
}

export default Pacientes;
