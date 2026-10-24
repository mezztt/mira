import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, getSessionUser, money, PAYER_KINDS } from "../../../config";
import type { Payer, Rate } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Switch, numOrNull, strOrNull, useFlash } from "../../../components/ui";

function Convenios() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMINISTRADOR";
  const { show, fail, node: flash } = useFlash();
  const [payers, setPayers] = useState<Payer[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Payer | "new" | null>(null);
  const [rateForm, setRateForm] = useState<Rate | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [increase, setIncrease] = useState(false);

  const load = useCallback(() => {
    appApi<Payer[]>("/payers?include_inactive=true").then((p) => { setPayers(p); setSel((s) => s ?? p[0]?.id ?? null); }).catch(fail);
  }, [fail]);
  const loadRates = useCallback(() => {
    if (!sel) { setRates(null); return; }
    setRates(null);
    appApi<Rate[]>(`/payers/${sel}/rates`).then(setRates).catch(fail);
  }, [sel, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRates(); }, [loadRates]);

  const payer = payers?.find((p) => p.id === sel) || null;
  const visibleRates = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rates || []).filter((r) => !t || r.code.toLowerCase().includes(t) || r.description.toLowerCase().includes(t));
  }, [rates, q]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONVENIOS" title="Convenios y nomenclador" subtitle="Obras sociales, prepagas y ART con las que trabaja el círculo, con sus valores por código.">
        <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo convenio</button>
      </PageHeader>

      {!payers ? <Loading /> : payers.length === 0 ? <Empty title="Todavía no hay convenios">Cargá el primero (ej. PAMI, OSDE, APROSS) y después su nomenclador.</Empty> : (
        <div className="mr-odonto-panel mr-conv-panel">
          <div className="mr-card" style={{ padding: 10 }}>
            <ul className="mr-list">
              {payers.map((p) => (
                <li key={p.id} className="is-click" onClick={() => setSel(p.id)} style={sel === p.id ? { background: "var(--mr-teal-soft)" } : undefined}>
                  <div className="mr-list-main">
                    <strong>{p.name}</strong>
                    <small>{PAYER_KINDS[p.kind]} · {p.rates_count} códigos{!p.active ? " · inactivo" : ""}</small>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {payer && (
            <div>
              <div className="mr-card" style={{ marginBottom: 14 }}>
                <div className="mr-card-head">
                  <div>
                    <h2>{payer.name}</h2>
                    <p>{PAYER_KINDS[payer.kind]}{payer.cuit ? ` · CUIT ${payer.cuit}` : ""}{payer.code ? ` · código ${payer.code}` : ""}</p>
                  </div>
                  <button className="secondary-button" onClick={() => setEditing(payer)}>Editar convenio</button>
                </div>
                <div className="mr-row">
                  <Pill tone="teal">Paga a {payer.payment_days} días</Pill>
                  {payer.presentation_day && <Pill tone="blue">Presentar el día {payer.presentation_day}</Pill>}
                  <Pill tone="gray">Gasto adm. {payer.admin_fee_percent != null ? `${payer.admin_fee_percent}%` : "general"}</Pill>
                  {payer.requires_authorization && <Pill tone="orange">Exige autorización</Pill>}
                  {!payer.active && <Pill tone="red">Inactivo</Pill>}
                </div>
                {payer.notes && <p className="mr-muted" style={{ marginBottom: 0 }}>{payer.notes}</p>}
              </div>

              <div className="mr-toolbar">
                <input className="mr-search" placeholder="Buscar código o práctica…" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="mr-row">
                  <button className="secondary-button" onClick={() => setImporting(true)}>Importar nomenclador</button>
                  {isAdmin && <button className="secondary-button" onClick={() => setIncrease(true)}>Aumento %</button>}
                  <button className="primary-button" onClick={() => setRateForm("new")}>+ Código</button>
                </div>
              </div>
              {!rates ? <Loading /> : visibleRates.length === 0 ? <Empty title={q ? "Ningún código coincide" : "El nomenclador está vacío"}>Pegá la planilla con “Importar nomenclador”.</Empty> : (
                <div className="mr-table-wrap">
                  <table className="mr-table">
                    <thead><tr><th>Código</th><th>Práctica</th><th className="num">Valor</th><th className="num">Coseguro</th></tr></thead>
                    <tbody>
                      {visibleRates.map((r) => (
                        <tr key={r.id} className="is-click" onClick={() => setRateForm(r)}>
                          <td><span className="mr-code-sm">{r.code}</span></td><td>{r.description}</td>
                          <td className="num"><strong>{money(r.amount)}</strong></td><td className="num">{r.copay ? money(r.copay) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editing && <PayerForm payer={editing === "new" ? null : editing} onClose={() => setEditing(null)}
        onSaved={(p) => { setEditing(null); load(); setSel(p.id); show("Convenio guardado"); }} />}
      {rateForm && payer && <RateForm payerId={payer.id} rate={rateForm === "new" ? null : rateForm} onClose={() => setRateForm(null)}
        onSaved={() => { setRateForm(null); loadRates(); load(); show("Código guardado"); }} />}
      {importing && payer && <ImportRates payer={payer} onClose={() => setImporting(false)} onDone={(m) => { setImporting(false); loadRates(); load(); show(m); }} />}
      {increase && payer && <Increase payer={payer} onClose={() => setIncrease(false)} onDone={(m) => { setIncrease(false); loadRates(); show(m); }} />}
      {flash}
    </section>
  );
}

function PayerForm({ payer, onClose, onSaved }: { payer: Payer | null; onClose: () => void; onSaved: (p: Payer) => void }) {
  const [f, setF] = useState({
    name: payer?.name || "", code: payer?.code || "", cuit: payer?.cuit || "", kind: payer?.kind || "OBRA_SOCIAL",
    presentation_day: payer?.presentation_day ? String(payer.presentation_day) : "", payment_days: String(payer?.payment_days ?? 30),
    admin_fee_percent: payer?.admin_fee_percent != null ? String(payer.admin_fee_percent) : "", requires_authorization: payer?.requires_authorization ?? false,
    contact: payer?.contact || "", notes: payer?.notes || "", active: payer?.active ?? true,
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    try {
      const body = { ...f, code: strOrNull(f.code), cuit: strOrNull(f.cuit), contact: strOrNull(f.contact), notes: strOrNull(f.notes),
        presentation_day: numOrNull(f.presentation_day), payment_days: Number(f.payment_days) || 0, admin_fee_percent: numOrNull(f.admin_fee_percent) };
      onSaved(await appApi<Payer>(payer ? `/payers/${payer.id}` : "/payers", { method: payer ? "PUT" : "POST", body }));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="CONVENIO" title={payer ? payer.name : "Nuevo convenio"} onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <div className="form-row">
          <Field label="Nombre"><input value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
          <Field label="Tipo"><select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(PAYER_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        <div className="form-row">
          <Field label="CUIT"><input value={f.cuit} onChange={(e) => set("cuit", e.target.value)} /></Field>
          <Field label="Código de prestador"><input value={f.code} onChange={(e) => set("code", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Día de presentación" hint="Día del mes en que se presenta la facturación"><input type="number" min="1" max="31" value={f.presentation_day} onChange={(e) => set("presentation_day", e.target.value)} /></Field>
          <Field label="Plazo de pago"><div className="mr-input-suffix"><input type="number" min="0" value={f.payment_days} onChange={(e) => set("payment_days", e.target.value)} /><span>días</span></div></Field>
        </div>
        <div className="form-row">
          <Field label="Gasto administrativo propio" hint="Vacío = el general del círculo"><div className="mr-input-suffix"><input type="number" min="0" max="100" step="0.1" value={f.admin_fee_percent} onChange={(e) => set("admin_fee_percent", e.target.value)} /><span>%</span></div></Field>
          <Field label="Contacto"><input value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
        </div>
        <Field label="Notas"><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <Switch on={f.requires_authorization} onChange={(v) => set("requires_authorization", v)} label="Exige número de autorización" hint="No deja cargar prestaciones sin autorización" />
        {payer && <Switch on={f.active} onChange={(v) => set("active", v)} label="Activo" />}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function RateForm({ payerId, rate, onClose, onSaved }: { payerId: number; rate: Rate | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(rate?.code || "");
  const [description, setDescription] = useState(rate?.description || "");
  const [amount, setAmount] = useState(rate ? String(rate.amount) : "");
  const [copay, setCopay] = useState(rate?.copay ? String(rate.copay) : "");
  const [active, setActive] = useState(rate?.active ?? true);
  const [error, setError] = useState("");
  async function save() {
    try {
      await appApi(`/payers/${payerId}/rates`, { method: "POST", body: { code: code.trim(), description: description.trim(), amount: numOrNull(amount) ?? 0, copay: numOrNull(copay), active } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="NOMENCLADOR" title={rate ? `Código ${rate.code}` : "Nuevo código"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <div className="form-row">
          <Field label="Código"><input value={code} onChange={(e) => setCode(e.target.value)} disabled={!!rate} placeholder="420101" /></Field>
          <Field label="Valor"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div></Field>
        </div>
        <Field label="Práctica"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Consulta en consultorio" /></Field>
        <Field label="Coseguro (opcional)"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={copay} onChange={(e) => setCopay(e.target.value)} /></div></Field>
        {rate && <Switch on={active} onChange={setActive} label="Vigente" />}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function ImportRates({ payer, onClose, onDone }: { payer: Payer; onClose: () => void; onDone: (m: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  async function run() {
    setError("");
    try {
      const r = await appApi<{ created: number; updated: number; errors: string[] }>(`/payers/${payer.id}/rates/import`, { method: "POST", body: { text } });
      if (r.errors.length) setResult(r);
      else onDone(`Nomenclador importado: ${r.created} nuevos, ${r.updated} actualizados`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo importar"); }
  }
  return (
    <Modal eyebrow="IMPORTAR NOMENCLADOR" title={payer.name} onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button" onClick={run} disabled={text.trim().length < 3}>Importar</button></>}>
      <div className="product-form">
        <p className="mr-muted" style={{ marginTop: 0 }}>
          Copiá las columnas desde Excel y pegalas acá: <b>código · práctica · valor</b> (y opcional <b>coseguro</b>).
          Sirve separado por tabulación, punto y coma o coma. Los valores pueden venir como 1.500,50. Si el código ya existe, se actualiza.
        </p>
        <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={"420101;Consulta en consultorio;12.500\n420201;Consulta en domicilio;18.000"} style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }} />
        {result && (
          <div className="mr-note mr-note-warn">
            {result.created} nuevos, {result.updated} actualizados. Líneas con problemas:<br />{result.errors.join(" · ")}
            <div style={{ marginTop: 8 }}><button className="secondary-button" onClick={() => onDone(`Importado con ${result.errors.length} líneas salteadas`)}>Listo</button></div>
          </div>
        )}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function Increase({ payer, onClose, onDone }: { payer: Payer; onClose: () => void; onDone: (m: string) => void }) {
  const [percent, setPercent] = useState("");
  const [error, setError] = useState("");
  async function run() {
    try {
      const r = await appApi<{ updated: number }>(`/payers/${payer.id}/rates/increase`, { method: "POST", body: { percent: numOrNull(percent) } });
      onDone(`${r.updated} códigos actualizados ${percent}%`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo actualizar"); }
  }
  return (
    <Modal eyebrow="ACTUALIZAR VALORES" title={payer.name} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={run} disabled={!numOrNull(percent)}>Aplicar</button></>}>
      <div className="product-form">
        <p className="mr-muted" style={{ marginTop: 0 }}>Aplica el porcentaje a todos los códigos vigentes del convenio (para las actualizaciones de aranceles).</p>
        <Field label="Porcentaje"><div className="mr-input-suffix"><input type="number" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="8" autoFocus /><span>%</span></div></Field>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Convenios;
