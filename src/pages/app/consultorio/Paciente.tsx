import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  appApi, canAccess, getSessionUser, dateTime, initials, money, shortDate, APPT_KINDS, APPT_STATUS, CHARGE_KINDS, PAYMENT_LABELS,
} from "../../../config";
import type { ApptStatus, InsuranceItem, Patient, Professional } from "../../../config";
import { Empty, Loading, Pill, Tabs, useFlash } from "../../../components/ui";
import PatientForm from "../../../components/PatientForm";
import ChargeModal from "../../../components/ChargeModal";
import HistoriaClinica from "../../../components/clinical/HistoriaClinica";
import Odontograma from "../../../components/clinical/Odontograma";
import Documentos from "../../../components/clinical/Documentos";
import Archivos from "../../../components/clinical/Archivos";
import BudgetsView from "../../../components/budgets/BudgetsView";
import { toneOf } from "../Inicio";

interface Detail extends Patient {
  stats: { attended: number; absent: number; cancelled: number };
  appointments: { id: number; start_at: string; professional_name: string | null; status: ApptStatus; kind: string; reason: string | null; code: string }[];
  charges: { id: number; date: string; kind: string; concept: string; amount: number; method: string | null; os_status: string | null; insurance_name: string | null }[];
}
type Tab = "datos" | "hc" | "archivos" | "odonto" | "docs" | "presupuestos" | "turnos" | "cobros" | "accesos";

const ACTIONS: Record<string, string> = {
  VER_HC: "Abrió la historia clínica", NUEVA_EVOLUCION: "Escribió una evolución", ENMIENDA: "Agregó una enmienda",
  VER_ODONTOGRAMA: "Abrió el odontograma", ODONTOGRAMA: "Cargó el odontograma", NUEVO_DOCUMENTO: "Emitió un documento",
  COPIA_HC: "Imprimió una copia de la historia clínica", VER_DOCUMENTO: "Abrió un documento para imprimir",
  VER_ARCHIVOS: "Abrió los estudios y archivos", SUBIR_ARCHIVO: "Subió un archivo", VER_ARCHIVO: "Abrió un archivo", ANULAR_ARCHIVO: "Anuló un archivo",
};

function Paciente() {
  const { id } = useParams();
  const patientId = Number(id);
  const navigate = useNavigate();
  const user = getSessionUser();
  const [params] = useSearchParams();
  const { show, node: flash } = useFlash();

  const canHC = canAccess(user, "historia_clinica");
  const canOdonto = canAccess(user, "odontologia");
  const canDocs = canAccess(user, "documentos");
  const canCharge = canAccess(user, "cobros");
  const canBudgets = canAccess(user, "presupuestos");
  const isAdmin = user?.role === "ADMINISTRADOR";

  const initialTab = (params.get("tab") as Tab) || (canHC && user?.role === "PROFESIONAL" ? "hc" : "datos");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [charging, setCharging] = useState(false);
  const [insurances, setInsurances] = useState<InsuranceItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [audit, setAudit] = useState<{ id: number; action: string; user_name: string | null; created_at: string; detail?: string | null }[] | null>(null);

  const load = useCallback(() => {
    appApi<Detail>(`/patients/${patientId}`).then(setData).catch((e) => setError(e.message));
  }, [patientId]);
  useEffect(() => {
    load();
    appApi<InsuranceItem[]>("/insurances").then(setInsurances).catch(() => {});
    appApi<Professional[]>("/professionals").then(setProfessionals).catch(() => {});
  }, [load]);
  useEffect(() => {
    if (tab === "accesos") appApi<typeof audit>(`/patients/${patientId}/audit`).then(setAudit).catch(() => setAudit([]));
  }, [tab, patientId]);

  if (error) return <div className="mr-note mr-note-error">{error}</div>;
  if (!data) return <Loading />;

  const tabs: [Tab, string][] = [["datos", "Ficha"]];
  if (canHC) tabs.push(["hc", "Historia clínica"]);
  if (canHC) tabs.push(["archivos", "Estudios y archivos"]);
  if (canOdonto) tabs.push(["odonto", "Odontograma"]);
  if (canDocs) tabs.push(["docs", "Recetas y documentos"]);
  if (canBudgets) tabs.push(["presupuestos", "Presupuestos"]);
  tabs.push(["turnos", `Turnos (${data.appointments.length})`]);
  if (canCharge) tabs.push(["cobros", "Cobros"]);
  if (canHC && isAdmin) tabs.push(["accesos", "Accesos"]);

  return (
    <section className="products-page">
      <button className="mr-link" onClick={() => navigate("/app/pacientes")} style={{ marginBottom: 12 }}>‹ Pacientes</button>
      <div className="mr-patient-head">
        <span className="mr-avatar">{initials(`${data.first_name} ${data.last_name}`)}</span>
        <div style={{ minWidth: 0 }}>
          <h1>{data.first_name} {data.last_name}</h1>
          <div className="mr-patient-meta">
            {data.age !== null && <span><b>{data.age}</b> años</span>}
            {data.dni && <span>DNI <b>{data.dni}</b></span>}
            <span><b>{data.insurance_name || "Particular"}</b>{data.insurance_number ? ` · ${data.insurance_number}` : ""}{data.insurance_plan ? ` · plan ${data.insurance_plan}` : ""}</span>
            {data.phone && <span>☎ {data.phone}</span>}
            {data.blood_type && <span>Grupo <b>{data.blood_type}</b></span>}
          </div>
          <div className="mr-alerts">
            {data.allergies && <span className="mr-alert-chip">⚠ Alergias: {data.allergies}</span>}
            {data.chronic && <span className="mr-alert-chip is-info">{data.chronic}</span>}
            {data.medications && <span className="mr-alert-chip is-info">Medicación: {data.medications}</span>}
            {!data.active && <Pill tone="gray">Inactivo</Pill>}
          </div>
        </div>
        <div className="mr-head-actions">
          <button className="secondary-button" onClick={() => setEditing(true)}>Editar ficha</button>
          {canAccess(user, "agenda") && <button className="secondary-button" onClick={() => navigate("/app/agenda?nuevo=1")}>Dar turno</button>}
          {canCharge && <button className="primary-button" onClick={() => setCharging(true)}>Cobrar</button>}
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} options={tabs} />

      {tab === "datos" && (
        <div className="mr-grid-2">
          <div className="mr-card">
            <h2>Datos personales</h2>
            <div className="mr-info-grid" style={{ marginTop: 12 }}>
              <div><small>Nacimiento</small><span>{data.birth_date ? shortDate(data.birth_date) : "—"}</span></div>
              <div><small>Sexo</small><span>{({ F: "Femenino", M: "Masculino", X: "X / otro" } as Record<string, string>)[data.sex || ""] || "—"}</span></div>
              <div><small>Email</small><span>{data.email || "—"}</span></div>
              <div><small>Domicilio</small><span>{[data.address, data.city].filter(Boolean).join(", ") || "—"}</span></div>
              <div><small>Emergencias</small><span>{data.emergency_contact || "—"}</span></div>
              <div><small>Alta</small><span>{data.created_at ? shortDate(data.created_at) : "—"}{data.source === "WEB" ? " · por la web" : ""}</span></div>
              {data.notes && <div><small>Notas</small><span>{data.notes}</span></div>}
            </div>
          </div>
          <div className="mr-card">
            <h2>Salud</h2>
            <div className="mr-info-grid" style={{ marginTop: 12 }}>
              <div><small>Alergias</small><span>{data.allergies || "No informa"}</span></div>
              <div><small>Crónicas</small><span>{data.chronic || "—"}</span></div>
              <div><small>Medicación habitual</small><span>{data.medications || "—"}</span></div>
              <div style={{ gridColumn: "1 / -1" }}><small>Antecedentes</small><span>{data.background || "—"}</span></div>
            </div>
            <div className="mr-kpis" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="mr-kpi"><span>Atendido</span><strong>{data.stats.attended}</strong><small>veces</small></div>
              <div className={`mr-kpi ${data.stats.absent ? "is-warn" : ""}`}><span>Ausencias</span><strong>{data.stats.absent}</strong><small>{data.stats.cancelled} cancelados</small></div>
            </div>
          </div>
        </div>
      )}

      {tab === "hc" && canHC && (
        <HistoriaClinica patientId={patientId} appointmentId={Number(params.get("turno")) || null}
          onSaved={(m) => { show(m); load(); }} onPrint={() => window.open(`/print/hc/${patientId}`, "_blank")} />
      )}
      {tab === "archivos" && canHC && <Archivos patientId={patientId} onSaved={show} />}
      {tab === "presupuestos" && canBudgets && (
        <BudgetsView patientId={patientId} patientName={`${data.first_name} ${data.last_name}`} onChanged={load} />
      )}
      {tab === "odonto" && canOdonto && <Odontograma patientId={patientId} onSaved={show} />}
      {tab === "docs" && canDocs && <Documentos patientId={patientId} canWrite={user?.role === "PROFESIONAL" || !!user?.professional_id} onSaved={show} />}

      {tab === "turnos" && (data.appointments.length === 0 ? <Empty title="Sin turnos" /> : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>Fecha</th><th>Profesional</th><th>Tipo</th><th>Motivo</th><th>Estado</th></tr></thead>
            <tbody>
              {data.appointments.map((a) => (
                <tr key={a.id}>
                  <td>{dateTime(a.start_at)}</td><td>{a.professional_name}</td><td>{APPT_KINDS[a.kind] || a.kind}</td>
                  <td>{a.reason || "—"}</td><td><Pill tone={toneOf(a.status)}>{APPT_STATUS[a.status]?.label || a.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tab === "cobros" && (data.charges.length === 0 ? <Empty title="Sin cobros registrados" /> : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Medio / estado</th><th className="num">Monto</th></tr></thead>
            <tbody>
              {data.charges.map((c) => (
                <tr key={c.id}>
                  <td>{dateTime(c.date)}</td>
                  <td>{CHARGE_KINDS[c.kind]}{c.insurance_name && <small>{c.insurance_name}</small>}</td>
                  <td>{c.concept}</td>
                  <td>{c.kind === "OBRA_SOCIAL" ? <Pill tone={c.os_status === "COBRADA" ? "green" : c.os_status === "PRESENTADA" ? "violet" : "orange"}>{c.os_status?.toLowerCase()}</Pill> : PAYMENT_LABELS[c.method || ""] || c.method}</td>
                  <td className="num">{money(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tab === "accesos" && (!audit ? <Loading /> : audit.length === 0 ? <Empty title="Sin accesos registrados" /> : (
        <div className="mr-card">
          <div className="mr-card-head"><div><h2>Registro de accesos</h2><p>Quién abrió o escribió la historia clínica de este paciente.</p></div></div>
          <ul className="mr-list">
            {audit.map((r) => (
              <li key={r.id}><span className="mr-time-badge">{dateTime(r.created_at)}</span>
                <div className="mr-list-main"><strong>{r.user_name || "—"}</strong><small>{ACTIONS[r.action] || r.action}{r.detail && r.action.includes("ARCHIVO") ? ` · ${r.detail}` : ""}</small></div></li>
            ))}
          </ul>
        </div>
      ))}

      {editing && <PatientForm patient={data} insurances={insurances} canDeactivate={isAdmin} onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); load(); show("Ficha actualizada"); }} />}
      {charging && <ChargeModal patientId={patientId} patientName={`${data.first_name} ${data.last_name}`} professionals={professionals} insurances={insurances}
        defaultProfessionalId={user?.professional_id}
        onClose={() => setCharging(false)} onSaved={() => { setCharging(false); load(); show("Cobro registrado"); }} />}
      {flash}
    </section>
  );
}

export default Paciente;
