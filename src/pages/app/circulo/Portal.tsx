import { useCallback, useEffect, useState } from "react";
import { appApi, money, shortDate, periodLabel, currentPeriod, shiftPeriod, PREST_STATUS } from "../../../config";
import type { Member, Prestacion, PrestStatus } from "../../../config";
import { Empty, Loading, PageHeader, Pill, Tabs, useFlash, useRefreshKey } from "../../../components/ui";
import PrestacionForm from "../../../components/PrestacionForm";
import type { PayerLite, RateLite } from "../../../components/PrestacionForm";
import type { Line } from "./Liquidaciones";
import Pendientes from "../../../components/Pendientes";

interface Me {
  member: Member; circle: { name: string; deadline_day: number; can_load: boolean }; period: string;
  by_status: Record<string, { count: number; total: number }>; observed: number; in_process: number;
  last_settlement: { id: number; settlement_id: number; number: number; period: string; net: number; paid: boolean } | null;
}
interface PortalPayer extends PayerLite { rates: RateLite[] }
interface MySettlement extends Line { settlement_id: number; number: number; period: string; closed_at: string | null }

const EDITABLE: PrestStatus[] = ["CARGADA", "OBSERVADA"];

function Portal() {
  const refreshKey = useRefreshKey();
  const { show, fail, node: flash } = useFlash();
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<"prest" | "liq">("prest");
  const [period, setPeriod] = useState(currentPeriod());
  const [items, setItems] = useState<Prestacion[] | null>(null);
  const [payers, setPayers] = useState<PortalPayer[]>([]);
  const [settlements, setSettlements] = useState<MySettlement[] | null>(null);
  const [form, setForm] = useState<Prestacion | "new" | null>(null);
  const [error, setError] = useState("");

  const loadMe = useCallback(() => appApi<Me>("/portal/me").then(setMe).catch((e) => setError(e.message)), []);
  const loadItems = useCallback(() => {
    appApi<Prestacion[]>(`/portal/prestaciones${period ? `?period=${period}` : ""}`).then(setItems).catch(fail);
  }, [period, fail]);
  useEffect(() => { loadMe(); appApi<PortalPayer[]>("/portal/payers").then(setPayers).catch(() => {}); }, [loadMe, refreshKey]);
  useEffect(() => { loadItems(); }, [loadItems, refreshKey]);
  useEffect(() => { if (tab === "liq") appApi<MySettlement[]>("/portal/settlements").then(setSettlements).catch(fail); }, [tab, fail]);

  const loadRates = useCallback(async (pid: number) => payers.find((p) => p.id === pid)?.rates || [], [payers]);

  async function remove(p: Prestacion) {
    if (!confirm(`¿Borrar la prestación de ${p.patient_name}?`)) return;
    try { await appApi(`/portal/prestaciones/${p.id}`, { method: "DELETE" }); show("Prestación borrada"); loadItems(); loadMe(); } catch (e) { fail(e); }
  }

  if (error) return <div className="mr-note mr-note-error">{error}</div>;
  if (!me) return <Loading />;
  const periodTotal = Object.values(me.by_status).reduce((a, b) => a + b.total, 0);
  const periodCount = Object.values(me.by_status).reduce((a, b) => a + b.count, 0);
  const canLoad = me.circle.can_load;

  return (
    <section className="products-page">
      <PageHeader eyebrow={me.circle.name.toUpperCase()} title={`Hola, ${me.member.first_name}`}
        subtitle={`${me.member.specialty || "Portal del médico"}${me.member.license ? ` · MP ${me.member.license}` : ""}`}>
        {canLoad && <button className="primary-button" onClick={() => setForm("new")}>+ Cargar prestación</button>}
      </PageHeader>

      {/* turnos de hoy de su agenda (las observadas ya tienen su aviso acá abajo) */}
      <Pendientes exclude={["my_observed"]} hideEmpty />

      {me.observed > 0 && (
        <div className="mr-note mr-note-warn" style={{ marginBottom: 14 }}>
          Tenés <b>{me.observed}</b> prestación(es) observada(s) por auditoría. Corregilas para que entren en la presentación.
          <button className="mr-link" style={{ marginLeft: 8 }} onClick={() => { setTab("prest"); setPeriod(""); }}>Ver</button>
        </div>
      )}

      <div className="mr-kpis">
        <div className="mr-kpi"><span>Cargado en {periodLabel(me.period)}</span><strong>{money(periodTotal)}</strong><small>{periodCount} prestaciones · cierre el día {me.circle.deadline_day}</small></div>
        <div className="mr-kpi"><span>En trámite con obras sociales</span><strong>{money(me.in_process)}</strong><small>Presentado o cobrado, sin liquidar</small></div>
        {me.last_settlement && (
          <button className="mr-kpi" onClick={() => window.open(`/print/mi-recibo/${me.last_settlement!.id}`, "_blank")}>
            <span>Última liquidación (N° {me.last_settlement.number})</span><strong>{money(me.last_settlement.net)}</strong>
            <small>{periodLabel(me.last_settlement.period)} · {me.last_settlement.paid ? "transferida" : "a transferir"} · ver recibo</small>
          </button>
        )}
      </div>

      <Tabs value={tab} onChange={setTab} options={[["prest", "Mis prestaciones"], ["liq", "Mis liquidaciones"]]} />

      {tab === "prest" && (<>
        <div className="mr-toolbar">
          <select className="mr-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="">Todos los períodos</option>
            {[0, -1, -2, -3, -4, -5].map((i) => { const p = shiftPeriod(currentPeriod(), i); return <option key={p} value={p}>{periodLabel(p)}</option>; })}
          </select>
          {!canLoad && <span className="mr-muted">El círculo carga las prestaciones por vos; acá ves su estado.</span>}
        </div>
        {!items ? <Loading /> : items.length === 0 ? <Empty title="No hay prestaciones en este período" /> : (
          <div className="mr-table-wrap">
            <table className="mr-table mr-table-cards">
              <thead><tr><th>Fecha</th><th>Paciente</th><th>Obra social</th><th>Código</th><th className="num">Total</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Fecha">{shortDate(p.date)}</td>
                    <td data-label="Paciente"><strong>{p.patient_name}</strong><small>{p.affiliate_number ? `Afil. ${p.affiliate_number}` : ""}</small></td>
                    <td data-label="Obra social">{p.payer_name}</td>
                    <td data-label="Código"><span className="mr-code-sm">{p.code}</span><small>{p.description}</small></td>
                    <td className="num" data-label="Total">{money(p.total)}{p.debit_amount > 0 && <small style={{ color: "var(--mr-red-text)" }}>débito {money(p.debit_amount)}</small>}</td>
                    <td data-label="Estado"><Pill tone={PREST_STATUS[p.status].tone}>{PREST_STATUS[p.status].label}</Pill>{p.observation && <small>{p.observation}</small>}{p.debit_reason && <small>{p.debit_reason}</small>}</td>
                    <td className="num mr-cell-actions">{canLoad && EDITABLE.includes(p.status) && <><button className="mr-link" onClick={() => setForm(p)}>{p.status === "OBSERVADA" ? "Corregir" : "Editar"}</button>{" "}<button className="mr-link mr-link-danger" onClick={() => remove(p)}>Borrar</button></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>)}

      {tab === "liq" && (!settlements ? <Loading /> : settlements.length === 0 ? <Empty title="Todavía no tenés liquidaciones" /> : (
        <div className="mr-table-wrap">
          <table className="mr-table mr-table-cards">
            <thead><tr><th>N°</th><th>Período</th><th className="num">Bruto</th><th className="num">Descuentos</th><th className="num">Neto</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {settlements.map((l) => (
                <tr key={l.id}>
                  <td data-label="N°"><strong>{l.number}</strong></td><td data-label="Período">{periodLabel(l.period)}</td>
                  <td className="num" data-label="Bruto">{money(l.gross)}</td><td className="num" data-label="Descuentos">{money(l.gross - l.net)}</td><td className="num" data-label="Neto"><strong>{money(l.net)}</strong></td>
                  <td data-label="Estado">{l.paid ? <Pill tone="green">Transferida</Pill> : <Pill tone="orange">A transferir</Pill>}</td>
                  <td className="num mr-cell-actions"><a className="secondary-button" href={`/print/mi-recibo/${l.id}`} target="_blank" rel="noreferrer">Recibo</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {form && <PrestacionForm prest={form === "new" ? null : form} base="/portal/prestaciones" payers={payers} loadRates={loadRates}
        onClose={() => setForm(null)}
        onSaved={(p, again) => { if (!again) setForm(null); show(p.possible_duplicate ? "Guardada. Ojo: parece duplicada" : "Prestación guardada"); loadItems(); loadMe(); }} />}
      {flash}
    </section>
  );
}

export default Portal;
