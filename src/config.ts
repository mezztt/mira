// Configuración compartida de MIRA · by Mezztt
// En local usa el backend de tu PC. Online se define VITE_API_URL al compilar (ver .env.example).
export const API_URL = ((typeof window !== "undefined" && (window as any).mezzttApp?.apiUrl) || import.meta.env.VITE_API_URL || "http://127.0.0.1:8030").replace(/\/$/, "");

export const APP_NAME = "MIRA";
export const APP_VERSION = "1.0.0";
export const APP_BRAND = "Mezztt";

/** Enlaces de marca por defecto (Mezztt los cambia desde Configuración del panel; ver useBrandLinks en components/Brand) */
export interface BrandLinks { system_instagram_url: string; mezztt_instagram_url: string; mezztt_site_url: string }
export const DEFAULT_BRAND_LINKS: BrandLinks = {
  system_instagram_url: "https://instagram.com/mira.mezztt",
  mezztt_instagram_url: "https://instagram.com/mezzttofficial",
  mezztt_site_url: "https://mezztt.site",
};

export const ADMIN_TOKEN_KEY = "mira_admin_token";
export const TOKEN_KEY = "mira_token";
export const USER_KEY = "mira_user";
export const THEME_KEY = "mira_theme";

/** Link público de la web de turnos de un consultorio o de un círculo médico */
export function publicSiteUrl(slug: string | null | undefined): string {
  return `${window.location.origin}/t/${slug || ""}`;
}

// =====================================================================
// MÓDULOS (dos tipos de sistema)
// =====================================================================
export type Kind = "CONSULTORIO" | "CIRCULO";
export const KIND_LABELS: Record<Kind, string> = { CONSULTORIO: "Consultorio / clínica", CIRCULO: "Círculo médico" };

export const CORE_BY_KIND: Record<Kind, string[]> = {
  CONSULTORIO: ["inicio", "profesionales", "configuracion", "usuarios"],
  CIRCULO: ["inicio", "configuracion", "usuarios"],
};
export const MODULES_BY_KIND: Record<Kind, string[]> = {
  CONSULTORIO: ["agenda", "pacientes", "historia_clinica", "odontologia", "documentos", "cobros", "presupuestos", "reportes", "web_turnos"],
  CIRCULO: ["padron", "convenios", "prestaciones", "presentaciones", "liquidaciones", "agenda", "reportes", "portal_medico", "web_turnos"],
};
/** Webs (cada una se cobra con el precio de web): web de turnos y, en el círculo, también el portal del médico */
export const EXTRA_MODULES = ["web_turnos", "portal_medico"];

export const MODULE_LABELS: Record<string, string> = {
  inicio: "Inicio", profesionales: "Profesionales", configuracion: "Configuración", usuarios: "Usuarios",
  agenda: "Agenda de turnos", pacientes: "Pacientes", historia_clinica: "Historia clínica", odontologia: "Odontograma",
  documentos: "Recetas y documentos", cobros: "Cobros", web_turnos: "Web de turnos",
  presupuestos: "Presupuestos y planes de tratamiento", reportes: "Reportes",
  padron: "Padrón de médicos", convenios: "Convenios y nomenclador", prestaciones: "Prestaciones y auditoría",
  presentaciones: "Presentaciones a obras sociales", liquidaciones: "Liquidación de honorarios", portal_medico: "Portal del médico",
};
export const MODULE_HINTS: Record<string, string> = {
  agenda: "Turnos por profesional, sobreturnos, sala de espera y recordatorios por WhatsApp",
  pacientes: "Ficha completa: datos, obra social, alergias, antecedentes e historial",
  historia_clinica: "Evoluciones inalterables con enmiendas, signos vitales y registro de accesos",
  odontologia: "Odontograma por pieza y cara (FDI), con tratamientos pendientes y realizados",
  documentos: "Registro de recetas, pedidos de estudios, certificados e indicaciones para imprimir",
  cobros: "Caja diaria, coseguros y prestaciones a presentar a cada obra social",
  presupuestos: "Presupuestos por paciente con lista de precios, pagos a cuenta, saldo y plan desde el odontograma",
  reportes: "Ausentismo, pacientes que no vuelven, cobranzas, débitos y evolución mensual, con exportación a Excel",
  web_turnos: "Página para que los pacientes saquen y cancelen turnos solos",
  padron: "Nómina de médicos: matrícula, especialidad, categoría, CBU y condición impositiva",
  convenios: "Obras sociales y prepagas con su nomenclador, valores y actualizaciones",
  prestaciones: "Carga mensual de prestaciones, control de duplicados y auditoría",
  presentaciones: "Facturación por obra social, cobros, débitos y refacturación",
  liquidaciones: "Honorarios a cada médico con gastos, cuota y retenciones, recibos y transferencias",
  portal_medico: "Cada médico carga sus prestaciones y ve sus liquidaciones",
};

/** En el círculo, "agenda" y "web_turnos" son la agenda y la web de turnos de los médicos del padrón */
const CIRCLE_LABELS: Record<string, string> = { agenda: "Agenda de médicos", web_turnos: "Web de turnos de los médicos" };
const CIRCLE_HINTS: Record<string, string> = {
  agenda: "Cada médico del padrón con su calendario, horarios y turnos; la administración agenda para todos",
  web_turnos: "Página para que los pacientes elijan médico y saquen o cancelen turnos solos",
  reportes: "Débitos por obra social y por motivo, ranking de médicos, tiempos de cobro y evolución mensual, con exportación a Excel",
};
export function moduleLabel(module: string, kind?: Kind | null): string {
  return (kind === "CIRCULO" && CIRCLE_LABELS[module]) || MODULE_LABELS[module] || module;
}
export function moduleHint(module: string, kind?: Kind | null): string {
  return (kind === "CIRCULO" && CIRCLE_HINTS[module]) || MODULE_HINTS[module] || "";
}

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador", PROFESIONAL: "Profesional", RECEPCION: "Recepción",
  ADMINISTRATIVO: "Administrativo", MEDICO: "Médico",
};
export const ROLES_BY_KIND: Record<Kind, string[]> = {
  CONSULTORIO: ["ADMINISTRADOR", "PROFESIONAL", "RECEPCION"],
  CIRCULO: ["ADMINISTRADOR", "ADMINISTRATIVO", "MEDICO"],
};
export const ROLE_HINTS: Record<string, string> = {
  ADMINISTRADOR: "Todo el sistema",
  PROFESIONAL: "Su agenda, historias clínicas y documentos",
  RECEPCION: "Agenda, pacientes y cobros (sin historia clínica)",
  ADMINISTRATIVO: "Padrón, prestaciones, presentaciones y agenda de médicos",
  MEDICO: "Solo lo suyo: su portal (prestaciones y liquidaciones) y su agenda de turnos",
};

// =====================================================================
// HELPERS
// =====================================================================
export function splitList(value: string | null | undefined): string[] {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function money(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Importe en dólares: "USD 38,72" (los precios de MIRA se cotizan en USD) */
export function usd(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return "USD " + n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Planes sobre el abono mensual M (iguales a los del backend, schemas.py): trimestral paga 2 de 3 meses, anual 10 de 12 */
export const TRIMESTRAL_MESES_PAGOS = 2;
export const ANUAL_MESES_PAGOS = 10;
export function plansFor(monthly: number | string | null | undefined) {
  const m = Number(monthly || 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { quarterly: r(m * TRIMESTRAL_MESES_PAGOS), annual: r(m * ANUAL_MESES_PAGOS), annualSaving: r(m * (12 - ANUAL_MESES_PAGOS)) };
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const v = value.length === 10 ? value + "T12:00:00" : value;
  return new Date(v).toLocaleDateString("es-AR");
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("es-AR")} ${hhmm(d)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Date -> "2026-10-01T18:30:00" (hora local, lo que espera el backend) */
export function toLocalISO(d: Date): string {
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60000);
}
export function hhmm(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function timeRange(start: string | Date, end: string | Date): string {
  return `${hhmm(start)}–${hhmm(end)}`;
}
export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]; // 0 = lunes (como el backend)

export function dayLabel(d: Date, short = true): string {
  const today = new Date();
  const k = dayKey(d);
  if (k === dayKey(today)) return "Hoy";
  if (k === dayKey(addDays(today, 1))) return "Mañana";
  if (k === dayKey(addDays(today, -1))) return "Ayer";
  return short ? `${DAYS_ES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` : longDate(d);
}
export function longDate(d: Date): string {
  const txt = `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const t = `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function shiftPeriod(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function minutesLabel(min: number): string {
  if (min % 60 === 0) return `${min / 60} h`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${min} min`;
}
export function initials(name: string): string {
  return name.replace(/^(dra?|od|lic|dr)\.?\s+/i, "").split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Descarga un archivo del backend (CSV) con el token de la sesión */
export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga en el navegador un archivo ya armado */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Arma un CSV que Excel abre bien (separado por ; y con acentos) y lo descarga */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
    return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const text = [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  saveBlob(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }), filename);
}

/** Descarga un archivo del panel general (con el token del panel) */
export async function adminDownload(path: string, fallbackName: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const match = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "");
  saveBlob(await res.blob(), match ? match[1] : fallbackName);
}

// =====================================================================
// FETCH
// =====================================================================
function adminHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/** fetch para el panel general (Mezztt). Si el token venció, vuelve al login. */
export async function adminApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: adminHeaders(options.body !== undefined),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401 || response.status === 403) {
    if (path !== "/admin/me/password" && !path.endsWith("/toggle-active")) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = "/";
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

function detailText(data: any): string {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return "Revisá los datos: " + d.map((x: any) => (x.loc || []).slice(-1)[0]).join(", ");
  return "Ocurrió un error";
}

/** fetch para el sistema (consultorio / círculo). Si la sesión venció, vuelve al login. */
export async function appApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** Sube un archivo (multipart). No lleva Content-Type: el navegador arma el boundary. */
export async function appUpload<T = any>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` },
      body: form,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }
  if (response.status === 413) throw new Error("El archivo es demasiado grande");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** Trae un archivo protegido (imagen, PDF) con el token en el encabezado, nunca en la URL */
export async function appBlob(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` } });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(detailText(data));
  }
  return response.blob();
}

/** fetch público (web de turnos, sin login) */
export async function publicApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar. Probá de nuevo en un momento.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

// =====================================================================
// SESIÓN
// =====================================================================
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  company_id: number;
  company_name: string;
  role: string;
  kind: Kind;
  professional_id: number | null;
  member_id: number | null;
  enabled_modules: string;
  rubro?: string | null;
}

export function getSessionUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

/** Qué secciones ve cada rol (además de que el módulo esté contratado). */
const ROLE_ACCESS: Record<string, string[]> = {
  ADMINISTRADOR: ["*"],
  PROFESIONAL: ["inicio", "profesionales", "agenda", "pacientes", "historia_clinica", "odontologia", "documentos", "cobros", "presupuestos", "reportes"],
  RECEPCION: ["inicio", "profesionales", "agenda", "pacientes", "cobros", "presupuestos"],
  ADMINISTRATIVO: ["inicio", "padron", "convenios", "prestaciones", "presentaciones", "liquidaciones", "agenda", "reportes"],
  MEDICO: ["portal_medico", "agenda"],
};

export function canAccess(user: SessionUser | null, module: string): boolean {
  if (!user) return false;
  const core = CORE_BY_KIND[user.kind] || [];
  const enabled = core.includes(module) || splitList(user.enabled_modules).includes(module);
  if (!enabled) return false;
  const allowed = ROLE_ACCESS[user.role] || [];
  if (module === "configuracion" || module === "usuarios") return user.role === "ADMINISTRADOR";
  return allowed.includes("*") || allowed.includes(module);
}

// =====================================================================
// PANEL (Mezztt)
// =====================================================================
export interface SystemItem {
  id: number;
  kind: Kind;
  name: string;
  slug: string | null;
  specialty: string | null;
  rubro?: string | null;   // tipo de negocio (rubros.ts)
  cuit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  enabled_modules: string | null;
  client_price: number | string | null;
  payment_status: string;
  payment_due_date: string | null;
  billed: boolean;
  apply_iva: boolean;
  archived: boolean;
  cancel_requested_at?: string | null;   // baja del servicio pedida por la empresa
  service_end_date?: string | null;       // el sistema funciona hasta esta fecha
  notes: string | null;
  created_at: string;
}
export interface PaymentItem { id: number; company_id: number; amount: number | string; payment_date: string; method: string | null; notes: string | null }
export const GRACE_DAYS = 10;
export function isOverdue(s: Pick<SystemItem, "payment_due_date" | "payment_status">): boolean {
  if (!s.payment_due_date || s.payment_status === "al_dia") return false;
  const limit = new Date(s.payment_due_date);
  limit.setDate(limit.getDate() + GRACE_DAYS);
  return new Date() > limit;
}
export function systemStatus(s: SystemItem): { label: string; tone: "ok" | "warn" | "off" } {
  if (s.service_end_date && !s.archived) return { label: `Baja solicitada · hasta ${s.service_end_date.slice(0, 10).split("-").reverse().join("/")}`, tone: "warn" };
  if (s.archived) return { label: "Dado de baja", tone: "off" };
  if (isOverdue(s)) return { label: "Pago atrasado", tone: "warn" };
  return { label: "Activo", tone: "ok" };
}
export const PAYMENT_STATUS_LABELS: Record<string, string> = { al_dia: "Al día", pendiente: "Pendiente", vencido: "Vencido" };

/** Precios de MIRA (USD): configuración (una vez) por tipo, precio por módulo extra y precio de cada web */
export interface BillingPrices { base_cost: number | string; circle_base_cost: number | string; module_price: number | string; web_price: number | string }
export interface PriceBreakdown {
  setup: number; modulesCount: number; modulesTotal: number; web: number; websCount: number;
  monthlySubtotal: number; monthlyTotal: number; initialSubtotal: number; initialTotal: number;
}
/**
 * Pago inicial (una sola vez) = configuración + módulos extra + webs.
 * Abono mensual = módulos extra + webs (la configuración no se cobra por mes).
 * Cada web se cobra aparte (el círculo puede tener el portal del médico y la web de turnos).
 */
export function priceBreakdown(modules: string[], kind: Kind, prices: BillingPrices | null, iva: boolean): PriceBreakdown {
  const allowed = MODULES_BY_KIND[kind] || [];
  const mods = [...new Set(modules)].filter((m) => allowed.includes(m));
  const modulesCount = mods.filter((m) => !EXTRA_MODULES.includes(m)).length;
  const setup = Number((kind === "CIRCULO" ? prices?.circle_base_cost : prices?.base_cost) ?? 0);
  const modulesTotal = Number(prices?.module_price ?? 0) * modulesCount;
  const websCount = mods.filter((m) => EXTRA_MODULES.includes(m)).length;
  const web = Number(prices?.web_price ?? 0) * websCount;
  const monthlySubtotal = modulesTotal + web;
  const initialSubtotal = setup + monthlySubtotal;
  const f = iva ? 1.21 : 1;
  return { setup, modulesCount, modulesTotal, web, websCount, monthlySubtotal, monthlyTotal: monthlySubtotal * f, initialSubtotal, initialTotal: initialSubtotal * f };
}

// =====================================================================
// CONSULTORIO
// =====================================================================
export interface Block { id?: number; weekday: number; start_time: string; end_time: string }
export interface Professional {
  id: number; name: string; kind: "MEDICO" | "ODONTOLOGO" | "OTRO"; specialty: string | null; license: string | null;
  email: string | null; phone: string | null; color: string; slot_minutes: number; consult_price: number | null;
  web_visible: boolean; bio: string | null; active: boolean; sort_order: number; availability: Block[];
  member_id?: number | null;   // círculo: médico del padrón dueño de esta agenda
}
export interface InsuranceItem {
  id: number; name: string; code: string | null; kind: string; copay: number | null; consult_value: number | null;
  accepts_web: boolean; active: boolean; notes: string | null;
}
export interface PatientLite {
  id: number; first_name: string; last_name: string; full_name: string; dni: string | null; birth_date: string | null;
  age: number | null; sex: string | null; phone: string | null; email: string | null; insurance_id: number | null;
  insurance_name: string | null; insurance_number: string | null; insurance_plan: string | null; active: boolean;
  source: string; allergies: string | null;
}
export interface Patient extends PatientLite {
  address: string | null; city: string | null; blood_type: string | null; chronic: string | null; medications: string | null;
  background: string | null; emergency_contact: string | null; notes: string | null; created_at: string | null;
}
export type ApptStatus = "RESERVADO" | "CONFIRMADO" | "EN_ESPERA" | "ATENDIENDO" | "ATENDIDO" | "AUSENTE" | "CANCELADO";
export interface Appointment {
  id: number; professional_id: number; professional_name: string | null; professional_color: string | null;
  patient_id: number | null; patient_name: string; patient_dni: string | null; phone: string | null; email: string | null;
  insurance_id: number | null; insurance_name: string | null; start_at: string; end_at: string; duration: number;
  kind: string; status: ApptStatus; overbook: boolean; source: string; code: string; reason: string | null; notes: string | null;
  reminded_at: string | null; arrived_at: string | null; started_at: string | null; finished_at: string | null;
  cancel_reason: string | null; wait_minutes: number | null; has_note?: boolean; charged?: boolean;
  reminder_text?: string; whatsapp_url?: string | null;
  deposit_status?: "PENDIENTE" | "PAGADA" | "VENCIDA" | null; deposit_amount?: number | null;
}

/**
 * Estados de turno.
 * color: relleno vivo para dibujos / bordes · solid: fondo con texto blanco (≥ 4.5:1) · text/bg: etiqueta clara.
 */
export const APPT_STATUS: Record<ApptStatus, { label: string; color: string; solid: string; text: string; bg: string }> = {
  RESERVADO: { label: "Reservado", color: "#3b82c4", solid: "#2a5f8f", text: "#2a5f8f", bg: "#e3eef8" },
  CONFIRMADO: { label: "Confirmado", color: "#14919b", solid: "#0b6971", text: "#0b6971", bg: "#dff2f3" },
  EN_ESPERA: { label: "En sala de espera", color: "#e08a1e", solid: "#9a5508", text: "#8a4b06", bg: "#fdefd9" },
  ATENDIENDO: { label: "En consultorio", color: "#7c5cc4", solid: "#5b3fa3", text: "#5b3fa3", bg: "#ece6f8" },
  ATENDIDO: { label: "Atendido", color: "#2f9a5c", solid: "#1d6b3f", text: "#1d6b3f", bg: "#e3f2e7" },
  AUSENTE: { label: "Ausente", color: "#d64545", solid: "#a3302a", text: "#a3302a", bg: "#f9e3e1" },
  CANCELADO: { label: "Cancelado", color: "#9aa8ae", solid: "#55656c", text: "#4c5b62", bg: "#e8edef" },
};
export const NEXT_STATUS: Record<ApptStatus, ApptStatus[]> = {
  RESERVADO: ["CONFIRMADO", "EN_ESPERA", "AUSENTE", "CANCELADO"],
  CONFIRMADO: ["EN_ESPERA", "RESERVADO", "AUSENTE", "CANCELADO"],
  EN_ESPERA: ["ATENDIENDO", "ATENDIDO", "AUSENTE", "CANCELADO"],
  ATENDIENDO: ["ATENDIDO", "EN_ESPERA"],
  ATENDIDO: ["ATENDIENDO"],
  AUSENTE: ["RESERVADO", "EN_ESPERA"],
  CANCELADO: ["RESERVADO"],
};
export const APPT_KINDS: Record<string, string> = {
  PRIMERA_VEZ: "Primera vez", CONSULTA: "Consulta", CONTROL: "Control", PRACTICA: "Práctica", URGENCIA: "Urgencia",
};
export const PROF_KINDS: Record<string, string> = { MEDICO: "Médico/a", ODONTOLOGO: "Odontólogo/a", OTRO: "Otro profesional" };
export const PAYMENT_METHODS = ["EFECTIVO", "TRANSFERENCIA", "DEBITO", "CREDITO", "MERCADO_PAGO", "OTRO"];
export const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", MERCADO_PAGO: "Mercado Pago", DEBITO: "Débito", CREDITO: "Crédito", OTRO: "Otro",
};
export const CHARGE_KINDS: Record<string, string> = { PARTICULAR: "Particular", COSEGURO: "Coseguro", OBRA_SOCIAL: "Obra social" };
export const DOC_KINDS: Record<string, string> = {
  RECETA: "Receta", ESTUDIOS: "Pedido de estudios", CERTIFICADO: "Certificado", INDICACIONES: "Indicaciones", DERIVACION: "Derivación",
};

export interface ClinicalNote {
  id: number; kind: "EVOLUCION" | "ENMIENDA"; amends_id: number | null; appointment_id: number | null;
  professional_id: number; professional_name: string | null; professional_license: string | null; professional_specialty: string | null;
  author_name: string | null; reason: string | null; anamnesis: string | null; exam: string | null; diagnosis: string | null;
  diagnosis_code: string | null; plan: string | null; vitals: Record<string, string>; content_hash: string; created_at: string;
}
export interface MedDoc {
  id: number; kind: string; title: string | null; body: string | null; items: { name: string; detail?: string | null }[];
  diagnosis: string | null; rx_number: string | null; rx_url?: string | null; professional_id: number; professional_name: string | null;
  professional_license: string | null; professional_specialty: string | null; created_at: string;
}
export interface ToothEntry {
  id: number; tooth: number; surface: string | null; condition: string; status: "PENDIENTE" | "REALIZADO" | "EXISTENTE";
  notes: string | null; professional_name: string | null; created_at: string;
}
/** Plantilla: texto habitual de un profesional (evolución o documento) */
export interface TemplateItem {
  id: number; kind: string; name: string; payload: Record<string, any>; shared: boolean;
  professional_id: number | null; professional_name: string | null; can_edit: boolean; created_at: string | null;
}
/** Adjunto de la historia clínica */
export interface PatientFileItem {
  id: number; name: string; content_type: string; size: number; category: string; note: string | null; created_at: string;
  professional_id: number; professional_name: string | null; author_name: string | null; is_image: boolean; sha256: string | null;
  voided: boolean; voided_at: string | null; voided_by_name: string | null; void_reason: string | null; thumb: string | null;
}
export const FILE_CATEGORIES: Record<string, string> = { ESTUDIO: "Estudio", RADIOGRAFIA: "Radiografía", IMAGEN: "Foto / imagen", OTRO: "Otro" };

// Presupuestos y planes de tratamiento
export interface Practice { id: number; code: string | null; name: string; price: number; active: boolean }
export interface BudgetItem {
  id?: number; practice_id: number | null; description: string; tooth: number | null; surface: string | null; condition: string | null;
  quantity: number; unit_price: number; subtotal?: number; done?: boolean; done_at?: string | null;
}
export type BudgetStatus = "BORRADOR" | "PRESENTADO" | "ACEPTADO" | "RECHAZADO" | "FINALIZADO";
export interface BudgetLite {
  id: number; number: number; status: BudgetStatus; title: string | null; notes: string | null; patient_id: number;
  patient_name: string | null; patient_phone: string | null; professional_id: number | null; professional_name: string | null;
  discount_percent: number; total: number; paid: number; balance: number; installments: number; installment_value: number;
  valid_until: string | null; expired: boolean; presented_at: string | null; accepted_at: string | null; created_at: string;
  items_count: number; done_count: number;
}
export interface Budget extends BudgetLite {
  subtotal: number; discount_amount: number; items: BudgetItem[]; editable: boolean;
  payments: { id: number; date: string; amount: number; method: string; notes: string | null }[];
  patient: { name: string; dni: string | null; phone: string | null; insurance: string | null };
  professional: { name: string; license: string | null; specialty: string | null } | null;
  company: { name: string; address: string | null; city: string | null; phone: string | null; email: string | null; cuit: string | null };
  odontogram_registered?: boolean;
}
export const BUDGET_STATUS: Record<BudgetStatus, { label: string; tone: string }> = {
  BORRADOR: { label: "Borrador", tone: "gray" },
  PRESENTADO: { label: "Presentado", tone: "blue" },
  ACEPTADO: { label: "Aceptado", tone: "teal" },
  RECHAZADO: { label: "Rechazado", tone: "red" },
  FINALIZADO: { label: "Finalizado", tone: "green" },
};

/** Ítem del panel «Pendientes» del Inicio */
export interface PendingItem { key: string; label: string; count: number; path: string; hint: string; tone: "warn" | "alert" | "info"; amount?: number }

export const VITALS: { key: string; label: string; unit: string; placeholder: string }[] = [
  { key: "ta", label: "Tensión", unit: "mmHg", placeholder: "120/80" },
  { key: "fc", label: "Frec. cardíaca", unit: "lpm", placeholder: "72" },
  { key: "fr", label: "Frec. resp.", unit: "rpm", placeholder: "16" },
  { key: "temp", label: "Temperatura", unit: "°C", placeholder: "36.5" },
  { key: "sat", label: "Saturación", unit: "%", placeholder: "98" },
  { key: "peso", label: "Peso", unit: "kg", placeholder: "70" },
  { key: "talla", label: "Talla", unit: "cm", placeholder: "170" },
  { key: "glucemia", label: "Glucemia", unit: "mg/dl", placeholder: "95" },
];

// =====================================================================
// CÍRCULO MÉDICO
// =====================================================================
export interface Member {
  id: number; first_name: string; last_name: string; full_name: string; dni: string | null; cuit: string | null;
  license: string | null; specialty: string | null; email: string | null; phone: string | null; address: string | null;
  category: string; tax_condition: string; ganancias_exempt?: boolean; iibb_exempt?: boolean; cbu: string | null; bank_alias: string | null; bank: string | null;
  membership_fee: number | null; joined_at: string | null; active: boolean; notes: string | null;
  portal_email: string | null; prestaciones_period?: number;
}
export interface Payer {
  id: number; name: string; code: string | null; cuit: string | null; kind: string; presentation_day: number | null;
  payment_days: number; admin_fee_percent: number | null; requires_authorization: boolean; contact: string | null;
  notes: string | null; active: boolean; rates_count: number;
}
export interface Rate { id: number; payer_id: number; code: string; description: string; amount: number; copay: number | null; active: boolean }
export type PrestStatus = "CARGADA" | "OBSERVADA" | "APROBADA" | "PRESENTADA" | "COBRADA" | "DEBITADA" | "LIQUIDADA";
export interface Prestacion {
  id: number; member_id: number; member_name: string | null; member_license: string | null; payer_id: number;
  payer_name: string | null; period: string; date: string; patient_name: string; patient_dni: string | null;
  affiliate_number: string | null; code: string; description: string | null; quantity: number; unit_amount: number;
  total: number; authorization: string | null; diagnosis: string | null; status: PrestStatus; observation: string | null;
  debit_amount: number; debit_reason: string | null; net: number; batch_id: number | null; settlement_id: number | null;
  rebilled_from_id: number | null; source: string; created_at: string | null; possible_duplicate?: boolean;
}
export const PREST_STATUS: Record<PrestStatus, { label: string; tone: string }> = {
  CARGADA: { label: "Para auditar", tone: "blue" },
  OBSERVADA: { label: "Observada", tone: "orange" },
  APROBADA: { label: "Aprobada", tone: "teal" },
  PRESENTADA: { label: "Presentada", tone: "violet" },
  COBRADA: { label: "Cobrada", tone: "green" },
  DEBITADA: { label: "Debitada", tone: "red" },
  LIQUIDADA: { label: "Liquidada", tone: "gray" },
};
export const BATCH_STATUS: Record<string, { label: string; tone: string }> = {
  ABIERTA: { label: "En armado", tone: "blue" },
  PRESENTADA: { label: "Presentada", tone: "violet" },
  COBRADA_PARCIAL: { label: "Cobro parcial", tone: "orange" },
  COBRADA: { label: "Cobrada", tone: "green" },
};
export const SETTLEMENT_STATUS: Record<string, { label: string; tone: string }> = {
  BORRADOR: { label: "Borrador", tone: "blue" },
  CERRADA: { label: "Cerrada · a pagar", tone: "orange" },
  PAGADA: { label: "Pagada", tone: "green" },
};
export const MEMBER_CATEGORIES: Record<string, string> = { ACTIVO: "Socio activo", ADHERENTE: "Adherente", VITALICIO: "Vitalicio", NO_SOCIO: "No socio" };
export const TAX_LABELS: Record<string, string> = { MONOTRIBUTO: "Monotributo", RESPONSABLE_INSCRIPTO: "Responsable inscripto", EXENTO: "Exento" };
export const PAYER_KINDS: Record<string, string> = { OBRA_SOCIAL: "Obra social", PREPAGA: "Prepaga", ART: "ART", OTRO: "Otro" };
