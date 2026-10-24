import { useCallback, useEffect, useState } from "react";
import { appApi, canAccess, getSessionUser, initials, money, shortDate, PROF_KINDS, WEEKDAYS, PAYER_KINDS } from "../../../config";
import type { Block, InsuranceItem, Professional } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Switch, Tabs, numOrNull, strOrNull, useFlash } from "../../../components/ui";
import PlantillasAdmin from "../../../components/clinical/PlantillasAdmin";

const COLORS = ["#0f7c86", "#2a6fb0", "#7c5cc4", "#c2477a", "#a85a10", "#1f7a45", "#b5452f", "#56708a"];
interface TimeOff { id: number; professional_id: number | null; date_from: string; date_to: string; reason: string | null }

function Profesionales() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMINISTRADOR";
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<"pros" | "licencias" | "os" | "plantillas">("pros");
  // plantillas de evolución y de documentos: solo roles clínicos (recepción no las ve)
  const canTemplates = user?.role !== "RECEPCION" && (canAccess(user, "historia_clinica") || canAccess(user, "documentos"));
  const [pros, setPros] = useState<Professional[] | null>(null);
  const [editing, setEditing] = useState<Professional | "new" | null>(null);
  const [schedule, setSchedule] = useState<Professional | null>(null);

  const load = useCallback(() => {
    appApi<Professional[]>(`/professionals?include_inactive=${isAdmin}`).then(setPros).catch(fail);
  }, [isAdmin, fail]);
  useEffect(() => { load(); }, [load]);

  const canSchedule = (p: Professional) => isAdmin || user?.professional_id === p.id;

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONSULTORIO" title="Profesionales" subtitle="Quiénes atienden, en qué horarios y con qué coberturas trabaja el consultorio.">
        {isAdmin && tab === "pros" && <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo profesional</button>}
      </PageHeader>
      <Tabs value={tab} onChange={setTab} options={[["pros", "Profesionales"], ["licencias", "Licencias y feriados"], ["os", "Obras sociales y prepagas"],
        ...(canTemplates ? [["plantillas", "Plantillas"] as ["plantillas", string]] : [])]} />

      {tab === "pros" && (!pros ? <Loading /> : pros.length === 0 ? <Empty title="Todavía no cargaste profesionales">Cargá el primero para empezar a dar turnos.</Empty> : (
        <div className="mr-prof-grid">
          {pros.map((p) => (
            <div key={p.id} className={`mr-prof-card ${p.active ? "" : "is-inactive"}`}>
              <header>
                <span className="mr-avatar" style={{ background: p.color }}>{initials(p.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <strong>{p.name}</strong>
                  <small>{PROF_KINDS[p.kind]}{p.specialty ? ` · ${p.specialty}` : ""}{p.license ? ` · MP ${p.license}` : ""}</small>
                </div>
              </header>
              <div className="mr-week">
                {WEEKDAYS.map((d, i) => {
                  const blocks = p.availability.filter((b) => b.weekday === i);
                  return <div key={d} className={blocks.length ? "is-on" : ""} title={blocks.map((b) => `${b.start_time}–${b.end_time}`).join(" · ")}><b>{d.slice(0, 2)}</b>{blocks.length ? blocks.map((b) => b.start_time.slice(0, 2)).join("/") : "—"}</div>;
                })}
              </div>
              <div className="mr-row">
                <Pill tone="teal">Turnos de {p.slot_minutes} min</Pill>
                {p.consult_price ? <Pill tone="gray">{money(p.consult_price)}</Pill> : null}
                {p.web_visible ? <Pill tone="blue">En la web</Pill> : <Pill tone="gray">No sale en la web</Pill>}
                {!p.active && <Pill tone="red">Inactivo</Pill>}
              </div>
              <div className="mr-row">
                {canSchedule(p) && <button className="secondary-button" onClick={() => setSchedule(p)}>Horarios</button>}
                {isAdmin && <button className="secondary-button" onClick={() => setEditing(p)}>Editar</button>}
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === "licencias" && pros && <Licencias pros={pros} isAdmin={isAdmin} ownId={user?.professional_id || null} show={show} fail={fail} />}
      {tab === "plantillas" && canTemplates && <PlantillasAdmin show={show} fail={fail} />}
      {tab === "os" && <Coberturas canEdit={user?.role !== "PROFESIONAL"} show={show} fail={fail} />}

      {editing && <ProfForm prof={editing === "new" ? null : editing} onClose={() => setEditing(null)}
        onSaved={(p, isNew) => { setEditing(null); load(); show(isNew ? "Profesional creado con horario sugerido de lunes a viernes. Ajustalo en Horarios." : "Cambios guardados"); if (isNew) setSchedule(p); }} />}
      {schedule && <ScheduleEditor prof={schedule} onClose={() => setSchedule(null)} onSaved={() => { setSchedule(null); load(); show("Horarios guardados"); }} />}
      {flash}
    </section>
  );
}

function ProfForm({ prof, onClose, onSaved }: { prof: Professional | null; onClose: () => void; onSaved: (p: Professional, isNew: boolean) => void }) {
  const [f, setF] = useState({
    name: prof?.name || "", kind: prof?.kind || "MEDICO", specialty: prof?.specialty || "", license: prof?.license || "",
    email: prof?.email || "", phone: prof?.phone || "", color: prof?.color || COLORS[0], slot_minutes: String(prof?.slot_minutes || 20),
    consult_price: prof?.consult_price != null ? String(prof.consult_price) : "", web_visible: prof?.web_visible ?? true,
    bio: prof?.bio || "", active: prof?.active ?? true, sort_order: String(prof?.sort_order || 0),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setError("");
    setSaving(true);
    try {
      const body = {
        ...f, specialty: strOrNull(f.specialty), license: strOrNull(f.license), email: strOrNull(f.email), phone: strOrNull(f.phone),
        slot_minutes: Number(f.slot_minutes) || 20, consult_price: numOrNull(f.consult_price), bio: strOrNull(f.bio), sort_order: Number(f.sort_order) || 0,
      };
      const saved = prof ? await appApi<Professional>(`/professionals/${prof.id}`, { method: "PUT", body })
        : await appApi<Professional>("/professionals", { method: "POST", body });
      onSaved(saved, !prof);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow={prof ? "EDITAR" : "NUEVO"} title={prof ? prof.name : "Nuevo profesional"} onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <div className="form-row">
          <Field label="Nombre como lo ven los pacientes"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Dra. Laura Pérez" autoFocus /></Field>
          <Field label="Profesión">
            <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(PROF_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Especialidad"><input value={f.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="Clínica médica, ortodoncia…" /></Field>
          <Field label="Matrícula"><input value={f.license} onChange={(e) => set("license", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Duración del turno"><div className="mr-input-suffix"><input type="number" min="5" step="5" value={f.slot_minutes} onChange={(e) => set("slot_minutes", e.target.value)} /><span>min</span></div></Field>
          <Field label="Valor de la consulta particular"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={f.consult_price} onChange={(e) => set("consult_price", e.target.value)} /></div></Field>
        </div>
        <div className="form-row">
          <Field label="Email"><input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Teléfono"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
        <Field label="Color en la agenda">
          <div className="mr-color-pick">{COLORS.map((c) => <button key={c} type="button" className={f.color === c ? "is-on" : ""} style={{ background: c }} onClick={() => set("color", c)} aria-label={c} />)}</div>
        </Field>
        <Field label="Presentación para la web (opcional)"><textarea rows={2} value={f.bio} onChange={(e) => set("bio", e.target.value)} maxLength={500} /></Field>
        <Switch on={f.web_visible} onChange={(v) => set("web_visible", v)} label="Aparece en la web de turnos" hint="Los pacientes pueden sacar turno online con este profesional" />
        {prof && <Switch on={f.active} onChange={(v) => set("active", v)} label="Activo" hint="Si lo desactivás, no se le pueden dar turnos nuevos" />}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

/** Horarios de atención de un profesional (también lo usa la agenda de médicos del círculo) */
export function ScheduleEditor({ prof, onClose, onSaved }: { prof: Professional; onClose: () => void; onSaved: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>(prof.availability.map((b) => ({ weekday: b.weekday, start_time: b.start_time, end_time: b.end_time })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (idx: number, patch: Partial<Block>) => setBlocks(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  function copyMonday() {
    const mon = blocks.filter((b) => b.weekday === 0);
    if (!mon.length) return;
    setBlocks([...mon, ...[1, 2, 3, 4].flatMap((d) => mon.map((b) => ({ ...b, weekday: d }))), ...blocks.filter((b) => b.weekday >= 5)]);
  }
  async function save() {
    setError("");
    setSaving(true);
    try { await appApi(`/professionals/${prof.id}/availability`, { method: "PUT", body: blocks }); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow="HORARIOS DE ATENCIÓN" title={prof.name} onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar horarios"}</button></>}>
      <p className="mr-muted" style={{ marginTop: 0 }}>Podés cargar varios bloques por día (ej. mañana y tarde). Los turnos se arman cada {prof.slot_minutes} minutos.</p>
      <div>
        {WEEKDAYS.map((d, wd) => (
          <div key={d} className="mr-schedule-row">
            <strong>{d}</strong>
            <div className="mr-schedule-blocks">
              {blocks.map((b, i) => b.weekday !== wd ? null : (
                <span key={i} className="mr-block">
                  <input type="time" value={b.start_time} onChange={(e) => update(i, { start_time: e.target.value })} aria-label="Desde" />
                  <span className="mr-muted">a</span>
                  <input type="time" value={b.end_time} onChange={(e) => update(i, { end_time: e.target.value })} aria-label="Hasta" />
                  <button type="button" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))} aria-label="Quitar">×</button>
                </span>
              ))}
              <button type="button" className="mr-link" onClick={() => setBlocks([...blocks, { weekday: wd, start_time: "09:00", end_time: "13:00" }])}>+ bloque</button>
              {!blocks.some((b) => b.weekday === wd) && <span className="mr-muted">No atiende</span>}
            </div>
          </div>
        ))}
      </div>
      <button className="secondary-button" style={{ marginTop: 10 }} onClick={copyMonday}>Copiar el lunes a martes–viernes</button>
      {error && <div className="mr-note mr-note-error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}

/**
 * Licencias y feriados. También lo usa la agenda de médicos del círculo:
 * canPickAny = puede cargarle licencias a cualquiera (aunque no pueda cargar cierres generales).
 */
export function Licencias({ pros, isAdmin, ownId, show, fail, canPickAny = isAdmin, allLabel = "Todo el consultorio" }: {
  pros: Professional[]; isAdmin: boolean; ownId: number | null; show: (m: string) => void; fail: (e: unknown) => void;
  canPickAny?: boolean; allLabel?: string;
}) {
  const [items, setItems] = useState<TimeOff[] | null>(null);
  const [prof, setProf] = useState(isAdmin ? "" : String(ownId || (canPickAny ? pros[0]?.id || "" : "")));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const load = useCallback(() => { appApi<TimeOff[]>("/time-off").then(setItems).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);
  const name = (id: number | null) => (id ? pros.find((p) => p.id === id)?.name || "—" : allLabel);

  async function add() {
    if (!from) return fail(new Error("Elegí la fecha"));
    try {
      const r = await appApi<{ affected_appointments: number }>("/time-off", { method: "POST", body: { professional_id: numOrNull(prof), date_from: from, date_to: to || from, reason: strOrNull(reason) } });
      show(r.affected_appointments ? `Guardado. Ojo: hay ${r.affected_appointments} turno(s) dados en esas fechas para reprogramar.` : "Guardado");
      setFrom(""); setTo(""); setReason(""); load();
    } catch (e) { fail(e); }
  }
  async function remove(t: TimeOff) {
    try { await appApi(`/time-off/${t.id}`, { method: "DELETE" }); load(); } catch (e) { fail(e); }
  }

  return (
    <div className="mr-grid-2">
      <div className="mr-card">
        <h2>Cargar licencia o feriado</h2>
        <p className="mr-muted">Esos días no se ofrecen turnos (ni en el sistema ni en la web).</p>
        <div className="product-form">
          <Field label="¿Para quién?">
            <select value={prof} onChange={(e) => setProf(e.target.value)} disabled={!canPickAny}>
              {isAdmin && <option value="">{allLabel} (feriado / cierre)</option>}
              {pros.filter((p) => canPickAny || p.id === ownId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="form-row">
            <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Hasta"><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones, congreso, feriado…" /></Field>
          <button className="primary-button" onClick={add} style={{ alignSelf: "flex-start" }}>Guardar</button>
        </div>
      </div>
      <div className="mr-card">
        <h2>Cargadas</h2>
        {!items ? <Loading /> : items.length === 0 ? <Empty title="Sin licencias ni feriados" /> : (
          <ul className="mr-list">
            {items.map((t) => (
              <li key={t.id}>
                <div className="mr-list-main"><strong>{shortDate(t.date_from)}{t.date_to !== t.date_from ? ` al ${shortDate(t.date_to)}` : ""}</strong>
                  <small>{name(t.professional_id)}{t.reason ? ` · ${t.reason}` : ""}</small></div>
                {(isAdmin || (t.professional_id !== null && (canPickAny || t.professional_id === ownId))) && <button className="mr-link mr-link-danger" onClick={() => remove(t)}>Quitar</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Coberturas({ canEdit, show, fail }: { canEdit: boolean; show: (m: string) => void; fail: (e: unknown) => void }) {
  const [items, setItems] = useState<InsuranceItem[] | null>(null);
  const [editing, setEditing] = useState<InsuranceItem | "new" | null>(null);
  const load = useCallback(() => { appApi<InsuranceItem[]>("/insurances?include_inactive=true").then(setItems).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {canEdit && <button className="primary-button" style={{ marginBottom: 14 }} onClick={() => setEditing("new")}>+ Agregar cobertura</button>}
      {!items ? <Loading /> : items.length === 0 ? <Empty title="Sin obras sociales cargadas">Agregá las obras sociales y prepagas con las que trabaja el consultorio.</Empty> : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>Nombre</th><th>Tipo</th><th className="num">Coseguro</th><th className="num">Valor consulta</th><th>Web</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={canEdit ? "is-click" : ""} onClick={() => canEdit && setEditing(i)}>
                  <td><strong>{i.name}</strong>{i.code && <small>Código {i.code}</small>}</td>
                  <td>{PAYER_KINDS[i.kind] || i.kind}</td>
                  <td className="num">{i.copay ? money(i.copay) : "—"}</td>
                  <td className="num">{i.consult_value ? money(i.consult_value) : "—"}</td>
                  <td>{i.accepts_web ? <Pill tone="blue">Acepta</Pill> : <Pill tone="gray">No</Pill>}</td>
                  <td className="num">{!i.active && <Pill tone="gray">Inactiva</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <InsuranceForm item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); show("Cobertura guardada"); }} />}
    </div>
  );
}

function InsuranceForm({ item, onClose, onSaved }: { item: InsuranceItem | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: item?.name || "", code: item?.code || "", kind: item?.kind || "OBRA_SOCIAL",
    copay: item?.copay != null ? String(item.copay) : "", consult_value: item?.consult_value != null ? String(item.consult_value) : "",
    accepts_web: item?.accepts_web ?? true, active: item?.active ?? true, notes: item?.notes || "",
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    try {
      const body = { ...f, code: strOrNull(f.code), copay: numOrNull(f.copay), consult_value: numOrNull(f.consult_value), notes: strOrNull(f.notes) };
      await appApi(item ? `/insurances/${item.id}` : "/insurances", { method: item ? "PUT" : "POST", body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="COBERTURA" title={item ? item.name : "Nueva obra social / prepaga"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <div className="form-row">
          <Field label="Nombre"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="OSDE, PAMI, APROSS…" autoFocus /></Field>
          <Field label="Tipo"><select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(PAYER_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        <div className="form-row">
          <Field label="Coseguro que paga el paciente"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={f.copay} onChange={(e) => set("copay", e.target.value)} /></div></Field>
          <Field label="Valor que paga la obra social"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={f.consult_value} onChange={(e) => set("consult_value", e.target.value)} /></div></Field>
        </div>
        <Field label="Código / notas"><input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="Código de prestador (opcional)" /></Field>
        <Switch on={f.accepts_web} onChange={(v) => set("accepts_web", v)} label="Se puede elegir en la web de turnos" />
        {item && <Switch on={f.active} onChange={(v) => set("active", v)} label="Activa" />}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Profesionales;
