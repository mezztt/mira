import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { publicApi, money, initials, longDate, parseDay } from "../../config";
import { MiraLogo, PoweredBy, useLightPage } from "../../components/Brand";

interface Prof { id: number; name: string; kind: string; specialty: string | null; license?: string | null; color: string; slot_minutes: number; bio: string | null; price: number | null; deposit: number | null }
interface Clinic {
  kind?: "CONSULTORIO" | "CIRCULO";
  name: string; slug: string; specialty: string | null; address: string | null; city: string | null; phone: string | null; email: string | null;
  message: string | null; days_ahead: number; cancel_hours: number; deposit_hold_minutes: number | null; professionals: Prof[]; insurances: { id: number; name: string }[];
}
interface Avail { professional_id: number; slot_minutes: number; last_day: string; days: { date: string; slots: string[] }[] }

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MAX_LIST = 30;   // un círculo puede tener muchos médicos: se busca por nombre o especialidad
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function Reservar() {
  useLightPage();
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [notFound, setNotFound] = useState("");
  const [step, setStep] = useState(1);
  const [prof, setProf] = useState<Prof | null>(null);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [day, setDay] = useState<string>("");
  const [time, setTime] = useState("");
  const [f, setF] = useState({ first_name: "", last_name: "", dni: "", phone: "", email: "", insurance_id: "", insurance_number: "", kind: "CONSULTA", reason: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [lookup, setLookup] = useState("");
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");

  useEffect(() => {
    publicApi<Clinic>(`/public/clinic/${slug}`).then((c) => {
      setClinic(c);
      document.title = `${c.name} · Turnos online`;
      if (c.professionals.length === 1) chooseProf(c.professionals[0]);
    }).catch((e) => setNotFound(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function loadAvail(p: Prof, start?: string) {
    setLoadingAvail(true);
    publicApi<Avail>(`/public/clinic/${slug}/availability?professional_id=${p.id}&days=21${start ? `&start=${start}` : ""}`)
      .then((a) => {
        setAvail(a);
        const first = a.days.find((d) => d.slots.length);
        setDay(first?.date || a.days[0]?.date || "");
      }).catch((e) => setError(e.message)).finally(() => setLoadingAvail(false));
  }
  function chooseProf(p: Prof) {
    setProf(p); setTime(""); setError(""); setStep(2); loadAvail(p);
  }

  const dayInfo = useMemo(() => avail?.days.find((d) => d.date === day), [avail, day]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  // círculo médico: el paciente elige entre los médicos del padrón que dan turnos por la web
  const isCircle = clinic?.kind === "CIRCULO";
  const who = isCircle ? "médico" : "profesional";
  const place = isCircle ? "el círculo" : "el consultorio";
  const specialties = useMemo(() => [...new Set((clinic?.professionals || []).map((p) => p.specialty).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b)), [clinic]);
  const profs = useMemo(() => {
    const term = norm(q.trim());
    return (clinic?.professionals || []).filter((p) => (!specialty || p.specialty === specialty)
      && (!term || norm(`${p.name} ${p.specialty || ""}`).includes(term)));
  }, [clinic, q, specialty]);
  const showSearch = (clinic?.professionals.length || 0) > 6;

  async function confirm() {
    setError("");
    if (f.first_name.trim().length < 2 || f.last_name.trim().length < 2) return setError("Completá tu nombre y apellido");
    if (f.dni.replace(/\D/g, "").length < 6) return setError("Revisá el DNI");
    if (f.phone.replace(/\D/g, "").length < 6) return setError("Dejanos un celular para avisarte");
    setSending(true);
    try {
      const r = await publicApi<{ code: string; payment_url: string | null }>(`/public/clinic/${slug}/appointments`, {
        method: "POST",
        body: {
          professional_id: prof!.id, start_at: `${day}T${time}:00`,
          first_name: f.first_name.trim(), last_name: f.last_name.trim(), dni: f.dni.trim(), phone: f.phone.trim(),
          email: f.email.trim() || null, insurance_id: f.insurance_id ? Number(f.insurance_id) : null,
          insurance_number: f.insurance_number.trim() || null, kind: f.kind, reason: f.reason.trim() || null,
          return_base: window.location.origin,
        },
      });
      if (r.payment_url) { window.location.href = r.payment_url; return; }   // a pagar la seña en Mercado Pago
      navigate(`/t/${slug}/turno/${r.code}?nuevo=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reservar");
      if (prof && /disponible|tomar/i.test(String(e))) { setStep(2); loadAvail(prof); }
    } finally {
      setSending(false);
    }
  }

  if (notFound) return (
    <div className="pt-page"><div className="pt-hero"><div className="pt-wrap"><div className="pt-top"><MiraLogo size={36} /><strong>MIRA</strong></div><h1>Página no encontrada</h1><p>{notFound}</p></div></div></div>
  );
  if (!clinic) return <div className="pt-page"><div className="pt-hero"><div className="pt-wrap"><p>Cargando…</p></div></div></div>;

  return (
    <div className="pt-page">
      <header className="pt-hero">
        <div className="pt-wrap">
          <div className="pt-top">
            <MiraLogo size={40} />
            <div><strong>{clinic.name}</strong><small>{[clinic.specialty, [clinic.address, clinic.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</small></div>
          </div>
          <h1>Sacá tu turno online</h1>
          <p>Elegí {who}, día y horario. Te lleva menos de un minuto.</p>
        </div>
      </header>

      <main className="pt-wrap pt-main">
        <div className="pt-card">
          <div className="pt-steps">{[1, 2, 3].map((s) => <span key={s} className={step >= s ? "is-on" : ""} />)}</div>

          {step === 1 && (<>
            <div className="pt-step-label">Paso 1 de 3</div>
            <h2>¿Con quién querés atenderte?</h2>
            <p>{clinic.professionals.length === 1 ? `1 ${who}` : `${clinic.professionals.length} ${isCircle ? "médicos" : "profesionales"}`} con turnos online</p>
            {clinic.professionals.length === 0 && <div className="pt-msg">Por ahora no hay turnos online. Comunicate {clinic.phone ? `al ${clinic.phone}` : `con ${place}`}.</div>}
            {showSearch && (
              <div className="pt-search">
                <input type="search" placeholder={isCircle ? "Buscar médico o especialidad" : "Buscar profesional"} value={q}
                  onChange={(e) => setQ(e.target.value)} aria-label={`Buscar ${who}`} />
                {specialties.length > 1 && (
                  <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label="Especialidad">
                    <option value="">Todas las especialidades</option>
                    {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            )}
            {clinic.professionals.length > 0 && profs.length === 0 && <div className="pt-msg">No encontramos a nadie con esa búsqueda. Probá con otro nombre o especialidad.</div>}
            {profs.slice(0, MAX_LIST).map((p) => (
              <button key={p.id} className={`pt-prof ${prof?.id === p.id ? "is-on" : ""}`} onClick={() => chooseProf(p)}>
                <span className="mr-avatar" style={{ background: p.color }}>{initials(p.name)}</span>
                <span className="pt-prof-text">
                  <strong>{p.name}</strong>
                  <small>{[p.specialty, isCircle && p.license ? (/^\d/.test(p.license) ? `Mat. ${p.license}` : p.license) : ""].filter(Boolean).join(" · ")}</small>
                  {p.bio && <small>{p.bio}</small>}
                </span>
                {p.price != null ? <em>{money(p.price)}</em> : p.deposit ? <em>Seña {money(p.deposit)}</em> : <em className="pt-prof-go" aria-hidden="true">›</em>}
              </button>
            ))}
            {profs.length > MAX_LIST && <p className="pt-more">Mostramos {MAX_LIST} de {profs.length}. Usá el buscador para encontrar a los demás.</p>}
          </>)}

          {step === 2 && prof && (<>
            <div className="pt-step-label">Paso 2 de 3</div>
            <h2>Elegí día y horario</h2>
            <p>Con <b>{prof.name}</b> · turnos de {prof.slot_minutes} min. <button className="mr-link" onClick={() => setStep(1)}>Cambiar</button></p>
            {loadingAvail || !avail ? <p>Buscando horarios…</p> : (<>
              <div className="pt-days">
                {avail.days.map((d) => {
                  const dt = parseDay(d.date);
                  return (
                    <button key={d.date} className={`pt-day ${day === d.date ? "is-on" : ""}`} disabled={!d.slots.length} onClick={() => { setDay(d.date); setTime(""); }}>
                      <small>{DOW[dt.getDay()]}</small><b>{dt.getDate()}</b><em>{d.slots.length ? `${d.slots.length} libres` : "sin turnos"}</em>
                    </button>
                  );
                })}
              </div>
              {avail.days.every((d) => !d.slots.length) ? <div className="pt-msg">No hay turnos libres en estos días. Probá más adelante o comunicate con {place}.</div> : dayInfo && (
                <>
                  <p style={{ margin: "14px 0 0", fontWeight: 700 }}>{longDate(parseDay(day))}</p>
                  <div className="pt-slots">
                    {dayInfo.slots.map((s) => <button key={s} className={`pt-slot ${time === s ? "is-on" : ""}`} onClick={() => setTime(s)}>{s}</button>)}
                  </div>
                </>
              )}
              {avail.days.length > 0 && avail.days[avail.days.length - 1].date < avail.last_day && (
                <button className="mr-link" style={{ marginTop: 12 }} onClick={() => { const last = parseDay(avail.days[avail.days.length - 1].date); last.setDate(last.getDate() + 1); loadAvail(prof, `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`); }}>Ver más días ›</button>
              )}
            </>)}
            {error && <div className="pt-error" style={{ marginTop: 12 }}>{error}</div>}
            <div style={{ marginTop: 16 }}><button className="pt-btn" disabled={!time} onClick={() => { setError(""); setStep(3); }}>Continuar</button></div>
          </>)}

          {step === 3 && prof && (<>
            <div className="pt-step-label">Paso 3 de 3</div>
            <h2>Tus datos</h2>
            <div className="pt-summary">
              <strong>{longDate(parseDay(day))} · {time} h</strong>
              <span>{prof.name}{prof.specialty ? ` · ${prof.specialty}` : ""}</span>
              <button className="mr-link" style={{ justifySelf: "start" }} onClick={() => setStep(2)}>Cambiar horario</button>
            </div>
            <div className="pt-row">
              <div className="pt-field"><label>Nombre</label><input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" /></div>
              <div className="pt-field"><label>Apellido</label><input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} autoComplete="family-name" /></div>
            </div>
            <div className="pt-row">
              <div className="pt-field"><label>DNI</label><input value={f.dni} onChange={(e) => set("dni", e.target.value)} inputMode="numeric" /></div>
              <div className="pt-field"><label>Celular <span>(para recordarte el turno)</span></label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" /></div>
            </div>
            <div className="pt-field"><label>Email <span>(opcional)</span></label><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></div>
            <div className={isCircle ? "" : "pt-row"}>
              {!isCircle && (
                <div className="pt-field"><label>Cobertura</label>
                  <select value={f.insurance_id} onChange={(e) => set("insurance_id", e.target.value)}>
                    <option value="">Particular</option>
                    {clinic.insurances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              )}
              {f.insurance_id ? <div className="pt-field"><label>N° de afiliado</label><input value={f.insurance_number} onChange={(e) => set("insurance_number", e.target.value)} /></div>
                : <div className="pt-field"><label>Es tu…</label>
                  <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>
                    <option value="PRIMERA_VEZ">Primera vez</option><option value="CONSULTA">Consulta</option><option value="CONTROL">Control</option>
                  </select></div>}
            </div>
            {f.insurance_id && (
              <div className="pt-field"><label>Es tu…</label>
                <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>
                  <option value="PRIMERA_VEZ">Primera vez</option><option value="CONSULTA">Consulta</option><option value="CONTROL">Control</option>
                </select></div>
            )}
            <div className="pt-field"><label>Motivo <span>(opcional)</span></label><input value={f.reason} onChange={(e) => set("reason", e.target.value)} maxLength={255} /></div>
            {clinic.message && <div className="pt-msg">{clinic.message}</div>}
            {prof.deposit ? (
              <div className="pt-msg">
                Para confirmar el turno se paga una <b>seña de {money(prof.deposit)}</b> con Mercado Pago (se descuenta de la consulta).
                Tenés {clinic.deposit_hold_minutes} minutos para pagarla; si no, el horario se libera.
              </div>
            ) : null}
            {error && <div className="pt-error">{error}</div>}
            <button className="pt-btn" onClick={confirm} disabled={sending}>{sending ? "Reservando…" : prof.deposit ? `Reservar y pagar seña ${money(prof.deposit)}` : "Confirmar turno"}</button>
            <p className="pt-consent">
              Al confirmar aceptás que {clinic.name} use estos datos para gestionar tu turno, según la{" "}
              <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad</a>.
              Podés cancelarlo online hasta {clinic.cancel_hours} h antes.
            </p>
          </>)}
        </div>

        <div className="pt-card">
          <h2>¿Ya tenés un turno?</h2>
          <p>Buscalo con el código que te dimos para verlo o cancelarlo.</p>
          <div className="pt-row">
            <div className="pt-field" style={{ marginBottom: 0 }}><input placeholder="Código (ej. K7P2QX)" value={lookup} onChange={(e) => setLookup(e.target.value.toUpperCase())} /></div>
            <button className="pt-btn pt-btn-ghost" disabled={lookup.trim().length < 4} onClick={() => navigate(`/t/${slug}/turno/${lookup.trim()}`)}>Buscar</button>
          </div>
        </div>
        <address className="pt-business">
          <strong>{clinic.name}</strong>
          {(clinic.address || clinic.city) && <span>{[clinic.address, clinic.city].filter(Boolean).join(", ")}</span>}
          {clinic.phone && <span>Tel. {clinic.phone}</span>}
          {clinic.email && <span>{clinic.email}</span>}
        </address>
      </main>
      <footer className="pt-foot"><PoweredBy /></footer>
    </div>
  );
}

export default Reservar;
