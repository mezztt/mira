import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  appApi, canAccess, money, hhmm, timeRange, dayKey, addDays, longDate, shortDate, moduleLabel, moduleHint,
  APPT_STATUS, PAYMENT_LABELS, ROLE_HINTS, ROLE_LABELS, ROLES_BY_KIND,
} from "../config";
import type { Appointment, PatientLite, SessionUser } from "../config";
import { MiraLogo } from "./Brand";

/**
 * Asistente de MIRA.
 * Responde con datos ADMINISTRATIVOS reales (turnos, sala de espera, cobros, saldos, pacientes por nombre/DNI)
 * consultando la API del propio sistema, y explica cómo usar cada pantalla. No usa IA externa: no tiene costo.
 * Nunca muestra datos clínicos (motivo de consulta, notas, alergias, evoluciones, diagnósticos): eso se ve en la ficha.
 * Solo ofrece lo que el usuario puede ver: usa canAccess (módulos contratados + rol).
 */

interface Msg {
  from: "bot" | "user";
  text: string;
  actions?: { label: string; to: string }[];
}

interface PendingItem { key: string; label: string; count: number; path: string; amount?: number }
interface ClinicDash {
  today: Record<string, number>;
  professionals_today: { id: number; name: string; total: number; attended: number; next: string | null }[];
  birthdays?: { id: number; name: string }[];
  patients_total?: number; patients_new_month?: number;
}
interface CircleDash {
  to_audit: number; ready_to_present: { count: number; total: number }; receivable: number;
  overdue_batches: { number: string | number; payer_name: string | null; pending: number }[];
  to_settle: { count: number; total: number }; period_total: number; period: string;
}
interface ChargesRes {
  summary: { collected: number; insurance: number; count: number; by_method: Record<string, number> };
}
interface BudgetRow { id: number; number: number; status: string; patient_name: string | null; total: number; balance: number }
interface BudgetsRes { items: BudgetRow[]; summary: { count: number; balance: number; presented_total: number } }
interface InsGroup { insurance_name: string; count: number; total: number }

// ---------------------------------------------------------------- texto
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Una palabra clave: exacta, con tipeo (1-2 letras) si es larga, o prefijo si termina en * */
function wordIs(w: string, k: string): boolean {
  if (k.endsWith("*")) {
    const p = k.slice(0, -1);
    return w.startsWith(p) || (p.length >= 5 && lev(w.slice(0, p.length), p) <= 1);
  }
  return w === k || (k.length >= 5 && lev(w, k) <= (k.length >= 9 ? 2 : 1));
}
/** Una clave puede ser una frase («dar turno»): sus palabras tienen que aparecer seguidas */
function keyIn(toks: string[], k: string): boolean {
  const ws = k.split(" ");
  for (let i = 0; i + ws.length <= toks.length; i++) if (ws.every((w, j) => wordIs(toks[i + j], w))) return true;
  return false;
}
const matcher = (t: string) => { const toks = t.split(" "); return (...keys: string[]) => keys.some((k) => keyIn(toks, k)); };
const score = (t: string, keys: string[]) => { const toks = t.split(" "); return keys.filter((k) => keyIn(toks, k)).length; };

// ---------------------------------------------------------------- ayuda
interface Help {
  keys: string[];
  text: string | ((u: SessionUser | null) => string);
  need?: string;                 // módulo que el usuario tiene que poder abrir
  kind?: "CONSULTORIO" | "CIRCULO";
  to?: string; label?: string;
}

const HELP: Help[] = [
  { keys: ["dar de baja el servicio", "dar de baja el sistema", "baja del servicio", "baja del sistema", "darme de baja", "cancelar el servicio", "cancelar mi cuenta", "dejar de usar el sistema", "retirar la baja", "constancia de baja"],
    to: "/app/configuracion", label: "Ir a Configuración",
    text: "Para dar de baja el servicio entrá a Configuración y tocá «Dar de baja el servicio» (también está al pie de la pantalla de ingreso). Lo hace el administrador, sin motivo y en dos pasos, y te da una constancia BAJA-AAAA-NNNN con fecha y hora para copiar o imprimir. El sistema NO se corta ese día: sigue funcionando hasta el final del período que ya pagaste, y antes de esa fecha podés «Retirar la baja». Después se desactiva y tus datos se conservan." },
  { keys: ["dar turno", "dar un turno", "nuevo turno", "turno nuevo", "sacar turno", "agendar", "reservar", "cargar turno", "anotar paciente", "programar turno", "doy un turno", "doy turno", "pido un turno", "saco un turno", "cargo un turno", "agrego un turno", "creo un turno", "hago un turno", "doy de alta un turno", "damos turno"],
    need: "agenda", to: "/app/agenda?nuevo=1", label: "Nuevo turno",
    text: "En Agenda tocá un espacio libre de la grilla, o «+ Nuevo turno». Elegís profesional, día y horario, buscás al paciente (si es nuevo, cargás sus datos y se crea la ficha sola) y guardás." },
  { keys: ["sobreturno*", "encajar", "fuera de horario", "sin horario libre"],
    need: "agenda", to: "/app/agenda", label: "Ir a Agenda",
    text: "Al dar el turno, si el horario está ocupado tildá «Sobreturno / otro horario»: te deja elegir cualquier hora y el turno queda marcado como sobreturno." },
  { keys: ["cancelar turno", "cancelar", "anular turno", "reprogramar", "mover turno", "cambiar turno", "cambiar horario", "editar turno", "pasar turno", "cancelo", "cancelo un turno", "reprogramo", "muevo un turno", "cambio un turno", "anulo un turno"],
    need: "agenda", to: "/app/agenda", label: "Ir a Agenda",
    text: "Abrí el turno en la Agenda: «Editar / mover» cambia el día o la hora, y «Cancelar turno» lo cancela (te pide confirmar). El horario queda libre al instante." },
  { keys: ["llegada", "llego", "llegaron", "hacer pasar", "atender", "atendido", "estado del turno", "cambiar estado", "marcar llegada", "sala de espera"],
    need: "agenda", to: "/app/agenda?vista=espera", label: "Ver sala de espera",
    text: "Cuando llega el paciente, abrí su turno y pasalo a «En sala de espera». Con «Hacer pasar» queda en consultorio y con «Atendido» se cierra. La vista Sala de espera muestra quién espera y hace cuánto." },
  { keys: ["recordatorio*", "whatsapp", "avisar", "avisarle", "confirmar turno", "confirmar asistencia"],
    need: "agenda", to: "/app/agenda?vista=recordatorios", label: "Ver recordatorios",
    text: "En Agenda → Recordatorios por WhatsApp ves los turnos de mañana: tocás cada uno y se abre WhatsApp con el mensaje listo. El texto del mensaje lo cambia el administrador en Configuración." },
  { keys: ["nuevo paciente", "alta de paciente", "cargar paciente", "agregar paciente", "crear paciente", "importar", "excel", "planilla de pacientes"],
    need: "pacientes", kind: "CONSULTORIO", to: "/app/pacientes", label: "Ir a Pacientes",
    text: "En Pacientes tocá «+ Nuevo paciente» y completá los datos (con nombre y DNI alcanza para empezar). Si ya tenés una planilla, usá «Importar desde Excel»." },
  { keys: ["editar paciente", "editar ficha", "modificar paciente", "cambiar telefono", "cambiar obra social", "cambiar datos", "datos del paciente"],
    need: "pacientes", kind: "CONSULTORIO", to: "/app/pacientes", label: "Ir a Pacientes",
    text: "Buscá al paciente, abrí su ficha y tocá «Editar ficha»: ahí cambiás teléfono, obra social y demás datos." },
  { keys: ["historia clinica", "evolucion*", "evolucionar", "enmendar", "enmienda*", "signos vitales", "nota clinica"],
    need: "historia_clinica", to: "/app/pacientes", label: "Ir a Pacientes",
    text: "Abrí la ficha del paciente → pestaña «Historia clínica» (o «Historia clínica» desde el turno). Cada evolución queda inalterable: para corregir se usa «Enmendar» y se conserva el registro." },
  { keys: ["odontograma", "dientes", "diente", "pieza dental", "caries"],
    need: "odontologia", to: "/app/pacientes", label: "Ir a Pacientes",
    text: "En la ficha del paciente, pestaña «Odontograma»: marcás cada pieza y cara, y los tratamientos pendientes pueden pasar directo a un presupuesto." },
  { keys: ["receta*", "documento*", "certificado*", "pedido de estudios", "derivacion", "indicaciones", "imprimir receta"],
    need: "documentos", to: "/app/pacientes", label: "Ir a Pacientes",
    text: "En la ficha del paciente → pestaña «Recetas y documentos» cargás recetas, pedidos de estudios, certificados, indicaciones o derivaciones, y los imprimís en PDF." },
  { keys: ["registrar cobro", "cobrar", "cobro", "cobros", "caja", "coseguro", "medio de pago", "efectivo", "transferencia"],
    need: "cobros", kind: "CONSULTORIO", to: "/app/cobros", label: "Ir a Cobros",
    text: "En Cobros tocá «+ Registrar cobro» (o «Cobrar» desde la ficha del paciente): elegís paciente, tipo (particular, coseguro u obra social), concepto, medio y monto. Los de obra social quedan para presentar." },
  { keys: ["presentar", "obra social", "obras sociales", "prepaga*", "planilla de obra"],
    need: "cobros", kind: "CONSULTORIO", to: "/app/cobros?tab=os", label: "Ver obras sociales",
    text: "En Cobros → pestaña «Obras sociales» ves lo pendiente de presentar agrupado por obra social, con código y autorización de cada práctica, y exportás la planilla." },
  { keys: ["lista de precios", "precio*", "arancel*", "practica*", "nomenclador"],
    need: "presupuestos", kind: "CONSULTORIO", to: "/app/presupuestos?tab=precios", label: "Ver lista de precios",
    text: "En Presupuestos → «Lista de precios» cargás tus prácticas con «+ Nueva práctica» (código y precio). Cambiar un precio no modifica los presupuestos ya armados." },
  { keys: ["presupuesto*", "plan de tratamiento", "pago a cuenta", "cuotas"],
    need: "presupuestos", kind: "CONSULTORIO", to: "/app/presupuestos", label: "Ir a Presupuestos",
    text: "En Presupuestos armás uno por paciente con renglones de tu lista de precios (también desde el odontograma). Lo marcás presentado y, cuando acepta, cargás sus pagos a cuenta: el saldo se actualiza solo." },
  { keys: ["horario*", "licencia*", "feriado*", "vacaciones", "profesional*", "duracion del turno", "dias de atencion"],
    need: "profesionales", kind: "CONSULTORIO", to: "/app/profesionales", label: "Ir a Profesionales",
    text: "En Profesionales cargás a cada uno con sus días y horarios de atención y la duración del turno. Las licencias y feriados que cargues ahí bloquean esos días en la agenda." },
  { keys: ["web", "link", "pagina", "online", "compartir", "instagram", "pacientes saquen"],
    need: "web_turnos", to: "/app/configuracion", label: "Ir a Configuración",
    text: "En Configuración → «Web de turnos» copiás el link para compartir por WhatsApp o Instagram: los pacientes eligen día y horario y también pueden cancelar solos. Esos turnos aparecen como «Pedido online» y avisan en la campanita." },
  { keys: ["sena", "mercado pago", "mercadopago", "anticipo", "deposito"],
    need: "configuracion", to: "/app/configuracion", label: "Ir a Configuración",
    text: "La seña se activa en Configuración → «Seña online con Mercado Pago»: conectás la cuenta del consultorio y elegís porcentaje o monto fijo y cuántos minutos tiene el paciente para pagar." },
  { keys: ["usuario*", "rol", "roles", "permiso*", "empleado*", "secretaria", "recepcionista", "contrasena", "clave"],
    need: "usuarios", to: "/app/usuarios", label: "Ir a Usuarios",
    text: (u) => "En Usuarios creás al equipo y elegís su rol. " + (ROLES_BY_KIND[u?.kind || "CONSULTORIO"] || []).map((r) => `${ROLE_LABELS[r]}: ${ROLE_HINTS[r]}`).join(". ") + "." },
  { keys: ["reporte*", "estadistica*", "ausentismo", "informe*"],
    need: "reportes", to: "/app/reportes", label: "Ir a Reportes",
    text: (u) => `En Reportes: ${moduleHint("reportes", u?.kind).replace(/^./, (c) => c.toLowerCase())}.` },
  // ---- círculo médico
  { keys: ["padron", "matricula", "alta de medico", "cargar medico", "medicos"],
    need: "padron", kind: "CIRCULO", to: "/app/padron", label: "Ir a Padrón",
    text: "En Padrón está la nómina de médicos: matrícula, especialidad, categoría, CBU y condición impositiva. Un médico dado de alta y activo tiene su propia agenda." },
  { keys: ["convenio*", "nomenclador", "valores", "actualizar valores"],
    need: "convenios", kind: "CIRCULO", to: "/app/convenios", label: "Ir a Convenios",
    text: "En Convenios cargás las obras sociales y prepagas con su nomenclador y valores, y cada actualización de valores." },
  { keys: ["prestacion*", "auditar", "auditoria", "duplicado*", "cargar prestaciones"],
    need: "prestaciones", kind: "CIRCULO", to: "/app/prestaciones", label: "Ir a Prestaciones",
    text: "En Prestaciones se cargan las del mes, el sistema controla duplicados y se audita cada una (aprobar u observar) antes de presentarlas." },
  { keys: ["presentacion*", "refacturar", "debito*", "facturar obra social", "lote*"],
    need: "presentaciones", kind: "CIRCULO", to: "/app/presentaciones", label: "Ir a Presentaciones",
    text: "En Presentaciones armás la facturación por obra social con las prestaciones aprobadas, registrás cobros y débitos, y refacturás lo debitado." },
  { keys: ["liquidacion*", "honorario*", "retencion*", "recibo*", "pagar a los medicos"],
    need: "liquidaciones", kind: "CIRCULO", to: "/app/liquidaciones", label: "Ir a Liquidaciones",
    text: "En Liquidaciones se calculan los honorarios de cada médico con gastos, cuota y retenciones, y se emiten los recibos y transferencias." },
  { keys: ["mi portal", "portal*", "mis prestaciones", "mis liquidaciones"],
    need: "portal_medico", to: "/app/portal", label: "Ir a Mi portal",
    text: "En Mi portal cargás tus prestaciones, ves en qué estado está cada una (cargada, presentada, cobrada o debitada) y consultás tus liquidaciones." },
  // ---- general
  { keys: ["campanita", "campana", "aviso*", "notificacion*", "alerta*"],
    text: "Los avisos (turnos nuevos de la web, cancelaciones, ausentes, novedades) llegan con un pitido y quedan en la campanita de arriba a la derecha." },
  { keys: ["modo oscuro", "oscuro", "claro", "tema", "colores"],
    text: "El modo oscuro o claro se cambia abajo del menú de la izquierda (en el celular, abrí el menú con el botón de arriba)." },
  { keys: ["recorrido", "tutorial", "como funciona*", "como funcionamos", "primeros pasos", "guia"],
    text: "Abajo del menú tocá «¿Cómo funcionamos?» y te muestro un recorrido por las pantallas que vos usás.", },
];

const HELP_VERBS = ["como*", "donde", "que hago", "se puede", "puedo", "quiero", "necesito", "tutorial", "ayuda con", "explicame", "dar", "darle", "sacar", "agendar",
  "cancelar", "reprogramar", "mover", "cargar", "crear", "agregar", "anotar", "registrar", "editar", "configurar", "activar", "imprimir", "importar", "exportar", "cambiar", "modificar"];

const CLINICAL = ["diagnostico*", "alergia*", "alergico*", "medicacion", "medicamento*", "antecedente*", "enfermedad*", "patologia*", "tratamiento de", "que tiene", "resultado*", "motivo de consulta", "sintoma*", "estudios de", "evolucion de", "historia de", "historia clinica de"];

const DENIED_NAME: Record<string, string> = {
  agenda: "la agenda", pacientes: "los pacientes", cobros: "los cobros", presupuestos: "los presupuestos", historia_clinica: "la historia clínica",
};

// ---------------------------------------------------------------- componente
function Assistant({ user }: { user: SessionUser | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // en el celular el botón se esconde al bajar la pantalla (así no tapa los botones de acción del final) y vuelve al subir
  const [tuck, setTuck] = useState(false);
  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | Document;
      const y = t instanceof Document ? window.scrollY : (t as HTMLElement).scrollTop;
      const prev = last.get(t);
      if (prev === undefined) { last.set(t, y); return; }
      if (Math.abs(y - prev) > 6) { setTuck(y > prev && y > 60); last.set(t, y); }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const can = (m: string) => canAccess(user, m);
  const kind = user?.kind || "CONSULTORIO";
  const isClinic = kind === "CONSULTORIO";
  const isCircle = kind === "CIRCULO";
  const isDoctor = user?.role === "MEDICO";
  const onlyMine = user?.role === "PROFESIONAL" || isDoctor;   // el servidor ya filtra: solo ve lo suyo
  const sees = {
    agenda: can("agenda"), pacientes: isClinic && can("pacientes"), cobros: isClinic && can("cobros"),
    presupuestos: isClinic && can("presupuestos"),
    prest: isCircle && !isDoctor && can("prestaciones"), pres: isCircle && !isDoctor && can("presentaciones"),
    liq: isCircle && !isDoctor && can("liquidaciones"),
  };

  useEffect(() => {
    if (open && msgs.length === 0) {
      const first = (user?.name || "").replace(/^(dra?|lic|od)\.?\s+/i, "").split(" ")[0];
      setMsgs([{
        from: "bot",
        text: `¡Hola${first ? ` ${first}` : ""}! Soy el asistente de MIRA. Te cuento los turnos, la sala de espera, los cobros y los saldos, busco pacientes por nombre o DNI y te explico cómo hacer cada cosa. No muestro datos clínicos en el chat: eso se ve en la ficha.`,
      }]);
    }
    if (open) window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, typing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const deny = (module: string): Msg => ({
    from: "bot",
    text: `Tu usuario no tiene acceso a ${DENIED_NAME[module] || moduleLabel(module, kind).toLowerCase()}. Si lo necesitás, pedíselo al administrador.`,
  });

  const apptLine = (a: Appointment, withProf: boolean) =>
    `• ${hhmm(a.start_at)} · ${a.patient_name}${withProf && a.professional_name ? ` (${a.professional_name})` : ""} — ${APPT_STATUS[a.status]?.label || a.status}`;

  async function dayAppointments(d: Date) {
    const k = dayKey(d);
    return appApi<Appointment[]>(`/appointments?date_from=${k}&date_to=${k}`);
  }

  async function answer(raw: string): Promise<Msg> {
    const t = norm(raw);
    const h = matcher(t);
    const withProfs = (list: Appointment[]) => !onlyMine && new Set(list.map((a) => a.professional_id)).size > 1;

    // ---- código de turno (6 caracteres, el que recibe el paciente de la web) ----
    const code = raw.toUpperCase().match(/\b[A-HJ-NP-Z2-9]{6}\b/);
    if (code && (h("codigo") || (raw.trim().toUpperCase() === code[0] && /\d/.test(code[0])))) {
      if (!sees.agenda) return deny("agenda");
      try {
        const a = await appApi<Appointment>(`/appointments/by-code/${code[0]}`);
        return {
          from: "bot",
          text: `Código ${a.code}: ${a.patient_name} · ${shortDate(a.start_at)} ${timeRange(a.start_at, a.end_at)}${a.professional_name ? ` · ${a.professional_name}` : ""}.\nEstado: ${APPT_STATUS[a.status]?.label || a.status}.`,
          actions: [{ label: "Ver ese día en la Agenda", to: `/app/agenda?dia=${a.start_at.slice(0, 10)}&turno=${a.id}` }],
        };
      } catch {
        return { from: "bot", text: `No encontré ningún turno con el código ${code[0]}. Revisá que esté bien escrito.` };
      }
    }

    // ---- saludo / gracias / qué podés hacer ----
    if (/^(hola|holaa+|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/.test(t) && t.split(" ").length <= 3) {
      return { from: "bot", text: "¡Hola! ¿En qué te ayudo? Podés tocar una de las sugerencias de abajo o escribirme." };
    }
    if (h("gracias", "genial", "joya", "perfecto", "excelente", "buenisimo", "listo", "ok", "dale")) {
      return { from: "bot", text: "¡De nada! Cualquier cosa, acá estoy." };
    }
    if (h("que sabes", "que podes", "que haces", "ayuda", "ayudame", "opciones", "comandos", "para que servis")) {
      const l: string[] = [];
      if (sees.agenda) l.push("• Turnos de hoy o de mañana, quién sigue y la sala de espera");
      if (sees.pacientes) l.push("• Buscar un paciente por nombre o DNI (datos de contacto, no clínicos)");
      if (sees.cobros) l.push("• Cuánto se cobró hoy y en el mes, y lo que falta presentar a obras sociales");
      if (sees.presupuestos) l.push("• Saldos de presupuestos y cuáles esperan respuesta");
      if (sees.prest || sees.pres || sees.liq) l.push("• Qué falta auditar, presentar y liquidar");
      l.push("• Lo que tenés pendiente hoy");
      l.push("• Cómo hacer cada cosa («¿cómo doy un turno?», «¿cómo cobro?»…)");
      return { from: "bot", text: "Puedo ayudarte con:\n" + l.join("\n") + "\nNo muestro datos clínicos en el chat." };
    }

    // ---- ayuda de uso ("cómo…") ----
    const wantsHelp = h(...HELP_VERBS);
    if (wantsHelp) {
      const r = helpFor(t);
      if (r) return r;
    }

    // ---- datos clínicos: nunca en el chat ----
    if (h(...CLINICAL)) {
      return {
        from: "bot",
        text: "Por privacidad no muestro datos clínicos (diagnósticos, alergias, evoluciones, medicación) en el chat. Se ven en la ficha del paciente, con el registro de accesos.",
        actions: sees.pacientes ? [{ label: "Ir a Pacientes", to: "/app/pacientes" }] : undefined,
      };
    }

    // ---- pendientes ----
    if (h("pendiente*", "tareas", "que me falta", "que tengo que hacer", "por hacer") && !h("saldo*", "presupuesto*", "obra social", "obras sociales", "cobr*", "paciente*")) {
      if (isDoctor) return { from: "bot", text: "Para tu agenda, preguntame «mis turnos de hoy»." };
      const r = await appApi<{ items: PendingItem[] }>("/dashboard/pending");
      if (!r.items.length) return { from: "bot", text: "No tenés nada pendiente por ahora." };
      return {
        from: "bot",
        text: "Pendiente hoy:\n" + r.items.map((i) => `• ${i.label}: ${i.count}${i.amount ? ` (${money(i.amount)})` : ""}`).join("\n"),
        actions: [{ label: "Ver en Inicio", to: "/app" }],
      };
    }

    // ---- sala de espera ----
    if (h("sala", "espera", "esperando", "llegaron", "llegado*", "ya llego*") && !h("web", "cobr*")) {
      if (!sees.agenda) return deny("agenda");
      const w = await appApi<Appointment[]>("/appointments/waiting-room");
      const act = [{ label: "Ver sala de espera", to: "/app/agenda?vista=espera" }];
      if (!w.length) return { from: "bot", text: "No hay nadie en la sala de espera ni en consultorio ahora.", actions: act };
      const wp = withProfs(w);
      return {
        from: "bot",
        text: `Ahora hay ${w.length} paciente${w.length > 1 ? "s" : ""}:\n` + w.map((a) =>
          `• ${a.patient_name}${wp && a.professional_name ? ` (${a.professional_name})` : ""} — ${a.status === "ATENDIENDO" ? "en consultorio" : `esperando${a.wait_minutes ? ` hace ${a.wait_minutes} min` : ""}`}`).join("\n"),
        actions: act,
      };
    }

    // ---- quién sigue ----
    if (h("sigue", "proximo*", "siguiente*", "quien viene", "quien entra", "despues de este")) {
      if (!sees.agenda) return deny("agenda");
      const list = await dayAppointments(new Date());
      const now = Date.now();
      const inRoom = list.filter((a) => a.status === "ATENDIENDO");
      const waiting = list.filter((a) => a.status === "EN_ESPERA");
      const next = list.filter((a) => (a.status === "RESERVADO" || a.status === "CONFIRMADO") && new Date(a.end_at).getTime() >= now).slice(0, 3);
      const wp = withProfs(list);
      const lines = [
        ...inRoom.map((a) => `En consultorio: ${a.patient_name}${wp && a.professional_name ? ` (${a.professional_name})` : ""}`),
        ...waiting.map((a) => `Esperando: ${a.patient_name}${a.wait_minutes ? ` (hace ${a.wait_minutes} min)` : ""}`),
        ...next.map((a, i) => `${i === 0 ? "Sigue" : "Después"}: ${hhmm(a.start_at)} · ${a.patient_name}${wp && a.professional_name ? ` (${a.professional_name})` : ""}`),
      ];
      return { from: "bot", text: lines.length ? lines.join("\n") : "No quedan turnos por atender hoy.", actions: [{ label: "Ver Agenda", to: "/app/agenda" }] };
    }

    // ---- circulo: qué falta auditar / presentar / liquidar ----
    if (isCircle && !isDoctor && h("auditar", "presentar", "liquidar", "falta", "debito*", "vencid*", "cobrar", "cuanto nos deben", "facturacion", "resumen") && (sees.prest || sees.pres || sees.liq)) {
      const d = await appApi<CircleDash>("/dashboard");
      const l: string[] = [];
      if (sees.prest) l.push(`• Para auditar: ${d.to_audit} prestación${d.to_audit === 1 ? "" : "es"}`);
      if (sees.pres) {
        l.push(`• Listas para presentar: ${d.ready_to_present.count} (${money(d.ready_to_present.total)})`);
        l.push(`• Presentado y por cobrar: ${money(d.receivable)}`);
        if (d.overdue_batches.length) l.push(`• Con vencimiento pasado: ${d.overdue_batches.map((b) => `${b.payer_name || "—"} ${money(b.pending)}`).join(", ")}`);
      }
      if (sees.liq) l.push(`• Para liquidar a médicos: ${d.to_settle.count} (${money(d.to_settle.total)})`);
      const to = sees.pres ? "/app/presentaciones" : sees.prest ? "/app/prestaciones" : "/app/liquidaciones";
      return { from: "bot", text: l.join("\n"), actions: [{ label: "Ir a " + (sees.pres ? "Presentaciones" : sees.prest ? "Prestaciones" : "Liquidaciones"), to }] };
    }

    // ---- cumpleaños ----
    if (h("cumple*", "cumpleanos")) {
      if (!sees.pacientes) return deny("pacientes");
      const d = await appApi<ClinicDash>("/dashboard");
      const b = d.birthdays || [];
      return {
        from: "bot",
        text: b.length ? `Hoy cumplen años:\n${b.map((x) => `• ${x.name}`).join("\n")}` : "Hoy no cumple años ningún paciente.",
        actions: b.slice(0, 3).map((x) => ({ label: `Ficha: ${x.name}`, to: `/app/pacientes/${x.id}` })),
      };
    }

    // ---- cuántos pacientes ----
    if (h("cuantos pacientes", "total de pacientes", "pacientes nuevos", "pacientes en total", "cantidad de pacientes")) {
      if (!sees.pacientes) return deny("pacientes");
      const d = await appApi<ClinicDash>("/dashboard");
      return { from: "bot", text: `Tenés ${d.patients_total ?? 0} pacientes activos; ${d.patients_new_month ?? 0} nuevo${d.patients_new_month === 1 ? "" : "s"} este mes.`, actions: [{ label: "Ir a Pacientes", to: "/app/pacientes" }] };
    }

    // ---- quién atiende hoy ----
    if (isClinic && h("quien atiende", "quienes atienden", "que profesionales", "profesionales hoy", "medicos hoy", "profesionales de hoy", "quien trabaja")) {
      if (!sees.agenda) return deny("agenda");
      const d = await appApi<ClinicDash>("/dashboard");
      const p = d.professionals_today || [];
      if (!p.length) return { from: "bot", text: "Hoy no hay turnos con ningún profesional." };
      return {
        from: "bot",
        text: "Profesionales con turnos hoy:\n" + p.map((x) => `• ${x.name}: ${x.total} turno${x.total > 1 ? "s" : ""} (${x.attended} atendido${x.attended === 1 ? "" : "s"})${x.next ? `, próximo ${hhmm(x.next)}` : ""}`).join("\n"),
        actions: [{ label: "Ver Agenda", to: "/app/agenda" }],
      };
    }

    // ---- resumen del día / ausentes ----
    if (isClinic && h("resumen", "como va el dia", "como viene el dia", "ausente*", "faltaron", "no vinieron", "cancelados")) {
      if (!sees.agenda) return deny("agenda");
      const d = await appApi<ClinicDash>("/dashboard");
      const c = d.today || {};
      return {
        from: "bot",
        text: `Hoy: ${c.total ?? 0} turnos. Atendidos ${c.ATENDIDO ?? 0}, en espera ${c.EN_ESPERA ?? 0}, en consultorio ${c.ATENDIENDO ?? 0}, por llegar ${(c.RESERVADO ?? 0) + (c.CONFIRMADO ?? 0)}, ausentes ${c.AUSENTE ?? 0}, cancelados ${c.CANCELADO ?? 0}.`,
        actions: [{ label: "Ver Agenda", to: "/app/agenda" }],
      };
    }

    // ---- saldos de presupuestos ----
    if (h("saldo*", "deuda*", "adeuda*", "deben", "debe", "debiendo", "moroso*") || (h("presupuesto*") && h("pendiente*", "cobrar", "falta"))) {
      if (!sees.presupuestos) return deny("presupuestos");
      const r = await appApi<BudgetsRes>("/budgets?pending=true");
      const act = [{ label: "Ver saldos", to: "/app/presupuestos?saldo=1" }];
      if (!r.items.length) return { from: "bot", text: "No hay presupuestos aceptados con saldo pendiente.", actions: act };
      const top = [...r.items].sort((a, b) => b.balance - a.balance).slice(0, 5);
      return {
        from: "bot",
        text: `Hay ${r.items.length} presupuesto${r.items.length > 1 ? "s" : ""} con saldo, por ${money(r.summary.balance)} en total. Los mayores:\n` +
          top.map((b) => `• #${b.number} ${b.patient_name || "—"} — ${money(b.balance)}`).join("\n"),
        actions: act,
      };
    }

    // ---- presupuestos: estado ----
    if (h("presupuesto*") && h("cuantos", "hay", "estado", "sin respuesta", "presentado*", "esperando", "tengo", "resumen")) {
      if (!sees.presupuestos) return deny("presupuestos");
      const r = await appApi<BudgetsRes>("/budgets");
      const n = (s: string) => r.items.filter((b) => b.status === s).length;
      return {
        from: "bot",
        text: `Presupuestos: ${n("BORRADOR")} en borrador, ${n("PRESENTADO")} presentados esperando respuesta (${money(r.summary.presented_total)}), ${n("ACEPTADO")} aceptados y ${n("FINALIZADO")} finalizados. Saldo por cobrar: ${money(r.summary.balance)}.`,
        actions: [{ label: "Ir a Presupuestos", to: "/app/presupuestos" }],
      };
    }

    // ---- obras sociales a presentar ----
    if (isClinic && h("obra social", "obras sociales", "prepaga*", "presentar") && h("cuanto", "pendiente*", "falta", "tengo", "hay", "a presentar", "total", "presentar")) {
      if (!sees.cobros) return deny("cobros");
      const g = await appApi<InsGroup[]>("/charges/insurance?status=PENDIENTE");
      const act = [{ label: "Ver obras sociales", to: "/app/cobros?tab=os" }];
      if (!g.length) return { from: "bot", text: "No hay prestaciones de obras sociales pendientes de presentar.", actions: act };
      const total = g.reduce((s, x) => s + x.total, 0);
      return {
        from: "bot",
        text: `A presentar a obras sociales: ${money(total)}.\n` + g.slice(0, 6).map((x) => `• ${x.insurance_name}: ${x.count} ${x.count > 1 ? "prestaciones" : "prestación"} — ${money(x.total)}`).join("\n") + (g.length > 6 ? `\n… y ${g.length - 6} más.` : ""),
        actions: act,
      };
    }

    // ---- atendidos sin cobrar ----
    if (h("sin cobrar", "falta cobrar", "por cobrar", "no cobre", "no se cobro", "no cobramos")) {
      if (!sees.cobros) return deny("cobros");
      const r = await appApi<{ items: PendingItem[] }>("/dashboard/pending");
      const it = r.items.find((i) => i.key === "to_charge");
      return {
        from: "bot",
        text: it ? `Hay ${it.count} paciente${it.count > 1 ? "s" : ""} atendido${it.count > 1 ? "s" : ""} hoy sin cobro registrado.` : "Todos los atendidos de hoy tienen su cobro registrado.",
        actions: it ? [{ label: "Ver Agenda", to: "/app/agenda?vista=lista" }, { label: "Registrar cobro", to: "/app/cobros" }] : undefined,
      };
    }

    // ---- cobros del día / mes ----
    if (isClinic && h("cobr*", "caja", "recaud*", "ingres*", "plata", "factur*", "gane", "ganamos", "vendi") && h("cuanto", "hoy", "mes", "total", "caja", "semana", "recaud*", "ingres*", "gane", "ganamos", "plata")) {
      if (!sees.cobros) return deny("cobros");
      const now = new Date();
      const day = dayKey(now);
      const first = dayKey(new Date(now.getFullYear(), now.getMonth(), 1));
      const [d, m] = await Promise.all([
        appApi<ChargesRes>(`/charges?date_from=${day}&date_to=${day}`),
        appApi<ChargesRes>(`/charges?date_from=${first}&date_to=${day}`),
      ]);
      const methods = Object.entries(d.summary.by_method).filter(([, v]) => v > 0).map(([k, v]) => `${PAYMENT_LABELS[k] || k} ${money(v)}`).join(", ");
      return {
        from: "bot",
        text: `${onlyMine ? "Tus cobros: hoy" : "Hoy se cobraron"} ${money(d.summary.collected)} (${d.summary.count} registro${d.summary.count === 1 ? "" : "s"})${methods ? `: ${methods}` : ""}.\nEn el mes: ${money(m.summary.collected)}.${m.summary.insurance ? `\nObras sociales por presentar este mes: ${money(m.summary.insurance)}.` : ""}`,
        actions: [{ label: "Ver Cobros", to: "/app/cobros" }],
      };
    }

    // ---- buscar paciente (nombre / DNI) ----
    const stop = new Set(["buscar", "busca", "busco", "buscame", "ficha", "paciente", "pacientes", "dni", "de", "del", "la", "el", "los", "las", "un", "una", "por", "nombre", "quiero", "ver",
      "datos", "mostrame", "decime", "telefono", "tel", "celular", "contacto", "numero", "que", "es", "me", "podes", "y", "con", "al", "para", "abrir", "abri", "encontrar", "fijate", "turno", "proximo", "hoy", "manana", "ayer", "pasado"]);
    if (isClinic && (h("buscar", "busca", "busco", "buscame", "ficha", "dni", "telefono", "tel", "celular", "contacto", "paciente", "encontrar"))) {
      const words = t.split(" ").filter((w) => !stop.has(w));
      const term = words.join(" ");
      if (term.length >= 2 || /^\d{5,}$/.test(term.replace(/\s/g, ""))) {
        if (!sees.pacientes) return deny("pacientes");
        return searchPatient(term, words);
      }
      if (h("buscar", "busca", "busco", "buscame", "ficha")) return { from: "bot", text: "¿A quién busco? Escribime el nombre, el apellido o el DNI. Por ejemplo: «buscar Gómez» o «paciente 30123456»." };
    }

    // ---- turnos de hoy / mañana ----
    if (h("turno*", "agenda", "cita*", "reserva*", "atienden", "atiendo", "pacientes", "tengo hoy") || h("hoy", "manana", "ayer")) {
      if (!sees.agenda) return deny("agenda");
      const off = /\bpasado manana\b/.test(t) ? 2 : /\bmanana\b/.test(t) ? 1 : /\bayer\b/.test(t) ? -1 : 0;
      const date = addDays(new Date(), off);
      const list = (await dayAppointments(date)).filter((a) => a.status !== "CANCELADO");
      const label = off === 0 ? "hoy" : off === 1 ? "mañana" : off === 2 ? "pasado mañana" : "ayer";
      const act = [{ label: "Ver en Agenda", to: `/app/agenda?dia=${dayKey(date)}` }];
      if (!list.length) return { from: "bot", text: `No hay turnos para ${label} (${longDate(date).toLowerCase()}).`, actions: [{ label: "Dar un turno", to: "/app/agenda?nuevo=1" }, ...act] };
      const wp = withProfs(list);
      return {
        from: "bot",
        text: `${label.charAt(0).toUpperCase() + label.slice(1)} ${off < 0 ? "hubo" : "hay"} ${list.length} turno${list.length > 1 ? "s" : ""}:\n` +
          list.slice(0, 8).map((a) => apptLine(a, wp)).join("\n") + (list.length > 8 ? `\n… y ${list.length - 8} más.` : ""),
        actions: act,
      };
    }

    // ---- ayuda sin "cómo" ----
    const r = helpFor(t);
    if (r) return r;

    // un nombre suelto («Gómez», «María Pérez»): lo buscamos como paciente
    if (sees.pacientes && /^[a-z]{3,}( [a-z]{2,}){0,2}$/.test(t)) {
      const words = t.split(" ");
      const found = await searchPatient(t, words).catch(() => null);
      if (found && !found.text.startsWith("No encontré")) return found;
    }

    const ex = suggestions().filter((s) => !s.fill).slice(0, 3).map((s) => `«${s.label}»`).join(", ");
    return {
      from: "bot",
      text: `No te entendí del todo. Probá con algo como ${ex || "«turnos de hoy»"}, «buscar paciente Gómez» o «¿cómo doy un turno?».`,
    };
  }

  function helpFor(t: string): Msg | null {
    let best: Help | null = null;
    let top = 0;
    for (const x of HELP) {
      if (x.kind && x.kind !== kind) continue;
      const s = score(t, x.keys);
      const ok = !x.need || can(x.need);
      if (s > top || (s === top && s > 0 && ok && best && best.need && !can(best.need))) { top = s; best = x; }
    }
    if (!best) return null;
    if (best.need && !can(best.need)) return deny(best.need);
    const text = typeof best.text === "function" ? best.text(user) : best.text;
    return { from: "bot", text, actions: best.to ? [{ label: best.label || "Ir", to: best.to }] : undefined };
  }

  async function searchPatient(term: string, words: string[]): Promise<Msg> {
    const digits = term.replace(/\s/g, "");
    const q = /^\d{5,}$/.test(digits) ? digits : term;
    let items = (await appApi<{ items: PatientLite[] }>(`/patients?limit=6&q=${encodeURIComponent(q)}`)).items;
    if (!items.length && words.length > 1) {   // por si escribió de más: probamos con la palabra más larga
      const longest = [...words].sort((a, b) => b.length - a.length)[0];
      items = (await appApi<{ items: PatientLite[] }>(`/patients?limit=6&q=${encodeURIComponent(longest)}`)).items;
    }
    if (!items.length) return { from: "bot", text: `No encontré pacientes con «${term}». Probá con el apellido solo o con el DNI.`, actions: [{ label: "Nuevo paciente", to: "/app/pacientes" }] };
    let next = "";
    if (items.length === 1 && sees.agenda) {
      try {
        const k = dayKey(new Date());
        const l = await appApi<Appointment[]>(`/appointments?date_from=${k}&date_to=${dayKey(addDays(new Date(), 60))}&patient_id=${items[0].id}`);
        const n = l.find((a) => a.status !== "CANCELADO" && a.status !== "AUSENTE" && a.status !== "ATENDIDO" && new Date(a.end_at).getTime() >= Date.now());
        next = n ? `\nPróximo turno: ${shortDate(n.start_at)} ${hhmm(n.start_at)}${n.professional_name ? ` con ${n.professional_name}` : ""}.` : "\nNo tiene turnos próximos.";
      } catch { /* sin permiso de agenda: seguimos sin esa línea */ }
    }
    return {
      from: "bot",
      text: `${items.length === 1 ? "Encontré a:" : `Encontré ${items.length} pacientes:`}\n` +
        items.map((p) => `• ${p.full_name}${p.dni ? ` · DNI ${p.dni}` : ""}${p.phone ? ` · ${p.phone}` : ""}${p.insurance_name ? ` · ${p.insurance_name}` : ""}`).join("\n") + next,
      actions: items.slice(0, 4).map((p) => ({ label: `Ficha: ${p.full_name}`, to: `/app/pacientes/${p.id}` })),
    };
  }

  function suggestions(): { label: string; fill?: string }[] {
    const s: { label: string; fill?: string }[] = [];
    if (isDoctor) {
      if (sees.agenda) s.push({ label: "Mis turnos de hoy" }, { label: "Turnos de mañana" });
      if (can("portal_medico")) s.push({ label: "¿Cómo veo mis liquidaciones?" });
      return s;
    }
    if (sees.agenda) s.push({ label: "Turnos de hoy" }, { label: "¿Quién sigue?" }, { label: "Sala de espera" });
    if (sees.pacientes) s.push({ label: "Buscar un paciente", fill: "Buscar paciente " });
    if (sees.cobros) s.push({ label: "¿Cuánto cobré hoy?" });
    if (sees.presupuestos) s.push({ label: "Saldos pendientes" });
    if (sees.prest || sees.pres || sees.liq) s.push({ label: "¿Qué falta presentar?" });
    s.push({ label: "¿Qué tengo pendiente?" });
    if (sees.agenda) s.push({ label: "¿Cómo doy un turno?" });
    return s;
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    try {
      const [reply] = await Promise.all([answer(q), new Promise((r) => setTimeout(r, 350))]);
      setMsgs((m) => [...m, reply]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "bot", text: e instanceof Error ? `No pude consultar eso: ${e.message}` : "No pude consultar eso. Probá de nuevo." }]);
    } finally {
      setTyping(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  function go(to: string) {
    navigate(to);
    if (window.innerWidth <= 860) setOpen(false);   // en el celular el panel tapa la pantalla: lo cerramos
  }

  function pick(s: { label: string; fill?: string }) {
    if (s.fill) { setInput(s.fill); inputRef.current?.focus(); } else send(s.label);
  }

  return (
    <>
      {!open && (
        <button type="button" className={`mr-assist-fab ${tuck ? "is-tucked" : ""}`} onClick={() => setOpen(true)} aria-label="Abrir el asistente" data-assistant="fab">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
          </svg>
          <span className="mr-assist-fab-text">Asistente</span>
        </button>
      )}
      {open && (
        <section className="mr-assist" role="dialog" aria-label="Asistente de MIRA" data-assistant="panel">
          <header className="mr-assist-head">
            <MiraLogo size={32} />
            <div>
              <strong>Asistente MIRA</strong>
              <small>Turnos, cobros y ayuda al instante</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar el asistente">×</button>
          </header>
          <div className="mr-assist-body" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`mr-assist-msg ${m.from}`}>
                <p>{m.text}</p>
                {m.actions && m.actions.length > 0 && (
                  <div className="mr-assist-actions">
                    {m.actions.map((a) => (
                      <button type="button" key={a.to + a.label} onClick={() => go(a.to)}>{a.label} ›</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="mr-assist-msg bot"><p className="mr-assist-typing" aria-label="Escribiendo"><span /><span /><span /></p></div>}
            <div ref={endRef} />
          </div>
          <div className="mr-assist-suggest">
            {suggestions().slice(0, 8).map((s) => (
              <button type="button" key={s.label} onClick={() => pick(s)} disabled={typing}>{s.label}</button>
            ))}
          </div>
          <form className="mr-assist-input" onSubmit={submit}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí tu pregunta…" aria-label="Escribí tu pregunta" autoComplete="off" enterKeyHint="send" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}

export default Assistant;
