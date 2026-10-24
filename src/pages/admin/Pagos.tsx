import { useEffect, useMemo, useState } from "react";
import { adminApi, money, shortDate } from "../../config";
import type { PaymentItem, SystemItem } from "../../config";

function Pagos() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemFilter, setSystemFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        adminApi<PaymentItem[]>("/admin/payments"),
        adminApi<SystemItem[]>("/admin/systems"),
      ]);
      setPayments(p);
      setSystems(s);
    } catch {
      console.error("No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function removePayment(id: number) {
    if (!confirm("¿Eliminar este pago? No se puede deshacer.")) return;
    try {
      await adminApi(`/admin/payments/${id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo eliminar.");
    }
  }

  const systemName = (id: number) => systems.find((s) => s.id === id)?.name || `Sistema #${id}`;

  const months = useMemo(
    () => Array.from(new Set(payments.map((p) => p.payment_date.slice(0, 7)))).sort().reverse(),
    [payments]
  );

  const filtered = payments.filter((p) =>
    (!systemFilter || p.company_id === Number(systemFilter)) &&
    (!monthFilter || p.payment_date.startsWith(monthFilter))
  );
  const total = filtered.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT · MIRA</span>
          <h1>Pagos</h1>
          <p>Todo lo que te pagaron los consultorios y círculos.</p>
        </div>
      </div>

      <div className="dashboard-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="dashboard-card"><span>Total (filtro actual)</span><strong>{money(total)}</strong></div>
        <div className="dashboard-card"><span>Pagos</span><strong>{filtered.length}</strong></div>
        <div className="dashboard-card"><span>Promedio por pago</span><strong>{money(filtered.length ? total / filtered.length : 0)}</strong></div>
      </div>

      <div className="mr-toolbar">
        <div className="mr-filters">
          <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)}>
            <option value="">Todos los sistemas</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">Todos los meses</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
        ) : filtered.length === 0 ? (
          <div className="mr-empty"><strong>No hay pagos para mostrar</strong>Los pagos se cargan desde la ficha de cada sistema.</div>
        ) : (
          <div className="mr-table-wrap">
            <table className="mr-table">
              <thead><tr><th>Fecha</th><th>Sistema</th><th className="num">Monto</th><th>Método</th><th>Notas</th><th></th></tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{shortDate(p.payment_date)}</td>
                    <td>{systemName(p.company_id)}</td>
                    <td className="num"><strong>{money(p.amount)}</strong></td>
                    <td>{p.method || "—"}</td>
                    <td>{p.notes || "—"}</td>
                    <td className="num"><button className="mr-link mr-link-danger" onClick={() => removePayment(p.id)}>Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default Pagos;
