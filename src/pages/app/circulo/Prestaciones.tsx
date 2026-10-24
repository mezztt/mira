import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { appApi, money, shortDate, periodLabel, currentPeriod, shiftPeriod, PREST_STATUS } from "../../../config";
import type { Member, Payer, Prestacion, PrestStatus, Rate } from "../../../config";
import { Empty, Loading, Modal, PageHeader, Pill, Tabs, useFlash } from "../../../components/ui";
import PrestacionForm from "../../../components/PrestacionForm";

interface ListResp { items: Prestacion[]; by_status: Record<string, { count: number; total: number }>; total: number }
interface SummaryRow { id: number; name: string; count: number; total: number; approved: number; pending_audit: number }

const EDITABLE: PrestStatus[] = ["CARGADA", "OBSERVADA"];

function Prestaciones() {
  const [params] = useSearchParams();
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<"lista" | "resumen">("lista");
  const [period, setPeriod] = useState(currentPeriod());
  const [status, setStatus] = useState(params.get("estado") || "");
  const [payerId, setPayerId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListResp | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<Prestacion | "new" | null>(null);
  const [observing, setObserving] = useState(false);
  const [summary, setSummary] = useState<{ by_payer: SummaryRow[]; by_member: SummaryRow[] } | null>(null);

  useEffect(() => {
    appApi<Member[]>("/members?include_inactive=true").then(setMembers).catch(() => {});
    appApi<Payer[]>("/payers?include_inactive=true").then(setPayers).catch(() => {});
  }, []);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (period) p.set("period", period);
    if (status) p.set("status", status);
    if (payerId) p.set("payer_id", payerId);
    if (memberId) p.set("member_id", memberId);
    if (q.trim()) p.set("q", q.trim());
    appApi<ListResp>(`/prestaciones?${p}`).then((d) => { setData(d); setSelected(new Set()); }).catch(fail);
  }, [period, status, payerId, memberId, q, fail]);
  useEffect(() => { const t = window.setTimeout(load, 200); return () => window.clearTimeout(t); }, [load]);
  useEffect(() => {
    if (tab === "resumen") appApi<{ by_payer: SummaryRow[]; by_member: SummaryRow[] }>(`/prestaciones/summary?period=${period || currentPeriod()}`).then(setSummary).catch(fail);
  }, [tab, period, fail]);

  const loadRates = useCallback((pid: number) => appApi<Rate[]>(`/payers/${pid}/rates`), []);
  const items = data?.items || [];
  const selItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
  const toggle = (id: number) => { const s = new Set(selected); if (s.has(id)) s.delete(id); else s.add(id); setSelected(s); };

  async function audit(action: "APROBAR" | "OBSERVAR" | "VOLVER", observation?: string) {
    try {
      const r = await appApi<{ updated: number; skipped: number }>("/prestaciones/audit", { method: "POST", body: { ids: [...selected], action, observation: observation || null } });
      show(`${r.updated} actualizadas${r.skipped ? ` · ${r.skipped} no correspondían` : ""}`);
      setObserving(false);
      load();
    } catch (e) { fail(e); }
  }
  async function remove(p: Prestacion) {
    if (!confirm(`¿Borrar la prestación de ${p.patient_name}?`)) return;
    try { await appApi(`/prestaciones/${p.id}`, { method: "DELETE" }); show("Prestación borrada"); load(); } catch (e) { fail(e); }
  }
  async function rebill(p: Prestacion) {
    if (!confirm(`Se va a cargar de nuevo en ${periodLabel(currentPeriod())} para volver a presentarla. ¿Seguir?`)) return;
    try { await appApi(`/prestaciones/${p.id}/rebill`, { method: "POST", body: {} }); show("Refacturada: quedó para auditar en el período actual"); load(); } catch (e) { fail(e); }
  }

  const periods = [1, 0, -1, -2, -3, -4, -5, -6].map((i) => shiftPeriod(currentPeriod(), i));
  const statusCounts = data?.by_status || {};

  return (
    <section className="products-page">
      <PageHeader eyebrow="PRESTACIONES" title="Prestaciones y auditoría" subtitle="Lo que atendió cada médico por obra social. Se audita antes de presentar.">
        <button className="primary-button" onClick={() => setForm("new")}>+ Cargar prestación</button>
      </PageHeader>
      <Tabs value={tab} onChange={setTab} options={[["lista", "Prestaciones"], ["resumen", "Resumen del período"]]} />

      <div className="mr-toolbar">
        <div className="mr-filters">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="">Todos los períodos</option>
            {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
          {tab === "lista" && (<>
            <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
              <option value="">Todos los convenios</option>
              {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Todos los médicos</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </>)}
        </div>
        {tab === "lista" && <input className="mr-search" placeholder="Paciente, afiliado, código o autorización…" value={q} onChange={(e) => setQ(e.target.value)} />}
      </div>

      {tab === "lista" && (<>
        <div className="mr-seg" style={{ marginBottom: 14 }}>
          <button className={!status ? "is-on" : ""} onClick={() => setStatus("")}>Todas</button>
          {(Object.keys(PREST_STATUS) as PrestStatus[]).map((s) => (
            <button key={s} className={status === s ? "is-on" : ""} onClick={() => setStatus(s)}>
              {PREST_STATUS[s].label}{!status && statusCounts[s] ? ` (${statusCounts[s].count})` : ""}
            </button>
          ))}
        </div>

        {!data ? <Loading /> : items.length === 0 ? <Empty title="No hay prestaciones con estos filtros" /> : (
          <div className="mr-table-wrap">
            <table className="mr-table">
              <thead><tr>
                <th><input type="checkbox" aria-label="Seleccionar todas" checked={items.length > 0 && items.every((i) => selected.has(i.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} /></th>
                <th>Fecha</th><th>Médico</th><th>Paciente</th><th>Convenio</th><th>Código</th><th className="num">Total</th><th>Estado</th><th></th>
              </tr></thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className={selected.has(p.id) ? "is-selected" : ""}>
                    <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                    <td>{shortDate(p.date)}<small>{periodLabel(p.period)}</small></td>
                    <td>{p.member_name}{p.source === "MEDICO" && <small>Cargó el médico</small>}</td>
                    <td><strong>{p.patient_name}</strong><small>{p.affiliate_number ? `Afil. ${p.affiliate_number}` : ""}{p.authorization ? ` · Aut. ${p.authorization}` : ""}</small></td>
                    <td>{p.payer_name}</td>
                    <td><span className="mr-code-sm">{p.code}</span>{p.quantity > 1 ? ` ×${p.quantity}` : ""}<small>{p.description}</small></td>
                    <td className="num"><strong>{money(p.total)}</strong>{p.debit_amount > 0 && <small style={{ color: "var(--mr-red-text)" }}>débito {money(p.debit_amount)}</small>}</td>
                    <td>
                      <Pill tone={PREST_STATUS[p.status].tone}>{PREST_STATUS[p.status].label}</Pill>
                      {p.observation && <small>{p.observation}</small>}
                      {p.debit_reason && <small>{p.debit_reason}</small>}
                    </td>
                    <td className="num">
                      {EDITABLE.includes(p.status) && <><button className="mr-link" onClick={() => setForm(p)}>Editar</button>{" "}<button className="mr-link mr-link-danger" onClick={() => remove(p)}>Borrar</button></>}
                      {p.status === "DEBITADA" && <button className="mr-link" onClick={() => rebill(p)}>Refacturar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={6}>{items.length} prestaciones</td><td className="num">{money(data.total)}</td><td colSpan={2}></td></tr></tfoot>
            </table>
          </div>
        )}

        {selected.size > 0 && (
          <div className="mr-sticky-actions">
            <span><strong>{selected.size} seleccionadas</strong> · {money(selItems.reduce((a, b) => a + b.total, 0))}</span>
            <div className="mr-row">
              <button className="secondary-button" onClick={() => audit("VOLVER")}>Volver a auditar</button>
              <button className="secondary-button" onClick={() => setObserving(true)}>Observar</button>
              <button className="primary-button" onClick={() => audit("APROBAR")}>Aprobar</button>
            </div>
          </div>
        )}
      </>)}

      {tab === "resumen" && (!summary ? <Loading /> : (
        <div className="mr-grid-2">
          {(["by_payer", "by_member"] as const).map((k) => (
            <div key={k} className="mr-card">
              <h2>{k === "by_payer" ? "Por convenio" : "Por médico"}</h2>
              {summary[k].length === 0 ? <Empty title="Sin prestaciones en el período" /> : (
                <div className="mr-table-wrap" style={{ marginTop: 10 }}>
                  <table className="mr-table">
                    <thead><tr><th>{k === "by_payer" ? "Convenio" : "Médico"}</th><th className="num">Cant.</th><th className="num">Para auditar</th><th className="num">Total</th></tr></thead>
                    <tbody>{summary[k].map((r) => (
                      <tr key={r.id}><td>{r.name}</td><td className="num">{r.count}</td><td className="num">{r.pending_audit || "—"}</td><td className="num">{money(r.total)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {form && (
        <PrestacionForm prest={form === "new" ? null : form} base="/prestaciones" members={members} payers={payers} loadRates={loadRates}
          onClose={() => setForm(null)}
          onSaved={(p, again) => {
            if (!again) setForm(null);
            show(p.possible_duplicate ? "Guardada. Ojo: parece duplicada (mismo médico, paciente, código y fecha)" : "Prestación guardada");
            load();
          }} />
      )}
      {observing && <ObserveModal count={selected.size} onClose={() => setObserving(false)} onConfirm={(t) => audit("OBSERVAR", t)} />}
      {flash}
    </section>
  );
}

function ObserveModal({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: (text: string) => void }) {
  const [text, setText] = useState("");
  const quick = ["Falta autorización", "Falta firma del afiliado", "Código mal cargado", "Afiliado no corresponde", "Fecha fuera de período"];
  return (
    <Modal eyebrow="AUDITORÍA" title={`Observar ${count} prestación(es)`} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={() => onConfirm(text)} disabled={!text.trim()}>Observar</button></>}>
      <div className="product-form">
        <p className="mr-muted" style={{ marginTop: 0 }}>El médico recibe un aviso en su portal para corregirla.</p>
        <div className="mr-chips" style={{ marginBottom: 10 }}>{quick.map((x) => <button key={x} type="button" className="mr-chip" style={{ border: 0, cursor: "pointer" }} onClick={() => setText(x)}>{x}</button>)}</div>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Qué hay que corregir" autoFocus />
      </div>
    </Modal>
  );
}

export default Prestaciones;
