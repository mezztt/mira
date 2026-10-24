import { useState } from "react";
import { appApi, money, CHARGE_KINDS, PAYMENT_LABELS, PAYMENT_METHODS } from "../config";
import type { Appointment, InsuranceItem, Professional } from "../config";
import { Field, Modal, numOrNull, strOrNull } from "./ui";

/** Registrar un cobro: particular, coseguro o prestación a presentar a la obra social. */
export default function ChargeModal({ appointment, patientId, patientName, professionals, insurances, defaultProfessionalId, onClose, onSaved }: {
  appointment?: Appointment | null;
  patientId?: number | null;
  patientName?: string;
  professionals: Professional[];
  insurances: InsuranceItem[];
  defaultProfessionalId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ins = insurances.find((i) => i.id === appointment?.insurance_id) || null;
  const prof = professionals.find((p) => p.id === (appointment?.professional_id || defaultProfessionalId)) || null;
  const initialKind = ins ? (ins.copay ? "COSEGURO" : "OBRA_SOCIAL") : "PARTICULAR";
  const [kind, setKind] = useState<string>(initialKind);
  const [professionalId, setProfessionalId] = useState<string>(String(prof?.id || ""));
  const [insuranceId, setInsuranceId] = useState<string>(String(ins?.id || ""));
  const [concept, setConcept] = useState(appointment ? `Consulta ${appointment.kind === "PRACTICA" ? "· práctica" : ""}`.trim() : "Consulta");
  const [amount, setAmount] = useState<string>(() => defaultAmount(initialKind, ins, prof));
  const [method, setMethod] = useState("EFECTIVO");
  const [practiceCode, setPracticeCode] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function defaultAmount(k: string, i: InsuranceItem | null, p: Professional | null): string {
    if (k === "COSEGURO" && i?.copay) return String(i.copay);
    if (k === "OBRA_SOCIAL" && i?.consult_value) return String(i.consult_value);
    if (k === "PARTICULAR" && p?.consult_price) return String(p.consult_price);
    return "";
  }

  function changeKind(k: string) {
    setKind(k);
    const i = insurances.find((x) => String(x.id) === insuranceId) || ins;
    const p = professionals.find((x) => String(x.id) === professionalId) || prof;
    setAmount(defaultAmount(k, i, p));
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      await appApi("/charges", {
        method: "POST",
        body: {
          appointment_id: appointment?.id || null,
          patient_id: appointment?.patient_id || patientId || null,
          professional_id: numOrNull(professionalId),
          insurance_id: kind === "PARTICULAR" ? null : numOrNull(insuranceId),
          kind, concept: concept.trim() || "Consulta", amount: numOrNull(amount) ?? 0,
          method: kind === "OBRA_SOCIAL" ? null : method,
          practice_code: strOrNull(practiceCode), authorization: strOrNull(authorization),
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal eyebrow="COBRO" title={appointment?.patient_name || patientName || "Nuevo cobro"} onClose={onClose}
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : kind === "OBRA_SOCIAL" ? "Registrar prestación" : `Cobrar ${amount ? money(amount) : ""}`}</button>
      </>}>
      <div className="product-form">
        <div className="mr-seg" style={{ marginBottom: 12 }}>
          {Object.entries(CHARGE_KINDS).map(([k, label]) => (
            <button key={k} type="button" className={kind === k ? "is-on" : ""} onClick={() => changeKind(k)}>{label}</button>
          ))}
        </div>
        <p className="mr-muted" style={{ marginTop: 0 }}>
          {kind === "PARTICULAR" && "El paciente paga la consulta completa."}
          {kind === "COSEGURO" && "El paciente paga el coseguro; la consulta se presenta a la obra social aparte."}
          {kind === "OBRA_SOCIAL" && "No entra plata ahora: queda pendiente para presentar a la obra social a fin de mes."}
        </p>
        <div className="form-row">
          <Field label="Profesional">
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">—</option>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {kind !== "PARTICULAR" ? (
            <Field label="Obra social / prepaga">
              <select value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
                <option value="">Elegí…</option>
                {insurances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
          ) : <Field label="Concepto"><input value={concept} onChange={(e) => setConcept(e.target.value)} /></Field>}
        </div>
        {kind !== "PARTICULAR" && (
          <div className="form-row">
            <Field label="Concepto"><input value={concept} onChange={(e) => setConcept(e.target.value)} /></Field>
            <Field label="Código de práctica" hint="Opcional (nomenclador)"><input value={practiceCode} onChange={(e) => setPracticeCode(e.target.value)} placeholder="420101" /></Field>
          </div>
        )}
        <div className="form-row">
          <Field label={kind === "OBRA_SOCIAL" ? "Valor de la prestación" : "Monto"}>
            <div className="mr-input-suffix"><span>$</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </Field>
          {kind === "OBRA_SOCIAL"
            ? <Field label="N° de autorización" hint="Si la obra social la pide"><input value={authorization} onChange={(e) => setAuthorization(e.target.value)} /></Field>
            : <div />}
        </div>
        {kind !== "OBRA_SOCIAL" && (
          <Field label="Medio de pago">
            <div className="mr-method-grid">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} type="button" className={`mr-method ${method === m ? "is-on" : ""}`} onClick={() => setMethod(m)}>{PAYMENT_LABELS[m]}</button>
              ))}
            </div>
          </Field>
        )}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
