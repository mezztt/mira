import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { publicApi, hhmm, longDate, money, APPT_KINDS } from "../../config";
import { MiraLogo, PoweredBy, useLightPage } from "../../components/Brand";

interface TicketData {
  code: string; status: string; patient_name: string; start_at: string; end_at: string; kind: string;
  professional: { name: string; specialty: string | null; color: string } | null; insurance: string | null;
  clinic: { kind?: "CONSULTORIO" | "CIRCULO"; name: string; address: string | null; city: string | null; phone: string | null; email?: string | null; message: string | null };
  can_cancel: boolean; cancel_hours: number;
  deposit: { amount: number; status: "PENDIENTE" | "PAGADA" | "VENCIDA"; expires_at: string; payment_url: string | null } | null;
}

const STATUS: Record<string, string> = {
  RESERVADO: "Turno reservado", CONFIRMADO: "Turno confirmado", EN_ESPERA: "Ya estás en la sala de espera", ATENDIENDO: "En consulta",
  ATENDIDO: "Turno atendido", AUSENTE: "No asististe a este turno", CANCELADO: "Turno cancelado",
};

function icsDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

function Ticket() {
  useLightPage();
  const { slug = "", code = "" } = useParams();
  const [params] = useSearchParams();
  const [t, setT] = useState<TicketData | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [dni, setDni] = useState("");
  const [cancelError, setCancelError] = useState("");

  const load = useCallback(() => {
    publicApi<TicketData>(`/public/clinic/${slug}/appointments/${code}`).then((d) => { setT(d); document.title = `${d.clinic.name} · Turno ${d.code}`; }).catch((e) => setError(e.message));
  }, [slug, code]);
  const [checking, setChecking] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [now, setNow] = useState(Date.now());

  // al volver de Mercado Pago (o con "Ya pagué") se verifica el pago de la seña
  const verify = useCallback(async (paymentId?: string | null) => {
    setChecking(true); setPayMsg("");
    try {
      const d = await publicApi<TicketData>(`/public/clinic/${slug}/appointments/${code}/verify-payment${paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : ""}`, { method: "POST" });
      setT(d);
      if (d.deposit?.status === "PENDIENTE") setPayMsg("Todavía no vemos el pago. Si recién pagaste, esperá unos segundos y volvé a probar.");
    } catch (e) { setPayMsg(e instanceof Error ? e.message : "No se pudo verificar el pago"); }
    finally { setChecking(false); }
  }, [slug, code]);

  useEffect(() => {
    const pid = params.get("payment_id") || params.get("collection_id");
    if (pid && pid !== "null") verify(pid); else load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  async function cancel() {
    setCancelError("");
    try {
      await publicApi(`/public/clinic/${slug}/appointments/${code}/cancel`, { method: "POST", body: { dni } });
      setCancelling(false);
      load();
    } catch (e) { setCancelError(e instanceof Error ? e.message : "No se pudo cancelar"); }
  }

  function addToCalendar() {
    if (!t) return;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MIRA//Turnos//ES", "BEGIN:VEVENT",
      `UID:${t.code}@mira`, `DTSTART:${icsDate(new Date(t.start_at))}`, `DTEND:${icsDate(new Date(t.end_at))}`,
      `SUMMARY:Turno con ${t.professional?.name || t.clinic.name}`,
      `LOCATION:${[t.clinic.name, t.clinic.address, t.clinic.city].filter(Boolean).join(", ")}`,
      `DESCRIPTION:Código ${t.code}`, "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio de turno", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `turno-${t.code}.ics`;
    a.click();
  }

  const cancelled = t?.status === "CANCELADO";
  const pending = !!t?.deposit && t.deposit.status === "PENDIENTE" && !cancelled;
  const left = t?.deposit ? Math.max(0, Math.floor((new Date(t.deposit.expires_at).getTime() - now) / 1000)) : 0;
  const start = t ? new Date(t.start_at) : null;

  return (
    <div className="pt-page">
      <header className="pt-hero">
        <div className="pt-wrap">
          <div className="pt-top"><MiraLogo size={40} /><div><strong>{t?.clinic.name || "Turno"}</strong><small>{t ? [t.clinic.address, t.clinic.city].filter(Boolean).join(", ") : ""}</small></div></div>
          <h1>{pending ? "Falta pagar la seña" : params.get("nuevo") && !cancelled ? "¡Listo, tenés turno!" : t ? STATUS[t.status] || "Tu turno" : "Tu turno"}</h1>
          <p>{pending ? "Tu horario está reservado por unos minutos." : params.get("nuevo") && !cancelled ? "Guardá el código para verlo o cancelarlo." : "Detalle de tu turno."}</p>
        </div>
      </header>
      <main className="pt-wrap pt-main">
        <div className="pt-card pt-ticket">
          {error ? <div className="pt-error">{error}</div> : !t ? <p>Cargando…</p> : (<>
            <div className={`pt-ticket-icon ${cancelled ? "is-cancel" : pending ? "is-wait" : ""}`}>{cancelled ? "×" : pending ? "$" : "✓"}</div>
            <h2>{pending ? "Turno a confirmar" : STATUS[t.status] || t.status}</h2>
            {pending && t.deposit && (
              <div className="pt-pay">
                <p>Pagá la seña de <b>{money(t.deposit.amount)}</b> para confirmar el turno.{" "}
                  {left > 0 ? <>Te quedan <b>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</b> min.</> : "El tiempo se cumplió: si ya pagaste, tocá “Ya pagué”."}</p>
                {t.deposit.payment_url && left > 0 && <a className="pt-btn" href={t.deposit.payment_url}>Pagar seña con Mercado Pago</a>}
                <button className="pt-btn pt-btn-ghost" onClick={() => verify(null)} disabled={checking}>{checking ? "Verificando…" : "Ya pagué"}</button>
                {payMsg && <div className="pt-error">{payMsg}</div>}
              </div>
            )}
            {t.deposit?.status === "PAGADA" && <div className="pt-msg">Seña pagada: <b>{money(t.deposit.amount)}</b>. Se descuenta de la consulta.</div>}
            {cancelled && t.deposit?.status === "VENCIDA" && <div className="pt-error">La seña no se pagó a tiempo y el horario se liberó.</div>}
            <div className="pt-code"><small>Código</small><strong>{t.code}</strong></div>
            <div className="pt-detail">
              <div><span>Día</span><strong>{longDate(start!)}</strong></div>
              <div><span>Hora</span><strong>{hhmm(start!)} h</strong></div>
              <div><span>{t.clinic.kind === "CIRCULO" ? "Médico" : "Profesional"}</span><strong>{t.professional?.name}{t.professional?.specialty ? ` · ${t.professional.specialty}` : ""}</strong></div>
              <div><span>Paciente</span><strong>{t.patient_name}</strong></div>
              {t.insurance && <div><span>Cobertura</span><strong>{t.insurance}</strong></div>}
              <div><span>Tipo</span><strong>{APPT_KINDS[t.kind] || t.kind}</strong></div>
              {t.clinic.address && <div><span>Dirección</span><strong>{[t.clinic.address, t.clinic.city].filter(Boolean).join(", ")}</strong></div>}
            </div>
            {t.clinic.message && !cancelled && <div className="pt-msg" style={{ textAlign: "left" }}>{t.clinic.message}</div>}
            {!cancelled && !pending && ["RESERVADO", "CONFIRMADO"].includes(t.status) && (
              <div style={{ display: "grid", gap: 10 }}>
                <button className="pt-btn pt-btn-ghost" onClick={addToCalendar}>Agregar a mi calendario</button>
                {t.can_cancel ? (
                  cancelling ? (
                    <div style={{ textAlign: "left" }}>
                      <div className="pt-field"><label>Para cancelar, ingresá tu DNI</label><input value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" autoFocus /></div>
                      {cancelError && <div className="pt-error">{cancelError}</div>}
                      <div className="pt-row">
                        <button className="pt-btn pt-btn-ghost" onClick={() => setCancelling(false)}>Volver</button>
                        <button className="pt-btn pt-btn-danger" onClick={cancel} disabled={dni.trim().length < 6}>Cancelar turno</button>
                      </div>
                    </div>
                  ) : <button className="pt-btn pt-btn-danger" onClick={() => setCancelling(true)}>No puedo ir · cancelar</button>
                ) : <p className="pt-consent">Faltan menos de {t.cancel_hours} h: para cancelar comunicate {t.clinic.phone ? `al ${t.clinic.phone}` : t.clinic.kind === "CIRCULO" ? "con el círculo" : "con el consultorio"}.</p>}
              </div>
            )}
            <div style={{ marginTop: 14 }}><Link className="mr-link" to={`/t/${slug}`}>{cancelled ? "Sacar otro turno" : "Volver a turnos online"}</Link></div>
          </>)}
        </div>
        {t && (
          <address className="pt-business">
            <strong>{t.clinic.name}</strong>
            {(t.clinic.address || t.clinic.city) && <span>{[t.clinic.address, t.clinic.city].filter(Boolean).join(", ")}</span>}
            {t.clinic.phone && <span>Tel. {t.clinic.phone}</span>}
            {t.clinic.email && <span>{t.clinic.email}</span>}
          </address>
        )}
      </main>
      <footer className="pt-foot"><PoweredBy /></footer>
    </div>
  );
}

export default Ticket;
