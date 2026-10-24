import { useCallback, useEffect, useState } from "react";
import { appApi, canAccess, dateTime, getSessionUser, money, shortDate, BUDGET_STATUS, PAYMENT_LABELS, PAYMENT_METHODS } from "../../config";
import type { Budget, BudgetItem, BudgetStatus } from "../../config";
import { Field, Loading, Modal, Pill, numOrNull, strOrNull } from "../ui";

/** Detalle del presupuesto: estado, renglones realizados, pagos y saldo. */
export default function BudgetDetail({ budgetId, onClose, onChanged, onEdit }: {
  budgetId: number; onClose: () => void; onChanged: (msg?: string) => void; onEdit: (b: Budget) => void;
}) {
  const user = getSessionUser();
  const canWrite = user?.role === "ADMINISTRADOR" || user?.role === "PROFESIONAL";
  const isAdmin = user?.role === "ADMINISTRADOR";
  const canTeeth = !!user?.professional_id && canAccess(user, "odontologia");
  const [b, setB] = useState<Budget | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toTeeth, setToTeeth] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [payNotes, setPayNotes] = useState("");
  const [cuotas, setCuotas] = useState("1");

  const apply = useCallback((x: Budget) => { setB(x); setCuotas(String(x.installments || 1)); }, []);
  useEffect(() => { appApi<Budget>(`/budgets/${budgetId}`).then(apply).catch((e) => setError(e.message)); }, [budgetId, apply]);

  async function run(fn: () => Promise<Budget>, ok?: string) {
    setError("");
    setBusy(true);
    try {
      apply(await fn());
      onChanged(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  const setStatus = (status: BudgetStatus, ok: string) => run(() => appApi<Budget>(`/budgets/${budgetId}/status`, { method: "POST", body: { status } }), ok);

  function toggleDone(item: BudgetItem) {
    const done = !item.done;
    const register = done && toTeeth && canTeeth && !!item.tooth && !!item.condition;
    run(async () => {
      const r = await appApi<Budget>(`/budgets/${budgetId}/items/${item.id}/done`, { method: "POST", body: { done, register_odontogram: register } });
      return r;
    }, done ? (register ? "Realizado y registrado en el odontograma" : "Marcado como realizado") : "Marcado como pendiente");
  }

  function pay() {
    const value = numOrNull(amount);
    if (!value || value <= 0) return setError("Ingresá el monto del pago");
    run(async () => {
      const r = await appApi<Budget>(`/budgets/${budgetId}/payments`, { method: "POST", body: { amount: value, method, notes: strOrNull(payNotes) } });
      setAmount(""); setPayNotes("");
      return r;
    }, "Pago registrado");
  }

  function removePayment(id: number) {
    if (!confirm("¿Borrar este pago? También se saca de la caja.")) return;
    run(() => appApi<Budget>(`/budgets/${budgetId}/payments/${id}`, { method: "DELETE" }), "Pago borrado");
  }

  function saveCuotas() {
    if (!b || !canWrite || b.status !== "ACEPTADO") return;
    const n = Math.min(60, Math.max(1, Math.round(numOrNull(cuotas) || 1)));
    if (n === b.installments) return;
    run(() => appApi<Budget>(`/budgets/${budgetId}`, { method: "PUT", body: { notes: b.notes, installments: n, items: [] } }));
  }

  async function remove() {
    if (!b || !confirm(`¿Borrar el presupuesto N° ${b.number}? No se puede deshacer.`)) return;
    try {
      await appApi(`/budgets/${budgetId}`, { method: "DELETE" });
      onChanged("Presupuesto borrado");
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo borrar"); }
  }

  if (!b) {
    return <Modal eyebrow="PRESUPUESTO" title="Presupuesto" onClose={onClose}>{error ? <div className="mr-note mr-note-error">{error}</div> : <Loading />}</Modal>;
  }

  const st = BUDGET_STATUS[b.status];
  const accepted = b.status === "ACEPTADO";
  const canPay = (accepted || b.status === "FINALIZADO") && b.balance > 0;
  const n = Math.min(60, Math.max(1, Math.round(numOrNull(cuotas) || 1)));
  const base = b.paid > 0 ? b.balance : b.total;
  const hasTeeth = b.items.some((i) => i.tooth && i.condition && !i.done);
  const allDone = b.items.length > 0 && b.items.every((i) => i.done);

  return (
    <Modal eyebrow={`PRESUPUESTO N° ${b.number} · ${shortDate(b.created_at)}`} title={b.patient_name || "Presupuesto"} onClose={onClose} size="xl"
      footer={<>
        <button className="secondary-button" onClick={() => window.open(`/print/presupuesto/${b.id}`, "_blank")}>Imprimir / PDF</button>
        {canWrite && b.editable && <button className="secondary-button" onClick={() => onEdit(b)} disabled={busy}>Editar renglones</button>}
        {canWrite && b.status === "BORRADOR" && <button className="primary-button" onClick={() => setStatus("PRESENTADO", "Presupuesto presentado")} disabled={busy}>Marcar como presentado</button>}
        {canWrite && b.status === "PRESENTADO" && <button className="mr-danger-button" onClick={() => setStatus("RECHAZADO", "Presupuesto rechazado")} disabled={busy}>El paciente lo rechazó</button>}
        {canWrite && b.editable && <button className="primary-button" onClick={() => { if (confirm("Al aceptar, los renglones y el total quedan fijos. ¿Seguir?")) setStatus("ACEPTADO", "Presupuesto aceptado"); }} disabled={busy}>El paciente aceptó</button>}
        {canWrite && accepted && <button className="primary-button" onClick={() => setStatus("FINALIZADO", "Tratamiento finalizado")} disabled={busy}>Finalizar tratamiento</button>}
      </>}>
      <div className="mr-spread" style={{ marginBottom: 12 }}>
        <div className="mr-row">
          <Pill tone={st.tone}>{st.label}</Pill>
          {b.expired && <Pill tone="orange">Venció el {shortDate(b.valid_until)}</Pill>}
          {b.title && <strong>{b.title}</strong>}
        </div>
        <span className="mr-muted">
          {b.professional_name || "Sin profesional"}{b.valid_until && !b.expired ? ` · válido hasta ${shortDate(b.valid_until)}` : ""}
        </span>
      </div>

      {accepted && canWrite && hasTeeth && (canTeeth ? (
        <div className="mr-inline-checks" style={{ marginBottom: 10 }}>
          <label><input type="checkbox" checked={toTeeth} onChange={(e) => setToTeeth(e.target.checked)} /> Al marcar un renglón con pieza, registrarlo también como realizado en el odontograma</label>
        </div>
      ) : <p className="mr-hint" style={{ marginBottom: 10 }}>Para que los realizados pasen al odontograma, tu usuario tiene que estar vinculado a un profesional.</p>)}

      <div className="mr-table-wrap">
        <table className="mr-table">
          <thead><tr>{(accepted || b.status === "FINALIZADO") && <th>Realizado</th>}<th>Descripción</th><th>Pieza</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {b.items.map((i) => (
              <tr key={i.id}>
                {(accepted || b.status === "FINALIZADO") && (
                  <td>
                    {accepted && canWrite
                      ? <label className="mr-inline-checks" style={{ paddingTop: 0 }}><input type="checkbox" checked={!!i.done} disabled={busy} onChange={() => toggleDone(i)} aria-label={`Realizado: ${i.description}`} /> {i.done ? "Sí" : "No"}</label>
                      : i.done ? <Pill tone="green">Realizado</Pill> : <Pill tone="gray">Pendiente</Pill>}
                    {i.done && i.done_at && <small>{shortDate(i.done_at)}</small>}
                  </td>
                )}
                <td>{i.description}</td>
                <td>{i.tooth ? `${i.tooth}${i.surface ? ` · ${i.surface}` : ""}` : "—"}</td>
                <td className="num">{i.quantity}</td><td className="num">{money(i.unit_price)}</td><td className="num">{money(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {accepted && allDone && <div className="mr-note mr-note-info" style={{ marginTop: 10 }}>Todos los renglones están realizados. Cuando quieras, cerralo con “Finalizar tratamiento”.</div>}

      <div className="mr-grid-2" style={{ marginTop: 16, marginBottom: 0 }}>
        <div className="mr-card">
          <h2>Pagos</h2>
          {b.payments.length === 0 ? <p className="mr-muted">Todavía no hay pagos.</p> : (
            <ul className="mr-list" style={{ marginTop: 8 }}>
              {b.payments.map((p) => (
                <li key={p.id}>
                  <span className="mr-time-badge">{dateTime(p.date)}</span>
                  <div className="mr-list-main"><strong>{money(p.amount)}</strong><small>{PAYMENT_LABELS[p.method] || p.method}{p.notes ? ` · ${p.notes}` : ""}</small></div>
                  {isAdmin && <button type="button" className="mr-link mr-link-danger" onClick={() => removePayment(p.id)} disabled={busy}>Borrar</button>}
                </li>
              ))}
            </ul>
          )}
          {canPay ? (
            <div className="product-form" style={{ marginTop: 12 }}>
              <div className="form-row">
                <Field label="Monto"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(n > 1 ? Math.min(b.balance, Math.round((base / n) * 100) / 100) : b.balance)} /></div></Field>
                <Field label="Medio de pago">
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Nota (opcional)"><input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} maxLength={255} placeholder="Ej. cuota 1" /></Field>
              <button type="button" className="primary-button" onClick={pay} disabled={busy} style={{ alignSelf: "flex-start" }}>Registrar pago</button>
              <small className="mr-hint">Cada pago queda también en la caja como “Presupuesto N° {b.number}”.</small>
            </div>
          ) : !accepted && b.status !== "FINALIZADO" ? <p className="mr-hint">Los pagos se cargan cuando el paciente acepta el presupuesto.</p> : null}
        </div>

        <div className="mr-card">
          <h2>Totales</h2>
          <div style={{ marginTop: 8 }}>
            <div className="mr-sum-row"><span>Subtotal</span><span>{money(b.subtotal)}</span></div>
            {b.discount_percent > 0 && <div className="mr-sum-row is-minus"><span>Descuento {b.discount_percent}%</span><span>− {money(b.discount_amount)}</span></div>}
            <div className="mr-sum-row"><span><strong>Total</strong></span><span><strong>{money(b.total)}</strong></span></div>
            <div className="mr-sum-row"><span>Pagado</span><span>{money(b.paid)}</span></div>
            <div className="mr-sum-row is-total"><span>Saldo</span><span>{money(b.balance)}</span></div>
          </div>
          <div className="product-form" style={{ marginTop: 12 }}>
            <Field label="Cantidad de cuotas" hint="Solo calcula el valor sugerido de cada cuota; no genera vencimientos.">
              <input type="number" min="1" max="60" value={cuotas} onChange={(e) => setCuotas(e.target.value)} onBlur={saveCuotas} />
            </Field>
            <p className="mr-muted" style={{ margin: 0 }}>
              {n > 1 ? <>{n} cuotas de <strong>{money(Math.round((base / n) * 100) / 100)}</strong>{b.paid > 0 ? " (sobre el saldo)" : ""}</> : "Un solo pago."}
            </p>
          </div>
          {b.notes && <p className="mr-muted" style={{ marginTop: 10 }}>Notas: {b.notes}</p>}
        </div>
      </div>

      {error && <div className="mr-note mr-note-error" style={{ marginTop: 12 }}>{error}</div>}
      {canWrite && (
        <div className="mr-row" style={{ marginTop: 14 }}>
          {b.status === "PRESENTADO" && <button type="button" className="mr-link" onClick={() => setStatus("BORRADOR", "Volvió a borrador")}>Volver a borrador</button>}
          {b.status === "RECHAZADO" && <button type="button" className="mr-link" onClick={() => setStatus("BORRADOR", "Volvió a borrador")}>Reabrir como borrador</button>}
          {b.status === "FINALIZADO" && <button type="button" className="mr-link" onClick={() => setStatus("ACEPTADO", "Presupuesto reabierto")}>Reabrir (volver a aceptado)</button>}
          {accepted && b.payments.length === 0 && !b.items.some((i) => i.done) && <button type="button" className="mr-link" onClick={() => setStatus("PRESENTADO", "Volvió a presentado")}>Deshacer la aceptación</button>}
          {(b.editable || b.status === "RECHAZADO") && b.payments.length === 0 && <button type="button" className="mr-link mr-link-danger" onClick={remove}>Borrar presupuesto</button>}
        </div>
      )}
    </Modal>
  );
}
