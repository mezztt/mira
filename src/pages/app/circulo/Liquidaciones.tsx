import { useCallback, useEffect, useState } from "react";
import { appApi, downloadFile, getSessionUser, money, shortDate, periodLabel, currentPeriod, shiftPeriod, SETTLEMENT_STATUS, TAX_LABELS } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, numOrNull, strOrNull, useFlash } from "../../../components/ui";

interface Settlement {
  id: number; number: number; period: string; status: string; gross: number; deductions: number; net: number; notes: string | null;
  created_at: string | null; closed_at: string | null; paid_at: string | null; members?: number;
}
export interface Line {
  id: number; member_id: number; member_name: string | null; member_license: string | null; cbu: string | null; bank_alias: string | null;
  cuit: string | null; tax_condition: string | null; prestaciones_count: number; gross: number; admin_fee: number; membership_fee: number;
  ganancias: number; iibb: number; other_deductions: number; other_concept: string | null; net: number; paid: boolean; paid_at: string | null; payment_ref: string | null;
}
interface Detail extends Settlement { lines: Line[] }

function Liquidaciones() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMINISTRADOR";
  const { show, fail, node: flash } = useFlash();
  const [data, setData] = useState<{ items: Settlement[]; ready: { count: number; total: number } } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => { appApi<typeof data>("/settlements").then(setData).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);
  const open = (id: number) => appApi<Detail>(`/settlements/${id}`).then(setDetail).catch(fail);

  const hasDraft = data?.items.some((s) => s.status === "BORRADOR");

  return (
    <section className="products-page">
      <PageHeader eyebrow="LIQUIDACIONES" title="Liquidación de honorarios" subtitle="Lo cobrado a las obras sociales, repartido a cada médico con sus descuentos y retenciones.">
        {isAdmin && !hasDraft && <button className="primary-button" onClick={() => setCreating(true)} disabled={!data?.ready.count}>+ Nueva liquidación</button>}
      </PageHeader>

      {data && (
        <div className="mr-note mr-note-info" style={{ marginBottom: 16 }}>
          {data.ready.count
            ? <>Hay <b>{data.ready.count}</b> prestaciones cobradas por <b>{money(data.ready.total)}</b> listas para liquidar{hasDraft ? " (se suman al recalcular el borrador)" : ""}.</>
            : "No hay prestaciones cobradas pendientes de liquidar. Se habilitan cuando registrás los cobros en Presentaciones."}
        </div>
      )}

      {!data ? <Loading /> : data.items.length === 0 ? <Empty title="Todavía no hay liquidaciones" /> : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>N°</th><th>Período</th><th className="num">Médicos</th><th className="num">Bruto</th><th className="num">Descuentos</th><th className="num">Neto a pagar</th><th>Estado</th></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id} className="is-click" onClick={() => open(s.id)}>
                  <td><strong>{s.number}</strong></td>
                  <td>{periodLabel(s.period)}<small>{s.closed_at ? `Cerrada ${shortDate(s.closed_at)}` : "Borrador"}</small></td>
                  <td className="num">{s.members}</td>
                  <td className="num">{money(s.gross)}</td>
                  <td className="num">{money(s.deductions)}</td>
                  <td className="num"><strong>{money(s.net)}</strong></td>
                  <td><Pill tone={SETTLEMENT_STATUS[s.status]?.tone}>{SETTLEMENT_STATUS[s.status]?.label}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onDone={(d) => { setCreating(false); setDetail(d); load(); show(`Liquidación N° ${d.number} armada`); }} fail={fail} />}
      {detail && <SettlementModal s={detail} isAdmin={isAdmin} onClose={() => setDetail(null)} fail={fail}
        onChange={(d, msg) => { setDetail(d); load(); if (msg) show(msg); }} />}
      {flash}
    </section>
  );
}

function CreateModal({ onClose, onDone, fail }: { onClose: () => void; onDone: (d: Detail) => void; fail: (e: unknown) => void }) {
  const [period, setPeriod] = useState(currentPeriod());
  const [notes, setNotes] = useState("");
  async function create() {
    try { onDone(await appApi<Detail>("/settlements", { method: "POST", body: { period, notes: strOrNull(notes) } })); } catch (e) { fail(e); }
  }
  return (
    <Modal eyebrow="NUEVA LIQUIDACIÓN" title="Liquidar honorarios" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={create}>Armar borrador</button></>}>
      <div className="product-form">
        <p className="mr-muted" style={{ marginTop: 0 }}>Se toman todas las prestaciones cobradas y todavía no liquidadas. Queda en borrador para revisar antes de cerrar.</p>
        <Field label="Período de la liquidación">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {[0, -1, -2, -3].map((i) => { const p = shiftPeriod(currentPeriod(), i); return <option key={p} value={p}>{periodLabel(p)}</option>; })}
          </select>
        </Field>
        <Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function SettlementModal({ s, isAdmin, onClose, onChange, fail }: {
  s: Detail; isAdmin: boolean; onClose: () => void; onChange: (d: Detail | null, msg?: string) => void; fail: (e: unknown) => void;
}) {
  const [adjust, setAdjust] = useState<Line | null>(null);
  const [paying, setPaying] = useState(false);
  const [ref, setRef] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const draft = s.status === "BORRADOR";
  const closed = s.status === "CERRADA";

  async function call(path: string, body: unknown, msg: string, method = "POST") {
    try { onChange(await appApi<Detail>(`/settlements/${s.id}${path}`, { method, body }), msg); setSelected(new Set()); setPaying(false); }
    catch (e) { fail(e); }
  }
  async function remove() {
    if (!confirm("¿Borrar este borrador? Las prestaciones vuelven a quedar para liquidar.")) return;
    try { await appApi(`/settlements/${s.id}`, { method: "DELETE" }); onChange(null, "Borrador eliminado"); } catch (e) { fail(e); }
  }
  const sum = (k: keyof Line) => s.lines.reduce((a, l) => a + Number(l[k] || 0), 0);

  return (
    <Modal eyebrow={`LIQUIDACIÓN N° ${s.number} · ${periodLabel(s.period).toUpperCase()}`} title={SETTLEMENT_STATUS[s.status]?.label || s.status} onClose={onClose} size="xl">
      <div className="mr-kpis">
        <div className="mr-kpi"><span>Bruto cobrado</span><strong>{money(s.gross)}</strong><small>{s.lines.length} médicos</small></div>
        <div className="mr-kpi"><span>Descuentos y retenciones</span><strong>{money(s.deductions)}</strong></div>
        <div className="mr-kpi"><span>Neto a transferir</span><strong>{money(s.net)}</strong><small>{s.lines.filter((l) => l.paid).length} pagados</small></div>
      </div>
      <div className="mr-row" style={{ marginBottom: 12 }}>
        {draft && isAdmin && <button className="primary-button" onClick={() => confirm("Al cerrar, las prestaciones quedan liquidadas y cada médico ve su recibo. ¿Cerrar?") && call("/close", undefined, "Liquidación cerrada: los médicos ya ven su recibo")}>Cerrar liquidación</button>}
        {draft && isAdmin && <button className="secondary-button" onClick={() => call("/recalc", undefined, "Recalculada")}>Recalcular</button>}
        {draft && isAdmin && <button className="mr-danger-button" onClick={remove}>Borrar borrador</button>}
        {(closed || s.status === "PAGADA") && <button className="secondary-button" onClick={() => downloadFile(`/settlements/${s.id}/transfers.csv`, `transferencias-${s.number}.csv`).catch(fail)}>Planilla de transferencias</button>}
        {closed && isAdmin && <button className="primary-button" onClick={() => setPaying(true)}>{selected.size ? `Marcar ${selected.size} pagados` : "Marcar todo pagado"}</button>}
      </div>
      {paying && (
        <div className="mr-card" style={{ marginBottom: 12 }}>
          <Field label="Referencia del pago (opcional)"><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Lote de transferencias, N° de operación…" /></Field>
          <button className="primary-button" onClick={() => call("/pay", { line_ids: selected.size ? [...selected] : null, payment_ref: strOrNull(ref) }, "Pagos registrados")}>Confirmar</button>
        </div>
      )}
      <div className="mr-table-wrap">
        <table className="mr-table">
          <thead><tr>
            {closed && isAdmin && <th></th>}
            <th>Médico</th><th className="num">Prest.</th><th className="num">Bruto</th><th className="num">Gasto adm.</th><th className="num">Cuota</th>
            <th className="num">Ganancias</th><th className="num">IIBB</th><th className="num">Otros</th><th className="num">Neto</th><th></th>
          </tr></thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.id}>
                {closed && isAdmin && <td>{!l.paid && <input type="checkbox" checked={selected.has(l.id)} onChange={() => { const x = new Set(selected); if (x.has(l.id)) x.delete(l.id); else x.add(l.id); setSelected(x); }} />}</td>}
                <td><strong>{l.member_name}</strong><small>{TAX_LABELS[l.tax_condition || ""] || ""}{l.cbu || l.bank_alias ? "" : " · sin CBU"}</small></td>
                <td className="num">{l.prestaciones_count}</td>
                <td className="num">{money(l.gross)}</td>
                <td className="num">{money(l.admin_fee)}</td>
                <td className="num">{money(l.membership_fee)}</td>
                <td className="num">{l.ganancias ? money(l.ganancias) : "—"}</td>
                <td className="num">{l.iibb ? money(l.iibb) : "—"}</td>
                <td className="num">{l.other_deductions ? <span title={l.other_concept || ""}>{money(l.other_deductions)}</span> : "—"}
                  {draft && isAdmin && <><br /><button className="mr-link" onClick={() => setAdjust(l)}>Ajustar</button></>}</td>
                <td className="num"><strong>{money(l.net)}</strong></td>
                <td className="num">
                  {l.paid ? <Pill tone="green">Pagado</Pill> : null}{" "}
                  {!draft && <a className="mr-link" href={`/print/recibo/${s.id}/${l.id}`} target="_blank" rel="noreferrer">Recibo</a>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            {closed && isAdmin && <td></td>}
            <td>Totales</td><td className="num">{sum("prestaciones_count")}</td><td className="num">{money(sum("gross"))}</td><td className="num">{money(sum("admin_fee"))}</td>
            <td className="num">{money(sum("membership_fee"))}</td><td className="num">{money(sum("ganancias"))}</td><td className="num">{money(sum("iibb"))}</td>
            <td className="num">{money(sum("other_deductions"))}</td><td className="num">{money(sum("net"))}</td><td></td>
          </tr></tfoot>
        </table>
      </div>
      <p className="mr-legal" style={{ marginTop: 10 }}>Bruto = cobrado menos débitos. La cuota societaria se descuenta una vez por período y nunca deja el neto en negativo. Ganancias solo a responsables inscriptos.</p>
      {adjust && <AdjustModal line={adjust} onClose={() => setAdjust(null)}
        onSave={(amount, concept) => { setAdjust(null); call(`/lines/${adjust.id}`, { other_deductions: amount, other_concept: concept }, "Ajuste guardado", "PUT"); }} />}
    </Modal>
  );
}

function AdjustModal({ line, onClose, onSave }: { line: Line; onClose: () => void; onSave: (amount: number, concept: string | null) => void }) {
  const [amount, setAmount] = useState(String(line.other_deductions || ""));
  const [concept, setConcept] = useState(line.other_concept || "");
  return (
    <Modal eyebrow="OTROS DESCUENTOS" title={line.member_name || ""} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={() => onSave(numOrNull(amount) ?? 0, strOrNull(concept))}>Guardar</button></>}>
      <div className="product-form">
        <p className="mr-muted" style={{ marginTop: 0 }}>Para adelantos, seguros de mala praxis, cuotas atrasadas, etc.</p>
        <Field label="Monto"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div></Field>
        <Field label="Concepto"><input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Seguro de mala praxis" /></Field>
      </div>
    </Modal>
  );
}

export default Liquidaciones;
