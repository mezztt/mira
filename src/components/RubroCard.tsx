import { useCallback, useEffect, useState } from "react";
import { appApi } from "../config";
import { Field } from "./ui";

interface Option { key: string; label: string; icon: string; tagline: string }
interface RubroInfo {
  rubro: string | null; label: string | null; options: Option[];
  starter: { available: boolean; total: { practices: number; templates: number }; pending: { practices: number; templates: number } };
}
interface StarterResult { added: { practices: number; templates: number }; skipped: string[] }

function plural(n: number, one: string, many: string) { return `${n} ${n === 1 ? one : many}`; }

/** Configuración · tipo de negocio del consultorio o círculo y sugerencias ya armadas (opcionales, solo agregan) */
export default function RubroCard({ show, fail }: { show: (m: string) => void; fail: (e: unknown) => void }) {
  const [info, setInfo] = useState<RubroInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { appApi<RubroInfo>("/company/rubro").then(setInfo).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);

  async function changeRubro(key: string) {
    setBusy(true);
    try {
      await appApi("/company", { method: "PUT", body: { rubro: key || null } });
      show(key ? "Tipo de negocio guardado" : "Tipo de negocio quitado");
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function loadStarter() {
    if (!info?.label || !confirm(`Se van a sumar las sugerencias de ${info.label}. Lo que ya cargaste no se toca ni se duplica. ¿Seguimos?`)) return;
    setBusy(true);
    try {
      const r = await appApi<StarterResult>("/company/starter", { method: "POST" });
      const parts = [
        r.added.practices ? plural(r.added.practices, "práctica", "prácticas") : "",
        r.added.templates ? plural(r.added.templates, "plantilla", "plantillas") : "",
      ].filter(Boolean);
      show(parts.length ? `Se agregaron ${parts.join(" y ")}` : "No había nada nuevo para agregar");
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  if (!info) return null;
  const pend = info.starter.pending;
  const nothingNew = pend.practices + pend.templates === 0;
  return (
    <div className="mr-card" style={{ marginTop: 16 }}>
      <div className="mr-card-head"><div><h2>Tipo de negocio</h2><p>Sirve para ofrecerte sugerencias de tu actividad. No cambia los módulos que tenés contratados.</p></div></div>
      <div className="product-form">
        <Field label="Mi tipo de negocio">
          <select value={info.rubro || ""} disabled={busy} onChange={(e) => changeRubro(e.target.value)}>
            <option value="">Sin elegir</option>
            {info.options.map((o) => <option key={o.key} value={o.key}>{o.icon} {o.label}</option>)}
          </select>
        </Field>
        {info.starter.available ? (
          <>
            <p className="mr-muted" style={{ margin: 0 }}>
              Las sugerencias de {info.label} traen {plural(info.starter.total.templates, "plantilla", "plantillas")} de documentos y evolución
              {info.starter.total.practices > 0 && <> y {plural(info.starter.total.practices, "práctica", "prácticas")} para tu lista (sin precio: los ponés vos)</>}.
              Son un punto de partida: las editás o borrás cuando quieras.
            </p>
            <button type="button" className="secondary-button" style={{ alignSelf: "flex-start" }} disabled={busy || nothingNew} onClick={loadStarter}>
              {nothingNew ? "Las sugerencias ya están cargadas" : `Cargar sugerencias de ${info.label}`}
            </button>
          </>
        ) : info.rubro ? (
          <p className="mr-muted" style={{ margin: 0 }}>Este tipo de negocio no trae datos para cargar de entrada.</p>
        ) : null}
      </div>
    </div>
  );
}
