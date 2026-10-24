import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_BRAND, APP_NAME } from "../../config";
import { InstagramLink, MezzttLink, MiraLogo, PoweredBy, useBrandLinks, useLightPage } from "../../components/Brand";

/**
 * Textos legales públicos (sin login): /legal/terminos y /legal/privacidad.
 * Son textos generales del servicio; no reemplazan el asesoramiento de un profesional (ver LEGAL.md).
 */
const UPDATED = "octubre de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="lg-section"><h2>{title}</h2>{children}</section>;
}

function Contact() {
  const links = useBrandLinks();
  return (
    <p className="lg-contact">
      Escribinos por el Instagram de <MezzttLink />
      <InstagramLink href={links.mezztt_instagram_url} label={`Instagram de ${APP_BRAND}`} />
    </p>
  );
}

function Terminos() {
  return (
    <>
      <p className="lg-lead">
        Estas son las condiciones para usar {APP_NAME}. Están escritas en lenguaje simple. Si usás el sistema, entendemos que las aceptás.
      </p>
      <Section title="1. Qué es MIRA">
        <p>{APP_NAME} es un sistema de gestión para consultorios, clínicas y círculos médicos: agenda y turnos, pacientes, historia clínica, cobros, convenios, prestaciones y liquidaciones, según los módulos que cada cliente contrate.</p>
      </Section>
      <Section title="2. Quién presta el servicio">
        <p>El servicio lo presta {APP_BRAND}, que desarrolla y mantiene el sistema. El cliente es el consultorio, la clínica o el círculo médico que lo contrata, y es quien decide qué personas de su equipo tienen usuario.</p>
      </Section>
      <Section title="3. Cuenta y contraseñas">
        <ul>
          <li>Cada usuario es personal. No compartas tu contraseña.</li>
          <li>El cliente es responsable de lo que se hace con los usuarios que crea y de darlos de baja cuando alguien deja de trabajar con él.</li>
          <li>Si creés que alguien entró con tu usuario, cambiá la contraseña y avisanos.</li>
        </ul>
      </Section>
      <Section title="4. Uso permitido">
        <ul>
          <li>El sistema es para la actividad profesional del cliente. No se puede usar para fines ilegales ni para cargar datos de personas sin tener derecho a hacerlo.</li>
          <li>No está permitido intentar entrar a datos de otros clientes, copiar el sistema ni afectar su funcionamiento.</li>
          <li>{APP_NAME} es una herramienta de registro y organización: no reemplaza el criterio del profesional de la salud ni da indicaciones médicas.</li>
        </ul>
      </Section>
      <Section title="5. Recetas, órdenes y comprobantes">
        <ul>
          <li>{APP_NAME} <b>no es</b> una plataforma de receta electrónica registrada. Las recetas y órdenes que se imprimen desde el sistema son solo una constancia de la indicación médica, sin el valor legal de la receta ni de la orden electrónica: la receta y la orden válidas son las electrónicas emitidas por una plataforma registrada (ReNaPDiS).</li>
          <li>{APP_NAME} <b>no emite</b> comprobantes fiscales de ARCA. Los recibos, presupuestos y liquidaciones que imprime son documentos internos, no válidos como factura.</li>
        </ul>
      </Section>
      <Section title="6. Abono y baja del servicio">
        <ul>
          <li>El servicio tiene un pago inicial y un abono mensual según los módulos contratados, acordados con {APP_BRAND} antes de empezar.</li>
          <li>Podés pedir la baja cuando quieras, por los mismos medios por los que te contactás con nosotros, sin trámites adicionales.</li>
          <li>Si el abono queda impago, el acceso puede suspenderse después de avisarte. Los datos no se borran por eso.</li>
        </ul>
      </Section>
      <Section title="7. Tus datos son tuyos">
        <p>Los datos que el cliente carga en el sistema son del cliente (y de sus pacientes, según la ley). Podés pedirnos una copia en cualquier momento, también al darte de baja. Cómo los cuidamos está explicado en la <Link to="/legal/privacidad">Política de privacidad</Link>.</p>
      </Section>
      <Section title="8. Disponibilidad">
        <p>Trabajamos para que el sistema esté disponible todo el tiempo y hacemos copias de seguridad, pero no podemos garantizar que nunca haya cortes: pueden existir interrupciones por mantenimiento, por fallas de internet o de los proveedores de alojamiento.</p>
      </Section>
      <Section title="9. Responsabilidad">
        <p>{APP_BRAND} responde por el funcionamiento del sistema dentro de lo razonable. No responde por los datos mal cargados, por las decisiones profesionales tomadas con esos datos, ni por el uso del sistema fuera de estas condiciones. La relación con los pacientes y con las obras sociales es del cliente.</p>
      </Section>
      <Section title="10. Cambios">
        <p>Podemos mejorar el sistema y actualizar estas condiciones. Si el cambio es importante, te avisamos antes.</p>
      </Section>
      <Section title="11. Ley aplicable">
        <p>Estas condiciones se rigen por las leyes de la República Argentina.</p>
      </Section>
      <Section title="12. Contacto"><Contact /></Section>
    </>
  );
}

function Privacidad() {
  return (
    <>
      <p className="lg-lead">
        Acá te contamos qué datos personales se guardan en {APP_NAME}, para qué se usan y qué derechos tenés, según la Ley 25.326 de Protección de Datos Personales.
      </p>
      <Section title="1. Quién es responsable de los datos">
        <ul>
          <li>El <b>consultorio, clínica o círculo médico</b> que usa {APP_NAME} es el responsable de su base de datos: decide qué datos carga y para qué.</li>
          <li><b>{APP_BRAND}</b> presta el software y guarda esos datos por cuenta del consultorio o círculo. No los usa para otra cosa.</li>
        </ul>
      </Section>
      <Section title="2. Qué datos se guardan y para qué">
        <ul>
          <li><b>Pacientes:</b> nombre, DNI, teléfono, email, cobertura médica y los datos del turno. Sirven para dar y recordar turnos y para la atención.</li>
          <li><b>Historia clínica</b> (solo en consultorios que la usan): evoluciones, diagnósticos, indicaciones, odontograma, estudios y documentos. Sirve para la atención de la salud del paciente.</li>
          <li><b>Profesionales y usuarios:</b> nombre, email, matrícula y los datos necesarios para la agenda, la facturación a obras sociales y la liquidación de honorarios.</li>
          <li><b>Uso del sistema:</b> se registra quién entra a cada historia clínica y qué hace, para cuidar la confidencialidad.</li>
        </ul>
      </Section>
      <Section title="3. Datos de salud">
        <ul>
          <li>Los datos de salud son <b>datos sensibles</b> (Ley 25.326). Solo los pueden ver los profesionales y el personal autorizado del consultorio, obligados por el secreto profesional.</li>
          <li>La <b>historia clínica es del paciente</b>. El profesional o la institución la custodian (Ley 26.529) y el paciente puede pedir una copia.</li>
          <li>La historia clínica se <b>conserva por lo menos 10 años</b> desde la última atención. Por eso las evoluciones no se pueden borrar ni modificar: las correcciones se agregan como enmiendas y queda registrado quién las hizo.</li>
        </ul>
      </Section>
      <Section title="4. Si sacás un turno por la web">
        <p>Te pedimos nombre, DNI, teléfono y, si querés, email, cobertura y motivo. Esos datos los recibe el consultorio o el médico que elegiste, solo para gestionar tu turno y avisarte. Si pagás una seña, el pago se hace en Mercado Pago: {APP_NAME} no ve ni guarda los datos de tu tarjeta.</p>
      </Section>
      <Section title="5. No se venden ni se ceden">
        <p>Los datos no se venden, no se alquilan y no se entregan a terceros para publicidad. Solo se comparten cuando lo exige la ley o una orden judicial, o con los proveedores técnicos necesarios para que el sistema funcione (alojamiento), que están obligados a mantener la confidencialidad.</p>
      </Section>
      <Section title="6. Tus derechos">
        <p>Podés pedir <b>acceso</b> a tus datos, que se <b>rectifiquen</b> o <b>actualicen</b> si están mal, y que se <b>supriman</b> cuando corresponda (la historia clínica debe conservarse el plazo legal).</p>
        <p>El pedido se hace ante el consultorio, clínica o círculo donde te atendés, que es el responsable de la base. Si no sabés a quién dirigirte, escribinos y te orientamos.</p>
      </Section>
      <Section title="7. Seguridad">
        <p>Las contraseñas se guardan cifradas, la conexión es segura (https), cada cliente ve solo sus propios datos, el acceso a las historias clínicas queda registrado y se hacen copias de seguridad. Ningún sistema es infalible: si detectamos un problema que afecte tus datos, se lo avisamos al responsable.</p>
      </Section>
      <Section title="8. Cookies y seguimiento">
        <p>{APP_NAME} no usa cookies de publicidad ni rastreadores de terceros. Solo guarda en tu navegador lo necesario para mantener tu sesión y tu preferencia de modo claro u oscuro.</p>
      </Section>
      <Section title="9. Órgano de control">
        <p className="lg-quote">La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>
      </Section>
      <Section title="10. Contacto"><Contact /></Section>
    </>
  );
}

const DOCS = {
  terminos: { title: "Términos y condiciones", other: "privacidad", otherLabel: "Política de privacidad", Body: Terminos },
  privacidad: { title: "Política de privacidad", other: "terminos", otherLabel: "Términos y condiciones", Body: Privacidad },
} as const;

function Legal({ doc }: { doc: keyof typeof DOCS }) {
  useLightPage();
  const d = DOCS[doc];
  useEffect(() => { document.title = `${d.title} · ${APP_NAME}`; window.scrollTo(0, 0); }, [d.title]);
  return (
    <div className="pt-page lg-page">
      <header className="lg-top">
        <div className="lg-wrap lg-top-row">
          <span className="lg-brand"><MiraLogo size={34} /><strong>{APP_NAME}</strong></span>
          <button type="button" className="lg-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>‹ Volver</button>
        </div>
      </header>
      <main className="lg-wrap">
        <article className="pt-card lg-card">
          <span className="pt-step-label">Legales</span>
          <h1>{d.title}</h1>
          <p className="lg-updated">Última actualización: {UPDATED}</p>
          <d.Body />
          <p className="lg-also">Leé también: <Link to={`/legal/${d.other}`}>{d.otherLabel}</Link></p>
        </article>
      </main>
      <footer className="pt-foot"><PoweredBy /></footer>
    </div>
  );
}

export default Legal;
