import { useEffect, useState } from "react";
import { appApi, canAccess, getSessionUser, money } from "../../config";
import type { Budget, BudgetItem, Practice, Professional } from "../../config";
import { Field, Modal, numOrNull, strOrNull } from "../ui";

interface Row { practice_id: number | null; description: string; tooth: number | null; surface: string | null; condition: string | null; quantity: string; unit_price: string }
interface PatientHit { id: number; full_name: string; dni: string | null; phone: string | null }

const toRow = (i: BudgetItem): Row => ({
  practice_id: i.practice_id, description: i.description, tooth: i.tooth, surface: i.surface, condition: i.condition,
  quantity: String(i.quantity), unit_price: String(i.unit_price),
});
const emptyRow = (): Row => ({ practice_id: null, description: "", tooth: null, surface: null, condition: null, quantity: "1", unit_price: "" });

/** Armar o editar un presupuesto / plan de tratamiento (mientras está en borrador o presentado). */
export default function BudgetEditor({ budget, patientId, patientName, practices, professionals, onClose, onSaved }: {
  budget?: Budget | null; patientId?: number | null; patientName?: string;
  practices: Practice[]; professionals: Professional[];
  onClose: () => void; onSaved: (b: Budget) => void;
}) {
  const user = getSessionUser();
  const canOdonto = canAccess(user, "odontologia") && user?.role !== "RECEPCION";
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(
    budget ? { id: budget.patient_id, name: budget.patient_name || "" } : patientId ? { id: patientId, name: patientName || "" } : null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [professionalId, setProfessionalId] = useState(String(budget?.professional_id || user?.professional_id || ""));
  const [title, setTitle] = useState(budget?.title || "");
  const [rows, setRows] = useState<Row[]>(budget ? budget.items.map(toRow) : []);
  const [discount, setDiscount] = useState(budget ? String(budget.discount_percent || "") : "");
  const [installments, setInstallments] = useState(String(budget?.installments || 1));
  const [validUntil, setValidUntil] = useState(budget?.valid_until || "");
  const [notes, setNotes] = useState(budget?.notes || "");
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingTeeth, setLoadingTeeth] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    const term = q.trim();
    if (patient || term.length < 2) { setHits([]); return; }
    const t = window.setTimeout(() => {
      appApi<PatientHit[]>(`/budgets/patient-search?q=${encodeURIComponent(term)}`).then(setHits).catch(() => setHits([]));
    }, 220);
    return () => window.clearTimeout(t);
  }, [q, patient]);

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const subtotal = rows.reduce((a, r) => a + (numOrNull(r.unit_price) || 0) * (Math.max(1, Math.round(numOrNull(r.quantity) || 1))), 0);
  const pct = Math.min(100, Math.max(0, numOrNull(discount) || 0));
  const total = Math.round(subtotal * (100 - pct)) / 100;
  const cuotas = Math.min(60, Math.max(1, Math.round(numOrNull(installments) || 1)));

  function addPractice(id: string) {
    setPick("");
    const p = practices.find((x) => String(x.id) === id);
    if (p) setRows([...rows, { ...emptyRow(), practice_id: p.id, description: p.name, unit_price: String(p.price) }]);
  }

  async function fromOdontogram() {
    if (!patient) return setError("Primero elegí el paciente");
    setError(""); setInfo("");
    setLoadingTeeth(true);
    try {
      const sug = await appApi<BudgetItem[]>(`/patients/${patient.id}/budget-suggestions`);
      const key = (r: { tooth: number | null; surface: string | null; condition: string | null }) => `${r.tooth}-${r.surface}-${r.condition}`;
      const have = new Set(rows.filter((r) => r.tooth).map(key));
      const fresh = sug.filter((s) => !have.has(key(s)));
      if (sug.length === 0) setInfo("El odontograma no tiene tratamientos pendientes.");
      else if (fresh.length === 0) setInfo("Los tratamientos pendientes del odontograma ya están en el presupuesto.");
      else {
        setRows([...rows, ...fresh.map(toRow)]);
        const noPrice = fresh.filter((s) => !s.unit_price).length;
        setInfo(`Se agregaron ${fresh.length} renglones del odontograma.${noPrice ? ` ${noPrice} quedaron sin precio: completalos (o cargá esa práctica en la lista de precios).` : ""}`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el odontograma"); } finally { setLoadingTeeth(false); }
  }

  async function save() {
    setError("");
    if (!patient) return setError("Elegí el paciente");
    const items = rows.filter((r) => r.description.trim()).map((r) => ({
      practice_id: r.practice_id, description: r.description.trim(), tooth: r.tooth, surface: r.surface, condition: r.condition,
      quantity: Math.max(1, Math.round(numOrNull(r.quantity) || 1)), unit_price: numOrNull(r.unit_price) || 0,
    }));
    if (items.length === 0) return setError("Agregá al menos un renglón");
    setSaving(true);
    try {
      const body = {
        patient_id: patient.id, professional_id: numOrNull(professionalId), title: strOrNull(title), notes: strOrNull(notes),
        discount_percent: pct, installments: cuotas, valid_until: validUntil || null, items,
      };
      const b = await appApi<Budget>(budget ? `/budgets/${budget.id}` : "/budgets", { method: budget ? "PUT" : "POST", body });
      onSaved(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal eyebrow={budget ? `PRESUPUESTO N° ${budget.number}` : "NUEVO PRESUPUESTO"} title={patient ? patient.name : "Presupuesto"} onClose={onClose} size="xl"
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar presupuesto"}</button>
      </>}>
      <div className="product-form">
        {!patient && (
          <Field label="Paciente">
            <div className="mr-patient-pick">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá por nombre, apellido o DNI…" autoFocus />
            {q.trim().length >= 2 && (
              <div className="mr-patient-results">
                {hits.length === 0 ? <button type="button" disabled><small>Sin resultados</small></button> : hits.map((h) => (
                  <button key={h.id} type="button" onClick={() => { setPatient({ id: h.id, name: h.full_name }); setQ(""); }}>
                    <strong>{h.full_name}</strong> <small>{h.dni ? `DNI ${h.dni}` : ""}</small>
                  </button>
                ))}
              </div>
            )}
            </div>
          </Field>
        )}
        {patient && !budget && !patientId && (
          <p className="mr-muted" style={{ margin: 0 }}>Paciente: <strong>{patient.name}</strong> · <button type="button" className="mr-link" onClick={() => setPatient(null)}>Cambiar</button></p>
        )}
        <div className="form-row">
          <Field label="Título (opcional)"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Plan de tratamiento 2026" maxLength={150} /></Field>
          <Field label="Profesional">
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={user?.role === "PROFESIONAL"}>
              <option value="">Sin profesional</option>
              {professionals.filter((p) => p.active || String(p.id) === professionalId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <h4 className="mr-form-title">Renglones</h4>
        <div className="mr-row">
          {canOdonto && <button type="button" className="secondary-button" onClick={fromOdontogram} disabled={loadingTeeth}>{loadingTeeth ? "Leyendo odontograma..." : "Armar desde el odontograma"}</button>}
          <select className="mr-select" value={pick} onChange={(e) => addPractice(e.target.value)} aria-label="Agregar de la lista de precios">
            <option value="">+ Agregar de la lista de precios…</option>
            {practices.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
          </select>
          <button type="button" className="secondary-button" onClick={() => setRows([...rows, emptyRow()])}>+ Renglón libre</button>
        </div>
        {info && <div className="mr-note mr-note-info">{info}</div>}

        {rows.length === 0 ? <p className="mr-muted">Todavía no hay renglones. Agregá prácticas de la lista, texto libre{canOdonto ? " o traé los pendientes del odontograma" : ""}.</p> : (
          <div className="mr-table-wrap">
            <table className="mr-table mr-budget-rows">
              <thead><tr><th>Descripción</th><th>Pieza</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} maxLength={200} aria-label="Descripción" placeholder="Práctica o tratamiento" /></td>
                    <td>{r.tooth ? `${r.tooth}${r.surface ? ` · ${r.surface}` : ""}` : "—"}</td>
                    <td className="num"><input type="number" min="1" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} aria-label="Cantidad" style={{ width: 70 }} /></td>
                    <td className="num"><input type="number" min="0" value={r.unit_price} onChange={(e) => setRow(i, { unit_price: e.target.value })} aria-label="Precio" className="mr-amount-in" placeholder="0" /></td>
                    <td className="num">{money((numOrNull(r.unit_price) || 0) * Math.max(1, Math.round(numOrNull(r.quantity) || 1)))}</td>
                    <td className="num"><button type="button" className="mr-link mr-link-danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-row">
          <Field label="Descuento"><div className="mr-input-suffix"><input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /><span>%</span></div></Field>
          <Field label="Válido hasta"><input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Cantidad de cuotas" hint="Solo calcula el valor sugerido de cada cuota; no genera vencimientos.">
            <input type="number" min="1" max="60" value={installments} onChange={(e) => setInstallments(e.target.value)} />
          </Field>
          <Field label="Notas para el paciente"><input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Ej. no incluye prótesis" /></Field>
        </div>

        <div>
          <div className="mr-sum-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {pct > 0 && <div className="mr-sum-row is-minus"><span>Descuento {pct}%</span><span>− {money(subtotal - total)}</span></div>}
          <div className="mr-sum-row is-total"><span>Total</span><span>{money(total)}</span></div>
          {cuotas > 1 && <p className="mr-muted" style={{ textAlign: "right", margin: "6px 0 0" }}>{cuotas} cuotas de {money(Math.round((total / cuotas) * 100) / 100)}</p>}
        </div>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
