import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { appApi, dateTime, longDate, money, shortDate, BUDGET_STATUS, PAYMENT_LABELS } from "../../config";
import type { Budget } from "../../config";
import { Loading } from "../../components/ui";
import { PrintToolbar, SheetHead } from "./PrintDocumento";

function PrintPresupuesto() {
  const { id } = useParams();
  const [b, setB] = useState<Budget | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { appApi<Budget>(`/budgets/${id}`).then(setB).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => { if (b) document.title = `Presupuesto N° ${b.number} · ${b.patient.name}`; }, [b]);

  if (error) return <div className="mr-print-page"><div className="mr-note mr-note-error">{error}</div></div>;
  if (!b) return <Loading />;
  const n = Math.max(1, b.installments || 1);
  const accepted = b.status === "ACEPTADO" || b.status === "FINALIZADO";

  return (
    <div className="mr-print-page">
      <PrintToolbar title={`Presupuesto N° ${b.number}`} />
      <div className="mr-sheet">
        <SheetHead company={b.company} right={<><strong>PRESUPUESTO N° {b.number}</strong><small>{longDate(new Date(b.created_at))}</small>
          {b.status !== "BORRADOR" && b.status !== "PRESENTADO" && <small>{BUDGET_STATUS[b.status].label}</small>}</>} />
        <div className="mr-sheet-meta">
          <div><small>Paciente</small>{b.patient.name}</div>
          <div><small>DNI</small>{b.patient.dni || "—"}</div>
          <div><small>Profesional</small>{b.professional ? b.professional.name : "—"}</div>
          <div><small>Válido hasta</small>{b.valid_until ? shortDate(b.valid_until) : "—"}</div>
        </div>
        {b.title && <h2>{b.title}</h2>}
        <table>
          <thead><tr><th>Descripción</th><th>Pieza</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {b.items.map((i) => (
              <tr key={i.id}>
                <td>{i.description}{accepted && i.done ? " ✓" : ""}</td>
                <td>{i.tooth ? `${i.tooth}${i.surface ? ` · ${i.surface}` : ""}` : "—"}</td>
                <td className="num">{i.quantity}</td><td className="num">{money(i.unit_price)}</td><td className="num">{money(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14, marginLeft: "auto", maxWidth: 320 }}>
          {b.discount_percent > 0 && <div className="mr-print-sum"><span>Subtotal</span><span>{money(b.subtotal)}</span></div>}
          {b.discount_percent > 0 && <div className="mr-print-sum"><span>Descuento {b.discount_percent}%</span><span>− {money(b.discount_amount)}</span></div>}
          <div className="mr-print-sum is-total"><span>Total</span><span>{money(b.total)}</span></div>
          {b.paid > 0 && <div className="mr-print-sum"><span>Pagado</span><span>{money(b.paid)}</span></div>}
          {b.paid > 0 && <div className="mr-print-sum"><span>Saldo</span><span>{money(b.balance)}</span></div>}
        </div>
        {n > 1 && <p style={{ textAlign: "right" }}>Forma de pago sugerida: {n} cuotas de <strong>{money(b.installment_value)}</strong>.</p>}
        {b.notes && <p style={{ whiteSpace: "pre-line" }}><strong>Notas:</strong> {b.notes}</p>}
        {b.payments.length > 0 && (
          <>
            <h2>Pagos recibidos</h2>
            <table>
              <thead><tr><th>Fecha</th><th>Medio</th><th>Nota</th><th className="num">Monto</th></tr></thead>
              <tbody>{b.payments.map((p) => <tr key={p.id}><td>{dateTime(p.date)}</td><td>{PAYMENT_LABELS[p.method] || p.method}</td><td>{p.notes || "—"}</td><td className="num">{money(p.amount)}</td></tr>)}</tbody>
            </table>
          </>
        )}
        <div className="mr-signature-line" style={{ justifyContent: "space-between", gap: 24 }}>
          <div>Conformidad del paciente</div>
          <div>
            <strong>{b.professional ? b.professional.name : b.company.name}</strong><br />
            {b.professional ? `${b.professional.specialty || ""}${b.professional.license ? ` · MP ${b.professional.license}` : ""}` : ""}
          </div>
        </div>
        <div className="mr-sheet-foot">
          <span>Los valores pueden modificarse después de la fecha de validez. Documento no válido como factura.</span>
          <span>MIRA · by Mezztt</span>
        </div>
      </div>
    </div>
  );
}

export default PrintPresupuesto;
