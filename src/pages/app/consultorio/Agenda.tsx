import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  appApi, canAccess, getSessionUser, addDays, addMinutes, dayKey, hhmm, longDate, money, parseDay, toLocalISO, dateTime,
  APPT_KINDS, APPT_STATUS, NEXT_STATUS,
} from "../../../config";
import AgendaHorarios from "../circulo/AgendaHorarios";
import type { Appointment, ApptStatus, InsuranceItem, PatientLite, Professional } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, numOrNull, strOrNull, useFlash, useRefreshKey } from "../../../components/ui";
import ChargeModal from "../../../components/ChargeModal";
import { toneOf } from "../Inicio";

// La misma agenda sirve para el consultorio (por profesional) y para el círculo médico (por médico del padrón).
// En el círculo, el médico ve solo la suya ("Mi agenda") y la administración elige de qué médico.
type View = "dia" | "lista" | "espera" | "recordatorios" | "horarios";
interface Column {
  professional: { id: number; name: string; specialty: string | null; color: string; slot_minutes: number };
  blocks: { start: string; end: string }[];
  appointments: Appointment[];
}
interface Board { day: string; now: string; columns: Column[] }

const PX = 1.5; // píxeles por minuto en la grilla

function Agenda() {
  const user = getSessionUser();
  const navigate = useNavigate();
  const refreshKey = useRefreshKey();
  const [params, setParams] = useSearchParams();
  const { show, fail, node: flash } = useFlash();
  const isCircle = user?.kind === "CIRCULO";
  const isDoctor = isCircle && user?.role === "MEDICO";      // el médico del círculo: solo su agenda
  const who = isCircle ? "médico" : "profesional";

  const [view, setView] = useState<View>(() => {
    const v = params.get("vista");   // así llega desde «Pendientes» del inicio
    return v === "espera" || v === "lista" || v === "recordatorios" || (v === "horarios" && isCircle) ? v : "dia";
  });
  const [day, setDay] = useState<Date>(() => (params.get("dia") ? parseDay(params.get("dia")!) : new Date()));
  const [profFilter, setProfFilter] = useState<string>(user?.role === "PROFESIONAL" && user.professional_id ? String(user.professional_id) : "");
  const [board, setBoard] = useState<Board | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [insurances, setInsurances] = useState<InsuranceItem[]>([]);
  const [waiting, setWaiting] = useState<Appointment[]>([]);
  const [reminders, setReminders] = useState<{ day: string; items: Appointment[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<Appointment | null>(null);
  const [form, setForm] = useState<{ appt?: Appointment; professionalId?: number; start?: Date } | null>(null);
  const [charge, setCharge] = useState<Appointment | null>(null);

  const canCharge = canAccess(user, "cobros");
  const canPatients = canAccess(user, "pacientes");

  // círculo: al elegir un médico se pide solo su columna (así aparece aunque ese día no atienda)
  const boardFilter = isCircle && !isDoctor ? profFilter : "";
  const loadBoard = useCallback(async () => {
    try {
      setBoard(await appApi<Board>(`/appointments/board?day=${dayKey(day)}${boardFilter ? `&professional_id=${boardFilter}` : ""}`));
    } catch (e) { fail(e); } finally { setLoading(false); }
  }, [day, boardFilter, fail]);
  const loadProfessionals = useCallback(() => appApi<Professional[]>("/professionals").then(setProfessionals).catch(() => {}), []);

  const loadWaiting = useCallback(() => appApi<Appointment[]>("/appointments/waiting-room").then(setWaiting).catch(() => {}), []);
  const loadReminders = useCallback((d?: string) => {
    const q = d ? `?day=${d}` : "";
    return appApi<{ day: string; items: Appointment[] }>(`/appointments/reminders${q}`).then(setReminders).catch(fail);
  }, [fail]);

  useEffect(() => {
    loadProfessionals();
    if (!isCircle) appApi<InsuranceItem[]>("/insurances").then(setInsurances).catch(() => {});   // el círculo no carga cobertura en el turno
  }, [isCircle, loadProfessionals]);

  useEffect(() => { loadBoard(); }, [loadBoard, refreshKey]);
  useEffect(() => {
    if (view !== "espera") return;
    loadWaiting();
    const t = setInterval(loadWaiting, 30000);
    return () => clearInterval(t);
  }, [view, loadWaiting, refreshKey]);
  useEffect(() => { if (view === "recordatorios") loadReminders(); }, [view, loadReminders]);
  // refresco suave cada minuto (línea de "ahora" y ausentes automáticos)
  useEffect(() => { const t = setInterval(loadBoard, 60000); return () => clearInterval(t); }, [loadBoard]);

  // parámetros de la URL: ?nuevo=1 · ?turno=ID
  useEffect(() => {
    if (params.get("nuevo")) { setForm({}); setParams({}, { replace: true }); }
    const id = Number(params.get("turno"));
    if (id && board) {
      const a = board.columns.flatMap((c) => c.appointments).find((x) => x.id === id);
      if (a) setDetail(a);
      setParams({}, { replace: true });
    }
  }, [params, board, setParams]);

  const columns = useMemo(() => (board?.columns || []).filter((c) => !profFilter || String(c.professional.id) === profFilter), [board, profFilter]);
  const allAppts = useMemo(() => columns.flatMap((c) => c.appointments).sort((a, b) => a.start_at.localeCompare(b.start_at)), [columns]);

  async function changeStatus(a: Appointment, status: ApptStatus, reason?: string) {
    try {
      const updated = await appApi<Appointment>(`/appointments/${a.id}/status`, { method: "POST", body: { status, reason: reason || null } });
      setDetail((d) => (d && d.id === a.id ? { ...d, ...updated } : d));
      show(`${a.patient_name}: ${APPT_STATUS[status].label.toLowerCase()}`);
      loadBoard();
      if (view === "espera") loadWaiting();
      if (status === "ATENDIDO" && canCharge && !a.charged) setCharge({ ...a, ...updated });
    } catch (e) { fail(e); }
  }

  function moveDay(n: number) { setDay((d) => addDays(d, n)); }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    allAppts.forEach((a) => { c[a.status] = (c[a.status] || 0) + 1; });
    return c;
  }, [allAppts]);

  const mine = isDoctor ? professionals[0] : undefined;
  const viewOptions: [View, string][] = [["dia", "Día"], ["lista", "Lista"], ["espera", "Sala de espera"], ["recordatorios", "Recordatorios"]];
  if (isCircle) viewOptions.push(["horarios", isDoctor ? "Mis horarios" : "Horarios de los médicos"]);

  return (
    <section className="products-page">
      <PageHeader eyebrow={isCircle ? (isDoctor ? "MI AGENDA" : "AGENDA DE MÉDICOS") : "AGENDA"} title={isDoctor ? "Mis turnos" : "Turnos"}
        subtitle={`${allAppts.filter((a) => a.status !== "CANCELADO").length} turnos · ${counts.ATENDIDO || 0} atendidos · ${counts.EN_ESPERA || 0} en espera`}>
        <button className="primary-button" onClick={() => setForm({ start: undefined })}>+ Nuevo turno</button>
      </PageHeader>

      {isDoctor && mine && mine.availability.length === 0 && view !== "horarios" && (
        <div className="mr-note mr-note-warn" style={{ marginBottom: 14 }}>
          Todavía no cargaste tus horarios de atención: sin horarios no se ofrecen turnos.{" "}
          <button className="mr-link" onClick={() => setView("horarios")}>Cargar mis horarios</button>
        </div>
      )}

      <div className="mr-toolbar">
        <Seg value={view} onChange={setView} options={viewOptions} />
        {(view === "dia" || view === "lista") && (
          <div className="mr-day-nav">
            <span className="mr-day-title">{longDate(day)}</span>
            <button className="secondary-button" onClick={() => moveDay(-1)} aria-label="Día anterior">‹</button>
            <button className="secondary-button" onClick={() => setDay(new Date())}>Hoy</button>
            <button className="secondary-button" onClick={() => moveDay(1)} aria-label="Día siguiente">›</button>
            <input type="date" value={dayKey(day)} onChange={(e) => e.target.value && setDay(parseDay(e.target.value))} />
            {!isDoctor && (
              <select className="mr-select" value={profFilter} onChange={(e) => setProfFilter(e.target.value)} aria-label={`Elegir ${who}`}>
                <option value="">{isCircle ? "Médicos que atienden este día" : "Todos los profesionales"}</option>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}{isCircle && p.specialty ? ` · ${p.specialty}` : ""}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {view === "dia" && (loading ? <Loading /> : columns.length === 0 ? (
        isCircle
          ? <Empty title={isDoctor ? "Todavía no tenés agenda" : "Ningún médico atiende este día"}>
              {isDoctor ? "Pedile a la administración del círculo que revise tu alta en el padrón." : "Elegí un médico de la lista para ver su agenda, o cargale horarios en «Horarios de los médicos»."}
            </Empty>
          : <Empty title="No hay profesionales activos">Cargalos en Profesionales para empezar a dar turnos.</Empty>
      ) : (
        <>
          <DayBoard board={board!} columns={columns} circle={isCircle}
            onOpen={(a) => setDetail(a)}
            onEmpty={(pid, start) => setForm({ professionalId: pid, start })} />
          <div className="mr-legend" style={{ marginTop: 10 }}>
            {(Object.keys(APPT_STATUS) as ApptStatus[]).map((s) => (
              <span key={s}><i style={{ background: APPT_STATUS[s].color }} />{APPT_STATUS[s].label}</span>
            ))}
            <span>Tocá un espacio libre para dar un turno</span>
          </div>
        </>
      ))}

      {view === "lista" && (
        allAppts.length === 0 ? <Empty title="No hay turnos este día" /> : (
          <div className="mr-table-wrap mr-agenda-list">
            <table className="mr-table">
              <thead><tr><th>Hora</th><th>Paciente</th>{!isDoctor && <th>{isCircle ? "Médico" : "Profesional"}</th>}{!isCircle && <th>Cobertura</th>}<th>{isCircle ? "Tipo y motivo" : "Tipo"}</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {allAppts.map((a) => (
                  <tr key={a.id} className="is-click" onClick={() => setDetail(a)}>
                    <td><strong>{hhmm(a.start_at)}</strong>{a.overbook && <small>Sobreturno</small>}</td>
                    <td><strong>{a.patient_name}</strong><small>{a.patient_dni ? `DNI ${a.patient_dni}` : ""}{a.phone ? ` · ${a.phone}` : ""}</small></td>
                    {!isDoctor && <td>{a.professional_name}</td>}
                    {!isCircle && <td>{a.insurance_name || "Particular"}</td>}
                    <td>{APPT_KINDS[a.kind] || a.kind}{isCircle && a.reason && <small>{a.reason}</small>}{a.source === "WEB" && <small>Pedido online</small>}</td>
                    <td><Pill tone={toneOf(a.status)}>{APPT_STATUS[a.status].label}</Pill></td>
                    <td className="num">{a.deposit_status === "PENDIENTE" ? <Pill tone="orange">Esperando seña</Pill> : a.deposit_status === "PAGADA" ? <Pill tone="green">Seña {money(a.deposit_amount)}</Pill> : a.charged ? <Pill tone="green">Cobrado</Pill> : a.has_note ? <Pill tone="teal">Con evolución</Pill> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {view === "espera" && (
        waiting.length === 0 ? <Empty title="La sala de espera está vacía">Cuando un paciente llega, marcalo como “En sala de espera”.</Empty> : (
          <div className="mr-waiting">
            {waiting.map((a) => (
              <div key={a.id} className={`mr-wait-card ${a.status === "ATENDIENDO" ? "is-in" : ""}`}>
                <div className="mr-spread">
                  <strong>{a.patient_name}</strong>
                  <span className="mr-wait-time">{a.status === "ATENDIENDO" ? "Adentro" : `${a.wait_minutes ?? 0}′`}</span>
                </div>
                <small>Turno {hhmm(a.start_at)}{isDoctor ? "" : ` · ${a.professional_name}`}</small>
                <small>{isCircle ? a.reason || APPT_KINDS[a.kind] || "" : `${a.insurance_name || "Particular"}${a.reason ? ` · ${a.reason}` : ""}`}</small>
                <div className="mr-row" style={{ marginTop: 8 }}>
                  {a.status === "EN_ESPERA" && <button className="primary-button" onClick={() => changeStatus(a, "ATENDIENDO")}>Hacer pasar</button>}
                  <button className="secondary-button" onClick={() => changeStatus(a, "ATENDIDO")}>Atendido</button>
                  {a.patient_id && canAccess(user, "historia_clinica") && (
                    <button className="mr-link" onClick={() => navigate(`/app/pacientes/${a.patient_id}?tab=hc&turno=${a.id}`)}>Historia clínica</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {view === "recordatorios" && (
        <div className="mr-card">
          <div className="mr-card-head">
            <div><h2>Recordatorios por WhatsApp</h2><p>Mandá el recordatorio a cada paciente con un toque. Se abre WhatsApp con el mensaje listo.</p></div>
            <input type="date" className="mr-select" value={reminders?.day || dayKey(addDays(new Date(), 1))} onChange={(e) => e.target.value && loadReminders(e.target.value)} />
          </div>
          {!reminders ? <Loading /> : reminders.items.length === 0 ? <Empty title="No hay turnos para recordar ese día" /> : (
            <ul className="mr-list">
              {reminders.items.map((a) => (
                <li key={a.id}>
                  <span className="mr-time-badge">{hhmm(a.start_at)}</span>
                  <div className="mr-list-main">
                    <strong>{a.patient_name}</strong>
                    <small>{isDoctor ? "" : `${a.professional_name} · `}{a.phone || "sin teléfono"}{a.reminded_at ? ` · enviado ${dateTime(a.reminded_at)}` : ""}</small>
                  </div>
                  {a.whatsapp_url ? (
                    <a className={a.reminded_at ? "secondary-button" : "primary-button"} href={a.whatsapp_url} target="_blank" rel="noreferrer"
                      onClick={() => appApi(`/appointments/${a.id}/reminded`, { method: "POST" }).then(() => loadReminders(reminders.day)).catch(() => {})}>
                      {a.reminded_at ? "Reenviar" : "Enviar WhatsApp"}
                    </a>
                  ) : <Pill tone="orange">Sin celular</Pill>}
                </li>
              ))}
            </ul>
          )}
          <p className="mr-muted" style={{ marginTop: 12 }}>{isDoctor ? "El texto del mensaje lo define la administración del círculo." : "El texto del mensaje se cambia en Configuración."}</p>
        </div>
      )}

      {view === "horarios" && isCircle && (
        <AgendaHorarios professionals={professionals} isDoctor={!!isDoctor} isAdmin={user?.role === "ADMINISTRADOR"}
          onChanged={() => { loadProfessionals(); loadBoard(); }} show={show} fail={fail} />
      )}

      {detail && (
        <DetailModal appt={detail} circle={isCircle} onClose={() => setDetail(null)} canCharge={canCharge} canPatients={canPatients}
          canHC={canAccess(user, "historia_clinica")}
          onStatus={changeStatus}
          onEdit={() => { setForm({ appt: detail }); setDetail(null); }}
          onCharge={() => { setCharge(detail); setDetail(null); }}
          onPatient={() => navigate(`/app/pacientes/${detail.patient_id}`)}
          onHC={() => navigate(`/app/pacientes/${detail.patient_id}?tab=hc&turno=${detail.id}`)} />
      )}

      {form && (
        <AppointmentForm initial={form} professionals={professionals} insurances={insurances} canPatients={canPatients}
          circle={isCircle} single={!!isDoctor}
          defaultDay={day} defaultProfessionalId={profFilter ? Number(profFilter) : undefined}
          onClose={() => setForm(null)}
          onSaved={(a) => {
            setForm(null);
            show(`Turno guardado · ${a.patient_name} ${hhmm(a.start_at)}`);
            const d = new Date(a.start_at);
            if (dayKey(d) !== dayKey(day)) setDay(d); else loadBoard();
          }} />
      )}

      {charge && (
        <ChargeModal appointment={charge} professionals={professionals} insurances={insurances}
          onClose={() => setCharge(null)} onSaved={() => { setCharge(null); show("Cobro registrado"); loadBoard(); }} />
      )}
      {flash}
    </section>
  );
}

// =====================================================================
// Grilla del día
// =====================================================================
function DayBoard({ board, columns, circle, onOpen, onEmpty }: {
  board: Board; columns: Column[]; circle?: boolean; onOpen: (a: Appointment) => void; onEmpty: (professionalId: number, start: Date) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const base = parseDay(board.day);
  const toMin = (iso: string) => (new Date(iso).getTime() - base.getTime()) / 60000;

  let first = 24 * 60, last = 0;
  columns.forEach((c) => {
    c.blocks.forEach((b) => { first = Math.min(first, toMin(b.start)); last = Math.max(last, toMin(b.end)); });
    c.appointments.forEach((a) => { first = Math.min(first, toMin(a.start_at)); last = Math.max(last, toMin(a.end_at)); });
  });
  if (first >= last) { first = 8 * 60; last = 20 * 60; }
  first = Math.floor(first / 60) * 60;
  last = Math.min(24 * 60, Math.ceil(last / 60) * 60);
  const height = (last - first) * PX;
  const hours: number[] = [];
  for (let m = first; m <= last; m += 60) hours.push(m);
  const nowMin = toMin(board.now);
  const isToday = dayKey(new Date(board.now)) === board.day;

  // al abrir, baja hasta la hora actual
  useEffect(() => {
    if (isToday && wrap.current) wrap.current.scrollTop = Math.max(0, (nowMin - first - 60) * PX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.day]);

  return (
    <div className="mr-board-wrap" ref={wrap}>
      <div className="mr-board" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(190px, 1fr))` }}>
        <div className="mr-board-corner" />
        {columns.map((c) => (
          <div key={c.professional.id} className="mr-board-head">
            <span className="mr-avatar" style={{ background: c.professional.color }}>{initialsOf(c.professional.name)}</span>
            <div style={{ minWidth: 0 }}>
              <strong>{c.professional.name}</strong>
              <small>{c.professional.specialty || "—"} · {c.appointments.filter((a) => a.status !== "CANCELADO").length} turnos</small>
            </div>
          </div>
        ))}

        <div className="mr-board-hours" style={{ height, position: "sticky" }}>
          {hours.map((m) => <span key={m} style={{ top: (m - first) * PX }}>{String(Math.floor(m / 60)).padStart(2, "0")}:00</span>)}
        </div>
        {columns.map((c) => {
          const visible = c.appointments.filter((a) => a.status !== "CANCELADO");
          return (
            <div key={c.professional.id} className="mr-board-col" style={{ height }}>
              <div className="mr-board-closed" style={{ top: 0, height }} />
              {c.blocks.map((b, i) => {
                const top = (toMin(b.start) - first) * PX;
                const h = (toMin(b.end) - toMin(b.start)) * PX;
                return (
                  <div key={i} className="mr-board-open" style={{ top, height: h }} title="Tocá para dar un turno"
                    onClick={(e) => {
                      const y = e.clientY - (e.currentTarget.getBoundingClientRect().top);
                      const slot = c.professional.slot_minutes || 20;
                      const offset = Math.floor(y / PX / slot) * slot;
                      onEmpty(c.professional.id, addMinutes(new Date(b.start), offset));
                    }} />
                );
              })}
              {hours.map((m) => <div key={m} className="mr-board-line" style={{ top: (m - first) * PX }} />)}
              {isToday && nowMin >= first && nowMin <= last && <div className="mr-board-now" style={{ top: (nowMin - first) * PX }} />}
              {visible.map((a, i) => {
                const st = APPT_STATUS[a.status];
                const top = (toMin(a.start_at) - first) * PX;
                const overlapped = visible.slice(0, i).some((b) => b.end_at > a.start_at && b.start_at < a.end_at);
                const under = !overlapped && visible.slice(i + 1).some((b) => b.end_at > a.start_at && b.start_at < a.end_at);
                // los turnos que se pisan (sobreturnos) ocupan media columna: les damos más alto para que el nombre no se corte
                const h = Math.max(overlapped || under ? 40 : 22, (toMin(a.end_at) - toMin(a.start_at)) * PX - 2);
                return (
                  <button key={a.id} type="button" className={`mr-appt ${overlapped ? "is-over" : under ? "is-under" : ""}`}
                    style={{ top, height: h, background: st.bg, color: st.text, borderColor: st.color }}
                    onClick={() => onOpen(a)} title={`${hhmm(a.start_at)} ${a.patient_name} · ${st.label}${a.overbook ? " · Sobreturno" : ""}`}>
                    <strong>{hhmm(a.start_at)} {a.patient_name}</strong>
                    {h > 34 && <small>{circle ? a.reason || APPT_KINDS[a.kind] || a.kind : `${a.insurance_name || "Particular"} · ${APPT_KINDS[a.kind] || a.kind}`}</small>}
                    <span className="mr-appt-flags">
                      {a.source === "WEB" && <span title="Pedido online">🌐</span>}
                      {a.overbook && <span title="Sobreturno">＋</span>}
                      {a.deposit_status === "PENDIENTE" && <span title="Esperando el pago de la seña">⏳</span>}
                      {a.charged && <span title="Cobrado">$</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function initialsOf(name: string) {
  return name.replace(/^(dra?|od|lic)\.?\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// =====================================================================
// Detalle del turno
// =====================================================================
function DetailModal({ appt: a, circle, onClose, onStatus, onEdit, onCharge, onPatient, onHC, canCharge, canPatients, canHC }: {
  appt: Appointment; circle?: boolean; onClose: () => void; onStatus: (a: Appointment, s: ApptStatus, reason?: string) => void;
  onEdit: () => void; onCharge: () => void; onPatient: () => void; onHC: () => void;
  canCharge: boolean; canPatients: boolean; canHC: boolean;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const st = APPT_STATUS[a.status];
  const start = new Date(a.start_at);
  const wa = waLink(a);

  return (
    <Modal eyebrow={`TURNO · CÓDIGO ${a.code}`} title={a.patient_name} onClose={onClose} size="wide">
      <div className="mr-row" style={{ marginBottom: 14 }}>
        <Pill tone={toneOf(a.status)}>{st.label}</Pill>
        {a.overbook && <Pill tone="orange">Sobreturno</Pill>}
        {a.source === "WEB" && <Pill tone="blue">Pedido online</Pill>}
        {a.charged && <Pill tone="green">Cobrado</Pill>}
        {a.has_note && <Pill tone="teal">Con evolución</Pill>}
        {a.deposit_status === "PAGADA" && <Pill tone="green">Seña pagada {money(a.deposit_amount)}</Pill>}
        {a.deposit_status === "PENDIENTE" && <Pill tone="orange">Esperando la seña ({money(a.deposit_amount)})</Pill>}
        {a.deposit_status === "VENCIDA" && <Pill tone="red">Seña no pagada</Pill>}
      </div>
      <div className="mr-detail-grid">
        <div><small>Día y hora</small><strong>{longDate(start)} · {hhmm(a.start_at)} a {hhmm(a.end_at)}</strong></div>
        <div><small>{circle ? "Médico" : "Profesional"}</small><strong>{a.professional_name}</strong></div>
        {!circle && <div><small>Cobertura</small><span>{a.insurance_name || "Particular"}</span></div>}
        <div><small>Tipo</small><span>{APPT_KINDS[a.kind] || a.kind}</span></div>
        <div><small>DNI</small><span>{a.patient_dni || "—"}</span></div>
        <div><small>Teléfono</small><span>{a.phone || "—"}</span></div>
        {a.reason && <div><small>Motivo</small><span>{a.reason}</span></div>}
        {a.notes && <div><small>Notas</small><span>{a.notes}</span></div>}
        {a.arrived_at && <div><small>Llegó</small><span>{hhmm(a.arrived_at)}{a.started_at ? ` · pasó ${hhmm(a.started_at)}` : ""}{a.finished_at ? ` · terminó ${hhmm(a.finished_at)}` : ""}</span></div>}
        {a.cancel_reason && <div><small>Cancelación</small><span>{a.cancel_reason}</span></div>}
      </div>

      <h4 className="mr-form-title">Cambiar estado</h4>
      <div className="mr-status-btns">
        {NEXT_STATUS[a.status].filter((s) => s !== "CANCELADO").map((s) => (
          <button key={s} className="mr-status-btn" onClick={() => onStatus(a, s)}>
            <i style={{ background: APPT_STATUS[s].color }} />{actionLabel(s, a.status)}
          </button>
        ))}
        {NEXT_STATUS[a.status].includes("CANCELADO") && !cancelling && (
          <button className="mr-status-btn" onClick={() => setCancelling(true)}><i style={{ background: APPT_STATUS.CANCELADO.color }} />Cancelar turno</button>
        )}
      </div>
      {cancelling && (
        <div className="mr-row" style={{ marginTop: 10 }}>
          <input className="mr-search" style={{ flex: 1 }} placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="mr-danger-button" onClick={() => { onStatus(a, "CANCELADO", reason); setCancelling(false); }}>Confirmar cancelación</button>
        </div>
      )}

      <div className="modal-actions" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="mr-row">
          {a.patient_id && canPatients && <button className="secondary-button" onClick={onPatient}>Ficha del paciente</button>}
          {a.patient_id && canHC && <button className="secondary-button" onClick={onHC}>Historia clínica</button>}
          {wa && <a className="secondary-button" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
        </div>
        <div className="mr-row">
          {!["ATENDIDO", "CANCELADO"].includes(a.status) && <button className="secondary-button" onClick={onEdit}>Editar / mover</button>}
          {canCharge && a.status !== "CANCELADO" && <button className="primary-button" onClick={onCharge}>{a.charged ? "Otro cobro" : "Cobrar"}</button>}
        </div>
      </div>
    </Modal>
  );
}

function actionLabel(to: ApptStatus, from: ApptStatus): string {
  if (to === "EN_ESPERA") return from === "ATENDIENDO" ? "Volver a sala de espera" : "Llegó · sala de espera";
  if (to === "ATENDIENDO") return from === "ATENDIDO" ? "Reabrir (en consultorio)" : "Hacer pasar";
  if (to === "ATENDIDO") return "Atendido";
  if (to === "CONFIRMADO") return "Confirmó";
  if (to === "RESERVADO") return from === "CANCELADO" ? "Reactivar turno" : from === "AUSENTE" ? "Quitar ausente" : "Volver a reservado";
  if (to === "AUSENTE") return "No vino";
  return APPT_STATUS[to].label;
}

function waLink(a: Appointment): string | null {
  const digits = (a.phone || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const num = digits.startsWith("54") ? digits : "549" + digits.replace(/^0/, "");
  const d = new Date(a.start_at);
  const text = `Hola ${a.patient_name.split(" ")[0]}, te escribimos por tu turno del ${longDate(d).toLowerCase()} a las ${hhmm(d)} con ${a.professional_name}.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

// =====================================================================
// Alta / edición de turno
// =====================================================================
function AppointmentForm({ initial, professionals, insurances, canPatients, circle, single, defaultDay, defaultProfessionalId, onClose, onSaved }: {
  initial: { appt?: Appointment; professionalId?: number; start?: Date };
  professionals: Professional[]; insurances: InsuranceItem[]; canPatients: boolean;
  circle?: boolean;    // círculo médico: sin cobertura ni ficha de paciente
  single?: boolean;    // el médico agenda en su propia agenda: no elige profesional
  defaultDay: Date; defaultProfessionalId?: number;
  onClose: () => void; onSaved: (a: Appointment) => void;
}) {
  const a = initial.appt;
  const startDefault = a ? new Date(a.start_at) : initial.start || null;
  const [professionalId, setProfessionalId] = useState<string>(String(a?.professional_id || initial.professionalId || defaultProfessionalId || professionals[0]?.id || ""));
  const [dayStr, setDayStr] = useState(dayKey(startDefault || defaultDay));
  const [time, setTime] = useState(startDefault ? hhmm(startDefault) : "");
  const [manual, setManual] = useState(!!a?.overbook);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [duration, setDuration] = useState<string>(a ? String(a.duration) : "");
  const [patient, setPatient] = useState<PatientLite | null>(null);
  const [name, setName] = useState(a?.patient_name || "");
  const [dni, setDni] = useState(a?.patient_dni || "");
  const [phone, setPhone] = useState(a?.phone || "");
  const [insuranceId, setInsuranceId] = useState<string>(a?.insurance_id ? String(a.insurance_id) : "");
  const [kind, setKind] = useState(a?.kind || "CONSULTA");
  const [reason, setReason] = useState(a?.reason || "");
  const [notes, setNotes] = useState(a?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const prof = professionals.find((p) => String(p.id) === professionalId);

  useEffect(() => {
    if (!professionalId || !dayStr) return;
    setSlots(null);
    appApi<{ free: string[] }>(`/appointments/slots?professional_id=${professionalId}&day=${dayStr}`)
      .then((r) => setSlots(r.free.map((f) => hhmm(f)))).catch(() => setSlots([]));
  }, [professionalId, dayStr]);

  function pickPatient(p: PatientLite) {
    setPatient(p);
    setName(`${p.first_name} ${p.last_name}`);
    setDni(p.dni || "");
    setPhone(p.phone || "");
    if (p.insurance_id) setInsuranceId(String(p.insurance_id));
  }

  async function save() {
    setError("");
    if (!professionalId) return setError(circle ? "Elegí el médico" : "Elegí el profesional");
    if (!time) return setError("Elegí un horario");
    if (!patient && !name.trim() && !a?.patient_id) return setError("Escribí el nombre del paciente");
    const [h, m] = time.split(":").map(Number);
    const start = parseDay(dayStr);
    start.setHours(h, m, 0, 0);
    const freeSlot = slots?.includes(time);
    const sameAsBefore = !!a && hhmm(a.start_at) === time && dayKey(new Date(a.start_at)) === dayStr && String(a.professional_id) === professionalId;
    setSaving(true);
    try {
      const body = {
        professional_id: Number(professionalId), start_at: toLocalISO(start),
        duration_minutes: numOrNull(duration),
        patient_id: patient?.id || a?.patient_id || null,
        patient_name: strOrNull(name), patient_dni: strOrNull(dni), phone: strOrNull(phone),
        insurance_id: numOrNull(insuranceId), kind, reason: strOrNull(reason), notes: strOrNull(notes),
        // sobreturno solo si eligió un horario a mano que no está libre
        // (si edita y deja el mismo horario de un turno normal, no hace falta)
        overbook: manual && !freeSlot && !(sameAsBefore && !a?.overbook),
      };
      const saved = a
        ? await appApi<Appointment>(`/appointments/${a.id}`, { method: "PUT", body })
        : await appApi<Appointment>("/appointments", { method: "POST", body });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal eyebrow={a ? "EDITAR TURNO" : "NUEVO TURNO"} title={a ? a.patient_name : "Dar un turno"} onClose={onClose} size="wide"
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : a ? "Guardar cambios" : "Dar turno"}</button>
      </>}>
      <div className="product-form">
        <h4 className="mr-form-title">Cuándo</h4>
        <div className="form-row">
          {!single && (
            <Field label={circle ? "Médico" : "Profesional"}>
              <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` · ${p.specialty}` : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="Día"><input type="date" value={dayStr} onChange={(e) => setDayStr(e.target.value)} /></Field>
        </div>
        <Field label={<>Horario {prof && <span className="mr-muted">· turnos de {prof.slot_minutes} min</span>}</>}>
          {!manual && (slots === null ? <span className="mr-muted">Buscando horarios libres…</span> : slots.length === 0 ? (
            <div className="mr-note mr-note-warn">No hay horarios libres ese día (no atiende o está completo). Podés dar un sobreturno con otro horario.</div>
          ) : (
            <div className="mr-slots">
              {slots.map((s) => <button key={s} type="button" className={`mr-slot ${time === s ? "is-on" : ""}`} onClick={() => setTime(s)}>{s}</button>)}
            </div>
          ))}
          <div className="mr-row" style={{ marginTop: 10 }}>
            <div className="mr-inline-checks" style={{ paddingTop: 0 }}>
              <label><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Sobreturno / otro horario</label>
            </div>
            {manual && <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 130 }} />}
            {manual && <input type="number" min="5" step="5" placeholder={`${prof?.slot_minutes || 20} min`} value={duration} onChange={(e) => setDuration(e.target.value)} style={{ width: 110 }} />}
          </div>
        </Field>

        <h4 className="mr-form-title">Paciente</h4>
        {canPatients && !a?.patient_id && (
          patient ? (
            <div className="mr-selected-patient">
              <span><strong>{patient.full_name}</strong> <span className="mr-muted">{patient.dni ? `· DNI ${patient.dni}` : ""}{patient.insurance_name ? ` · ${patient.insurance_name}` : ""}</span></span>
              <button className="mr-link" type="button" onClick={() => setPatient(null)}>Cambiar</button>
            </div>
          ) : <PatientSearch onPick={pickPatient} />
        )}
        {!patient && (
          <>
            {canPatients && !a?.patient_id && <p className="mr-muted" style={{ margin: "8px 0" }}>¿Es nuevo? Cargá sus datos y se crea la ficha sola.</p>}
            <div className="form-row">
              <Field label="Nombre y apellido"><input value={name} onChange={(e) => setName(e.target.value)} disabled={!!a?.patient_id} /></Field>
              <Field label="DNI"><input value={dni} onChange={(e) => setDni(e.target.value)} disabled={!!a?.patient_id} /></Field>
            </div>
          </>
        )}
        <div className="form-row">
          <Field label="Celular (para recordatorios)"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="351 555-1234" /></Field>
          {!circle && (
            <Field label="Cobertura">
              <select value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
                <option value="">Particular</option>
                {insurances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="form-row">
          <Field label="Tipo de turno">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(APPT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Control, dolor de muela…" /></Field>
        </div>
        <Field label="Notas internas"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></Field>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export function PatientSearch({ onPick, placeholder }: { onPick: (p: PatientLite) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PatientLite[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems([]); return; }
    const t = window.setTimeout(() => {
      appApi<{ items: PatientLite[] }>(`/patients?limit=8&q=${encodeURIComponent(term)}`).then((r) => setItems(r.items)).catch(() => setItems([]));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <div className="mr-patient-pick">
      <input className="mr-search" style={{ width: "100%" }} placeholder={placeholder || "Buscar paciente existente por nombre o DNI…"} value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 && items.length > 0 && (
        <div className="mr-patient-results">
          {items.map((p) => (
            <button key={p.id} type="button" onClick={() => { onPick(p); setQ(""); }}>
              <span>{p.full_name}</span>
              <small>{p.dni ? `DNI ${p.dni}` : ""}{p.age !== null ? ` · ${p.age} años` : ""}{p.insurance_name ? ` · ${p.insurance_name}` : ""}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Agenda;
