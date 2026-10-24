import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  appApi, canAccess, getSessionUser, money, hhmm, parseDay, dayLabel, periodLabel, shortDate, APPT_STATUS,
} from "../../config";
import type { Appointment, SessionUser } from "../../config";
import { Empty, Loading, PageHeader, Pill, useRefreshKey } from "../../components/ui";
import Pendientes from "../../components/Pendientes";

function Inicio() {
  const user = getSessionUser();
  if (user?.kind === "CIRCULO") return <CirculoHome user={user} />;
  return <ConsultorioHome user={user} />;
}

// =====================================================================
// CONSULTORIO
// =====================================================================
interface ClinicOverview {
  now: string;
  today: Record<string, number> & { total: number };
  upcoming: Appointment[];
  waiting: Appointment[];
  professionals_today: { id: number; name: string; color: string; total: number; attended: number; next: string | null }[];
  money?: { today: number; month: number; insurance_pending: number; insurance_pending_count: number };
  to_charge?: number;
  birthdays?: { id: number; name: string; phone: string | null }[];
  patients_total?: number;
  patients_new_month?: number;
  week: { date: string; count: number }[];
}

function ConsultorioHome({ user }: { user: SessionUser | null }) {
  const navigate = useNavigate();
  const refreshKey = useRefreshKey();
  const [data, setData] = useState<ClinicOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => appApi<ClinicOverview>("/dashboard").then(setData).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [refreshKey]);

  if (error) return <div className="mr-note mr-note-error">{error}</div>;
  if (!data) return <Loading />;

  const hour = new Date().getHours();
  const hello = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const maxWeek = Math.max(1, ...data.week.map((w) => w.count));
  const t = data.today;

  return (
    <section className="products-page">
      <PageHeader eyebrow="INICIO" title={`${hello}, ${(user?.name || "").split(" ")[0]}`}
        subtitle={user?.role === "PROFESIONAL" ? "Tu día en el consultorio." : "Así viene el día en el consultorio."}>
        {canAccess(user, "agenda") && <button className="primary-button" onClick={() => navigate("/app/agenda?nuevo=1")}>+ Nuevo turno</button>}
      </PageHeader>

      <Pendientes />

      {/* Lo que requiere acción (sala de espera, atendidos sin cobrar…) está en «Pendientes»: acá van los números del día */}
      <div className="mr-kpis">
        <button className="mr-kpi" onClick={() => navigate("/app/agenda")}>
          <span>Turnos de hoy</span><strong>{t.total}</strong>
          <small>{t.ATENDIDO} atendidos · {t.RESERVADO + t.CONFIRMADO} por venir · {t.ATENDIENDO} en consultorio</small>
        </button>
        <div className={`mr-kpi ${t.AUSENTE ? "is-alert" : ""}`}>
          <span>Ausentes</span><strong>{t.AUSENTE}</strong><small>{t.CANCELADO} cancelados hoy</small>
        </div>
        {data.money && (
          <button className="mr-kpi" onClick={() => navigate("/app/cobros")}>
            <span>Cobrado hoy</span><strong>{money(data.money.today)}</strong><small>Mes: {money(data.money.month)}</small>
          </button>
        )}
        {data.money && (
          <button className="mr-kpi" onClick={() => navigate("/app/cobros?tab=os")}>
            <span>Obras sociales a presentar</span><strong>{money(data.money.insurance_pending)}</strong>
            <small>{data.money.insurance_pending_count} prestaciones pendientes</small>
          </button>
        )}
      </div>

      <div className="mr-grid-2">
        <div className="mr-card">
          <div className="mr-card-head"><div><h2>Próximos turnos</h2><p>Lo que sigue hoy</p></div>
            <button className="mr-link" onClick={() => navigate("/app/agenda")}>Ver agenda</button></div>
          {data.upcoming.length === 0 ? <Empty title="No hay más turnos por hoy" /> : (
            <ul className="mr-list">
              {data.upcoming.map((a) => (
                <li key={a.id} className="is-click" onClick={() => navigate(`/app/agenda?turno=${a.id}`)}>
                  <span className="mr-time-badge">{hhmm(a.start_at)}</span>
                  <div className="mr-list-main">
                    <strong>{a.patient_name}</strong>
                    <small>{a.professional_name}{a.insurance_name ? ` · ${a.insurance_name}` : " · Particular"}</small>
                  </div>
                  <Pill tone={toneOf(a.status)}>{APPT_STATUS[a.status].label}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mr-card">
          <div className="mr-card-head"><div><h2>Sala de espera</h2><p>Pacientes que ya llegaron</p></div></div>
          {data.waiting.length === 0 ? <Empty title="Nadie esperando" /> : (
            <ul className="mr-list">
              {data.waiting.map((a) => (
                <li key={a.id} className="is-click" onClick={() => navigate(`/app/agenda?turno=${a.id}`)}>
                  <span className="mr-time-badge">{hhmm(a.start_at)}</span>
                  <div className="mr-list-main">
                    <strong>{a.patient_name}</strong>
                    <small>{a.professional_name}</small>
                  </div>
                  {a.status === "ATENDIENDO" ? <Pill tone="violet">En consultorio</Pill>
                    : <Pill tone="orange">Espera {a.wait_minutes ?? 0} min</Pill>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mr-grid-2">
        <div className="mr-card">
          <div className="mr-card-head"><div><h2>Profesionales hoy</h2><p>Avance de cada agenda</p></div></div>
          {data.professionals_today.length === 0 ? <Empty title="Sin turnos dados para hoy" /> : (
            <ul className="mr-list">
              {data.professionals_today.map((p) => (
                <li key={p.id}>
                  <span className="mr-avatar" style={{ background: p.color, width: 34, height: 34, fontSize: 12 }}>{p.name.replace(/^(dra?|od)\.?\s*/i, "").slice(0, 2).toUpperCase()}</span>
                  <div className="mr-list-main">
                    <strong>{p.name}</strong>
                    <small>{p.attended}/{p.total} atendidos{p.next ? ` · próximo ${hhmm(p.next)}` : ""}</small>
                    <div className="mr-meter" style={{ marginTop: 6 }}><div style={{ width: `${(p.attended / Math.max(1, p.total)) * 100}%` }} /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mr-card">
          <div className="mr-card-head"><div><h2>Próximos 7 días</h2><p>Turnos dados por día</p></div></div>
          <div className="mr-bars">
            {data.week.map((w) => (
              <div key={w.date} className="mr-bar-col" title={`${w.count} turnos`}>
                <span className="mr-bar-value">{w.count || ""}</span>
                <div className="mr-bar-track"><div className="mr-bar" style={{ height: `${(w.count / maxWeek) * 100}%` }} /></div>
                <span className="mr-bar-label">{dayLabel(parseDay(w.date)).replace(/ \d+\/\d+$/, "")}</span>
              </div>
            ))}
          </div>
          {data.patients_total !== undefined && (
            <p className="mr-muted" style={{ marginTop: 14 }}>
              {data.patients_total} pacientes activos · {data.patients_new_month} nuevos este mes
            </p>
          )}
          {data.birthdays && data.birthdays.length > 0 && (
            <div className="mr-note mr-note-info" style={{ marginTop: 10 }}>
              🎂 Cumplen años hoy: {data.birthdays.map((b, i) => (
                <span key={b.id}>{i > 0 && ", "}<button className="mr-link" onClick={() => navigate(`/app/pacientes/${b.id}`)}>{b.name}</button></span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function toneOf(status: string): string {
  return ({ RESERVADO: "blue", CONFIRMADO: "teal", EN_ESPERA: "orange", ATENDIENDO: "violet", ATENDIDO: "green", AUSENTE: "red", CANCELADO: "gray" } as Record<string, string>)[status] || "gray";
}

// =====================================================================
// CÍRCULO MÉDICO
// =====================================================================
interface CircleOverview {
  period: string;
  members_active: number;
  payers_active: number;
  period_by_status: Record<string, { count: number; total: number }>;
  period_total: number;
  to_audit: number;
  ready_to_present: { count: number; total: number };
  receivable: number;
  overdue_batches: { id: number; number: number; payer_name: string; period: string; due_date: string; pending: number }[];
  to_settle: { count: number; total: number };
  debits_recent: number;
  last_settlement: { id: number; number: number; period: string; status: string; net: number } | null;
  top_payers: { payer_name: string; count: number; total: number }[];
}

function CirculoHome({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const refreshKey = useRefreshKey();
  const [data, setData] = useState<CircleOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    appApi<CircleOverview>("/dashboard").then(setData).catch((e) => setError(e.message));
  }, [refreshKey]);

  if (error) return <div className="mr-note mr-note-error">{error}</div>;
  if (!data) return <Loading />;
  const maxPayer = Math.max(1, ...data.top_payers.map((p) => p.total));

  return (
    <section className="products-page">
      <PageHeader eyebrow={`PERÍODO ${periodLabel(data.period).toUpperCase()}`} title={`Hola, ${user.name.split(" ")[0]}`}
        subtitle="El circuito del mes: carga → auditoría → presentación → cobro → liquidación." />

      <Pendientes />

      {/* Los pasos con algo para hacer (auditar, presentar, cobrar vencidas, liquidar) están en «Pendientes» */}
      <div className="mr-kpis">
        <div className="mr-kpi"><span>Facturado del período</span><strong>{money(data.period_total)}</strong>
          <small>{Object.values(data.period_by_status).reduce((a, b) => a + b.count, 0)} prestaciones</small></div>
        <div className="mr-kpi"><span>A cobrar a obras sociales</span><strong>{money(data.receivable)}</strong>
          <small>Presentado y todavía no pagado</small></div>
        <div className={`mr-kpi ${data.debits_recent ? "is-alert" : ""}`}><span>Débitos (últimos meses)</span>
          <strong>{money(data.debits_recent)}</strong><small>Para revisar y refacturar</small></div>
        <button className="mr-kpi" onClick={() => navigate("/app/padron")}><span>Padrón</span><strong>{data.members_active}</strong>
          <small>médicos activos · {data.payers_active} convenios</small></button>
      </div>

      <div className="mr-grid-2">
        <div className="mr-card">
          <div className="mr-card-head"><div><h2>Presentaciones vencidas</h2><p>Obras sociales que ya tendrían que haber pagado</p></div></div>
          {data.overdue_batches.length === 0 ? <Empty title="Nada vencido" /> : (
            <ul className="mr-list">
              {data.overdue_batches.map((b) => (
                <li key={b.id} className="is-click" onClick={() => navigate(`/app/presentaciones?id=${b.id}`)}>
                  <span className="mr-time-badge">N° {b.number}</span>
                  <div className="mr-list-main"><strong>{b.payer_name}</strong><small>{periodLabel(b.period)} · venció {shortDate(b.due_date)}</small></div>
                  <Pill tone="red">{money(b.pending)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mr-card">
          <div className="mr-card-head"><div><h2>Convenios del período</h2><p>Lo cargado por obra social</p></div></div>
          {data.top_payers.length === 0 ? <Empty title="Todavía no hay prestaciones este mes" /> : (
            <ul className="mr-list">
              {data.top_payers.map((p) => (
                <li key={p.payer_name}>
                  <div className="mr-list-main">
                    <div className="mr-spread"><strong>{p.payer_name}</strong><span>{money(p.total)}</span></div>
                    <div className="mr-meter" style={{ marginTop: 6 }}><div style={{ width: `${(p.total / maxPayer) * 100}%` }} /></div>
                    <small>{p.count} prestaciones</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data.last_settlement && (
            <div className="mr-note mr-note-info" style={{ marginTop: 12 }}>
              Última liquidación: N° {data.last_settlement.number} ({periodLabel(data.last_settlement.period)}) · neto {money(data.last_settlement.net)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Inicio;
