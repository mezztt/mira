import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, downloadFile, getSessionUser, money, shortDate, MEMBER_CATEGORIES, TAX_LABELS } from "../../../config";
import type { Member } from "../../../config";
import { useSearchParams } from "react-router-dom";
import { Empty, Field, Loading, Modal, PageHeader, Pill, numOrNull, strOrNull, useFlash } from "../../../components/ui";
import ImportModal, { MEMBER_IMPORT_FIELDS } from "../../../components/ImportModal";

function Padron() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMINISTRADOR";
  const mods = (user?.enabled_modules || "").split(",");
  const hasPortal = mods.includes("portal_medico"), hasAgenda = mods.includes("agenda");
  const portal = hasPortal || hasAgenda;   // el usuario del médico sirve para su portal y para su agenda
  const { show, fail, node: flash } = useFlash();
  const [items, setItems] = useState<Member[] | null>(null);
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [inactive, setInactive] = useState(false);
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [access, setAccess] = useState<Member | null>(null);
  const [importing, setImporting] = useState(false);
  const [params] = useSearchParams();
  const [noCbu, setNoCbu] = useState(params.get("sin_cbu") === "1");   // llega así desde «Pendientes»

  const load = useCallback(() => {
    appApi<Member[]>(`/members?include_inactive=${inactive}`).then(setItems).catch(fail);
  }, [inactive, fail]);
  useEffect(() => { load(); }, [load]);

  const specialties = useMemo(() => [...new Set((items || []).map((m) => m.specialty).filter(Boolean) as string[])].sort(), [items]);
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items || []).filter((m) => (!specialty || m.specialty === specialty)
      && (!noCbu || (m.active && !m.cbu && !m.bank_alias))
      && (!t || [m.full_name, m.license, m.dni, m.cuit, m.specialty].some((v) => (v || "").toLowerCase().includes(t))));
  }, [items, q, specialty, noCbu]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="PADRÓN" title="Padrón de médicos" subtitle={items ? `${items.filter((m) => m.active).length} médicos activos` : "Nómina de profesionales del círculo"}>
        <button className="secondary-button" onClick={() => setImporting(true)}>Importar desde Excel</button>
        <button className="secondary-button" onClick={() => downloadFile("/members/export.csv", "padron.csv").catch(fail)}>Exportar</button>
        <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo médico</button>
      </PageHeader>
      <div className="mr-toolbar">
        <input className="mr-search" style={{ flex: 1, maxWidth: 420 }} placeholder="Buscar por nombre, matrícula, DNI o CUIT…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mr-filters">
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="">Todas las especialidades</option>
            {specialties.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className="mr-inline-checks" style={{ paddingTop: 0 }}><input type="checkbox" checked={noCbu} onChange={(e) => setNoCbu(e.target.checked)} /> Solo sin CBU</label>
          <label className="mr-inline-checks" style={{ paddingTop: 0 }}><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Ver bajas</label>
        </div>
      </div>
      {!items ? <Loading /> : visible.length === 0 ? <Empty title="No hay médicos que coincidan">Cargá el padrón con “Nuevo médico” o traelo con “Importar desde Excel”.</Empty> : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>Médico</th><th>Matrícula</th><th>Especialidad</th><th>Categoría</th><th>Impuestos</th><th>Cobro</th><th className="num">Prest. del mes</th><th></th></tr></thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id} className="is-click" onClick={() => setEditing(m)}>
                  <td><strong>{m.full_name}</strong><small>{m.dni ? `DNI ${m.dni}` : ""}{m.phone ? ` · ${m.phone}` : ""}</small></td>
                  <td>{m.license || "—"}</td>
                  <td>{m.specialty || "—"}</td>
                  <td><Pill tone={m.category === "NO_SOCIO" ? "gray" : "teal"}>{MEMBER_CATEGORIES[m.category] || m.category}</Pill></td>
                  <td>{TAX_LABELS[m.tax_condition] || m.tax_condition}{m.cuit && <small>{m.cuit}</small>}</td>
                  <td>{m.cbu || m.bank_alias ? <small>{m.bank_alias || `CBU …${(m.cbu || "").slice(-6)}`}</small> : <Pill tone="orange">Sin CBU</Pill>}</td>
                  <td className="num">{m.prestaciones_period ?? 0}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    {!m.active ? <Pill tone="gray">Baja</Pill> : portal && isAdmin ? (
                      <button className="mr-link" onClick={() => setAccess(m)}>{m.portal_email ? "Acceso ✓" : "Dar acceso"}</button>
                    ) : m.portal_email ? <Pill tone="blue">Con acceso</Pill> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <MemberForm member={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); show("Médico guardado"); }} />}
      {importing && (
        <ImportModal title="Importar el padrón de médicos" what="médicos" fields={MEMBER_IMPORT_FIELDS} endpoint="/members/import"
          matchHint="Si la matrícula o el DNI ya existen se actualiza ese médico (sin borrar lo que ya tenía)."
          onClose={() => setImporting(false)}
          onDone={(summary) => { setImporting(false); load(); show(`Importación lista: ${summary}`); }} />
      )}
      {access && <PortalAccess member={access} hasPortal={hasPortal} hasAgenda={hasAgenda} onClose={() => setAccess(null)} onSaved={(m) => { setAccess(null); load(); show(m); }} />}
      {flash}
    </section>
  );
}

function MemberForm({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    first_name: member?.first_name || "", last_name: member?.last_name || "", dni: member?.dni || "", cuit: member?.cuit || "",
    license: member?.license || "", specialty: member?.specialty || "", email: member?.email || "", phone: member?.phone || "",
    address: member?.address || "", category: member?.category || "ACTIVO", tax_condition: member?.tax_condition || "MONOTRIBUTO",
    cbu: member?.cbu || "", bank_alias: member?.bank_alias || "", bank: member?.bank || "",
    membership_fee: member?.membership_fee != null ? String(member.membership_fee) : "", joined_at: member?.joined_at || "",
    active: member?.active ?? true, notes: member?.notes || "",
    ganancias_exempt: member?.ganancias_exempt ?? false, iibb_exempt: member?.iibb_exempt ?? false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      Object.entries(f).forEach(([k, v]) => { body[k] = typeof v === "string" ? strOrNull(v) : v; });
      body.first_name = f.first_name.trim();
      body.last_name = f.last_name.trim();
      body.category = f.category;
      body.tax_condition = f.tax_condition;
      body.membership_fee = numOrNull(f.membership_fee);
      await appApi(member ? `/members/${member.id}` : "/members", { method: member ? "PUT" : "POST", body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow={member ? "PADRÓN" : "NUEVO MÉDICO"} title={member ? member.full_name : "Nuevo médico"} onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <h4 className="mr-form-title">Datos personales y profesionales</h4>
        <div className="form-row">
          <Field label="Nombre"><input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} autoFocus /></Field>
          <Field label="Apellido"><input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Matrícula"><input value={f.license} onChange={(e) => set("license", e.target.value)} /></Field>
          <Field label="Especialidad"><input value={f.specialty} onChange={(e) => set("specialty", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="DNI"><input value={f.dni} onChange={(e) => set("dni", e.target.value)} /></Field>
          <Field label="Fecha de ingreso"><input type="date" value={f.joined_at} onChange={(e) => set("joined_at", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Email"><input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Teléfono"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
        <Field label="Domicilio"><input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>

        <h4 className="mr-form-title">Socio e impuestos</h4>
        <div className="form-row">
          <Field label="Categoría"><select value={f.category} onChange={(e) => set("category", e.target.value)}>{Object.entries(MEMBER_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Cuota societaria propia" hint="Vacío = la general del círculo"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={f.membership_fee} onChange={(e) => set("membership_fee", e.target.value)} /></div></Field>
        </div>
        <div className="form-row">
          <Field label="Condición frente al IVA"><select value={f.tax_condition} onChange={(e) => set("tax_condition", e.target.value)}>{Object.entries(TAX_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="CUIT"><input value={f.cuit} onChange={(e) => set("cuit", e.target.value)} placeholder="20-12345678-9" /></Field>
        </div>

        <div className="mr-inline-checks">
          <label><input type="checkbox" checked={f.ganancias_exempt} onChange={(e) => set("ganancias_exempt", e.target.checked)} /> No retener Ganancias (certificado de exclusión)</label>
          <label><input type="checkbox" checked={f.iibb_exempt} onChange={(e) => set("iibb_exempt", e.target.checked)} /> No retener Ingresos Brutos</label>
        </div>

        <h4 className="mr-form-title">Datos para transferir honorarios</h4>
        <div className="form-row">
          <Field label="CBU / CVU"><input value={f.cbu} onChange={(e) => set("cbu", e.target.value)} maxLength={22} inputMode="numeric" /></Field>
          <Field label="Alias"><input value={f.bank_alias} onChange={(e) => set("bank_alias", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Banco"><input value={f.bank} onChange={(e) => set("bank", e.target.value)} /></Field>
          <Field label="Notas"><input value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        {member && <div className="mr-inline-checks"><label><input type="checkbox" checked={!f.active} onChange={(e) => set("active", !e.target.checked)} /> Dado de baja</label></div>}
        {member?.joined_at && <p className="mr-muted">Socio desde {shortDate(member.joined_at)}{member.membership_fee != null ? ` · cuota ${money(member.membership_fee)}` : ""}</p>}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function PortalAccess({ member, hasPortal, hasAgenda, onClose, onSaved }: { member: Member; hasPortal: boolean; hasAgenda: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [email, setEmail] = useState(member.portal_email || member.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function save() {
    try {
      const r = await appApi<{ detail: string }>(`/members/${member.id}/portal-access`, { method: "POST", body: { email, password } });
      onSaved(r.detail);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="ACCESO DEL MÉDICO" title={member.full_name} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>{member.portal_email ? "Actualizar acceso" : "Dar acceso"}</button></>}>
      <div className="product-form">
        <p className="mr-muted" style={{ marginTop: 0 }}>
          Con este usuario el médico entra a MIRA y ve solo lo suyo
          {hasPortal ? ": carga sus prestaciones, ve las observaciones y descarga sus liquidaciones" : ""}
          {hasAgenda ? `${hasPortal ? "; y además" : ":"} tiene su agenda de turnos y carga sus horarios` : ""}.
        </p>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Contraseña" hint="Mínimo 6 caracteres. Pasásela al médico."><input value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Padron;
