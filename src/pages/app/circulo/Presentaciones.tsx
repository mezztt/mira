import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { appApi, downloadFile, getSessionUser, dayKey, money, shortDate, periodLabel, BATCH_STATUS, PREST_STATUS } from "../../../config";
import type { Prestacion } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, numOrNull, strOrNull, useFlash } from "../../../components/ui";

interface Batch {
  id: number; number: number; payer_id: number; payer_name: string | null; period: string; status: string; total: number;
  paid_amount: number; debited_amount: number; pending_amount: number; invoice_number: string | null; presented_at: string | null;
  due_date: string | null; overdue: boolean; notes: string | null; created_at: string | null; count: number;
}
interface BatchDetail extends Batch { prestaciones: Prestacion[]; payments: { id: number; date: string; amount: number; notes: string | null }[] }
interface Ready { payer_id: number; payer_name: string; period: string; count: number; total: number }

function Presentaciones() {
  const user = getSessionUser();
  const [params, setParams] = useSearchParams();
  const { show, fail, node: flash } = useFlash();
  const [filter, setFilter] = useState("abiertas");
  const [data, setData] = useState<{ items: Batch[]; ready: Ready[] } | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);

  const load = useCallback(() => {
    const status = filter === "abiertas" ? "ABIERTA,PRESENTADA,COBRADA_PARCIAL" : filter === "cobradas" ? "COBRADA" : "";
    appApi<{ items: Batch[]; ready: Ready[] }>(`/batches${status ? `?status=${status}` : ""}`).then(setData).catch(fail);
  }, [filter, fail]);
  useEffect(() => { load(); }, [load]);

  const open = useCallback((id: number) => { appApi<BatchDetail>(`/batches/${id}`).then(setDetail).catch(fail); }, [fail]);
  useEffect(() => {
    const id = Number(params.get("id"));
    if (id) { open(id); setParams({}, { replace: true }); }
  }, [params, open, setParams]);

  async function create(r: Ready) {
    try {
      const b = await appApi<BatchDetail>("/batches", { method: "POST", body: { payer_id: r.payer_id, period: r.period } });
      show(`Presentación N° ${b.number} armada con ${b.count} prestaciones`);
      setDetail(b);
      load();
    } catch (e) { fail(e); }
  }

  return (
    <section className="products-page">
      <PageHeader eyebrow="PRESENTACIONES" title="Presentaciones a obras sociales" subtitle="Armá la facturación de cada convenio, presentala, registrá cobros y débitos." />

      <div className="mr-card" style={{ marginBottom: 16 }}>
        <div className="mr-card-head"><div><h2>Listo para presentar</h2><p>Prestaciones aprobadas que todavía no están en ninguna presentación</p></div></div>
        {!data ? <Loading /> : data.ready.length === 0 ? <Empty title="No hay prestaciones aprobadas pendientes">Aprobalas en Prestaciones y aparecen acá agrupadas por convenio.</Empty> : (
          <div className="mr-ready">
            {data.ready.map((r) => (
              <div key={`${r.payer_id}-${r.period}`} className="mr-ready-card">
                <strong>{r.payer_name}</strong>
                <small>{periodLabel(r.period)} · {r.count} prestaciones</small>
                <span className="mr-total-big" style={{ fontSize: 22 }}>{money(r.total)}</span>
                <button className="primary-button" onClick={() => create(r)}>Armar presentación</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mr-toolbar">
        <Seg value={filter} onChange={setFilter} options={[["abiertas", "En curso"], ["cobradas", "Cobradas"], ["todas", "Todas"]]} />
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title="No hay presentaciones" /> : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>N°</th><th>Convenio</th><th>Período</th><th>Presentada</th><th className="num">Total</th><th className="num">Cobrado</th><th className="num">Débitos</th><th className="num">Pendiente</th><th>Estado</th></tr></thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b.id} className="is-click" onClick={() => open(b.id)}>
                  <td><strong>{b.number}</strong></td>
                  <td>{b.payer_name}<small>{b.count} prestaciones</small></td>
                  <td>{periodLabel(b.period)}</td>
                  <td>{b.presented_at ? shortDate(b.presented_at) : "—"}{b.invoice_number && <small>Fact. {b.invoice_number}</small>}</td>
                  <td className="num">{money(b.total)}</td>
                  <td className="num">{money(b.paid_amount)}</td>
                  <td className="num">{b.debited_amount ? money(b.debited_amount) : "—"}</td>
                  <td className="num"><strong>{money(b.pending_amount)}</strong>{b.due_date && <small>vence {shortDate(b.due_date)}</small>}</td>
                  <td><Pill tone={b.overdue ? "red" : BATCH_STATUS[b.status]?.tone}>{b.overdue ? "Vencida" : BATCH_STATUS[b.status]?.label}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && <BatchModal batch={detail} isAdmin={user?.role === "ADMINISTRADOR"} onClose={() => setDetail(null)}
        onChange={(b, msg) => { if (b) setDetail(b); else setDetail(null); load(); if (msg) show(msg); }} fail={fail} />}
      {flash}
    </section>
  );
}

function BatchModal({ batch: b, isAdmin, onClose, onChange, fail }: {
  batch: BatchDetail; isAdmin: boolean; onClose: () => void; onChange: (b: BatchDetail | null, msg?: string) => void; fail: (e: unknown) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [action, setAction] = useState<"present" | "pay" | "debits" | "close" | null>(null);
  const [invoice, setInvoice] = useState(b.invoice_number || "");
  const [presentedAt, setPresentedAt] = useState(dayKey(new Date()));
  const [payAmount, setPayAmount] = useState(String(b.pending_amount || ""));
  const [payDate, setPayDate] = useState(dayKey(new Date()));
  const [payNotes, setPayNotes] = useState("");
  const [debits, setDebits] = useState<Record<number, { amount: string; reason: string }>>({});
  const [closeReason, setCloseReason] = useState("Diferencia de pago de la obra social");
  const open = b.status === "ABIERTA";
  const live = b.status === "PRESENTADA" || b.status === "COBRADA_PARCIAL";

  async function call(path: string, body: unknown, msg: string, method = "POST") {
    try {
      const r = await appApi<BatchDetail>(`/batches/${b.id}${path}`, { method, body });
      setAction(null); setSelected(new Set());
      onChange(method === "DELETE" ? null : r, msg);
    } catch (e) { fail(e); }
  }
  function saveDebits() {
    const items = Object.entries(debits).filter(([, d]) => d.amount !== "").map(([id, d]) => ({ prestacion_id: Number(id), amount: numOrNull(d.amount) ?? 0, reason: d.reason.trim() || "Débito de la obra social" }));
    if (!items.length) return fail(new Error("Cargá al menos un débito"));
    call("/debits", { items }, `${items.length} débito(s) cargados`);
  }

  return (
    <Modal eyebrow={`PRESENTACIÓN N° ${b.number} · ${periodLabel(b.period).toUpperCase()}`} title={b.payer_name || "Presentación"} onClose={onClose} size="xl">
      <div className="mr-row" style={{ marginBottom: 12 }}>
        <Pill tone={b.overdue ? "red" : BATCH_STATUS[b.status]?.tone}>{b.overdue ? "Vencida" : BATCH_STATUS[b.status]?.label}</Pill>
        {b.invoice_number && <Pill tone="gray">Factura {b.invoice_number}</Pill>}
        {b.presented_at && <Pill tone="gray">Presentada {shortDate(b.presented_at)}</Pill>}
        {b.due_date && <Pill tone={b.overdue ? "red" : "gray"}>Vence {shortDate(b.due_date)}</Pill>}
      </div>
      <div className="mr-kpis">
        <div className="mr-kpi"><span>Total presentado</span><strong>{money(b.total)}</strong><small>{b.count} prestaciones</small></div>
        <div className="mr-kpi"><span>Cobrado</span><strong>{money(b.paid_amount)}</strong></div>
        <div className={`mr-kpi ${b.debited_amount ? "is-alert" : ""}`}><span>Débitos</span><strong>{money(b.debited_amount)}</strong></div>
        <div className={`mr-kpi ${b.pending_amount && live ? "is-warn" : ""}`}><span>Pendiente</span><strong>{money(b.pending_amount)}</strong></div>
      </div>

      <div className="mr-row" style={{ marginBottom: 12 }}>
        {open && <button className="primary-button" onClick={() => setAction("present")}>Marcar presentada</button>}
        {open && <button className="secondary-button" onClick={() => call("/refresh", undefined, "Se sumaron las aprobadas nuevas")}>Sumar aprobadas nuevas</button>}
        {open && selected.size > 0 && <button className="secondary-button" onClick={() => call("/remove", { ids: [...selected] }, "Prestaciones quitadas")}>Quitar {selected.size} seleccionadas</button>}
        {open && <button className="mr-danger-button" onClick={() => confirm("¿Deshacer esta presentación? Las prestaciones vuelven a 'aprobadas'.") && call("", undefined, "Presentación deshecha", "DELETE")}>Deshacer</button>}
        {live && <button className="primary-button" onClick={() => setAction("pay")}>Registrar cobro</button>}
        {live && <button className="secondary-button" onClick={() => setAction(action === "debits" ? null : "debits")}>{action === "debits" ? "Cancelar débitos" : "Cargar débitos"}</button>}
        {live && isAdmin && <button className="secondary-button" onClick={() => setAction("close")}>Cerrar con diferencia</button>}
        <button className="secondary-button" onClick={() => downloadFile(`/batches/${b.id}/export.csv`, `presentacion-${b.number}.csv`).catch(fail)}>Exportar planilla</button>
      </div>

      {action === "present" && (
        <div className="mr-card" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <Field label="N° de factura / liquidación"><input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="0001-00001234" /></Field>
            <Field label="Fecha de presentación"><input type="date" value={presentedAt} onChange={(e) => setPresentedAt(e.target.value)} /></Field>
          </div>
          <button className="primary-button" onClick={() => call("/present", { invoice_number: strOrNull(invoice), presented_at: presentedAt }, "Presentación registrada")}>Confirmar</button>
        </div>
      )}
      {action === "pay" && (
        <div className="mr-card" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <Field label="Monto cobrado"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div></Field>
            <Field label="Fecha"><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
          </div>
          <Field label="Notas"><input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Transferencia, orden de pago…" /></Field>
          <button className="primary-button" onClick={() => call("/payments", { amount: numOrNull(payAmount), date: payDate, notes: strOrNull(payNotes) }, "Cobro registrado")}>Guardar cobro</button>
        </div>
      )}
      {action === "close" && (
        <div className="mr-card" style={{ marginBottom: 12 }}>
          <p className="mr-muted" style={{ marginTop: 0 }}>Si la obra social no va a pagar el resto ({money(b.pending_amount)}), se reparte como débito proporcional entre las prestaciones y la presentación queda cerrada.</p>
          <Field label="Motivo"><input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} /></Field>
          <button className="mr-danger-button" onClick={() => call("/close", { reason: closeReason }, "Presentación cerrada")}>Cerrar presentación</button>
        </div>
      )}
      {action === "debits" && <div className="mr-note mr-note-warn" style={{ marginBottom: 10 }}>Cargá el monto debitado y el motivo en cada prestación. Si el débito es por el total, queda como debitada (y se puede refacturar).</div>}

      <div className="mr-table-wrap">
        <table className="mr-table">
          <thead><tr>
            {open && <th><input type="checkbox" checked={b.prestaciones.length > 0 && b.prestaciones.every((p) => selected.has(p.id))} onChange={(e) => setSelected(e.target.checked ? new Set(b.prestaciones.map((p) => p.id)) : new Set())} /></th>}
            <th>Médico</th><th>Fecha</th><th>Paciente</th><th>Código</th><th className="num">Total</th><th>{action === "debits" ? "Débito" : "Estado"}</th>
          </tr></thead>
          <tbody>
            {b.prestaciones.map((p) => (
              <tr key={p.id}>
                {open && <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => { const s = new Set(selected); if (s.has(p.id)) s.delete(p.id); else s.add(p.id); setSelected(s); }} /></td>}
                <td>{p.member_name}</td><td>{shortDate(p.date)}</td>
                <td>{p.patient_name}<small>{p.affiliate_number ? `Afil. ${p.affiliate_number}` : ""}{p.authorization ? ` · Aut. ${p.authorization}` : ""}</small></td>
                <td><span className="mr-code-sm">{p.code}</span>{p.quantity > 1 ? ` ×${p.quantity}` : ""}</td>
                <td className="num">{money(p.total)}{p.debit_amount > 0 && <small style={{ color: "var(--mr-red-text)" }}>−{money(p.debit_amount)}</small>}</td>
                <td>
                  {action === "debits" ? (
                    <div className="mr-row">
                      <input className="mr-amount-in" type="number" min="0" max={p.total} placeholder={p.debit_amount ? String(p.debit_amount) : "$"} value={debits[p.id]?.amount ?? ""}
                        onChange={(e) => setDebits({ ...debits, [p.id]: { amount: e.target.value, reason: debits[p.id]?.reason || p.debit_reason || "" } })} />
                      <input placeholder="Motivo" value={debits[p.id]?.reason ?? p.debit_reason ?? ""} style={{ minWidth: 140 }}
                        onChange={(e) => setDebits({ ...debits, [p.id]: { amount: debits[p.id]?.amount ?? "", reason: e.target.value } })} />
                    </div>
                  ) : <><Pill tone={PREST_STATUS[p.status].tone}>{PREST_STATUS[p.status].label}</Pill>{p.debit_reason && <small>{p.debit_reason}</small>}</>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {action === "debits" && <div className="modal-actions"><button className="primary-button" onClick={saveDebits}>Guardar débitos</button></div>}

      {b.payments.length > 0 && (
        <>
          <h4 className="mr-form-title" style={{ marginTop: 18 }}>Cobros registrados</h4>
          <ul className="mr-list">
            {b.payments.map((x) => <li key={x.id}><span className="mr-time-badge">{shortDate(x.date)}</span><div className="mr-list-main"><strong>{money(x.amount)}</strong><small>{x.notes || ""}</small></div></li>)}
          </ul>
        </>
      )}
    </Modal>
  );
}

export default Presentaciones;
