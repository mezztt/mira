import { useEffect, useState } from "react";
import { appApi, canAccess, getSessionUser, publicSiteUrl } from "../../config";
import { startTour } from "../../components/tour/Tour";
import RubroCard from "../../components/RubroCard";
import { BajaCard } from "../../components/ServiceCancel";
import { Field, Loading, PageHeader, Switch, numOrNull, strOrNull, useFlash } from "../../components/ui";

interface Company { name: string; slug: string | null; specialty: string | null; cuit: string | null; email: string | null; phone: string | null; address: string | null; city: string | null }
interface Clinic {
  slug: string | null; web_days_ahead: number; web_min_hours: number; web_cancel_hours: number; web_max_per_dni: number;
  web_show_prices: boolean; web_message: string | null; reminder_template: string; absent_after_minutes: number;
  deposit_enabled: boolean; deposit_mode: "PERCENT" | "FIXED"; deposit_percent: number; deposit_fixed: number;
  deposit_hold_minutes: number; has_mp_token: boolean; mp_token_hint: string | null; mp_test_mode: boolean;
}
interface Circle {
  admin_fee_percent: number; membership_fee: number; ganancias_percent: number; iibb_percent: number;
  presentation_deadline_day: number; members_can_load: boolean;
  ganancias_mode: "NONE" | "PERCENT" | "SCALE"; ganancias_min: number; ganancias_scale: number[][];
  iibb_scope: "ALL" | "RI" | "NONE"; iibb_min: number;
}

const VARS = ["{paciente}", "{profesional}", "{dia}", "{hora}", "{consultorio}", "{direccion}", "{codigo}"];

function Configuracion() {
  const user = getSessionUser();
  const { show, fail, node: flash } = useFlash();
  const [company, setCompany] = useState<Company | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [mpToken, setMpToken] = useState("");
  const isCircle = user?.kind === "CIRCULO";
  const agendaOn = isCircle && canAccess(user, "agenda");   // círculo con agenda de médicos

  useEffect(() => {
    appApi<Company>("/company").then(setCompany).catch(fail);
    if (isCircle) appApi<Circle>("/settings/circle").then(setCircle).catch(fail);
    // los ajustes de turnos también los usa el círculo cuando tiene la agenda de médicos
    if (!isCircle || agendaOn) appApi<Clinic>("/settings/clinic").then(setClinic).catch(fail);
  }, [isCircle, agendaOn, fail]);

  async function saveCompany() {
    if (!company) return;
    try {
      const c = await appApi<Company>("/company", { method: "PUT", body: {
        name: company.name, specialty: strOrNull(company.specialty), cuit: strOrNull(company.cuit), email: strOrNull(company.email),
        phone: strOrNull(company.phone), address: strOrNull(company.address), city: strOrNull(company.city),
      } });
      setCompany(c);
      show("Datos guardados");
    } catch (e) { fail(e); }
  }
  async function saveClinic() {
    if (!clinic) return;
    // solo los ajustes de turnos (la seña se guarda aparte; en el círculo no hay seña ni precios en la web)
    const body = {
      slug: clinic.slug, web_days_ahead: clinic.web_days_ahead, web_min_hours: clinic.web_min_hours,
      web_cancel_hours: clinic.web_cancel_hours, web_max_per_dni: clinic.web_max_per_dni,
      web_message: strOrNull(clinic.web_message), reminder_template: clinic.reminder_template,
      absent_after_minutes: clinic.absent_after_minutes,
      ...(isCircle ? {} : { web_show_prices: clinic.web_show_prices }),
    };
    try { setClinic(await appApi<Clinic>("/settings/clinic", { method: "PUT", body })); show("Configuración guardada"); }
    catch (e) { fail(e); }
  }
  async function saveToken(token: string) {
    try {
      setClinic(await appApi<Clinic>("/settings/clinic", { method: "PUT", body: { mp_access_token: token } }));
      setMpToken("");
      show(token ? "Mercado Pago conectado" : "Mercado Pago desconectado");
    } catch (e) { fail(e); }
  }
  async function saveDeposit(patch: Partial<Clinic>) {
    if (!clinic) return;
    try {
      setClinic(await appApi<Clinic>("/settings/clinic", { method: "PUT", body: {
        deposit_enabled: clinic.deposit_enabled, deposit_mode: clinic.deposit_mode, deposit_percent: clinic.deposit_percent,
        deposit_fixed: clinic.deposit_fixed, deposit_hold_minutes: clinic.deposit_hold_minutes, ...patch,
      } }));
      show("Seña guardada");
    } catch (e) { fail(e); }
  }
  async function saveCircle() {
    if (!circle) return;
    try { setCircle(await appApi<Circle>("/settings/circle", { method: "PUT", body: circle })); show("Configuración guardada"); }
    catch (e) { fail(e); }
  }

  if (!company) return <Loading />;
  const setC = (k: keyof Company, v: string) => setCompany({ ...company, [k]: v });
  const webOn = (!isCircle || agendaOn) && canAccess(user, "web_turnos");
  const link = publicSiteUrl(clinic?.slug);

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONFIGURACIÓN" title="Configuración" subtitle={isCircle ? (agendaOn ? "Datos del círculo, reglas de liquidación y turnos de los médicos." : "Datos del círculo y reglas de liquidación.") : "Datos del consultorio, web de turnos y recordatorios."} />

      <div className="mr-grid-2">
        <div className="mr-card">
          <h2>{isCircle ? "Datos del círculo" : "Datos del consultorio"}</h2>
          <p className="mr-muted">{isCircle ? "Salen en los recibos, las impresiones y la web de turnos." : "Salen en las recetas, recibos, impresiones y la web de turnos."}</p>
          <div className="product-form">
            <Field label="Nombre"><input value={company.name} onChange={(e) => setC("name", e.target.value)} /></Field>
            <div className="form-row">
              <Field label={isCircle ? "Descripción" : "Especialidad / rubro"}><input value={company.specialty || ""} onChange={(e) => setC("specialty", e.target.value)} /></Field>
              <Field label="CUIT"><input value={company.cuit || ""} onChange={(e) => setC("cuit", e.target.value)} /></Field>
            </div>
            <div className="form-row">
              <Field label="Teléfono"><input value={company.phone || ""} onChange={(e) => setC("phone", e.target.value)} /></Field>
              <Field label="Email"><input value={company.email || ""} onChange={(e) => setC("email", e.target.value)} /></Field>
            </div>
            <div className="form-row">
              <Field label="Dirección"><input value={company.address || ""} onChange={(e) => setC("address", e.target.value)} /></Field>
              <Field label="Localidad"><input value={company.city || ""} onChange={(e) => setC("city", e.target.value)} /></Field>
            </div>
            <button className="primary-button" onClick={saveCompany} style={{ alignSelf: "flex-start" }}>Guardar datos</button>
          </div>
        </div>

        {!isCircle && clinic && (
          <div className="mr-card">
            <h2>Recordatorios y ausentes</h2>
            <p className="mr-muted">Mensaje que se arma para mandar por WhatsApp desde la agenda.</p>
            <div className="product-form">
              <Field label="Texto del recordatorio" hint={<>Podés usar: {VARS.map((v) => <code key={v} style={{ marginRight: 6 }}>{v}</code>)}</>}>
                <textarea rows={4} value={clinic.reminder_template} onChange={(e) => setClinic({ ...clinic, reminder_template: e.target.value })} maxLength={500} />
              </Field>
              <Field label="Marcar ausente automáticamente" hint="Si el turno sigue sin llegada pasado ese tiempo, queda como ausente.">
                <div className="mr-input-suffix"><input type="number" min="5" max="240" value={clinic.absent_after_minutes} onChange={(e) => setClinic({ ...clinic, absent_after_minutes: Number(e.target.value) })} /><span>minutos después</span></div>
              </Field>
              <button className="primary-button" onClick={saveClinic} style={{ alignSelf: "flex-start" }}>Guardar</button>
            </div>
          </div>
        )}

        {isCircle && circle && (
          <div className="mr-card">
            <h2>Reglas de liquidación</h2>
            <p className="mr-muted">Se aplican a cada médico al liquidar sus honorarios (cada convenio puede tener su propio gasto administrativo).</p>
            <div className="product-form">
              <div className="form-row">
                <Field label="Gasto administrativo del círculo"><div className="mr-input-suffix"><input type="number" min="0" max="100" step="0.1" value={circle.admin_fee_percent} onChange={(e) => setCircle({ ...circle, admin_fee_percent: numOrNull(e.target.value) ?? 0 })} /><span>%</span></div></Field>
                <Field label="Cuota societaria mensual"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={circle.membership_fee} onChange={(e) => setCircle({ ...circle, membership_fee: numOrNull(e.target.value) ?? 0 })} /></div></Field>
              </div>
              <Field label="Día límite para cargar prestaciones del mes" hint="Se le muestra a los médicos en su portal">
                <input type="number" min="1" max="28" value={circle.presentation_deadline_day} onChange={(e) => setCircle({ ...circle, presentation_deadline_day: Number(e.target.value) })} />
              </Field>
              <Switch on={circle.members_can_load} onChange={(v) => setCircle({ ...circle, members_can_load: v })} label="Los médicos cargan sus prestaciones desde el portal" hint="Si lo apagás, solo administración carga y el médico solo consulta" />
              <button className="primary-button" onClick={saveCircle} style={{ alignSelf: "flex-start" }}>Guardar</button>
            </div>
          </div>
        )}
      </div>

      {isCircle && circle && (
        <div className="mr-card">
          <div className="mr-card-head"><div><h2>Retenciones impositivas</h2><p>Se calculan solas en cada liquidación. A cada médico se le puede marcar “no retener” desde el padrón.</p></div></div>
          <div className="mr-note mr-note-warn" role="note" style={{ marginBottom: 16 }}>
            <strong>Valores de referencia.</strong> Verificá los montos y alícuotas vigentes con tu contador antes de liquidar.
          </div>
          <div className="mr-grid-2" style={{ marginBottom: 0 }}>
            <div className="product-form">
              <h4 className="mr-form-title">Ganancias (RG 830 · profesiones liberales)</h4>
              <Field label="Cómo se retiene" hint="Solo a responsables inscriptos. A monotributistas y exentos no se les retiene.">
                <div className="mr-seg">
                  {([["SCALE", "Escala oficial"], ["PERCENT", "Porcentaje fijo"], ["NONE", "No retener"]] as const).map(([k, l]) => (
                    <button key={k} type="button" className={circle.ganancias_mode === k ? "is-on" : ""} onClick={() => setCircle({ ...circle, ganancias_mode: k })}>{l}</button>
                  ))}
                </div>
              </Field>
              {circle.ganancias_mode !== "NONE" && (
                <Field label="Monto no sujeto a retención (por mes)" hint="Se retiene sobre lo que supere este monto, sumando todo lo pagado al médico en el mes.">
                  <div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={circle.ganancias_min} onChange={(e) => setCircle({ ...circle, ganancias_min: numOrNull(e.target.value) ?? 0 })} /></div>
                </Field>
              )}
              {circle.ganancias_mode === "PERCENT" && (
                <Field label="Alícuota"><div className="mr-input-suffix"><input type="number" min="0" max="100" step="0.1" value={circle.ganancias_percent} onChange={(e) => setCircle({ ...circle, ganancias_percent: numOrNull(e.target.value) ?? 0 })} /><span>%</span></div></Field>
              )}
              {circle.ganancias_mode === "SCALE" && (
                <Field label="Escala (sobre el excedente del monto no sujeto)">
                  <div className="mr-scale">
                    <div className="mr-scale-row"><small>Desde $</small><small>Importe fijo $</small><small>Más el %</small><span /></div>
                    {circle.ganancias_scale.map((row, i) => (
                      <div key={i} className="mr-scale-row">
                        {[0, 1, 2].map((j) => (
                          <input key={j} type="number" min="0" step={j === 2 ? "0.1" : "1"} value={row[j]} aria-label={["Desde", "Importe fijo", "Porcentaje"][j]}
                            onChange={(e) => setCircle({ ...circle, ganancias_scale: circle.ganancias_scale.map((r, k) => (k === i ? r.map((v, m) => (m === j ? Number(e.target.value) : v)) : r)) })} />
                        ))}
                        <button type="button" aria-label="Quitar tramo" onClick={() => setCircle({ ...circle, ganancias_scale: circle.ganancias_scale.filter((_, k) => k !== i) })}>×</button>
                      </div>
                    ))}
                    <div className="mr-row">
                      <button type="button" className="mr-link" onClick={() => setCircle({ ...circle, ganancias_scale: [...circle.ganancias_scale, [0, 0, 0]] })}>+ tramo</button>
                      <button type="button" className="mr-link" onClick={() => setCircle({ ...circle, ganancias_scale: [] })}>Volver a la escala de referencia</button>
                    </div>
                  </div>
                </Field>
              )}
            </div>
            <div className="product-form">
              <h4 className="mr-form-title">Ingresos Brutos</h4>
              <Field label="A quién se le retiene">
                <select value={circle.iibb_scope} onChange={(e) => setCircle({ ...circle, iibb_scope: e.target.value as Circle["iibb_scope"] })}>
                  <option value="ALL">A todos los médicos</option>
                  <option value="RI">Solo a responsables inscriptos</option>
                  <option value="NONE">No retener</option>
                </select>
              </Field>
              {circle.iibb_scope !== "NONE" && (
                <div className="form-row">
                  <Field label="Alícuota"><div className="mr-input-suffix"><input type="number" min="0" max="100" step="0.1" value={circle.iibb_percent} onChange={(e) => setCircle({ ...circle, iibb_percent: numOrNull(e.target.value) ?? 0 })} /><span>%</span></div></Field>
                  <Field label="Desde qué monto" hint="0 = siempre"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={circle.iibb_min} onChange={(e) => setCircle({ ...circle, iibb_min: numOrNull(e.target.value) ?? 0 })} /></div></Field>
                </div>
              )}
              <p className="mr-muted" style={{ margin: 0 }}>
                La escala de Ganancias sale de la RG 830 y cambia cuando ARCA la actualiza. Ingresos Brutos depende de cada provincia.
              </p>
              <button className="primary-button" onClick={saveCircle} style={{ alignSelf: "flex-start" }}>Guardar retenciones</button>
            </div>
          </div>
        </div>
      )}

      {agendaOn && clinic && (
        <div className="mr-card" style={{ marginTop: 16, marginBottom: 16 }}>
          <div className="mr-card-head"><div><h2>Agenda de médicos · recordatorios y ausentes</h2><p>Vale para los turnos de todos los médicos. Los horarios de cada uno se cargan en Agenda de médicos.</p></div></div>
          <div className="product-form">
            <Field label="Texto del recordatorio" hint={<>Mensaje que se arma para mandar por WhatsApp desde la agenda. Podés usar: {VARS.map((v) => <code key={v} style={{ marginRight: 6 }}>{v}</code>)} ({"{consultorio}"} es el nombre del círculo)</>}>
              <textarea rows={3} value={clinic.reminder_template} onChange={(e) => setClinic({ ...clinic, reminder_template: e.target.value })} maxLength={500} />
            </Field>
            <Field label="Marcar ausente automáticamente" hint="Si el turno sigue sin llegada pasado ese tiempo, queda como ausente.">
              <div className="mr-input-suffix" style={{ maxWidth: 320 }}><input type="number" min="5" max="240" value={clinic.absent_after_minutes} onChange={(e) => setClinic({ ...clinic, absent_after_minutes: Number(e.target.value) })} /><span>minutos después</span></div>
            </Field>
            <button className="primary-button" onClick={saveClinic} style={{ alignSelf: "flex-start" }}>Guardar</button>
          </div>
        </div>
      )}

      {(!isCircle || agendaOn) && clinic && (
        <div className="mr-card">
          <div className="mr-card-head">
            <div><h2>{isCircle ? "Web de turnos de los médicos" : "Web de turnos"}</h2><p>{isCircle ? "Página para que los pacientes elijan médico y saquen o cancelen turnos solos. Salen los médicos que activaron “Dar turnos por la web”." : "Página para que los pacientes saquen y cancelen turnos solos, las 24 horas."}</p></div>
          </div>
          {!webOn ? <div className="mr-note mr-note-warn">Tu plan no incluye la web de turnos. Pedila a Mezztt para activarla.</div> : (
            <div className="product-form">
              <div className="mr-link-box">
                <code>{link}</code>
                <div className="mr-row">
                  <button className="secondary-button" onClick={() => { navigator.clipboard?.writeText(link); show("Link copiado"); }}>Copiar</button>
                  <a className="secondary-button" href={link} target="_blank" rel="noreferrer">Abrir</a>
                </div>
              </div>
              <div className="form-row">
                <Field label="Link (lo que va después de /t/)"><input value={clinic.slug || ""} onChange={(e) => setClinic({ ...clinic, slug: e.target.value })} /></Field>
                <Field label="Hasta cuántos días adelante"><div className="mr-input-suffix"><input type="number" min="1" max="180" value={clinic.web_days_ahead} onChange={(e) => setClinic({ ...clinic, web_days_ahead: Number(e.target.value) })} /><span>días</span></div></Field>
              </div>
              <div className="form-row">
                <Field label="Anticipación mínima para pedir"><div className="mr-input-suffix"><input type="number" min="0" max="168" value={clinic.web_min_hours} onChange={(e) => setClinic({ ...clinic, web_min_hours: Number(e.target.value) })} /><span>horas</span></div></Field>
                <Field label="Cancelar online hasta"><div className="mr-input-suffix"><input type="number" min="0" max="168" value={clinic.web_cancel_hours} onChange={(e) => setClinic({ ...clinic, web_cancel_hours: Number(e.target.value) })} /><span>horas antes</span></div></Field>
              </div>
              <div className="form-row">
                <Field label="Turnos pendientes máximos por DNI"><input type="number" min="1" max="20" value={clinic.web_max_per_dni} onChange={(e) => setClinic({ ...clinic, web_max_per_dni: Number(e.target.value) })} /></Field>
                {isCircle ? <div /> : <div className="form-group"><label>&nbsp;</label><Switch on={clinic.web_show_prices} onChange={(v) => setClinic({ ...clinic, web_show_prices: v })} label="Mostrar el valor de la consulta" /></div>}
              </div>
              <Field label="Mensaje para los pacientes" hint="Aparece al reservar y en el comprobante (ej. traer la credencial, llegar 10 min antes)">
                <textarea rows={2} value={clinic.web_message || ""} onChange={(e) => setClinic({ ...clinic, web_message: e.target.value })} maxLength={500} />
              </Field>
              <button className="primary-button" onClick={saveClinic} style={{ alignSelf: "flex-start" }}>Guardar web de turnos</button>
            </div>
          )}
        </div>
      )}
      {!isCircle && clinic && webOn && (
        <div className="mr-card" style={{ marginTop: 16 }}>
          <div className="mr-card-head">
            <div><h2>Seña online con Mercado Pago</h2><p>Opcional: el paciente paga una seña al pedir el turno por la web y el turno se confirma solo. La plata va directo a la cuenta del consultorio.</p></div>
            {clinic.has_mp_token && <span className={`mr-pill ${clinic.mp_test_mode ? "mr-pill-orange" : "mr-pill-green"}`}>{clinic.mp_test_mode ? "Modo prueba" : "Mercado Pago conectado"} {clinic.mp_token_hint}</span>}
          </div>
          <div className="product-form">
            {!clinic.has_mp_token ? (
              <>
                <Field label="Access Token de Mercado Pago" hint="Lo sacás en mercadopago.com.ar/developers → Tus integraciones → Credenciales de producción. Empezá con el de prueba (TEST-…) para probar.">
                  <input value={mpToken} onChange={(e) => setMpToken(e.target.value)} placeholder="APP_USR-…" autoComplete="off" />
                </Field>
                <button className="primary-button" style={{ alignSelf: "flex-start" }} disabled={mpToken.trim().length < 10} onClick={() => saveToken(mpToken.trim())}>Conectar Mercado Pago</button>
              </>
            ) : (
              <>
                <Switch on={clinic.deposit_enabled} onChange={(v) => saveDeposit({ deposit_enabled: v })} label="Pedir seña en los turnos online" hint="Los turnos que da recepción desde la agenda no piden seña" />
                <div className="form-row">
                  <Field label="Cuánto se pide">
                    <div className="mr-seg">
                      <button type="button" className={clinic.deposit_mode === "PERCENT" ? "is-on" : ""} onClick={() => setClinic({ ...clinic, deposit_mode: "PERCENT" })}>% de la consulta</button>
                      <button type="button" className={clinic.deposit_mode === "FIXED" ? "is-on" : ""} onClick={() => setClinic({ ...clinic, deposit_mode: "FIXED" })}>Monto fijo</button>
                    </div>
                  </Field>
                  {clinic.deposit_mode === "PERCENT" ? (
                    <Field label="Porcentaje" hint="Sobre el valor de la consulta particular de cada profesional. Si no tiene valor cargado, no se le pide seña.">
                      <div className="mr-input-suffix"><input type="number" min="1" max="100" value={clinic.deposit_percent} onChange={(e) => setClinic({ ...clinic, deposit_percent: Number(e.target.value) })} /><span>%</span></div>
                    </Field>
                  ) : (
                    <Field label="Monto de la seña"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={clinic.deposit_fixed} onChange={(e) => setClinic({ ...clinic, deposit_fixed: Number(e.target.value) })} /></div></Field>
                  )}
                </div>
                <Field label="Tiempo para pagar" hint="Pasado ese tiempo sin pago, el horario se libera solo.">
                  <div className="mr-input-suffix" style={{ maxWidth: 260 }}><input type="number" min="5" max="120" value={clinic.deposit_hold_minutes} onChange={(e) => setClinic({ ...clinic, deposit_hold_minutes: Number(e.target.value) })} /><span>minutos</span></div>
                </Field>
                <div className="mr-row">
                  <button className="primary-button" onClick={() => saveDeposit({})}>Guardar seña</button>
                  <button className="mr-link mr-link-danger" onClick={() => confirm("¿Desconectar Mercado Pago? Se deja de pedir seña.") && saveToken("")}>Desconectar Mercado Pago</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {user?.role === "ADMINISTRADOR" && <RubroCard show={show} fail={fail} />}
      {user?.role === "ADMINISTRADOR" && <div style={{ marginTop: 16 }}><BajaCard /></div>}
      <div className="mr-card" style={{ marginTop: 16 }}>
        <div className="mr-card-head"><div><h2>¿Cómo funcionamos?</h2><p>Volvé a ver el recorrido por el sistema.</p></div></div>
        <button type="button" className="secondary-button" onClick={startTour}>Ver el recorrido</button>
      </div>
      {flash}
    </section>
  );
}

export default Configuracion;
