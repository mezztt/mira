import { useEffect, useMemo, useState } from "react";
import { appApi, dayKey, money } from "../config";
import type { Member, Prestacion } from "../config";
import { Field, Modal, numOrNull, strOrNull } from "./ui";

export interface PayerLite { id: number; name: string; requires_authorization: boolean; active?: boolean }
export interface RateLite { code: string; description: string; amount: number }

/** Carga / corrección de una prestación (lo usan administración y el portal del médico) */
export default function PrestacionForm({ prest, base, members, payers, loadRates, onClose, onSaved }: {
  prest: Prestacion | null;
  base: "/prestaciones" | "/portal/prestaciones";
  members?: Member[];
  payers: PayerLite[];
  loadRates: (payerId: number) => Promise<RateLite[]>;
  onClose: () => void;
  onSaved: (p: Prestacion & { possible_duplicate?: boolean }, again: boolean) => void;
}) {
  const [memberId, setMemberId] = useState(prest ? String(prest.member_id) : "");
  const [payerId, setPayerId] = useState(prest ? String(prest.payer_id) : String(payers.find((p) => p.active !== false)?.id || ""));
  const [date, setDate] = useState(prest?.date || dayKey(new Date()));
  const [patient, setPatient] = useState(prest?.patient_name || "");
  const [dni, setDni] = useState(prest?.patient_dni || "");
  const [affiliate, setAffiliate] = useState(prest?.affiliate_number || "");
  const [code, setCode] = useState(prest?.code || "");
  const [quantity, setQuantity] = useState(String(prest?.quantity || 1));
  const [manual, setManual] = useState(false);
  const [unit, setUnit] = useState(prest ? String(prest.unit_amount) : "");
  const [authorization, setAuthorization] = useState(prest?.authorization || "");
  const [diagnosis, setDiagnosis] = useState(prest?.diagnosis || "");
  const [rates, setRates] = useState<RateLite[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!payerId) return;
    loadRates(Number(payerId)).then(setRates).catch(() => setRates([]));
  }, [payerId, loadRates]);

  const payer = payers.find((p) => String(p.id) === payerId);
  const rate = useMemo(() => rates.find((r) => r.code === code.trim()), [rates, code]);
  const unitValue = manual || !rate ? numOrNull(unit) : rate.amount;
  const total = (unitValue || 0) * (Number(quantity) || 1);

  async function save(again: boolean) {
    setError("");
    if (members && !memberId) return setError("Elegí el médico");
    if (!payerId) return setError("Elegí el convenio");
    setSaving(true);
    try {
      const body = {
        member_id: members ? Number(memberId) : null, payer_id: Number(payerId), date,
        patient_name: patient.trim(), patient_dni: strOrNull(dni), affiliate_number: strOrNull(affiliate),
        code: code.trim(), description: rate ? null : strOrNull(prest && prest.code === code.trim() ? prest.description || "" : ""),
        quantity: Number(quantity) || 1, unit_amount: manual || !rate ? numOrNull(unit) : null,
        authorization: strOrNull(authorization), diagnosis: strOrNull(diagnosis),
      };
      const saved = prest
        ? await appApi<Prestacion & { possible_duplicate?: boolean }>(`${base}/${prest.id}`, { method: "PUT", body })
        : await appApi<Prestacion & { possible_duplicate?: boolean }>(base, { method: "POST", body });
      onSaved(saved, again);
      if (again) { setPatient(""); setDni(""); setAffiliate(""); setAuthorization(""); setDiagnosis(""); setQuantity("1"); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal eyebrow={prest ? "CORREGIR PRESTACIÓN" : "CARGAR PRESTACIÓN"} title={prest ? `${prest.patient_name} · ${prest.code}` : "Nueva prestación"} onClose={onClose} size="wide"
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cerrar</button>
        {!prest && <button className="secondary-button" onClick={() => save(true)} disabled={saving}>Guardar y cargar otra</button>}
        <button className="primary-button" onClick={() => save(false)} disabled={saving}>{saving ? "Guardando..." : prest ? "Guardar corrección" : "Guardar"}</button>
      </>}>
      <div className="product-form">
        {prest?.observation && <div className="mr-note mr-note-warn" style={{ marginBottom: 12 }}>Observación de auditoría: {prest.observation}</div>}
        <div className="form-row">
          {members ? (
            <Field label="Médico">
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} autoFocus={!prest}>
                <option value="">Elegí…</option>
                {members.filter((m) => m.active || String(m.id) === memberId).map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.license ? ` · MP ${m.license}` : ""}</option>)}
              </select>
            </Field>
          ) : <Field label="Fecha de la prestación"><input type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} /></Field>}
          <Field label="Obra social / convenio">
            <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
              {payers.filter((p) => p.active !== false || String(p.id) === payerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        {members && <Field label="Fecha de la prestación"><input type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} /></Field>}
        <div className="form-row">
          <Field label="Paciente (apellido y nombre)"><input value={patient} onChange={(e) => setPatient(e.target.value)} autoFocus={!members && !prest} /></Field>
          <Field label="N° de afiliado"><input value={affiliate} onChange={(e) => setAffiliate(e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="DNI (opcional)"><input value={dni} onChange={(e) => setDni(e.target.value)} /></Field>
          <Field label={`Autorización${payer?.requires_authorization ? " (obligatoria)" : ""}`}><input value={authorization} onChange={(e) => setAuthorization(e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Código de práctica" hint={rate ? `${rate.description} · ${money(rate.amount)}` : code ? "No está en el nomenclador: cargá el valor a mano" : `${rates.length} códigos en el nomenclador`}>
            <input value={code} onChange={(e) => setCode(e.target.value)} list="mr-rates" placeholder="420101" />
            <datalist id="mr-rates">{rates.map((r) => <option key={r.code} value={r.code}>{r.description} · {money(r.amount)}</option>)}</datalist>
          </Field>
          <Field label="Cantidad"><input type="number" min="1" max="999" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Valor unitario">
            {rate && !manual ? (
              <div className="mr-row"><strong>{money(rate.amount)}</strong><button type="button" className="mr-link" onClick={() => { setManual(true); setUnit(String(rate.amount)); }}>Cambiar</button></div>
            ) : (
              <div className="mr-input-suffix"><span>$</span><input type="number" min="0" step="0.01" value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
            )}
          </Field>
          <Field label="Diagnóstico (opcional)"><input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>
        </div>
        <div className="mr-spread" style={{ padding: "8px 2px" }}><span className="mr-muted">Total de la prestación</span><span className="mr-total-big">{money(total)}</span></div>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
