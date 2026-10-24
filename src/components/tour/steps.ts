// Pasos del tutorial «¿Cómo funcionamos?» de MIRA, adaptados al tipo de sistema (consultorio / círculo)
// y al rol de quien entra. Solo se incluyen pantallas que esa persona realmente ve en su menú.
import { canAccess } from "../../config";
import type { SessionUser } from "../../config";
import type { TourStep } from "./Tour";

const nav = (m: string) => `[data-tour="nav-${m}"]`;

export function tourSteps(user: SessionUser | null): TourStep[] {
  if (!user) return [];
  const can = (m: string) => canAccess(user, m);
  const steps: TourStep[] = [];
  const add = (cond: boolean, s: TourStep) => { if (cond) steps.push(s); };
  const role = user.role;

  // ---------- médico del círculo (profesional) ----------
  if (role === "MEDICO") {
    add(true, { title: "Bienvenido a MIRA", text: "Este es tu espacio como médico del círculo. En un minuto te mostramos dónde está cada cosa." });
    add(can("portal_medico"), { selector: nav("portal_medico"), title: "Mi portal", text: "Mirá tus prestaciones del mes, en qué estado está cada una (cargada, presentada, cobrada o debitada) y tus liquidaciones con las retenciones." });
    add(can("agenda"), { selector: nav("agenda"), title: "Mi agenda", text: "Tus turnos del día y de la semana. Si algo cambia, el círculo lo ve reflejado enseguida." });
    add(true, { selector: '[data-tour="bell"]', title: "Avisos", text: "Acá te llegan los avisos: turnos nuevos, cambios y novedades de tus liquidaciones." });
    add(true, { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." });
    add(true, { selector: '[data-tour="tour-help"]', title: "¿Cómo funcionamos?", text: "Si querés volver a ver este recorrido, tocá este botón cuando quieras." });
    return steps;
  }

  // ---------- consultorio ----------
  if (user.kind === "CONSULTORIO") {
    const who = role === "PROFESIONAL" ? "Tu consultorio, tu agenda y tus pacientes en un solo lugar."
      : role === "RECEPCION" ? "Desde acá manejás turnos, pacientes y cobros del consultorio."
      : "Desde acá manejás todo el consultorio: turnos, pacientes, cobros y usuarios.";
    add(true, { title: "Bienvenido a MIRA", text: `${who} Te mostramos lo principal en un minuto.` });
    add(true, { selector: '[data-tour="pendientes"]', title: "Pendientes del día", text: "En Inicio ves lo que hay para resolver hoy: sala de espera, atendidos sin cobrar y más. Tocá uno y vas directo a esa pantalla." });
    add(can("agenda"), { selector: nav("agenda"), title: "Agenda",
      text: role === "PROFESIONAL" ? "Tus turnos del día. Tocá un turno para verlo, confirmarlo o pasar al paciente a la sala de espera."
        : "La grilla de turnos de cada profesional. Sacá turnos, confirmalos y seguí el estado: en espera, atendiendo, atendido." });
    add(can("pacientes"), { selector: nav("pacientes"),
      title: role === "PROFESIONAL" ? "Pacientes e historia clínica" : "Pacientes",
      text: role === "PROFESIONAL" ? "Ficha de cada paciente con su historia clínica, recetas, certificados y estudios. Lo que escribís queda registrado y no se pisa."
        : role === "RECEPCION" ? "Alta de pacientes, datos de contacto y obra social. La historia clínica la completa el profesional."
        : "Fichas de pacientes con sus datos, turnos y, según el rol, la historia clínica. También podés importarlos desde Excel." });
    add(can("pacientes"), { selector: '[data-tour="search"]', title: "Buscador", text: "Escribí el nombre o el DNI y abrís la ficha del paciente al toque, desde cualquier pantalla." });
    add(can("cobros"), { selector: nav("cobros"), title: "Cobros", text: "Registrá lo que paga cada paciente (particular, coseguro u obra social) y mirá la caja del día por medio de pago." });
    add(can("presupuestos") && role !== "PROFESIONAL", { selector: nav("presupuestos"), title: "Presupuestos", text: "Armá planes de tratamiento con cuotas y descuentos, imprimilos y seguí si el paciente los aceptó." });
    add(true, { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." });
    if (can("configuracion")) add(true, { selector: nav("configuracion"), title: "Configuración", text: "Datos del consultorio, web de turnos y recordatorios. Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido." });
    else add(true, { selector: '[data-tour="tour-help"]', title: "¿Cómo funcionamos?", text: "Si querés volver a ver este recorrido, tocá este botón cuando quieras." });
    return steps;
  }

  // ---------- círculo médico ----------
  const who = role === "ADMINISTRATIVO" ? "Desde acá cargás y seguís la facturación del círculo."
    : "Desde acá manejás el círculo: padrón, convenios, facturación y liquidaciones.";
  add(true, { title: "Bienvenido a MIRA", text: `${who} Te mostramos el circuito en un minuto.` });
  add(true, { selector: '[data-tour="pendientes"]', title: "Pendientes del período", text: "En Inicio ves lo que hay para hacer: auditar, presentar, cobrar vencidas o liquidar. Tocá uno y vas directo." });
  add(can("padron"), { selector: nav("padron"), title: "Padrón", text: "Los médicos del círculo con su matrícula y especialidad. Podés importarlos desde Excel." });
  add(can("convenios"), { selector: nav("convenios"), title: "Convenios", text: "Obras sociales y prepagas con sus valores por prestación y el gasto administrativo de cada una." });
  add(can("prestaciones"), { selector: nav("prestaciones"), title: "Prestaciones", text: "Se cargan las prestaciones de cada médico y se auditan: aprobadas u observadas para corregir." });
  add(can("presentaciones"), { selector: nav("presentaciones"), title: "Presentaciones", text: "Agrupá las prestaciones aprobadas por obra social, presentalas y registrá el cobro o los débitos." });
  add(can("liquidaciones"), { selector: nav("liquidaciones"), title: "Liquidaciones", text: "A cada médico se le calcula el neto: bruto menos gastos, cuota societaria y retenciones. Se imprime por médico." });
  add(true, { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." });
  if (can("configuracion")) add(true, { selector: nav("configuracion"), title: "Configuración", text: "Datos del círculo, reglas de liquidación y retenciones. Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido." });
  else add(true, { selector: '[data-tour="tour-help"]', title: "¿Cómo funcionamos?", text: "Si querés volver a ver este recorrido, tocá este botón cuando quieras." });
  return steps;
}

/** Recorrido del panel general de Mezztt (superadmin) */
export function adminTourSteps(): TourStep[] {
  const a = (p: string) => `[data-tour="admin-${p}"]`;
  return [
    { title: "Bienvenido al panel de MIRA", text: "Desde acá administrás los consultorios y círculos que usan MIRA: qué tienen habilitado, cuánto pagan y cómo se factura. Te mostramos lo principal." },
    { selector: a("inicio"), title: "Inicio", text: "El resumen: cuántos sistemas hay, qué se espera cobrar este mes y cuánto ya entró." },
    { selector: a("sistemas"), title: "Sistemas", text: "Cada cliente es un sistema. Acá lo das de alta, elegís sus módulos, el abono y podés resetear contraseñas." },
    { selector: a("pagos"), title: "Pagos", text: "Registrá lo que te paga cada cliente y mirá quién está al día y quién debe." },
    { selector: a("facturacion"), title: "Facturación", text: "Cotizaciones con pago inicial y abono mensual (más los planes trimestral y anual) y las facturas mensuales de cada sistema." },
    { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." },
    { selector: a("configuracion"), title: "Configuración", text: "Precios, enlaces de marca y copia de seguridad. Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido." },
  ];
}
