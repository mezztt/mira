import { useEffect, useMemo, useState } from "react";
import { MailCompose } from "./MailCenter";
import AppDesktop from "./AppDesktop";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  adminApi, money, plansFor, priceBreakdown, shortDate, splitList, systemStatus, publicSiteUrl,
  CORE_BY_KIND, KIND_LABELS, MODULE_LABELS, MODULES_BY_KIND, PAYMENT_STATUS_LABELS, ROLE_LABELS, moduleHint, moduleLabel,
} from "../../config";
import type { BillingPrices, Kind, SystemItem, PaymentItem } from "../../config";
import { Modal, PageHeader, Pill, Seg, Tabs, useFlash } from "../../components/ui";
import { RUBROS_BY_KIND, findRubro, suggestedModules } from "../../rubros";

interface SystemUser { id: number; name: string; email: string; role: string; active: boolean }
type DetailTab = "info" | "pagos" | "usuarios" | "mail" | "app" | "seguridad";

const DEFAULT_MODULES: Record<Kind, string[]> = {
  CONSULTORIO: ["agenda", "pacientes", "historia_clinica", "documentos", "cobros"],
  CIRCULO: ["padron", "convenios", "prestaciones", "presentaciones", "liquidaciones"],
};
const KIND_ICON: Record<Kind, string> = { CONSULTORIO: "✚", CIRCULO: "⇄" };
const KIND_HINT: Record<Kind, string> = {
  CONSULTORIO: "Médicos, odontólogos, clínicas y centros: agenda, pacientes, historia clínica, cobros",
  CIRCULO: "Círculos y colegios médicos: padrón, convenios, prestaciones, presentaciones y liquidaciones",
};

const emptyForm = (kind: Kind = "CONSULTORIO") => ({
  kind, company_name: "", slug: "", specialty: "", rubro: "", cuit: "", email: "", phone: "", address: "", city: "",
  enabled_modules: [...DEFAULT_MODULES[kind]] as string[],
  client_price: "", payment_status: "al_dia", payment_due_date: "", billed: false, apply_iva: true, notes: "",
  admin_name: "Administrador", admin_email: "", admin_password: "",
});

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
function slugPreview(text: string) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function KindPicker({ value, onChange, disabled }: { value: Kind; onChange: (k: Kind) => void; disabled?: boolean }) {
  return (
    <div className="mr-kind-picker">
      {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
        <button key={k} type="button" disabled={disabled && value !== k} className={`mr-kind ${value === k ? "is-on" : ""}`} onClick={() => !disabled && onChange(k)}>
          <span className="mr-kind-icon" aria-hidden="true">{KIND_ICON[k]}</span>
          <span><strong>{KIND_LABELS[k]}</strong><small>{KIND_HINT[k]}</small></span>
        </button>
      ))}
    </div>
  );
}

function ModulePicker({ kind, value, onChange }: { kind: Kind; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="mr-module-grid">
      {CORE_BY_KIND[kind].map((m) => (
        <label key={m} className="mr-module-option is-core">
          <input type="checkbox" checked readOnly disabled />
          <div><strong>{MODULE_LABELS[m]}</strong><small>Incluido siempre</small></div>
        </label>
      ))}
      {MODULES_BY_KIND[kind].map((m) => (
        <label key={m} className={`mr-module-option ${value.includes(m) ? "is-on" : ""}`}>
          <input type="checkbox" checked={value.includes(m)} onChange={() => onChange(toggle(value, m))} />
          <div><strong>{moduleLabel(m, kind)}</strong><small>{moduleHint(m, kind)}</small></div>
        </label>
      ))}
    </div>
  );
}

/** Tipo de negocio: elegirlo tilda los módulos sugeridos (se pueden destildar o sumar a mano) */
function RubroPicker({ kind, value, modules, onPick, onApply }: {
  kind: Kind; value: string; modules: string[]; onPick: (key: string) => void; onApply?: (mods: string[]) => void;
}) {
  const info = findRubro(kind, value);
  const suggested = suggestedModules(kind, value);
  const missing = suggested.filter((m) => !modules.includes(m));
  return (
    <div className="form-group mr-rubro">
      <label htmlFor="mr-rubro-select">Tipo de negocio</label>
      <select id="mr-rubro-select" value={value} onChange={(e) => onPick(e.target.value)}>
        <option value="">Sin elegir (armo los módulos a mano)</option>
        {RUBROS_BY_KIND[kind].map((r) => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
      </select>
      {info ? (
        <small className="mr-hint">
          Sugerido para {info.label}: {suggested.map((m) => moduleLabel(m, kind)).join(", ")}.
          {onApply && missing.length > 0 && (
            <> <button type="button" className="mr-link" onClick={() => onApply(suggested)}>Tildar los sugeridos</button></>
          )}
        </small>
      ) : <small className="mr-hint">Al elegir uno se tildan solos los módulos que suelen servirle; después los podés cambiar.</small>}
    </div>
  );
}

/** Abono mensual sugerido según los módulos tildados (el precio que se guarda se sigue escribiendo a mano) */
function SuggestedPrice({ kind, modules, iva, prices, onUse }: { kind: Kind; modules: string[]; iva: boolean; prices: BillingPrices | null; onUse: (v: string) => void }) {
  if (!prices) return null;
  const p = priceBreakdown(modules, kind, prices, iva);
  return (
    <div className="mr-price-box">
      <div><span>Abono mensual sugerido{iva ? " (con IVA)" : ""}</span><strong>{money(p.monthlyTotal)}</strong></div>
      <div><span>Pago inicial (una sola vez){iva ? " (con IVA)" : ""}</span><strong>{money(p.initialTotal)}</strong></div>
      <div><span>Trimestral (1 mes gratis)</span><strong>{money(plansFor(p.monthlyTotal).quarterly)}</strong></div>
      <div><span>Anual (2 meses gratis)</span><strong>{money(plansFor(p.monthlyTotal).annual)}</strong></div>
      <small>{p.modulesCount} módulos × {money(Number(prices.module_price))}{p.web ? ` + ${p.websCount > 1 ? `${p.websCount} webs` : "web"} ${money(p.web)}` : ""} · configuración {money(p.setup)} solo en el pago inicial</small>
      <button type="button" className="mr-link" style={{ justifySelf: "start" }} onClick={() => onUse(String(Math.round(p.monthlySubtotal * 100) / 100))}>
        Usar {money(p.monthlySubtotal)} como precio mensual
      </button>
    </div>
  );
}

function Sistemas() {
  const [params, setParams] = useSearchParams();
  const { show, fail, node: flash } = useFlash();
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"activos" | "inactivos" | "locales">("activos");
  const [localIds, setLocalIds] = useState<number[]>([]);
  const [kindFilter, setKindFilter] = useState<"" | Kind>("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<SystemItem | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [edit, setEdit] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Transferencia");
  const [payNotes, setPayNotes] = useState("");
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [closePassword, setClosePassword] = useState("");
  const [prices, setPrices] = useState<BillingPrices | null>(null);

  async function loadSystems() {
    setLoading(true);
    try {
      const list = await adminApi<SystemItem[]>("/admin/systems");
      setSystems(list);
      adminApi<{ ids: number[] }>("/admin/local-systems").then((r) => setLocalIds(r.ids)).catch(() => {});
      return list;
    } catch { return []; } finally { setLoading(false); }
  }

  useEffect(() => {
    adminApi<BillingPrices>("/admin/billing-settings").then(setPrices).catch(() => {});
    loadSystems().then((list) => {
      if (params.get("nuevo")) openForm();
      const id = Number(params.get("id"));
      const found = id ? list.find((s) => s.id === id) : undefined;
      if (found) openDetail(found);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearParams() { if (params.toString()) setParams({}, { replace: true }); }

  function openForm(kind: Kind = "CONSULTORIO") { setForm(emptyForm(kind)); setShowForm(true); }

  async function createSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi("/admin/systems", {
        method: "POST",
        body: {
          ...form, slug: form.slug || null, specialty: form.specialty || null, rubro: form.rubro || null, cuit: form.cuit || null,
          client_price: form.client_price ? Number(form.client_price) : null, payment_due_date: form.payment_due_date || null,
        },
      });
      setShowForm(false); clearParams(); setTab("activos");
      await loadSystems();
      show(`${KIND_LABELS[form.kind]} creado. Ya puede entrar con ${form.admin_email}`);
    } catch (e) { fail(e); } finally { setSaving(false); }
  }

  async function openDetail(s: SystemItem) {
    setDetail(s);
    setDetailTab("info");
    setEdit({
      name: s.name, slug: s.slug || "", specialty: s.specialty || "", rubro: s.rubro || "", cuit: s.cuit || "", email: s.email || "", phone: s.phone || "",
      address: s.address || "", city: s.city || "", enabled_modules: splitList(s.enabled_modules),
      client_price: s.client_price ?? "", payment_status: s.payment_status,
      payment_due_date: s.payment_due_date ? s.payment_due_date.slice(0, 10) : "",
      billed: s.billed, apply_iva: s.apply_iva, notes: s.notes || "",
    });
    setNewPassword(""); setClosePassword(""); setResetUserId("");
    setPayAmount(s.client_price ? String(s.client_price) : ""); setPayNotes("");
    const [p, u] = await Promise.all([
      adminApi<PaymentItem[]>(`/admin/systems/${s.id}/payments`).catch(() => []),
      adminApi<SystemUser[]>(`/admin/systems/${s.id}/users`).catch(() => []),
    ]);
    setPayments(p); setUsers(u);
  }
  function closeDetail() { setDetail(null); clearParams(); }

  async function saveInfo() {
    if (!detail || !edit) return;
    try {
      const updated = await adminApi<SystemItem>(`/admin/systems/${detail.id}`, {
        method: "PUT",
        body: {
          ...edit, slug: edit.slug || null, specialty: edit.specialty || null, rubro: edit.rubro || null, cuit: edit.cuit || null,
          client_price: edit.client_price === "" ? null : Number(edit.client_price), payment_due_date: edit.payment_due_date || null,
        },
      });
      setDetail(updated);
      await loadSystems();
      show("Cambios guardados");
    } catch (e) { fail(e); }
  }

  async function addPayment() {
    if (!detail || !payAmount) return;
    try {
      await adminApi(`/admin/systems/${detail.id}/payments`, { method: "POST", body: { amount: Number(payAmount), method: payMethod, notes: payNotes || null } });
      setPayNotes("");
      setPayments(await adminApi<PaymentItem[]>(`/admin/systems/${detail.id}/payments`));
      const list = await loadSystems();
      const fresh = list.find((s) => s.id === detail.id);
      if (fresh) {
        setDetail(fresh);
        setEdit((e: any) => ({ ...e, payment_status: fresh.payment_status, payment_due_date: fresh.payment_due_date ? fresh.payment_due_date.slice(0, 10) : "" }));
      }
      show("Pago registrado");
    } catch (e) { fail(e); }
  }

  async function doSecurityReset() {
    if (!detail || !newPassword) return;
    if (!confirm("Se van a cerrar TODAS las sesiones del sistema. ¿Seguir?")) return;
    try {
      const data = await adminApi<{ detail: string }>(`/admin/systems/${detail.id}/security-reset`, {
        method: "POST", body: { new_password: newPassword, user_id: resetUserId ? Number(resetUserId) : null },
      });
      show(data.detail); setNewPassword("");
    } catch (e) { fail(e); }
  }

  async function toggleActive() {
    if (!detail || !closePassword) return;
    try {
      const data = await adminApi<{ detail: string; archived: boolean }>(`/admin/systems/${detail.id}/toggle-active`, { method: "POST", body: { password: closePassword } });
      show(`Sistema ahora: ${data.detail}`);
      setTab(data.archived ? "inactivos" : "activos");
      closeDetail();
      await loadSystems();
    } catch (e) { fail(e); }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return systems
      .filter((s) => (tab === "locales" ? localIds.includes(s.id) : localIds.includes(s.id) ? false : tab === "activos" ? !s.archived : s.archived))
      .filter((s) => !kindFilter || s.kind === kindFilter)
      .filter((s) => !q || [s.name, s.city, s.slug, s.specialty].some((v) => (v || "").toLowerCase().includes(q)));
  }, [systems, localIds, tab, search, kindFilter]);
  const counts = { activos: systems.filter((s) => !s.archived && !localIds.includes(s.id)).length, inactivos: systems.filter((s) => s.archived && !localIds.includes(s.id)).length, locales: systems.filter((s) => localIds.includes(s.id)).length };

  return (
    <section className="products-page">
      <PageHeader eyebrow="MEZZTT · MIRA" title="Sistemas" subtitle="Consultorios, clínicas y círculos médicos que usan MIRA, con su estado en vivo.">
        <button className="secondary-button" onClick={() => openForm("CIRCULO")}>+ Círculo médico</button>
        <button className="primary-button" onClick={() => openForm("CONSULTORIO")}>+ Consultorio</button>
      </PageHeader>

      <div className="mr-toolbar">
        <div className="mr-row">
          <Seg value={tab} onChange={setTab} options={[["activos", `Activos (${counts.activos})`], ["inactivos", `De baja (${counts.inactivos})`], ["locales", `Comprados · locales (${counts.locales})`]]} />
          <Seg value={kindFilter} onChange={setKindFilter} options={[["", "Todos"], ["CONSULTORIO", "Consultorios"], ["CIRCULO", "Círculos"]]} />
        </div>
        <input className="mr-search" placeholder="Buscar por nombre, ciudad o especialidad…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
      ) : systems.length === 0 ? (
        <div className="mr-empty"><strong>Todavía no creaste ningún sistema</strong>Creá el primero y se genera su usuario administrador.</div>
      ) : visible.length === 0 ? (
        <div className="mr-empty"><strong>No hay sistemas que coincidan</strong></div>
      ) : (
        <div className="mr-systems-grid">
          {visible.map((s) => {
            const st = localIds.includes(s.id) ? { label: "Comprado · local", tone: (s.archived ? "off" : "ok") as ReturnType<typeof systemStatus>["tone"] } : systemStatus(s);
            const mods = splitList(s.enabled_modules);
            return (
              <button key={s.id} type="button" className="mr-system-card" onClick={() => openDetail(s)}>
                <div className="mr-spread" style={{ width: "100%" }}>
                  <span className="mr-status"><span className={`mr-dot ${st.tone}`} />{st.label}</span>
                  <Pill tone={s.kind === "CIRCULO" ? "violet" : "teal"}>{KIND_ICON[s.kind]} {KIND_LABELS[s.kind]}</Pill>
                </div>
                <strong>{s.name}</strong>
                <small>{[s.specialty, s.city].filter(Boolean).join(" · ") || "Sin datos"}</small>
                <div className="mr-chips">{mods.map((m) => <span key={m} className="mr-chip">{moduleLabel(m, s.kind)}</span>)}</div>
                <small>{localIds.includes(s.id) ? "Pago único" : s.client_price ? `${money(s.client_price)}/mes` : "Sin precio"} · {localIds.includes(s.id) ? "licencia de por vida" : s.payment_due_date ? `vence ${shortDate(s.payment_due_date)}` : PAYMENT_STATUS_LABELS[s.payment_status] || s.payment_status}{s.billed ? " · factura" : ""}</small>
                <span className="mr-edit">Ver y editar ›</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ============ ALTA ============ */}
      {showForm && (
        <Modal eyebrow="NUEVO SISTEMA" title={`Nuevo ${KIND_LABELS[form.kind].toLowerCase()}`} onClose={() => { setShowForm(false); clearParams(); }} size="wide">
          <form onSubmit={createSystem} className="product-form">
            <h4 className="mr-form-title">Tipo</h4>
            <KindPicker value={form.kind} onChange={(k) => setForm({ ...form, kind: k, rubro: "", enabled_modules: [...DEFAULT_MODULES[k]] })} />

            <h4 className="mr-form-title">Datos</h4>
            <div className="form-row">
              <div className="form-group"><label>Nombre</label><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required placeholder={form.kind === "CIRCULO" ? "Círculo Médico de…" : "Consultorios del Parque"} /></div>
              <div className="form-group"><label>{form.kind === "CIRCULO" ? "Descripción" : "Especialidad / rubro"}</label><input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder={form.kind === "CIRCULO" ? "Agrupa 120 médicos de la zona" : "Odontología, clínica médica…"} /></div>
            </div>
            {(form.kind === "CONSULTORIO" || form.enabled_modules.includes("web_turnos")) && (
              <div className="form-group">
                <label>Link de la web de turnos</label>
                <input value={form.slug} placeholder={slugPreview(form.company_name) || "mi-consultorio"} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                <small className="mr-hint">{window.location.host}/t/{slugPreview(form.slug || form.company_name) || "…"}</small>
              </div>
            )}
            <div className="form-row">
              <div className="form-group"><label>CUIT</label><input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} /></div>
              <div className="form-group"><label>Ciudad</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Dirección</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="form-group"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Email de contacto</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>

            <h4 className="mr-form-title">Módulos</h4>
            <RubroPicker kind={form.kind} value={form.rubro} modules={form.enabled_modules}
              onPick={(key) => setForm({ ...form, rubro: key, enabled_modules: key ? suggestedModules(form.kind, key) : form.enabled_modules })} />
            <ModulePicker kind={form.kind} value={form.enabled_modules} onChange={(v) => setForm({ ...form, enabled_modules: v })} />

            <h4 className="mr-form-title">Abono</h4>
            <SuggestedPrice kind={form.kind} modules={form.enabled_modules} iva={form.apply_iva} prices={prices} onUse={(v) => setForm({ ...form, client_price: v })} />
            <div className="form-row">
              <div className="form-group"><label>Precio mensual</label><input type="number" min="0" value={form.client_price} onChange={(e) => setForm({ ...form, client_price: e.target.value })} /></div>
              <div className="form-group"><label>Estado de pago</label>
                <select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                  <option value="al_dia">Al día</option><option value="pendiente">Pendiente</option><option value="vencido">Vencido</option>
                </select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Próximo vencimiento</label><input type="date" value={form.payment_due_date} onChange={(e) => setForm({ ...form, payment_due_date: e.target.value })} /></div>
              <div className="form-group"><label>¿Se factura? / IVA</label>
                <div className="mr-inline-checks">
                  <label><input type="checkbox" checked={form.billed} onChange={(e) => setForm({ ...form, billed: e.target.checked })} /> Se factura</label>
                  <label><input type="checkbox" checked={form.apply_iva} onChange={(e) => setForm({ ...form, apply_iva: e.target.checked })} /> Aplicar IVA 21%</label>
                </div></div>
            </div>

            <h4 className="mr-form-title">Usuario administrador</h4>
            <div className="form-row">
              <div className="form-group"><label>Nombre</label><input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required /></div>
              <div className="form-group"><label>Email (para entrar)</label><input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Contraseña inicial</label><input value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required minLength={6} /></div>
              <div className="form-group"><label>Notas internas</label><input value={form.notes} placeholder="Opcional" onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => { setShowForm(false); clearParams(); }}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? "Creando..." : "Crear sistema"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ DETALLE ============ */}
      {detail && edit && (
        <Modal eyebrow={`${KIND_LABELS[detail.kind].toUpperCase()} #${detail.id} · ALTA ${shortDate(detail.created_at)}`} title={detail.name} onClose={closeDetail} size="wide">
          <span className="mr-status" style={{ marginBottom: 12 }}><span className={`mr-dot ${systemStatus(detail).tone}`} />{systemStatus(detail).label}</span>
          <Tabs value={detailTab} onChange={setDetailTab} options={[["info", "Info y módulos"], ["pagos", `Pagos (${payments.length})`], ["usuarios", `Usuarios (${users.length})`], ["mail", "Enviar mail"], ["app", "App de escritorio"], ["seguridad", "Seguridad"]]} />

          {detailTab === "info" && (
            <div className="product-form">
              <KindPicker value={detail.kind} onChange={() => {}} disabled />
              <p className="mr-hint">El tipo no se cambia una vez creado (cada tipo tiene datos distintos).</p>
              <div className="form-row">
                <div className="form-group"><label>Nombre</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div className="form-group"><label>{detail.kind === "CIRCULO" ? "Descripción" : "Especialidad"}</label><input value={edit.specialty} onChange={(e) => setEdit({ ...edit, specialty: e.target.value })} /></div>
              </div>
              {(detail.kind === "CONSULTORIO" || edit.enabled_modules.includes("web_turnos")) && (
                <div className="form-group">
                  <label>Link web de turnos</label>
                  <input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
                  <small className="mr-hint">{publicSiteUrl(slugPreview(edit.slug))}</small>
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label>CUIT</label><input value={edit.cuit} onChange={(e) => setEdit({ ...edit, cuit: e.target.value })} /></div>
                <div className="form-group"><label>Ciudad</label><input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Dirección</label><input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></div>
                <div className="form-group"><label>Teléfono</label><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Email</label><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
              <RubroPicker kind={detail.kind} value={edit.rubro} modules={edit.enabled_modules} onPick={(key) => setEdit({ ...edit, rubro: key })}
                onApply={(mods) => setEdit({ ...edit, enabled_modules: Array.from(new Set([...edit.enabled_modules, ...mods])) })} />
              <div className="form-group"><label>Módulos</label><ModulePicker kind={detail.kind} value={edit.enabled_modules} onChange={(v) => setEdit({ ...edit, enabled_modules: v })} /></div>
              <SuggestedPrice kind={detail.kind} modules={edit.enabled_modules} iva={edit.apply_iva} prices={prices} onUse={(v) => setEdit({ ...edit, client_price: v })} />
              <div className="form-row">
                <div className="form-group"><label>Precio mensual</label><input type="number" value={edit.client_price} onChange={(e) => setEdit({ ...edit, client_price: e.target.value })} /></div>
                <div className="form-group"><label>Estado de pago</label>
                  <select value={edit.payment_status} onChange={(e) => setEdit({ ...edit, payment_status: e.target.value })}>
                    <option value="al_dia">Al día</option><option value="pendiente">Pendiente</option><option value="vencido">Vencido</option>
                  </select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Próximo vencimiento</label><input type="date" value={edit.payment_due_date} onChange={(e) => setEdit({ ...edit, payment_due_date: e.target.value })} /></div>
                <div className="form-group"><label>Facturación</label>
                  <div className="mr-inline-checks">
                    <label><input type="checkbox" checked={edit.billed} onChange={(e) => setEdit({ ...edit, billed: e.target.checked })} /> Se factura</label>
                    <label><input type="checkbox" checked={edit.apply_iva} onChange={(e) => setEdit({ ...edit, apply_iva: e.target.checked })} /> IVA 21%</label>
                  </div></div>
              </div>
              <div className="form-group"><label>Notas internas</label><input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
              <div className="modal-actions"><button className="primary-button" type="button" onClick={saveInfo}>Guardar cambios</button></div>
            </div>
          )}

          {detailTab === "pagos" && (
            <div className="product-form">
              <div className="form-row">
                <div className="form-group"><label>Monto</label><input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
                <div className="form-group"><label>Método</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option>Transferencia</option><option>Efectivo</option><option>Mercado Pago</option><option>Otro</option>
                  </select></div>
              </div>
              <div className="form-group"><label>Notas</label><input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opcional" /></div>
              <p className="mr-hint">Al registrar el pago, queda “Al día” y el vencimiento pasa al mes siguiente.</p>
              <button className="primary-button" type="button" onClick={addPayment} style={{ alignSelf: "flex-start" }}>Registrar pago</button>
              {payments.length === 0 ? <p className="mr-muted">Sin pagos todavía.</p> : (
                <div className="mr-table-wrap" style={{ marginTop: 14 }}>
                  <table className="mr-table">
                    <thead><tr><th>Fecha</th><th className="num">Monto</th><th>Método</th><th>Notas</th></tr></thead>
                    <tbody>{payments.map((p) => <tr key={p.id}><td>{shortDate(p.payment_date)}</td><td className="num">{money(p.amount)}</td><td>{p.method || "—"}</td><td>{p.notes || "—"}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {detailTab === "usuarios" && (
            <div>
              <div className="mr-table-wrap">
                <table className="mr-table">
                  <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th></tr></thead>
                  <tbody>{users.map((u) => (
                    <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{ROLE_LABELS[u.role] || u.role}</td><td>{u.active ? "Activo" : "Inactivo"}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="mr-hint" style={{ marginTop: 10 }}>Los usuarios los crea cada sistema desde su módulo Usuarios. Desde acá podés resetear contraseñas en Seguridad.</p>
            </div>
          )}

          {detailTab === "mail" && <MailCompose companyId={detail.id} status={(detail as any).payment_status} dueDate={(detail as any).payment_due_date} />}
          {detailTab === "app" && <AppDesktop companyId={detail.id} users={users} />}
          {detailTab === "seguridad" && (
            <div className="product-form">
              <div className="mr-note mr-note-warn">Cierra TODAS las sesiones activas del sistema y cambia la contraseña del usuario elegido.</div>
              <div className="form-row">
                <div className="form-group"><label>Usuario</label>
                  <select value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}>
                    <option value="">Administrador principal</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select></div>
                <div className="form-group"><label>Contraseña nueva</label><input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
              </div>
              <button className="mr-danger-button" type="button" onClick={doSecurityReset} style={{ alignSelf: "flex-start" }}>Cerrar sesiones y resetear</button>
              <hr className="mr-hr" />
              <div className="mr-note mr-note-warn">
                {detail.archived ? "Reactivar este sistema (vuelve a Activos y sus usuarios pueden entrar de nuevo)." : "Dar de baja este sistema (sus usuarios no van a poder entrar; los datos se conservan)."}
              </div>
              <div className="form-group"><label>Tu contraseña del panel</label><input type="password" value={closePassword} onChange={(e) => setClosePassword(e.target.value)} /></div>
              <button className="mr-danger-button" type="button" onClick={toggleActive} style={{ alignSelf: "flex-start" }}>{detail.archived ? "Reactivar sistema" : "Dar de baja"}</button>
            </div>
          )}
        </Modal>
      )}
      {flash}
    </section>
  );
}

export default Sistemas;
