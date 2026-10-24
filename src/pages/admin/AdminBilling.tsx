import { useEffect, useState } from "react";
import QuoteFlowModal from "../../components/QuoteFlowModal";
import BuzonCotizaciones from "../../components/BuzonCotizaciones";
import { API_URL as BUZON_API } from "../../config";
import { adminApi, money, moduleLabel, plansFor, priceBreakdown, usd, shortDate, splitList, EXTRA_MODULES, KIND_LABELS, MODULES_BY_KIND } from "../../config";
import type { BillingPrices, Kind, SystemItem } from "../../config";

const QUOTE_STATUSES = ["TODAS", "BORRADOR", "ENVIADA", "ACEPTADA", "RECHAZADA"];
const STATUS_LABEL = (s: string) => (s === "BORRADOR" ? "Nueva" : s.charAt(0) + s.slice(1).toLowerCase());
const TAB_LABEL: Record<string, string> = { TODAS: "Todas", BORRADOR: "Nuevas", ENVIADA: "Enviadas", ACEPTADA: "Aceptadas", RECHAZADA: "Rechazadas" };

type BillingSettings = BillingPrices;

const DEFAULT_MODULES: Record<Kind, string[]> = {
  CONSULTORIO: ["agenda", "pacientes", "historia_clinica"],
  CIRCULO: ["padron", "convenios", "prestaciones", "presentaciones", "liquidaciones"],
};

function ModuleCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
      <input type="checkbox" style={{ width: 14, height: 14, flexShrink: 0 }} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function toggle(list: string[], m: string) {
  return list.includes(m) ? list.filter((x) => x !== m) : [...list, m];
}

// Datos que llegan en el mensaje de la solicitud web: forma de uso (mensual o un solo pago) y POS pedido
function quoteTags(notes?: string | null) {
  const n = String(notes || "");
  const uso = (n.match(/Forma de uso: ([^·]+)/) || [])[1];
  const pos = (n.match(/POS: ([^·]+)/) || [])[1];
  return { uso: uso ? uso.trim() : "", pos: pos ? pos.trim() : "" };
}

function AdminBilling() {
  const [tab, setTab] = useState<"cotizaciones" | "facturas">("cotizaciones");
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [settings, setSettings] = useState<BillingSettings | null>(null);

  // nueva cotización
  const [clientName, setClientName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Kind>("CONSULTORIO");
  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES.CONSULTORIO);
  const [applyIva, setApplyIva] = useState(true);
  const [deliveryDate, setDeliveryDate] = useState("");

  // edición cotización
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  // facturas
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceSystemId, setInvoiceSystemId] = useState("");
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceOwnerName, setInvoiceOwnerName] = useState("");

  const [quoteFilter, setQuoteFilter] = useState("TODAS");
  const [invoiceFilter, setInvoiceFilter] = useState<"activos" | "inactivos">("activos");

  async function load() {
    const [q, i, s, bs] = await Promise.all([
      adminApi<any[]>("/admin/quotes").catch(() => []),
      adminApi<any[]>("/admin/invoices").catch(() => []),
      adminApi<SystemItem[]>("/admin/systems").catch(() => []),
      adminApi<BillingSettings>("/admin/billing-settings").catch(() => null),
    ]);
    setQuotes(q); setInvoices(i); setSystems(s); setSettings(bs);
  }
  useEffect(() => { load(); }, []);

  // vista previa de las dos cifras mientras armás la cotización: pago inicial y abono mensual
  const preview = (mods: string[], iva: boolean, k: Kind) => priceBreakdown(mods, k, settings, iva);
  const isQuote = (doc: any) => doc.client_name !== undefined;
  const kindOf = (doc: any): Kind => (doc.kind || systems.find((s) => s.id === doc.company_id)?.kind || "CONSULTORIO") as Kind;

  async function createQuote() {
    if (!clientName || !businessName) { alert("Completá cliente y consultorio / círculo."); return; }
    try {
      await adminApi("/admin/quotes", {
        method: "POST",
        body: { kind, client_name: clientName, business_name: businessName, email: email || null, modules, apply_iva: applyIva, delivery_date: deliveryDate || null },
      });
      setClientName(""); setBusinessName(""); setEmail(""); setModules(DEFAULT_MODULES[kind]); setDeliveryDate("");
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo crear");
    }
  }

  async function deleteQuote(id: number) {
    if (!confirm("¿Borrar esta cotización? No se puede deshacer.")) return;
    try {
      await adminApi(`/admin/quotes/${id}`, { method: "DELETE" });
      setSelectedQuote(null);
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo borrar");
    }
  }

  function openQuote(q: any) {
    setSelectedQuote(q);
  }

  /** Renglones del documento. Cotización: incluye la configuración (una sola vez). Factura mensual: no. */
  function buildLineItems(doc: any) {
    const k = kindOf(doc);
    const items: { label: string; price: number; once?: boolean }[] = isQuote(doc)
      ? [{ label: `Configuración inicial de MIRA ${KIND_LABELS[k]} (una sola vez)`, price: Number((k === "CIRCULO" ? settings?.circle_base_cost : settings?.base_cost) ?? 0), once: true }]
      : [];
    const webs: string[] = [];
    for (const m of [...new Set(splitList(doc.modules))]) {
      if (!MODULES_BY_KIND[k].includes(m)) continue;
      if (EXTRA_MODULES.includes(m)) webs.push(m);
      else items.push({ label: `Módulo ${moduleLabel(m, k)}`, price: Number(settings?.module_price ?? 0) });
    }
    // cada web se cobra aparte (el círculo puede tener el portal del médico y la web de turnos)
    for (const m of webs) items.push({ label: `Web: ${moduleLabel(m, k)}`, price: Number(settings?.web_price ?? 0) });
    // documentos emitidos con otros precios: el detalle siempre cierra con el subtotal guardado
    const diff = Number(doc.subtotal ?? 0) - items.reduce((a, it) => a + it.price, 0);
    if (Math.abs(diff) > 0.005) items.push({ label: "Ajuste (emitido con los precios de ese momento)", price: diff });
    return items;
  }

  function printDocument(title: string, docNumber: string, toName: string, businessLabel: string, doc: any) {
    const quote = isQuote(doc);
    const rows = buildLineItems(doc).map((it) => `
      <tr><td>${it.label}</td><td style="text-align:center">${it.once ? "una vez" : quote ? "inicial y por mes" : "mes"}</td>
      <td style="text-align:right">${money(it.price)}</td></tr>`).join("");
    const totals = quote ? `
          <table class="tot"><tbody>
            <tr><th></th><th>Pago inicial<br><small>una sola vez</small></th><th>Abono mensual<br><small>todos los meses</small></th></tr>
            <tr><td>Subtotal</td><td>${money(doc.subtotal)}</td><td>${money(doc.monthly_subtotal)}</td></tr>
            ${doc.apply_iva ? `<tr><td>IVA 21%</td><td>${money(doc.iva_amount)}</td><td>${money(doc.monthly_iva)}</td></tr>` : ""}
            <tr class="big"><td>Total</td><td>${money(doc.total)}</td><td>${money(doc.monthly_total)}</td></tr>
          </tbody></table>
          <table class="tot planes"><tbody>
            <tr><th colspan="2">Planes sobre el abono mensual${doc.apply_iva ? " (con IVA)" : ""}</th></tr>
            <tr><td>Mensual</td><td>${usd(doc.monthly_total)} por mes</td></tr>
            <tr><td>Trimestral</td><td>${usd(plansFor(doc.monthly_total).quarterly)} <small>(1 mes gratis)</small></td></tr>
            <tr><td>Anual</td><td>${usd(plansFor(doc.monthly_total).annual)} <small>(2 meses gratis, ahorrás ${usd(plansFor(doc.monthly_total).annualSaving)})</small></td></tr>
          </tbody></table>
          <p class="nota">El pago inicial se abona una sola vez y no tiene descuento; el abono mensual, todos los meses (o por trimestre o por año con el descuento indicado). Valores en dólares estadounidenses.</p>` : `
          <p>Subtotal: ${money(doc.subtotal)}</p>
          ${doc.apply_iva ? `<p>IVA 21%: ${money(doc.iva_amount)}</p>` : ""}
          <p><strong>Total del mes: ${money(doc.total)}</strong></p>
          <p class="nota">Abono mensual: módulos y webs contratados. Valores en dólares estadounidenses.</p>`;

    const html = `
      <html><head><title>${title} ${docNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 36px; color: #241f1b; }
        h1 { font-size: 22px; margin-bottom: 2px; }
        .sub { color: #6b5f54; font-size: 12px; margin-bottom: 24px; }
        .legal { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 11px; color: #4a4038; text-align: center; letter-spacing: .04em; text-transform: uppercase; }
        p { font-size: 13px; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; }
        th { background: #f4efe7; text-align: left; }
        .totales { margin-top: 16px; text-align: right; font-size: 14px; }
        .tot { width: auto; margin-left: auto; }
        .tot.planes { margin-top: 12px; }
        .tot th, .tot td { text-align: right; border: 0; border-bottom: 1px solid #ddd; padding: 6px 12px; background: none; }
        .tot small { font-weight: normal; color: #6b5f54; }
        .tot .big td { font-weight: bold; font-size: 14px; border-bottom: 0; }
        .nota { color: #6b5f54; font-size: 11px; margin-top: 10px; }
      </style></head>
      <body>
        <h1>MIRA · ${title}</h1>
        <div class="sub">N° ${docNumber} · ${new Date().toLocaleDateString("es-AR")}</div>
        <p><strong>Cliente:</strong> ${toName || "—"}</p>
        <p><strong>Consultorio / círculo:</strong> ${businessLabel}</p>
        <table>
          <thead><tr><th>Ítem</th><th style="text-align:center">Se cobra</th><th style="text-align:right">Precio</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totales">${totals}
        </div>
        <p class="legal">Documento no válido como factura</p>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Habilitá las ventanas emergentes."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  async function generateInvoice() {
    if (!invoiceSystemId) return;
    setGeneratingInvoice(true);
    try {
      await adminApi(`/admin/systems/${invoiceSystemId}/generate-invoice`, { method: "POST" });
      setShowInvoiceForm(false);
      setInvoiceSystemId("");
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo generar la factura.");
    } finally {
      setGeneratingInvoice(false);
    }
  }

  async function setInvoiceStatus(inv: any, status: string) {
    try {
      const updated = await adminApi(`/admin/invoices/${inv.id}/status`, { method: "PUT", body: { status } });
      setSelectedInvoice(updated);
      await load();
    } catch {
      alert("No se pudo actualizar.");
    }
  }

  async function openInvoice(inv: any) {
    setSelectedInvoice(inv);
    setInvoiceOwnerName("");
    try {
      const users = await adminApi<any[]>(`/admin/systems/${inv.company_id}/users`);
      const owner = users.find((u) => u.role === "ADMINISTRADOR") || users[0];
      if (owner) setInvoiceOwnerName(owner.name);
    } catch { /* sin titular */ }
  }

  const systemName = (id: number) => systems.find((s) => s.id === id)?.name || `Sistema #${id}`;
  const filteredQuotes = quotes.filter((q) => quoteFilter === "TODAS" || q.status === quoteFilter);
  const filteredInvoices = invoices.filter((inv) => {
    const archived = systems.find((s) => s.id === inv.company_id)?.archived ?? false;
    return invoiceFilter === "activos" ? !archived : archived;
  });

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT · MIRA</span>
          <h1>Facturación</h1>
          <p>Cotizaciones (pago inicial + abono mensual) para consultorios y círculos nuevos, y facturas mensuales.</p>
        </div>
        {tab === "facturas" && (
          <div className="products-header-actions">
            <button className="primary-button" onClick={() => setShowInvoiceForm(true)}>+ Nueva factura</button>
          </div>
        )}
      </div>

      <div className="product-actions" style={{ marginBottom: 20 }}>
        <button className={tab === "cotizaciones" ? "primary-button" : "secondary-button"} onClick={() => setTab("cotizaciones")}>Cotizaciones</button>
        <button className={tab === "facturas" ? "primary-button" : "secondary-button"} onClick={() => setTab("facturas")}>Facturas</button>
      </div>

      {tab === "cotizaciones" && <BuzonCotizaciones sistema="mira" apiUrl={BUZON_API} onDone={load} />}

      {tab === "cotizaciones" && (
        <>
          <div className="dashboard-section" style={{ marginBottom: 20 }}>
            <div className="section-heading"><h2>Nueva cotización</h2></div>
            <div className="product-form">
              <div className="form-row">
                <div className="form-group"><label>Cliente</label><input value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
                <div className="form-group"><label>Consultorio / círculo</label><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label>Tipo de sistema</label>
                <div className="mr-seg">
                  {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                    <button key={k} type="button" className={kind === k ? "is-on" : ""} onClick={() => { setKind(k); setModules(DEFAULT_MODULES[k]); }}>{KIND_LABELS[k]}</button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="form-group"><label>Entrega estimada</label><input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label>Módulos (Inicio, Configuración y Usuarios van incluidos)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {MODULES_BY_KIND[kind].map((m) => (
                    <ModuleCheckbox key={m} label={moduleLabel(m, kind)} checked={modules.includes(m)} onChange={() => setModules(toggle(modules, m))} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <ModuleCheckbox label="Aplicar IVA 21%" checked={applyIva} onChange={() => setApplyIva(!applyIva)} />
                <div className="mr-price-box" style={{ minWidth: 260 }}>
                  <div><span>Pago inicial (una sola vez)</span><strong>{money(preview(modules, applyIva, kind).initialTotal)}</strong></div>
                  <div><span>Abono mensual</span><strong>{money(preview(modules, applyIva, kind).monthlyTotal)}</strong></div>
                  <div><span>Trimestral (1 mes gratis)</span><strong>{money(plansFor(preview(modules, applyIva, kind).monthlyTotal).quarterly)}</strong></div>
                  <div><span>Anual (2 meses gratis)</span><strong>{money(plansFor(preview(modules, applyIva, kind).monthlyTotal).annual)}</strong></div>
                  <small>Configuración {money(preview(modules, applyIva, kind).setup)} · {preview(modules, applyIva, kind).modulesCount} módulos · {preview(modules, applyIva, kind).websCount > 1 ? `${preview(modules, applyIva, kind).websCount} webs` : "web"} {money(preview(modules, applyIva, kind).web)}{applyIva ? " · con IVA" : ""}</small>
                </div>
              </div>
              <button className="primary-button" onClick={createQuote} style={{ alignSelf: "flex-start" }}>Crear cotización</button>
            </div>
          </div>

          <div className="product-actions" style={{ marginBottom: 12 }}>
            {QUOTE_STATUSES.map((s) => (
              <button key={s} className={quoteFilter === s ? "primary-button" : "secondary-button"} onClick={() => setQuoteFilter(s)}>
                {TAB_LABEL[s] || s}
              </button>
            ))}
          </div>

          <div>
            {filteredQuotes.length === 0 ? (
              <div className="mr-empty"><strong>No hay cotizaciones para este filtro</strong>Probá con otro estado o creá una cotización nueva.</div>
            ) : (
              <div className="mr-table-wrap">
                <table className="mr-table">
                  <thead><tr><th>Fecha</th><th>Cliente</th><th>Módulos</th><th className="num">Pago inicial</th><th className="num">Abono mensual</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {filteredQuotes.map((q) => (
                      <tr key={q.id}>
                        <td>{shortDate(q.created_at)}</td>
                        <td>
                          {q.business_name}
                          {String(q.notes || "").startsWith("Pedido desde la web") && <span className="mr-badge mr-badge-enviada" style={{ marginLeft: 6 }}>Web</span>}
                          {(() => { const tg = quoteTags(q.notes); return (<>{tg.uso && <span className="mr-badge mr-badge-enviada" style={{ marginLeft: 6 }}>{tg.uso.startsWith("Mensual") ? "Mensual" : "Un solo pago"}</span>}{tg.pos && <span className="mr-badge mr-badge-aceptada" style={{ marginLeft: 6 }}>POS</span>}</>); })()}
                          <br /><small className="mr-muted">{KIND_LABELS[(q.kind || "CONSULTORIO") as Kind]} · {q.client_name}</small>
                        </td>
                        <td style={{ fontSize: 12 }}>{splitList(q.modules).map((m) => moduleLabel(m, q.kind)).join(", ") || "—"}</td>
                        <td className="num">{money(q.total)}</td>
                        <td className="num">{money(q.monthly_total)}</td>
                        <td><span className={`mr-badge mr-badge-${q.status.toLowerCase()}`}>{STATUS_LABEL(q.status)}</span></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="mr-link" onClick={() => openQuote(q)}>Ver</button>
                          {q.status === "BORRADOR" && (
                            <button className="mr-link mr-link-danger" onClick={() => deleteQuote(q.id)} style={{ marginLeft: 12 }}>Borrar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "facturas" && (
        <>
          <div className="product-actions" style={{ marginBottom: 12 }}>
            <button className={invoiceFilter === "activos" ? "primary-button" : "secondary-button"} onClick={() => setInvoiceFilter("activos")}>Sistemas activos</button>
            <button className={invoiceFilter === "inactivos" ? "primary-button" : "secondary-button"} onClick={() => setInvoiceFilter("inactivos")}>Dados de baja</button>
          </div>

          <div>
            {filteredInvoices.length === 0 ? (
              <div className="mr-empty"><strong>No hay facturas para este filtro</strong>Probá con otro filtro.</div>
            ) : (
              <div className="mr-table-wrap">
                <table className="mr-table">
                  <thead><tr><th>Período</th><th>Sistema</th><th className="num">Abono del mes</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.period}</td>
                        <td>{systemName(inv.company_id)}</td>
                        <td className="num">{money(inv.total)}</td>
                        <td><span className={`mr-badge mr-badge-${inv.status.toLowerCase()}`}>{STATUS_LABEL(inv.status)}</span></td>
                        <td className="num"><button className="mr-link" onClick={() => openInvoice(inv)}>Ver</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* COTIZACIÓN: precio del POS y del pago único, envío por mail, aceptar/rechazar (QuoteFlowModal) */}
      {selectedQuote && (
        <QuoteFlowModal
          quote={selectedQuote}
          api={adminApi}
          fmt={money}
          brandName="MIRA"
          labelOf={(m: string, q: any) => moduleLabel(m, q.kind)}
          renderModules={(c) => (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {MODULES_BY_KIND[c.quote.kind].map((m) => (
                    <ModuleCheckbox key={m} label={moduleLabel(m, c.quote.kind)} checked={c.value.includes(m)} onChange={() => c.onChange(toggle(c.value, m))} />
                  ))}
                </div>
          )}
          onClose={() => setSelectedQuote(null)}
          onChanged={load}
          onDelete={deleteQuote}
        />
      )}

      {/* MODAL NUEVA FACTURA */}
      {showInvoiceForm && (
        <div className="modal-overlay" onClick={() => setShowInvoiceForm(false)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">FACTURAS</span><h2>Nueva factura mensual</h2></div>
              <button className="modal-close" onClick={() => setShowInvoiceForm(false)}>×</button>
            </div>
            <div className="product-form">
              <div className="form-group">
                <label>Sistema</label>
                <select value={invoiceSystemId} onChange={(e) => setInvoiceSystemId(e.target.value)}>
                  <option value="">Elegí un sistema</option>
                  {systems.filter((s) => s.billed && !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <p className="mr-muted" style={{ fontSize: 11 }}>
                Solo aparecen sistemas activos marcados como "se factura". Es el abono mensual: suma los módulos y las webs que tiene habilitados (la configuración inicial no se cobra por mes).
              </p>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowInvoiceForm(false)}>Cancelar</button>
                <button className="primary-button" onClick={generateInvoice} disabled={generatingInvoice || !invoiceSystemId}>
                  {generatingInvoice ? "Generando..." : "Generar factura"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE FACTURA */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="dashboard-eyebrow">FACTURA {selectedInvoice.period}</span><h2>{systemName(selectedInvoice.company_id)}</h2></div>
              <button className="modal-close" onClick={() => setSelectedInvoice(null)}>×</button>
            </div>
            <div className="product-form">
              <div className="form-group"><label>Titular</label><p>{invoiceOwnerName || "—"}</p></div>
              <div className="mr-table-wrap">
                <table className="mr-table">
                  <thead><tr><th>Ítem</th><th className="num">Precio</th></tr></thead>
                  <tbody>
                    {buildLineItems(selectedInvoice).map((it, idx) => <tr key={idx}><td>{it.label}</td><td className="num">{money(it.price)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <p style={{ textAlign: "right" }}>
                Subtotal: {money(selectedInvoice.subtotal)}<br />
                {selectedInvoice.apply_iva && <>IVA: {money(selectedInvoice.iva_amount)}<br /></>}
                <strong>Abono del mes: {money(selectedInvoice.total)}</strong>
              </p>
              <div className="modal-actions" style={{ justifyContent: "space-between" }}>
                <button className="secondary-button" onClick={() => printDocument("Resumen de abono mensual", selectedInvoice.period, invoiceOwnerName, systemName(selectedInvoice.company_id), selectedInvoice)}>Imprimir</button>
                {selectedInvoice.status === "PENDIENTE" ? (
                  <button className="primary-button" onClick={() => setInvoiceStatus(selectedInvoice, "PAGADA")}>Marcar pagada</button>
                ) : (
                  <button className="secondary-button" onClick={() => setInvoiceStatus(selectedInvoice, "PENDIENTE")}>Volver a pendiente</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminBilling;
