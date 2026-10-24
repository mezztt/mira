import { useEffect, useMemo, useState } from "react";
import { appApi, getSessionUser, initials, publicSiteUrl, splitList, WEEKDAYS } from "../../../config";
import type { Professional } from "../../../config";
import { Empty, Field, Modal, Pill, Switch, strOrNull } from "../../../components/ui";
import { Licencias, ScheduleEditor } from "../consultorio/Profesionales";

const PAGE = 48;   // el padrón puede tener cientos de médicos: se muestran de a tandas y se busca por nombre

/**
 * Agenda de médicos del círculo · horarios, duración del turno, turnos por web y licencias.
 * El médico ve solo lo suyo; la administración, a todos los médicos del padrón.
 */
export default function AgendaHorarios({ professionals, isDoctor, isAdmin, onChanged, show, fail }: {
  professionals: Professional[]; isDoctor: boolean; isAdmin: boolean;
  onChanged: () => void; show: (m: string) => void; fail: (e: unknown) => void;
}) {
  const user = getSessionUser();
  const webOn = splitList(user?.enabled_modules).includes("web_turnos");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"todos" | "con" | "sin">("todos");
  const [schedule, setSchedule] = useState<Professional | null>(null);
  const [settings, setSettings] = useState<Professional | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  // el link de la web lo necesita la administración para compartirlo (el médico no ve la configuración general)
  useEffect(() => {
    if (webOn && !isDoctor) appApi<{ slug: string | null }>("/settings/clinic").then((s) => setSlug(s.slug)).catch(() => {});
  }, [webOn, isDoctor]);

  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => professionals.filter((p) =>
    (!term || `${p.name} ${p.specialty || ""} ${p.license || ""}`.toLowerCase().includes(term))
    && (only === "todos" || (only === "con") === p.availability.length > 0)), [professionals, term, only]);
  const shown = filtered.slice(0, PAGE);
  const withHours = professionals.filter((p) => p.availability.length > 0).length;
  const onWeb = professionals.filter((p) => p.web_visible).length;
  const mine = isDoctor ? professionals[0] : null;

  if (professionals.length === 0) {
    return <Empty title={isDoctor ? "Todavía no tenés agenda" : "No hay médicos activos en el padrón"}>
      {isDoctor ? "Pedile a la administración del círculo que revise tu alta en el padrón." : "Cargalos en Padrón: cada médico activo tiene su agenda."}
    </Empty>;
  }

  return (
    <div className="mr-stack">
      {!isDoctor && (
        <div className="mr-card">
          <div className="mr-card-head">
            <div>
              <h2>Horarios de los médicos</h2>
              <p>{professionals.length} médicos en el padrón · {withHours} con horarios cargados{webOn ? ` · ${onWeb} dan turnos por la web` : ""}</p>
            </div>
            {webOn && slug && <a className="secondary-button" href={publicSiteUrl(slug)} target="_blank" rel="noreferrer">Abrir la web de turnos</a>}
          </div>
          <div className="mr-toolbar" style={{ marginBottom: 0 }}>
            <input className="mr-search" placeholder="Buscar por apellido, especialidad o matrícula…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar médico" />
            <select className="mr-select" value={only} onChange={(e) => setOnly(e.target.value as typeof only)} aria-label="Filtrar">
              <option value="todos">Todos</option>
              <option value="con">Con horarios cargados</option>
              <option value="sin">Sin horarios</option>
            </select>
          </div>
        </div>
      )}

      {isDoctor && (
        <p className="mr-muted" style={{ margin: 0 }}>
          Cargá los días y horas en que atendés. Con eso se arman los turnos libres{webOn ? " (en la agenda y, si lo activás, en la web del círculo)" : ""}.
        </p>
      )}

      {shown.length === 0 ? <Empty title="Ningún médico coincide con la búsqueda" /> : (
        <div className="mr-prof-grid">
          {shown.map((p) => (
            <div key={p.id} className="mr-prof-card">
              <header>
                <span className="mr-avatar" style={{ background: p.color }}>{initials(p.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <strong>{p.name}</strong>
                  <small>{p.specialty || "Sin especialidad"}{p.license ? ` · ${p.license}` : ""}</small>
                </div>
              </header>
              <div className="mr-week">
                {WEEKDAYS.map((d, i) => {
                  const blocks = p.availability.filter((b) => b.weekday === i);
                  return <div key={d} className={blocks.length ? "is-on" : ""} title={blocks.map((b) => `${b.start_time}–${b.end_time}`).join(" · ")}><b>{d.slice(0, 2)}</b>{blocks.length ? blocks.map((b) => b.start_time.slice(0, 2)).join("/") : "—"}</div>;
                })}
              </div>
              <div className="mr-row">
                {p.availability.length === 0 ? <Pill tone="orange">Sin horarios</Pill> : <Pill tone="teal">Turnos de {p.slot_minutes} min</Pill>}
                {webOn && (p.web_visible ? <Pill tone="blue">Da turnos por la web</Pill> : <Pill tone="gray">No sale en la web</Pill>)}
              </div>
              <div className="mr-row">
                <button className="primary-button" onClick={() => setSchedule(p)}>{p.availability.length ? "Cambiar horarios" : "Cargar horarios"}</button>
                <button className="secondary-button" onClick={() => setSettings(p)}>{webOn ? "Turno y web" : "Duración del turno"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {filtered.length > PAGE && <p className="mr-muted">Se muestran {PAGE} de {filtered.length} médicos. Usá el buscador para encontrar a los demás.</p>}

      <Licencias pros={professionals} isAdmin={isAdmin} canPickAny={!isDoctor} ownId={mine?.id ?? null} show={show} fail={fail} allLabel="Todo el círculo" />

      {schedule && <ScheduleEditor prof={schedule} onClose={() => setSchedule(null)}
        onSaved={() => { setSchedule(null); onChanged(); show("Horarios guardados"); }} />}
      {settings && <AgendaSettings prof={settings} webOn={webOn} onClose={() => setSettings(null)}
        onSaved={() => { setSettings(null); onChanged(); show("Cambios guardados"); }} />}
    </div>
  );
}

function AgendaSettings({ prof, webOn, onClose, onSaved }: { prof: Professional; webOn: boolean; onClose: () => void; onSaved: () => void }) {
  const [slot, setSlot] = useState(String(prof.slot_minutes));
  const [web, setWeb] = useState(prof.web_visible);
  const [bio, setBio] = useState(prof.bio || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    const minutes = Number(slot);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) return setError("La duración del turno va de 5 a 240 minutos");
    setSaving(true);
    try {
      await appApi(`/professionals/${prof.id}/agenda-settings`, { method: "PUT", body: { slot_minutes: minutes, bio: strOrNull(bio), ...(webOn ? { web_visible: web } : {}) } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow="TURNOS" title={prof.name} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <Field label="Duración de cada turno" hint="Con esto se arman los horarios libres dentro de tus bloques de atención.">
          <div className="mr-input-suffix"><input type="number" min="5" max="240" step="5" value={slot} onChange={(e) => setSlot(e.target.value)} /><span>min</span></div>
        </Field>
        {webOn && (<>
          <Switch on={web} onChange={setWeb} label="Dar turnos por la web" hint="Los pacientes eligen día y horario solos en la web de turnos del círculo" />
          <Field label="Presentación para los pacientes (opcional)" hint="Aparece al lado del nombre en la web. Ej.: atiende adultos, no atiende urgencias.">
            <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
          </Field>
          {web && prof.availability.length === 0 && <div className="mr-note mr-note-warn">Falta cargar los horarios: sin horarios no aparecen turnos en la web.</div>}
        </>)}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
