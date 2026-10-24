import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  appApi, currentPeriod, dayKey, downloadCsv, getSessionUser, money, periodLabel, shiftPeriod, shortDate, PAYMENT_LABELS,
} from "../../config";
import { Empty, Loading, PageHeader, Seg } from "../../components/ui";

function Reportes() {
  const user = getSessionUser();
  return user?.kind === "CIRCULO" ? <CirculoReportes /> : <ConsultorioReportes ownOnly={user?.role === "PROFESIONAL"} />;
}

// =====================================================================
// Piezas compartidas
// =====================================================================
const pct = (v: number) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const monthShort = (period: string) => `${MONTHS_SHORT[(Number(period.split("-")[1]) || 1) - 1]} ${period.slice(2, 4)}`;

function ReportCard({ title, subtitle, onExport, children }: { title: string; subtitle?: string; onExport?: () => void; children: ReactNode }) {
  return (
    <div className="mr-card mr-report">
      <div className="mr-card-head">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {onExport && <button type="button" className="secondary-button" onClick={onExport}>Exportar CSV</button>}
      </div>
      {children}
    </div>
  );
}

/** Barras horizontales: una fila por categoría, con su valor escrito */
function HBars({ rows, format = String }: { rows: { label: string; value: number; hint?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="mr-hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mr-spread"><span>{r.label}</span><strong>{format(r.value)}{r.hint ? <small> · {r.hint}</small> : null}</strong></div>
          <div className="mr-meter"><div style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Barras verticales (una serie) */
function VBars({ rows, format = String }: { rows: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="mr-bars">
      {rows.map((r) => (
        <div key={r.label} className="mr-bar-col" title={`${r.label}: ${format(r.value)}`}>
          <span className="mr-bar-value">{r.value ? format(r.value) : ""}</span>
          <div className="mr-bar-track"><div className="mr-bar" style={{ height: `${(r.value / max) * 100}%` }} /></div>
          <span className="mr-bar-label">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Barras verticales agrupadas (varias series por mes), con leyenda */
function GroupBars({ rows, series }: { rows: { label: string; values: number[] }[]; series: string[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <div>
      <div className="mr-legend" style={{ marginBottom: 10 }}>
        {series.map((s, i) => <span key={s}><i className={`mr-serie mr-serie-${i + 1}`} />{s}</span>)}
      </div>
      <div className="mr-gbars">
        {rows.map((r) => (
          <div key={r.label} className="mr-gbar-col" title={series.map((s, i) => `${s}: ${money(r.values[i])}`).join(" · ")}>
            <div className="mr-gbar-track">
              {r.values.map((v, i) => <div key={i} className={`mr-serie-${i + 1}`} style={{ height: `${(v / max) * 100}%` }} />)}
            </div>
            <span className="mr-bar-label">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// CONSULTORIO
// =====================================================================
interface AbsRow { professional_id: number; professional_name: string; total: number; attended: number; absent: number; cancelled: number; absent_pct: number }
interface ClinicReport {
  date_from: string; date_to: string; months: number; own_only: boolean; sections: string[];
  absenteeism?: { rows: AbsRow[]; total: Omit<AbsRow, "professional_id" | "professional_name"> };
  by_source?: { source: string; count: number; pct: number }[];
  by_insurance?: { name: string; count: number; pct: number }[];
  appointments_total?: number;
  lost_patients?: { months: number; count: number; rows: { patient_id: number; patient_name: string; phone: string | null; last_visit: string; months_ago: number; professional_name: string | null }[] };
  new_patients?: { period: string; count: number }[];
  collected?: { total: number; by_professional: { name: string; count: number; total: number }[]; by_method: { method: string; count: number; total: number; pct: number }[] };
  insurance_charges?: { rows: { name: string; count: number; pending: number; presented: number; collected: number; total: number }[]; total: { count: number; pending: number; presented: number; collected: number; total: number } };
  diagnoses?: { total: number; rows: { code: string | null; label: string | null; count: number; pct: number }[] };
}
type Quick = "mes" | "anterior" | "trimestre" | "anio" | "custom";

function ConsultorioReportes({ ownOnly }: { ownOnly: boolean }) {
  const navigate = useNavigate();
  const today = new Date();
  const [quick, setQuick] = useState<Quick>("mes");
  const [from, setFrom] = useState(dayKey(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(dayKey(today));
  const [months, setMonths] = useState("6");
  const [data, setData] = useState<ClinicReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function pick(q: Quick) {
    setQuick(q);
    const y = today.getFullYear();
    const m = today.getMonth();
    if (q === "mes") { setFrom(dayKey(new Date(y, m, 1))); setTo(dayKey(today)); }
    if (q === "anterior") { setFrom(dayKey(new Date(y, m - 1, 1))); setTo(dayKey(new Date(y, m, 0))); }
    if (q === "trimestre") { setFrom(dayKey(new Date(y, m - 2, 1))); setTo(dayKey(today)); }
    if (q === "anio") { setFrom(dayKey(new Date(y, 0, 1))); setTo(dayKey(today)); }
  }

  const load = useCallback(() => {
    if (!from || !to) return;
    setLoading(true);
    setError("");
    const n = Math.min(60, Math.max(1, Math.round(Number(months) || 6)));
    appApi<ClinicReport>(`/reports/clinic?date_from=${from}&date_to=${to}&months=${n}`)
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [from, to, months]);
  useEffect(() => {
    const t = window.setTimeout(load, 300);
    return () => window.clearTimeout(t);
  }, [load]);

  const tag = `${from}_a_${to}`;
  const d = data;

  return (
    <section className="products-page">
      <PageHeader eyebrow="REPORTES" title="Reportes" subtitle={ownOnly ? "Tus números: turnos, cobros y diagnósticos." : "Cómo viene el consultorio: turnos, pacientes, cobros y diagnósticos."} />

      <div className="mr-toolbar">
        <Seg value={quick} onChange={pick} options={[["mes", "Este mes"], ["anterior", "Mes pasado"], ["trimestre", "Últimos 3 meses"], ["anio", "Este año"], ["custom", "Otro rango"]]} />
        <div className="mr-filters">
          <label className="mr-inline-checks" style={{ paddingTop: 0 }}>Desde <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setQuick("custom"); }} /></label>
          <label className="mr-inline-checks" style={{ paddingTop: 0 }}>Hasta <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setQuick("custom"); }} /></label>
        </div>
      </div>
      {error && <div className="mr-note mr-note-error" style={{ marginBottom: 14 }}>{error}</div>}
      {!d ? (loading ? <Loading /> : null) : d.sections.length === 0 ? (
        <Empty title="No hay datos para mostrar">Los reportes se arman con la agenda, los pacientes, los cobros y la historia clínica que tenga tu plan.</Empty>
      ) : (
        <div className="mr-stack" aria-busy={loading}>
          {d.absenteeism && (
            <ReportCard title="Ausentismo por profesional" subtitle={`${d.appointments_total} turnos del ${shortDate(d.date_from)} al ${shortDate(d.date_to)}`}
              onExport={() => downloadCsv(`ausentismo_${tag}.csv`, ["Profesional", "Turnos", "Atendidos", "Ausentes", "Cancelados", "% ausentismo"],
                [...d.absenteeism!.rows.map((r) => [r.professional_name, r.total, r.attended, r.absent, r.cancelled, r.absent_pct]),
                  ["Total", d.absenteeism!.total.total, d.absenteeism!.total.attended, d.absenteeism!.total.absent, d.absenteeism!.total.cancelled, d.absenteeism!.total.absent_pct]])}>
              {d.absenteeism.rows.length === 0 ? <Empty title="Sin turnos en ese rango" /> : (
                <>
                  <HBars rows={d.absenteeism.rows.map((r) => ({ label: r.professional_name, value: r.absent_pct, hint: `${r.absent} ausentes` }))} format={pct} />
                  <div className="mr-table-wrap" style={{ marginTop: 14 }}>
                    <table className="mr-table">
                      <thead><tr><th>Profesional</th><th className="num">Turnos</th><th className="num">Atendidos</th><th className="num">Ausentes</th><th className="num">Cancelados</th><th className="num">% ausentismo</th></tr></thead>
                      <tbody>
                        {d.absenteeism.rows.map((r) => (
                          <tr key={r.professional_id}><td>{r.professional_name}</td><td className="num">{r.total}</td><td className="num">{r.attended}</td>
                            <td className="num">{r.absent}</td><td className="num">{r.cancelled}</td><td className="num">{pct(r.absent_pct)}</td></tr>
                        ))}
                      </tbody>
                      <tfoot><tr><td>Total</td><td className="num">{d.absenteeism.total.total}</td><td className="num">{d.absenteeism.total.attended}</td>
                        <td className="num">{d.absenteeism.total.absent}</td><td className="num">{d.absenteeism.total.cancelled}</td><td className="num">{pct(d.absenteeism.total.absent_pct)}</td></tr></tfoot>
                    </table>
                  </div>
                  <small className="mr-hint">% de ausentismo = ausentes sobre los turnos que tenían que venir (atendidos + ausentes).</small>
                </>
              )}
            </ReportCard>
          )}

          {d.by_source && d.by_insurance && (
            <div className="mr-grid-2" style={{ marginBottom: 0 }}>
              <ReportCard title="Turnos por origen" subtitle="Pedidos por la web o cargados en el sistema"
                onExport={() => downloadCsv(`turnos_por_origen_${tag}.csv`, ["Origen", "Turnos", "%"], d.by_source!.map((r) => [r.source === "WEB" ? "Web de turnos" : "Sistema", r.count, r.pct]))}>
                {d.by_source.length === 0 ? <Empty title="Sin turnos en ese rango" />
                  : <HBars rows={d.by_source.map((r) => ({ label: r.source === "WEB" ? "Web de turnos" : "Cargados en el sistema", value: r.count, hint: pct(r.pct) }))} />}
              </ReportCard>
              <ReportCard title="Turnos por cobertura" subtitle="Obra social o particular"
                onExport={() => downloadCsv(`turnos_por_cobertura_${tag}.csv`, ["Cobertura", "Turnos", "%"], d.by_insurance!.map((r) => [r.name, r.count, r.pct]))}>
                {d.by_insurance.length === 0 ? <Empty title="Sin turnos en ese rango" />
                  : <HBars rows={d.by_insurance.slice(0, 10).map((r) => ({ label: r.name, value: r.count, hint: pct(r.pct) }))} />}
                {d.by_insurance.length > 10 && <small className="mr-hint">Se muestran las 10 principales; el CSV las trae todas.</small>}
              </ReportCard>
            </div>
          )}

          {d.lost_patients && (
            <ReportCard title="Pacientes que no vuelven" subtitle={`Su último turno atendido fue hace más de ${d.lost_patients.months} meses y no tienen turno dado`}
              onExport={() => downloadCsv(`pacientes_que_no_vuelven_${d.lost_patients!.months}_meses.csv`, ["Paciente", "Teléfono", "Última visita", "Meses", "Profesional"],
                d.lost_patients!.rows.map((r) => [r.patient_name, r.phone, shortDate(r.last_visit), r.months_ago, r.professional_name]))}>
              <div className="mr-row" style={{ marginBottom: 12 }}>
                <label className="mr-inline-checks" style={{ paddingTop: 0 }}>Sin venir hace más de
                  <input type="number" min="1" max="60" value={months} onChange={(e) => setMonths(e.target.value)} className="mr-search" style={{ width: 80 }} aria-label="Meses sin venir" /> meses</label>
                <strong>{d.lost_patients.count} pacientes</strong>
              </div>
              {d.lost_patients.rows.length === 0 ? <Empty title="Ningún paciente en esa situación" /> : (
                <div className="mr-table-wrap mr-scroll-table">
                  <table className="mr-table">
                    <thead><tr><th>Paciente</th><th>Teléfono</th><th>Última visita</th><th className="num">Hace</th><th>Profesional</th></tr></thead>
                    <tbody>
                      {d.lost_patients.rows.map((r) => (
                        <tr key={r.patient_id} className="is-click" onClick={() => navigate(`/app/pacientes/${r.patient_id}`)}>
                          <td><strong>{r.patient_name}</strong></td><td>{r.phone || "—"}</td><td>{shortDate(r.last_visit)}</td>
                          <td className="num">{r.months_ago} meses</td><td>{r.professional_name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {d.lost_patients.count > d.lost_patients.rows.length && <small className="mr-hint">Se muestran los primeros {d.lost_patients.rows.length}.</small>}
            </ReportCard>
          )}

          {d.new_patients && (
            <ReportCard title="Pacientes nuevos por mes" subtitle="Últimos 12 meses"
              onExport={() => downloadCsv("pacientes_nuevos_por_mes.csv", ["Mes", "Pacientes nuevos"], d.new_patients!.map((r) => [periodLabel(r.period), r.count]))}>
              <VBars rows={d.new_patients.map((r) => ({ label: monthShort(r.period), value: r.count }))} />
              <p className="mr-muted" style={{ marginTop: 10 }}>Total del año: <strong>{d.new_patients.reduce((a, r) => a + r.count, 0)}</strong> pacientes nuevos.</p>
            </ReportCard>
          )}

          {d.collected && (
            <div className="mr-grid-2" style={{ marginBottom: 0 }}>
              <ReportCard title="Cobrado por profesional" subtitle={`Particulares y coseguros · ${money(d.collected.total)}`}
                onExport={() => downloadCsv(`cobrado_por_profesional_${tag}.csv`, ["Profesional", "Cobros", "Total"],
                  [...d.collected!.by_professional.map((r) => [r.name, r.count, r.total]), ["Total", d.collected!.by_professional.reduce((a, r) => a + r.count, 0), d.collected!.total]])}>
                {d.collected.by_professional.length === 0 ? <Empty title="Sin cobros en ese rango" /> : (
                  <div className="mr-table-wrap">
                    <table className="mr-table">
                      <thead><tr><th>Profesional</th><th className="num">Cobros</th><th className="num">Total</th></tr></thead>
                      <tbody>{d.collected.by_professional.map((r) => <tr key={r.name}><td>{r.name}</td><td className="num">{r.count}</td><td className="num">{money(r.total)}</td></tr>)}</tbody>
                      <tfoot><tr><td>Total</td><td className="num">{d.collected.by_professional.reduce((a, r) => a + r.count, 0)}</td><td className="num">{money(d.collected.total)}</td></tr></tfoot>
                    </table>
                  </div>
                )}
              </ReportCard>
              <ReportCard title="Cobrado por medio de pago" subtitle="Cómo pagaron los pacientes"
                onExport={() => downloadCsv(`cobrado_por_medio_${tag}.csv`, ["Medio de pago", "Cobros", "Total", "%"], d.collected!.by_method.map((r) => [PAYMENT_LABELS[r.method] || r.method, r.count, r.total, r.pct]))}>
                {d.collected.by_method.length === 0 ? <Empty title="Sin cobros en ese rango" />
                  : <HBars rows={d.collected.by_method.map((r) => ({ label: PAYMENT_LABELS[r.method] || r.method, value: r.total, hint: pct(r.pct) }))} format={money} />}
              </ReportCard>
            </div>
          )}

          {d.insurance_charges && (
            <ReportCard title="Prestaciones por obra social" subtitle="Lo atendido por obra social en el rango, según su estado"
              onExport={() => downloadCsv(`prestaciones_por_obra_social_${tag}.csv`, ["Obra social", "Prestaciones", "Pendiente de presentar", "Presentado", "Cobrado", "Total"],
                [...d.insurance_charges!.rows.map((r) => [r.name, r.count, r.pending, r.presented, r.collected, r.total]),
                  ["Total", d.insurance_charges!.total.count, d.insurance_charges!.total.pending, d.insurance_charges!.total.presented, d.insurance_charges!.total.collected, d.insurance_charges!.total.total]])}>
              {d.insurance_charges.rows.length === 0 ? <Empty title="Sin prestaciones de obra social en ese rango" /> : (
                <div className="mr-table-wrap">
                  <table className="mr-table">
                    <thead><tr><th>Obra social</th><th className="num">Prestaciones</th><th className="num">Pendiente</th><th className="num">Presentado</th><th className="num">Cobrado</th><th className="num">Total</th></tr></thead>
                    <tbody>
                      {d.insurance_charges.rows.map((r) => (
                        <tr key={r.name}><td>{r.name}</td><td className="num">{r.count}</td><td className="num">{money(r.pending)}</td>
                          <td className="num">{money(r.presented)}</td><td className="num">{money(r.collected)}</td><td className="num">{money(r.total)}</td></tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td>Total</td><td className="num">{d.insurance_charges.total.count}</td><td className="num">{money(d.insurance_charges.total.pending)}</td>
                      <td className="num">{money(d.insurance_charges.total.presented)}</td><td className="num">{money(d.insurance_charges.total.collected)}</td><td className="num">{money(d.insurance_charges.total.total)}</td></tr></tfoot>
                  </table>
                </div>
              )}
            </ReportCard>
          )}

          {d.diagnoses && (
            <ReportCard title="Diagnósticos más frecuentes" subtitle={`${d.diagnoses.total} evoluciones con diagnóstico · solo cantidades, sin datos de pacientes`}
              onExport={() => downloadCsv(`diagnosticos_${tag}.csv`, ["CIE-10", "Diagnóstico", "Cantidad", "%"], d.diagnoses!.rows.map((r) => [r.code, r.label, r.count, r.pct]))}>
              {d.diagnoses.rows.length === 0 ? <Empty title="Sin diagnósticos cargados en ese rango" />
                : <HBars rows={d.diagnoses.rows.slice(0, 15).map((r) => ({ label: `${r.code ? `${r.code} · ` : ""}${r.label || ""}`, value: r.count, hint: pct(r.pct) }))} />}
            </ReportCard>
          )}
        </div>
      )}
    </section>
  );
}

// =====================================================================
// CÍRCULO MÉDICO
// =====================================================================
interface PayerRow { payer_id: number; payer_name: string; count: number; loaded: number; billed: number; collected: number; debited: number; debit_pct: number }
interface CircleReport {
  period_from: string; period_to: string; periods: number;
  by_payer: { rows: PayerRow[]; total: Omit<PayerRow, "payer_id" | "payer_name"> };
  debits_by_reason: { rows: { reason: string; count: number; amount: number; pct: number }[]; total: number };
  ranking: { rows: { rank: number; member_id: number; member_name: string; specialty: string | null; count: number; total: number; debited: number; net: number; pct: number }[]; total: number; members: number };
  collection_time: { payer_id: number; payer_name: string; agreed_days: number | null; batches: number; paid_batches: number; open: number; avg_days: number | null }[];
  evolution: { period: string; billed: number; collected: number; settled: number }[];
}
type CQuick = "1" | "3" | "6" | "12" | "custom";

function CirculoReportes() {
  const [quick, setQuick] = useState<CQuick>("1");
  const [from, setFrom] = useState(currentPeriod());
  const [to, setTo] = useState(currentPeriod());
  const [data, setData] = useState<CircleReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function pick(q: CQuick) {
    setQuick(q);
    if (q !== "custom") { setTo(currentPeriod()); setFrom(shiftPeriod(currentPeriod(), -(Number(q) - 1))); }
  }

  const load = useCallback(() => {
    if (!from || !to) return;
    setLoading(true);
    setError("");
    appApi<CircleReport>(`/reports/circle?period_from=${from}&period_to=${to}`)
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const d = data;
  const tag = from === to ? from : `${from}_a_${to}`;
  const rangeLabel = from === to ? periodLabel(from) : `${periodLabel(from)} a ${periodLabel(to)}`;

  return (
    <section className="products-page">
      <PageHeader eyebrow="REPORTES" title="Reportes" subtitle="Facturación, cobros y débitos por convenio, ranking de médicos y evolución mensual." />
      <div className="mr-toolbar">
        <Seg value={quick} onChange={pick} options={[["1", "Este período"], ["3", "Últimos 3"], ["6", "Últimos 6"], ["12", "Últimos 12"], ["custom", "Otro rango"]]} />
        <div className="mr-filters">
          <label className="mr-inline-checks" style={{ paddingTop: 0 }}>Desde <input type="month" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setQuick("custom"); }} /></label>
          <label className="mr-inline-checks" style={{ paddingTop: 0 }}>Hasta <input type="month" value={to} min={from} onChange={(e) => { setTo(e.target.value); setQuick("custom"); }} /></label>
        </div>
      </div>
      {error && <div className="mr-note mr-note-error" style={{ marginBottom: 14 }}>{error}</div>}
      {!d ? (loading ? <Loading /> : null) : (
        <div className="mr-stack" aria-busy={loading}>
          <ReportCard title="Facturado, cobrado y debitado por convenio" subtitle={rangeLabel}
            onExport={() => downloadCsv(`convenios_${tag}.csv`, ["Convenio", "Prestaciones", "Cargado", "Facturado", "Cobrado", "Debitado", "% débito"],
              [...d.by_payer.rows.map((r) => [r.payer_name, r.count, r.loaded, r.billed, r.collected, r.debited, r.debit_pct]),
                ["Total", d.by_payer.total.count, d.by_payer.total.loaded, d.by_payer.total.billed, d.by_payer.total.collected, d.by_payer.total.debited, d.by_payer.total.debit_pct]])}>
            {d.by_payer.rows.length === 0 ? <Empty title="Sin prestaciones en ese rango" /> : (
              <>
                <div className="mr-table-wrap">
                  <table className="mr-table">
                    <thead><tr><th>Convenio</th><th className="num">Prest.</th><th className="num">Cargado</th><th className="num">Facturado</th><th className="num">Cobrado</th><th className="num">Debitado</th><th className="num">% débito</th></tr></thead>
                    <tbody>
                      {d.by_payer.rows.map((r) => (
                        <tr key={r.payer_id}><td>{r.payer_name}</td><td className="num">{r.count}</td><td className="num">{money(r.loaded)}</td><td className="num">{money(r.billed)}</td>
                          <td className="num">{money(r.collected)}</td><td className="num">{money(r.debited)}</td><td className="num">{pct(r.debit_pct)}</td></tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td>Total</td><td className="num">{d.by_payer.total.count}</td><td className="num">{money(d.by_payer.total.loaded)}</td><td className="num">{money(d.by_payer.total.billed)}</td>
                      <td className="num">{money(d.by_payer.total.collected)}</td><td className="num">{money(d.by_payer.total.debited)}</td><td className="num">{pct(d.by_payer.total.debit_pct)}</td></tr></tfoot>
                  </table>
                </div>
                <small className="mr-hint">Cargado: todo lo ingresado. Facturado: lo ya presentado a la obra social. Cobrado: lo pagado, neto de débitos. % débito: debitado sobre facturado.</small>
              </>
            )}
          </ReportCard>

          <div className="mr-grid-2" style={{ marginBottom: 0 }}>
            <ReportCard title="Débitos por motivo" subtitle={`${money(d.debits_by_reason.total)} debitados · ${rangeLabel}`}
              onExport={() => downloadCsv(`debitos_por_motivo_${tag}.csv`, ["Motivo", "Prestaciones", "Monto", "%"], d.debits_by_reason.rows.map((r) => [r.reason, r.count, r.amount, r.pct]))}>
              {d.debits_by_reason.rows.length === 0 ? <Empty title="Sin débitos en ese rango" />
                : <HBars rows={d.debits_by_reason.rows.slice(0, 12).map((r) => ({ label: r.reason, value: r.amount, hint: `${r.count} prest. · ${pct(r.pct)}` }))} format={money} />}
            </ReportCard>
            <ReportCard title="Tiempo de cobro por convenio" subtitle="Días desde la presentación hasta el último cobro"
              onExport={() => downloadCsv(`tiempo_de_cobro_${tag}.csv`, ["Convenio", "Presentaciones", "Cobradas", "Sin cobrar", "Días promedio", "Días pactados"],
                d.collection_time.map((r) => [r.payer_name, r.batches, r.paid_batches, r.open, r.avg_days, r.agreed_days]))}>
              {d.collection_time.length === 0 ? <Empty title="Sin presentaciones en ese rango" /> : (
                <div className="mr-table-wrap">
                  <table className="mr-table">
                    <thead><tr><th>Convenio</th><th className="num">Presentaciones</th><th className="num">Sin cobrar</th><th className="num">Promedio</th><th className="num">Pactado</th></tr></thead>
                    <tbody>
                      {d.collection_time.map((r) => (
                        <tr key={r.payer_id}><td>{r.payer_name}</td><td className="num">{r.batches}</td><td className="num">{r.open}</td>
                          <td className="num">{r.avg_days === null ? "—" : <strong>{r.avg_days.toLocaleString("es-AR")} días</strong>}</td>
                          <td className="num">{r.agreed_days ?? "—"}{r.agreed_days !== null ? " días" : ""}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ReportCard>
          </div>

          <ReportCard title="Ranking de médicos por facturación" subtitle={`${d.ranking.members} médicos · ${money(d.ranking.total)} · ${rangeLabel}`}
            onExport={() => downloadCsv(`ranking_medicos_${tag}.csv`, ["Puesto", "Médico", "Especialidad", "Prestaciones", "Total", "Debitado", "Neto", "% del total"],
              d.ranking.rows.map((r) => [r.rank, r.member_name, r.specialty, r.count, r.total, r.debited, r.net, r.pct]))}>
            {d.ranking.rows.length === 0 ? <Empty title="Sin prestaciones en ese rango" /> : (
              <div className="mr-table-wrap mr-scroll-table">
                <table className="mr-table">
                  <thead><tr><th>#</th><th>Médico</th><th className="num">Prest.</th><th className="num">Total</th><th className="num">Debitado</th><th className="num">Neto</th><th>Participación</th></tr></thead>
                  <tbody>
                    {d.ranking.rows.map((r) => (
                      <tr key={r.member_id}><td>{r.rank}</td><td><strong>{r.member_name}</strong>{r.specialty && <small>{r.specialty}</small>}</td>
                        <td className="num">{r.count}</td><td className="num">{money(r.total)}</td><td className="num">{money(r.debited)}</td><td className="num">{money(r.net)}</td>
                        <td style={{ minWidth: 140 }}><div className="mr-meter"><div style={{ width: `${r.pct}%` }} /></div><small>{pct(r.pct)}</small></td></tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td></td><td>Total</td><td className="num">{d.ranking.rows.reduce((a, r) => a + r.count, 0)}</td><td className="num">{money(d.ranking.total)}</td>
                    <td className="num">{money(d.ranking.rows.reduce((a, r) => a + r.debited, 0))}</td><td className="num">{money(d.ranking.rows.reduce((a, r) => a + r.net, 0))}</td><td></td></tr></tfoot>
                </table>
              </div>
            )}
          </ReportCard>

          <ReportCard title="Evolución mensual" subtitle={`Facturado, cobrado y liquidado · 12 períodos hasta ${periodLabel(d.period_to)}`}
            onExport={() => downloadCsv(`evolucion_mensual_hasta_${d.period_to}.csv`, ["Período", "Facturado", "Cobrado", "Liquidado"], d.evolution.map((r) => [r.period, r.billed, r.collected, r.settled]))}>
            <GroupBars series={["Facturado", "Cobrado", "Liquidado a médicos"]} rows={d.evolution.map((r) => ({ label: monthShort(r.period), values: [r.billed, r.collected, r.settled] }))} />
            <div className="mr-table-wrap" style={{ marginTop: 14 }}>
              <table className="mr-table">
                <thead><tr><th>Período</th><th className="num">Facturado</th><th className="num">Cobrado</th><th className="num">Liquidado</th></tr></thead>
                <tbody>{d.evolution.map((r) => <tr key={r.period}><td>{periodLabel(r.period)}</td><td className="num">{money(r.billed)}</td><td className="num">{money(r.collected)}</td><td className="num">{money(r.settled)}</td></tr>)}</tbody>
                <tfoot><tr><td>Total</td><td className="num">{money(d.evolution.reduce((a, r) => a + r.billed, 0))}</td><td className="num">{money(d.evolution.reduce((a, r) => a + r.collected, 0))}</td>
                  <td className="num">{money(d.evolution.reduce((a, r) => a + r.settled, 0))}</td></tr></tfoot>
              </table>
            </div>
          </ReportCard>
        </div>
      )}
    </section>
  );
}

export default Reportes;
