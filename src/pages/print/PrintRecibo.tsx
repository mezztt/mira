import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { appApi, money, shortDate, periodLabel, longDate, TAX_LABELS } from "../../config";
import type { Member, Prestacion } from "../../config";
import { Loading } from "../../components/ui";
import { PrintToolbar, SheetHead } from "./PrintDocumento";
import type { Line } from "../app/circulo/Liquidaciones";

interface Receipt {
  settlement: { id: number; number: number; period: string; status: string; closed_at: string | null };
  line: Line; member: Member | null;
  by_payer: { payer_name: string; count: number; total: number; debits: number }[];
  prestaciones: Prestacion[];
  company: { name: string; cuit: string | null; address: string | null };
}

function PrintRecibo({ portal = false }: { portal?: boolean }) {
  const { sid, lineId } = useParams();
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(false);
  useEffect(() => {
    const path = portal ? `/portal/settlements/${lineId}` : `/settlements/${sid}/lines/${lineId}/receipt`;
    appApi<Receipt>(path).then(setR).catch((e) => setError(e.message));
  }, [portal, sid, lineId]);
  useEffect(() => { if (r) document.title = `Liquidación ${r.settlement.number} · ${r.line.member_name}`; }, [r]);

  if (error) return <div className="mr-print-page"><div className="mr-note mr-note-error">{error}</div></div>;
  if (!r) return <Loading />;
  const l = r.line;

  return (
    <div className="mr-print-page">
      <PrintToolbar title="Recibo de liquidación" />
      <div className="mr-print-toolbar no-print" style={{ justifyContent: "center" }}>
        <label className="mr-inline-checks"><input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /> Incluir el detalle de prestaciones</label>
      </div>
      <div className="mr-sheet">
        <SheetHead company={r.company} right={<><strong>LIQUIDACIÓN N° {r.settlement.number}</strong><small>Período {periodLabel(r.settlement.period)}</small>
          {r.settlement.closed_at && <small>{longDate(new Date(r.settlement.closed_at))}</small>}</>} />
        <div className="mr-sheet-meta">
          <div><small>Médico</small>{l.member_name}</div>
          <div><small>Matrícula</small>{l.member_license || "—"}</div>
          <div><small>CUIT</small>{l.cuit || "—"}</div>
          <div><small>Condición</small>{TAX_LABELS[l.tax_condition || ""] || "—"}</div>
          <div><small>CBU / alias</small>{l.bank_alias || l.cbu || "—"}</div>
          <div><small>Estado</small>{l.paid ? `Transferido${l.paid_at ? ` el ${shortDate(l.paid_at)}` : ""}${l.payment_ref ? ` · ${l.payment_ref}` : ""}` : "A transferir"}</div>
        </div>

        <h2>Por obra social</h2>
        <table>
          <thead><tr><th>Convenio</th><th className="num">Prestaciones</th><th className="num">Facturado</th><th className="num">Débitos</th><th className="num">Cobrado</th></tr></thead>
          <tbody>{r.by_payer.map((p) => (
            <tr key={p.payer_name}><td>{p.payer_name}</td><td className="num">{p.count}</td><td className="num">{money(p.total)}</td><td className="num">{p.debits ? `−${money(p.debits)}` : "—"}</td><td className="num">{money(p.total - p.debits)}</td></tr>
          ))}</tbody>
        </table>

        <h2>Liquidación</h2>
        <div className="mr-sum-row"><span>Honorarios cobrados ({l.prestaciones_count} prestaciones)</span><span>{money(l.gross)}</span></div>
        <div className="mr-sum-row is-minus"><span>Gasto administrativo</span><span>−{money(l.admin_fee)}</span></div>
        {l.membership_fee > 0 && <div className="mr-sum-row is-minus"><span>Cuota societaria</span><span>−{money(l.membership_fee)}</span></div>}
        {l.ganancias > 0 && <div className="mr-sum-row is-minus"><span>Retención Ganancias</span><span>−{money(l.ganancias)}</span></div>}
        {l.iibb > 0 && <div className="mr-sum-row is-minus"><span>Retención Ingresos Brutos</span><span>−{money(l.iibb)}</span></div>}
        {l.other_deductions > 0 && <div className="mr-sum-row is-minus"><span>{l.other_concept || "Otros descuentos"}</span><span>−{money(l.other_deductions)}</span></div>}
        <div className="mr-sum-row is-total"><span>Neto a cobrar</span><span>{money(l.net)}</span></div>

        {detail && (<>
          <h2>Detalle de prestaciones</h2>
          <table>
            <thead><tr><th>Fecha</th><th>Paciente</th><th>Convenio</th><th>Código</th><th className="num">Total</th><th className="num">Débito</th></tr></thead>
            <tbody>{r.prestaciones.map((p) => (
              <tr key={p.id}><td>{shortDate(p.date)}</td><td>{p.patient_name}</td><td>{p.payer_name}</td><td>{p.code}</td><td className="num">{money(p.total)}</td><td className="num">{p.debit_amount ? money(p.debit_amount) : "—"}</td></tr>
            ))}</tbody>
          </table>
        </>)}
        <div className="mr-sheet-foot"><span>Comprobante interno de liquidación de honorarios · Documento no válido como factura</span><span>MIRA · by Mezztt</span></div>
      </div>
    </div>
  );
}

export default PrintRecibo;
