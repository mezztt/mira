import { useState } from "react";
import { appApi } from "../config";
import type { InsuranceItem, Patient } from "../config";
import { Field, Modal, strOrNull } from "./ui";

const EMPTY = {
  first_name: "", last_name: "", dni: "", birth_date: "", sex: "", phone: "", email: "", address: "", city: "",
  insurance_id: "", insurance_number: "", insurance_plan: "", blood_type: "", allergies: "", chronic: "",
  medications: "", background: "", emergency_contact: "", notes: "", active: true,
};

/** Alta / edición de la ficha del paciente */
export default function PatientForm({ patient, insurances, onClose, onSaved, canDeactivate }: {
  patient?: Patient | null; insurances: InsuranceItem[]; onClose: () => void; onSaved: (p: Patient) => void; canDeactivate?: boolean;
}) {
  const [f, setF] = useState(() => patient ? {
    ...EMPTY,
    ...Object.fromEntries(Object.entries(patient).map(([k, v]) => [k, v === null ? "" : v])),
    insurance_id: patient.insurance_id ? String(patient.insurance_id) : "",
    birth_date: patient.birth_date || "",
  } as typeof EMPTY : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setError("");
    if (!f.first_name.trim() || !f.last_name.trim()) return setError("Completá nombre y apellido");
    setSaving(true);
    const body: Record<string, unknown> = {};
    for (const k of Object.keys(EMPTY) as (keyof typeof EMPTY)[]) {
      const v = f[k];
      body[k] = typeof v === "string" ? strOrNull(v) : v;
    }
    body.insurance_id = f.insurance_id ? Number(f.insurance_id) : null;
    try {
      const saved = patient
        ? await appApi<Patient>(`/patients/${patient.id}`, { method: "PUT", body })
        : await appApi<Patient>("/patients", { method: "POST", body });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal eyebrow={patient ? "EDITAR FICHA" : "NUEVO PACIENTE"} title={patient ? patient.full_name : "Nuevo paciente"} onClose={onClose} size="wide"
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
      </>}>
      <div className="product-form">
        <h4 className="mr-form-title">Datos personales</h4>
        <div className="form-row">
          <Field label="Nombre"><input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} autoFocus /></Field>
          <Field label="Apellido"><input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="DNI"><input value={f.dni} onChange={(e) => set("dni", e.target.value)} inputMode="numeric" /></Field>
          <Field label="Fecha de nacimiento"><input type="date" value={f.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Sexo">
            <select value={f.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">X / otro</option>
            </select>
          </Field>
          <Field label="Celular"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Domicilio"><input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Localidad"><input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Contacto de emergencia"><input value={f.emergency_contact} onChange={(e) => set("emergency_contact", e.target.value)} placeholder="Nombre y teléfono" /></Field>
        </div>

        <h4 className="mr-form-title">Cobertura</h4>
        <div className="form-row">
          <Field label="Obra social / prepaga">
            <select value={f.insurance_id} onChange={(e) => set("insurance_id", e.target.value)}>
              <option value="">Particular</option>
              {insurances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          <Field label="N° de afiliado"><input value={f.insurance_number} onChange={(e) => set("insurance_number", e.target.value)} /></Field>
        </div>
        <Field label="Plan"><input value={f.insurance_plan} onChange={(e) => set("insurance_plan", e.target.value)} placeholder="Ej. 210, Oro…" /></Field>

        <h4 className="mr-form-title">Datos de salud</h4>
        <div className="form-row">
          <Field label="Alergias" hint="Se muestran en rojo en toda la ficha"><input value={f.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Penicilina, látex…" /></Field>
          <Field label="Grupo y factor"><input value={f.blood_type} onChange={(e) => set("blood_type", e.target.value)} placeholder="0+" /></Field>
        </div>
        <div className="form-row">
          <Field label="Enfermedades crónicas"><input value={f.chronic} onChange={(e) => set("chronic", e.target.value)} placeholder="HTA, diabetes…" /></Field>
          <Field label="Medicación habitual"><input value={f.medications} onChange={(e) => set("medications", e.target.value)} /></Field>
        </div>
        <Field label="Antecedentes (personales, familiares, quirúrgicos)">
          <textarea rows={3} value={f.background} onChange={(e) => set("background", e.target.value)} />
        </Field>
        <Field label="Notas administrativas"><input value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        {patient && canDeactivate && (
          <div className="mr-inline-checks"><label><input type="checkbox" checked={!f.active} onChange={(e) => set("active", !e.target.checked)} /> Paciente inactivo (no aparece en las búsquedas)</label></div>
        )}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
