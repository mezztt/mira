import { useCallback, useEffect, useState } from "react";
import { appApi, getSessionUser, money, shortDate, BUDGET_STATUS } from "../../config";
import type { Budget, BudgetLite, BudgetStatus, Practice, Professional } from "../../config";
import { Empty, Loading, Pill, useFlash } from "../ui";
import BudgetEditor from "./BudgetEditor";
import BudgetDetail from "./BudgetDetail";

interface ListData { items: BudgetLite[]; summary: { count: number; accepted_total: number; paid: number; balance: number; presented_total: number } }

/**
 * Lista de presupuestos con alta, detalle y filtros. Se usa en la página «Presupuestos»
 * (todos) y en la ficha del paciente (los de ese paciente).
 */
export default function BudgetsView({ patientId, patientName, initialStatus = "", initialPending = false, practicesKey = 0, onChanged }: {
  patientId?: number; patientName?: string; initialStatus?: string; initialPending?: boolean; practicesKey?: number; onChanged?: () => void;
}) {
  const user = getSessionUser();
  const canWrite = user?.role === "ADMINISTRADOR" || user?.role === "PROFESIONAL";
  const { show, fail, node: flash } = useFlash();
  const [data, setData] = useState<ListData | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(initialPending);
  const [q, setQ] = useState("");
  const [prof, setProf] = useState("");
  const [practices, setPractices] = useState<Practice[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  const [detail, setDetail] = useState<number | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (patientId) params.set("patient_id", String(patientId));
    if (status) params.set("status", status);
    if (pending) params.set("pending", "true");
    if (prof) params.set("professional_id", prof);
    if (q.trim()) params.set("q", q.trim());
    appApi<ListData>(`/budgets?${params}`).then(setData).catch(fail);
  }, [patientId, status, pending, prof, q, fail]);
  useEffect(() => {
    const t = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);
  useEffect(() => {
    appApi<Practice[]>("/practices").then(setPractices).catch(() => {});
    appApi<Professional[]>("/professionals").then(setProfessionals).catch(() => {});
  }, [practicesKey]);

  const changed = (msg?: string) => { if (msg) show(msg); load(); onChanged?.(); };
  const s = data?.summary;

  return (
    <div>
      <div className="mr-toolbar">
        <div className="mr-row">
          {canWrite && <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo presupuesto</button>}
          {!patientId && <input className="mr-search" placeholder="Buscar por paciente, título o N°…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar presupuesto" />}
        </div>
        <div className="mr-filters">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            {(Object.keys(BUDGET_STATUS) as BudgetStatus[]).map((k) => <option key={k} value={k}>{BUDGET_STATUS[k].label}</option>)}
          </select>
          {!patientId && professionals.length > 1 && (
            <select value={prof} onChange={(e) => setProf(e.target.value)} aria-label="Profesional">
              <option value="">Todos los profesionales</option>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <label className="mr-inline-checks" style={{ paddingTop: 0 }}>
            <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} /> Con saldo pendiente
          </label>
        </div>
      </div>

      {s && !patientId && (
        <div className="mr-kpis">
          <div className="mr-kpi"><span>Presentados (esperando respuesta)</span><strong>{money(s.presented_total)}</strong><small>en esta lista</small></div>
          <div className="mr-kpi"><span>Aceptados</span><strong>{money(s.accepted_total)}</strong><small>cobrado {money(s.paid)}</small></div>
          <div className={`mr-kpi ${s.balance > 0 ? "is-warn" : ""}`}><span>Saldo por cobrar</span><strong>{money(s.balance)}</strong><small>de presupuestos aceptados</small></div>
        </div>
      )}

      {!data ? <Loading /> : data.items.length === 0 ? (
        <Empty title={status || pending || q ? "No hay presupuestos con ese filtro" : "Todavía no hay presupuestos"}>
          {canWrite ? "Armá el primero con “Nuevo presupuesto”." : "Los arma el profesional o el administrador."}
        </Empty>
      ) : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead>
              <tr><th>N°</th>{!patientId && <th>Paciente</th>}<th>Detalle</th><th>Estado</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th></tr>
            </thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b.id} className="is-click" onClick={() => setDetail(b.id)}>
                  <td><strong>{b.number}</strong><small>{shortDate(b.created_at)}</small></td>
                  {!patientId && <td>{b.patient_name}{b.patient_phone && <small>{b.patient_phone}</small>}</td>}
                  <td>{b.title || `${b.items_count} renglones`}<small>{b.professional_name || "Sin profesional"}{b.status === "ACEPTADO" || b.status === "FINALIZADO" ? ` · ${b.done_count}/${b.items_count} realizados` : ""}</small></td>
                  <td><Pill tone={BUDGET_STATUS[b.status].tone}>{BUDGET_STATUS[b.status].label}</Pill>{b.expired && <small>Venció el {shortDate(b.valid_until)}</small>}</td>
                  <td className="num">{money(b.total)}</td>
                  <td className="num">{money(b.paid)}</td>
                  <td className="num">{b.status === "ACEPTADO" || b.status === "FINALIZADO" ? (b.balance > 0 ? <strong>{money(b.balance)}</strong> : "Pagado") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <BudgetEditor budget={editing === "new" ? null : editing} patientId={patientId} patientName={patientName}
          practices={practices} professionals={professionals} onClose={() => setEditing(null)}
          onSaved={(b) => { setEditing(null); changed("Presupuesto guardado"); setDetail(b.id); }} />
      )}
      {detail !== null && !editing && (
        <BudgetDetail budgetId={detail} onClose={() => setDetail(null)} onChanged={changed}
          onEdit={(b) => setEditing(b)} />
      )}
      {flash}
    </div>
  );
}
