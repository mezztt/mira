import { useCallback, useEffect, useState } from "react";
import { appApi, getSessionUser, ROLE_HINTS, ROLE_LABELS, ROLES_BY_KIND } from "../../config";
import type { Member, Professional } from "../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, useFlash } from "../../components/ui";

interface UserItem { id: number; name: string; email: string; role: string; active: boolean; professional_id: number | null; member_id: number | null }

function Usuarios() {
  const me = getSessionUser();
  const kind = me?.kind || "CONSULTORIO";
  const { show, fail, node: flash } = useFlash();
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [pros, setPros] = useState<Professional[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [editing, setEditing] = useState<UserItem | "new" | null>(null);

  const load = useCallback(() => { appApi<UserItem[]>("/users").then(setUsers).catch(fail); }, [fail]);
  useEffect(() => {
    load();
    if (kind === "CONSULTORIO") appApi<Professional[]>("/professionals?include_inactive=true").then(setPros).catch(() => {});
    else appApi<Member[]>("/members?include_inactive=true").then(setMembers).catch(() => {});
  }, [load, kind]);

  const linkName = (u: UserItem) => {
    if (u.professional_id) return pros.find((p) => p.id === u.professional_id)?.name;
    if (u.member_id) return members.find((m) => m.id === u.member_id)?.full_name;
    return null;
  };

  return (
    <section className="products-page">
      <PageHeader eyebrow="USUARIOS" title="Usuarios" subtitle="Quién entra al sistema y qué puede ver cada uno.">
        <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo usuario</button>
      </PageHeader>
      <div className="mr-grid-3" style={{ marginBottom: 16 }}>
        {ROLES_BY_KIND[kind].map((r) => (
          <div key={r} className="mr-card" style={{ padding: 14 }}><strong>{ROLE_LABELS[r]}</strong><p className="mr-muted" style={{ margin: "4px 0 0" }}>{ROLE_HINTS[r]}</p></div>
        ))}
      </div>
      {!users ? <Loading /> : users.length === 0 ? <Empty title="Sin usuarios" /> : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Vinculado a</th><th>Estado</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="is-click" onClick={() => setEditing(u)}>
                  <td><strong>{u.name}</strong>{u.id === me?.id && <small>Vos</small>}</td>
                  <td>{u.email}</td>
                  <td><Pill tone={u.role === "ADMINISTRADOR" ? "violet" : u.role === "PROFESIONAL" || u.role === "MEDICO" ? "teal" : "blue"}>{ROLE_LABELS[u.role] || u.role}</Pill></td>
                  <td>{linkName(u) || "—"}</td>
                  <td>{u.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {kind === "CONSULTORIO" && (
        <p className="mr-muted" style={{ marginTop: 12 }}>
          Para que un médico u odontólogo escriba historias clínicas y recetas, su usuario tiene que estar vinculado a su ficha de profesional.
          Un administrador que también atiende puede vincularse a su ficha.
        </p>
      )}
      {editing && <UserForm user={editing === "new" ? null : editing} kind={kind} pros={pros} members={members} isMe={editing !== "new" && editing.id === me?.id}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); show("Usuario guardado"); }} />}
      {flash}
    </section>
  );
}

function UserForm({ user, kind, pros, members, isMe, onClose, onSaved }: {
  user: UserItem | null; kind: "CONSULTORIO" | "CIRCULO"; pros: Professional[]; members: Member[]; isMe: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || ROLES_BY_KIND[kind][1]);
  const [prof, setProf] = useState(user?.professional_id ? String(user.professional_id) : "");
  const [member, setMember] = useState(user?.member_id ? String(user.member_id) : "");
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const links = {
        professional_id: kind === "CONSULTORIO" && (role === "PROFESIONAL" || role === "ADMINISTRADOR") && prof ? Number(prof) : null,
        member_id: kind === "CIRCULO" && role === "MEDICO" && member ? Number(member) : null,
      };
      if (user) await appApi(`/users/${user.id}`, { method: "PUT", body: { name, role, active, ...links, password: password || null } });
      else await appApi("/users", { method: "POST", body: { name, email, password, role, ...links } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow={user ? "EDITAR USUARIO" : "NUEVO USUARIO"} title={user ? user.name : "Nuevo usuario"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Email (para entrar)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></Field>
        <Field label={user ? "Contraseña nueva (opcional)" : "Contraseña"} hint="Mínimo 6 caracteres"><input value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={isMe}>
            {ROLES_BY_KIND[kind].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HINTS[r]}</option>)}
          </select>
        </Field>
        {kind === "CONSULTORIO" && (role === "PROFESIONAL" || role === "ADMINISTRADOR") && (
          <Field label={role === "PROFESIONAL" ? "¿Qué profesional es?" : "¿También atiende? Vinculalo a su ficha (opcional)"}>
            <select value={prof} onChange={(e) => setProf(e.target.value)}>
              <option value="">{role === "PROFESIONAL" ? "Elegí…" : "No atiende"}</option>
              {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        )}
        {kind === "CIRCULO" && role === "MEDICO" && (
          <Field label="¿Qué médico del padrón es?" hint="También podés dar acceso desde el Padrón">
            <select value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">Elegí…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.license ? ` · MP ${m.license}` : ""}</option>)}
            </select>
          </Field>
        )}
        {user && !isMe && (
          <div className="mr-inline-checks"><label><input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} /> Desactivar (no puede entrar)</label></div>
        )}
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Usuarios;
