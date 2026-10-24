// Tipos de negocio ("rubros") de MIRA: mismos datos que backend/rubros.py (fuente: specs/rubros.json).
// Al crear un cliente desde el panel, elegir uno tilda los módulos sugeridos (se pueden cambiar a mano).
import type { Kind } from "./config";

export interface RubroInfo { key: string; label: string; icon: string; tagline: string; modules: string[] }

export const RUBROS_CONSULTORIO: RubroInfo[] = [
  { key: "MEDICO_CLINICO", label: "Médico clínico o de familia", icon: "🩺", tagline: "Agenda, historia clínica y recetas",
    modules: ["agenda", "pacientes", "historia_clinica", "documentos", "cobros", "web_turnos", "reportes"] },
  { key: "ODONTOLOGIA", label: "Odontología", icon: "🦷", tagline: "Odontograma y presupuestos",
    modules: ["agenda", "pacientes", "historia_clinica", "odontologia", "documentos", "cobros", "presupuestos", "web_turnos", "reportes"] },
  { key: "ESPECIALISTA", label: "Especialista", icon: "❤️", tagline: "Cardiología, dermatología, pediatría…",
    modules: ["agenda", "pacientes", "historia_clinica", "documentos", "cobros", "web_turnos"] },
  { key: "PSICOLOGIA", label: "Psicología y salud mental", icon: "🧠", tagline: "Sesiones, historia y certificados",
    modules: ["agenda", "pacientes", "historia_clinica", "documentos", "cobros", "web_turnos"] },
  { key: "KINESIOLOGIA", label: "Kinesiología y rehabilitación", icon: "🦴", tagline: "Tratamientos por sesiones",
    modules: ["agenda", "pacientes", "historia_clinica", "presupuestos", "cobros", "web_turnos"] },
  { key: "NUTRICION", label: "Nutrición", icon: "🥗", tagline: "Seguimiento y controles",
    modules: ["agenda", "pacientes", "historia_clinica", "documentos", "cobros", "web_turnos"] },
  { key: "CLINICA", label: "Clínica o centro médico", icon: "🏥", tagline: "Varios profesionales, todo incluido",
    modules: ["agenda", "pacientes", "historia_clinica", "odontologia", "documentos", "cobros", "presupuestos", "reportes", "web_turnos"] },
];

export const RUBROS_CIRCULO: RubroInfo[] = [
  { key: "CIRCULO_MEDICO", label: "Círculo o colegio médico", icon: "🤝", tagline: "Padrón, presentaciones y honorarios",
    modules: ["padron", "convenios", "prestaciones", "presentaciones", "liquidaciones", "portal_medico", "reportes"] },
  { key: "CIRCULO_ODONTOLOGICO", label: "Círculo odontológico", icon: "🦷", tagline: "Prestaciones y liquidación a odontólogos",
    modules: ["padron", "convenios", "prestaciones", "presentaciones", "liquidaciones", "portal_medico", "reportes"] },
  { key: "RED_PRESTADORES", label: "Red de prestadores o clínicas", icon: "🏥", tagline: "Convenios y facturación a obras sociales",
    modules: ["padron", "convenios", "prestaciones", "presentaciones", "liquidaciones", "reportes"] },
  { key: "CIRCULO_COMPLETO", label: "Círculo con turnos y web", icon: "📅", tagline: "Todo, incluida la agenda de médicos",
    modules: ["padron", "convenios", "prestaciones", "presentaciones", "liquidaciones", "reportes", "agenda", "web_turnos", "portal_medico"] },
];

export const RUBROS_BY_KIND: Record<Kind, RubroInfo[]> = { CONSULTORIO: RUBROS_CONSULTORIO, CIRCULO: RUBROS_CIRCULO };
export const RUBRO_LABELS: Record<string, string> = Object.fromEntries([...RUBROS_CONSULTORIO, ...RUBROS_CIRCULO].map((r) => [r.key, r.label]));

export function findRubro(kind: Kind, key: string | null | undefined): RubroInfo | undefined {
  return RUBROS_BY_KIND[kind].find((r) => r.key === key);
}
/** Módulos sugeridos del tipo de negocio, solo los que existen en este tipo de sistema (MIRA no tiene dependencias entre módulos) */
export function suggestedModules(kind: Kind, key: string | null | undefined): string[] {
  const r = findRubro(kind, key);
  return r ? r.modules : [];
}
