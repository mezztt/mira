import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  appApi, getSessionUser, addDays, dayKey, dateTime, money, periodLabel, currentPeriod, shiftPeriod, CHARGE_KINDS, PAYMENT_LABELS,
} from "../../../config";
import type { InsuranceItem, Professional } from "../../../config";
import { Empty, Loading, PageHeader, Pill, Seg, Tabs, useFlash } from "../../../components/ui";
import ChargeModal from "../../../components/ChargeModal";

interface Charge {
  id: number; date: string; kind: string; concept: string; amount: number; method: string | null; os_status: string | null;
  os_period: string | null; practice_code: string | null; authorization: string | null; patient_name: string | null;
  professional_name: string | null; insurance_name: string | null;
}
interface ChargesResp {
  items: Charge[];
  summary: { collected: number; insurance: number; count: number; by_method: Record<string, number>; by_professional: { name: string; collected: number; insurance: number; count: number }[] };
}
interface OsGroup { insurance_id: number; insurance_name: string; count: number; total: number; items: Charge[] }

type Range = "hoy" | "semana" | "mes" | "custom";

function Cobros() {
  const user = getSessionUser();
  const [params] = useSearchParams();
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<"caja" | "os">(params.get("tab") === "os" ? "os" : "caja");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [insurances, setInsurances] = useState<InsuranceItem[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    appApi<Professional[]>("/professionals").then(setProfessionals).catch(() => {});
    appApi<InsuranceItem[]>("/insurances").then(setInsurances).catch(() => {});
  }, []);

  return (
    <section className="products-page">
      <PageHeader eyebrow="COBROS" title="Cobros" subtitle="Caja del consultorio y prestaciones para presentar a cada obra social.">
        <button className="primary-button" onClick={() => setCreating(true)}>+ Registrar cobro</button>
      </PageHeader>
      <Tabs value={tab} onChange={setTab} options={[["caja", "Caja"], ["os", "Obras sociales"]]} />
      {tab === "caja" ? <Caja isAdmin={user?.role === "ADMINISTRADOR"} professionals={professionals} show={show} fail={fail} key={String(creating)} />
        : <ObrasSociales canEdit={user?.role !== "PROFESIONAL"} show={show} fail={fail} key={`os${creating}`} />}
      {creating && <ChargeModal professionals={professionals} insurances={insurances} defaultProfessionalId={user?.professional_id}
        onClose={() => setCreating(false)} onSaved={() => { setCreating(false); show("Cobro registrado"); }} />}
      {flash}
    </section>
  );
}

function Caja({ isAdmin, professionals, show, fail }: { isAdmin: boolean; professionals: Professional[]; show: (m: string) => void; fail: (e: unknown) => void }) {
  const [range, setRange] = useState<Range>("hoy");
  const [from, setFrom] = useState(dayKey(new Date()));
  const [to, setTo] = useState(dayKey(new Date()));
  const [prof, setProf] = useState("");
  const [kind, setKind] = useState("");
  const [data, setData] = useState<ChargesResp | null>(null);

  function pick(r: Range) {
    setRange(r);
    const today = new Date();
    if (r === "hoy") { setFrom(dayKey(today)); setTo(dayKey(today)); }
    if (r === "semana") { setFrom(dayKey(addDays(today, -6))); setTo(dayKey(today)); }
    if (r === "mes") { setFrom(dayKey(new Date(today.getFullYear(), today.getMonth(), 1))); setTo(dayKey(today)); }
  }

  const load = useCallback(() => {
    const p = new URLSearchParams({ date_from: from, date_to: to });
    if (prof) p.set("professional_id", prof);
    if (kind) p.set("kind", kind);
    appApi<ChargesResp>(`/charges?${p}`).then(setData).catch(fail);
  }, [from, to, prof, kind, fail]);
  useEffect(() => { load(); }, [load]);

  async function remove(c: Charge) {
    if (!confirm(`¿Borrar el cobro de ${money(c.amount)} (${c.patient_name || c.concept})?`)) return;
    try { await appApi(`/charges/${c.id}`, { method: "DELETE" }); show("Cobro borrado"); load(); } catch (e) { fail(e); }
  }

  function exportCsv() {
    if (!data) return;
    const rows = [["Fecha", "Paciente", "Profesional", "Tipo", "Concepto", "Obra social", "Medio", "Monto"],
      ...data.items.map((c) => [dateTime(c.date), c.patient_name || "", c.professional_name || "", CHARGE_KINDS[c.kind], c.concept, c.insurance_name || "", PAYMENT_LABELS[c.method || ""] || "", String(c.amount).replace(".", ",")])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cobros-${from}-a-${to}.csv`;
    a.click();
  }

  return (
    <div>
      <div className="mr-toolbar">
        <div className="mr-row">
          <Seg value={range} onChange={pick} options={[["hoy", "Hoy"], ["semana", "7 días"], ["mes", "Este mes"], ["custom", "Otro"]]} />
          {range === "custom" && (<>
            <input type="date" className="mr-select" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="mr-select" value={to} onChange={(e) => setTo(e.target.value)} />
          </>)}
        </div>
        <div className="mr-filters">
          <select value={prof} onChange={(e) => setProf(e.target.value)}>
            <option value="">Todos los profesionales</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(CHARGE_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="secondary-button" onClick={exportCsv}>Exportar</button>
        </div>
      </div>

      {!data ? <Loading /> : (<>
        <div className="mr-kpis">
          <div className="mr-kpi"><span>Cobrado</span><strong>{money(data.summary.collected)}</strong><small>Particulares y coseguros</small></div>
          <div className="mr-kpi"><span>A presentar a obras sociales</span><strong>{money(data.summary.insurance)}</strong><small>Del período elegido</small></div>
          {Object.entries(data.summary.by_method).map(([m, v]) => (
            <div key={m} className="mr-kpi"><span>{PAYMENT_LABELS[m] || m}</span><strong>{money(v)}</strong></div>
          ))}
        </div>
        {data.summary.by_professional.length > 1 && (
          <div className="mr-card" style={{ marginBottom: 16 }}>
            <h2>Por profesional</h2>
            <div className="mr-table-wrap" style={{ marginTop: 10 }}>
              <table className="mr-table">
                <thead><tr><th>Profesional</th><th className="num">Atenciones</th><th className="num">Cobrado</th><th className="num">Obras sociales</th></tr></thead>
                <tbody>{data.summary.by_professional.map((p) => (
                  <tr key={p.name}><td>{p.name}</td><td className="num">{p.count}</td><td className="num">{money(p.collected)}</td><td className="num">{money(p.insurance)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        {data.items.length === 0 ? <Empty title="No hay cobros en este período" /> : (
          <div className="mr-table-wrap">
            <table className="mr-table">
              <thead><tr><th>Fecha</th><th>Paciente</th><th>Profesional</th><th>Tipo</th><th>Concepto</th><th>Medio</th><th className="num">Monto</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>{dateTime(c.date)}</td>
                    <td>{c.patient_name || "—"}</td>
                    <td>{c.professional_name || "—"}</td>
                    <td><Pill tone={c.kind === "PARTICULAR" ? "teal" : c.kind === "COSEGURO" ? "blue" : "violet"}>{CHARGE_KINDS[c.kind]}</Pill>{c.insurance_name && <small>{c.insurance_name}</small>}</td>
                    <td>{c.concept}{c.practice_code && <small>Cód. {c.practice_code}</small>}</td>
                    <td>{c.kind === "OBRA_SOCIAL" ? <small>{c.os_status?.toLowerCase()}</small> : PAYMENT_LABELS[c.method || ""] || c.method}</td>
                    <td className="num"><strong>{money(c.amount)}</strong></td>
                    {isAdmin && <td className="num">{(c.kind !== "OBRA_SOCIAL" || c.os_status === "PENDIENTE") && <button className="mr-link mr-link-danger" onClick={() => remove(c)}>Borrar</button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>)}
    </div>
  );
}

function ObrasSociales({ canEdit, show, fail }: { canEdit: boolean; show: (m: string) => void; fail: (e: unknown) => void }) {
  const [status, setStatus] = useState("PENDIENTE");
  const [period, setPeriod] = useState("");
  const [groups, setGroups] = useState<OsGroup[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ status });
    if (period) p.set("period", period);
    appApi<OsGroup[]>(`/charges/insurance?${p}`).then((g) => { setGroups(g); setSelected(new Set()); }).catch(fail);
  }, [status, period, fail]);
  useEffect(() => { load(); }, [load]);

  async function mark(ids: number[], to: string) {
    try {
      const r = await appApi<{ updated: number }>("/charges/insurance/status", { method: "POST", body: { ids, status: to } });
      show(`${r.updated} prestaciones marcadas como ${to.toLowerCase()}`);
      load();
    } catch (e) { fail(e); }
  }

  function exportGroup(g: OsGroup) {
    const rows = [["Fecha", "Paciente", "Profesional", "Código", "Autorización", "Concepto", "Monto"],
      ...g.items.map((c) => [dateTime(c.date), c.patient_name || "", c.professional_name || "", c.practice_code || "", c.authorization || "", c.concept, String(c.amount).replace(".", ",")])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `presentacion-${g.insurance_name.replace(/\W+/g, "-")}-${period || "todo"}.csv`;
    a.click();
  }

  const next = status === "PENDIENTE" ? "PRESENTADA" : status === "PRESENTADA" ? "COBRADA" : null;

  return (
    <div>
      <div className="mr-toolbar">
        <Seg value={status} onChange={setStatus} options={[["PENDIENTE", "Para presentar"], ["PRESENTADA", "Presentadas"], ["COBRADA", "Cobradas"]]} />
        <div className="mr-filters">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="">Todos los meses</option>
            {[0, 1, 2, 3, 4, 5].map((i) => { const p = shiftPeriod(currentPeriod(), -i); return <option key={p} value={p}>{periodLabel(p)}</option>; })}
          </select>
        </div>
      </div>
      <p className="mr-muted" style={{ marginTop: -6 }}>
        Las consultas cargadas como “Obra social” se juntan acá por cobertura. A fin de mes exportá la planilla, presentala y marcala; cuando pague, marcala como cobrada.
      </p>
      {!groups ? <Loading /> : groups.length === 0 ? <Empty title="No hay prestaciones en este estado" /> : groups.map((g) => {
        const ids = g.items.map((i) => i.id);
        const allSel = ids.every((i) => selected.has(i));
        return (
          <div key={g.insurance_id} className="mr-group">
            <header>
              <div><strong>{g.insurance_name}</strong> <span className="mr-muted">· {g.count} prestaciones · {money(g.total)}</span></div>
              <div className="mr-row">
                <button className="mr-link" onClick={() => setOpen(open === g.insurance_id ? null : g.insurance_id)}>{open === g.insurance_id ? "Ocultar" : "Ver detalle"}</button>
                <button className="secondary-button" onClick={() => exportGroup(g)}>Exportar planilla</button>
                {canEdit && next && <button className="primary-button" onClick={() => mark(ids, next)}>Marcar todo {next === "PRESENTADA" ? "presentado" : "cobrado"}</button>}
              </div>
            </header>
            {open === g.insurance_id && (
              <div className="mr-table-wrap" style={{ border: 0, borderRadius: 0 }}>
                <table className="mr-table">
                  <thead><tr>{canEdit && next && <th><input type="checkbox" checked={allSel} onChange={() => {
                    const s = new Set(selected); ids.forEach((i) => (allSel ? s.delete(i) : s.add(i))); setSelected(s);
                  }} /></th>}<th>Fecha</th><th>Paciente</th><th>Profesional</th><th>Código</th><th>Autorización</th><th className="num">Monto</th></tr></thead>
                  <tbody>
                    {g.items.map((c) => (
                      <tr key={c.id}>
                        {canEdit && next && <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => { const s = new Set(selected); if (s.has(c.id)) s.delete(c.id); else s.add(c.id); setSelected(s); }} /></td>}
                        <td>{dateTime(c.date)}</td><td>{c.patient_name || "—"}</td><td>{c.professional_name || "—"}</td>
                        <td>{c.practice_code || "—"}</td><td>{c.authorization || "—"}</td><td className="num">{money(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {selected.size > 0 && next && (
        <div className="mr-sticky-actions">
          <strong>{selected.size} seleccionadas</strong>
          <div className="mr-row">
            {status !== "PENDIENTE" && <button className="secondary-button" onClick={() => mark([...selected], status === "COBRADA" ? "PRESENTADA" : "PENDIENTE")}>Volver atrás</button>}
            <button className="primary-button" onClick={() => mark([...selected], next)}>Marcar {next === "PRESENTADA" ? "presentadas" : "cobradas"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cobros;
