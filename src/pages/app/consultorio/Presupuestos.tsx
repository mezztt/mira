import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { appApi, getSessionUser, money } from "../../../config";
import type { Practice } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, numOrNull, strOrNull, useFlash } from "../../../components/ui";
import BudgetsView from "../../../components/budgets/BudgetsView";

/** Presupuestos y planes de tratamiento: todos los presupuestos + la lista de precios de prácticas. */
function Presupuestos() {
  const user = getSessionUser();
  const canWrite = user?.role === "ADMINISTRADOR" || user?.role === "PROFESIONAL";
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"lista" | "precios">(params.get("tab") === "precios" ? "precios" : "lista");
  const [practicesKey, setPracticesKey] = useState(0);

  return (
    <section className="products-page">
      <PageHeader eyebrow="PRESUPUESTOS" title="Presupuestos y planes de tratamiento"
        subtitle="Armá el presupuesto, presentalo al paciente y seguí lo realizado, los pagos y el saldo." />
      <Tabs value={tab} onChange={setTab} options={[["lista", "Presupuestos"], ["precios", "Lista de precios"]]} />
      {tab === "lista"
        ? <BudgetsView initialStatus={params.get("estado") || ""} initialPending={params.get("saldo") === "1"} practicesKey={practicesKey} />
        : <Precios canWrite={canWrite} onChanged={() => setPracticesKey((k) => k + 1)} />}
    </section>
  );
}

function Precios({ canWrite, onChanged }: { canWrite: boolean; onChanged: () => void }) {
  const { show, fail, node: flash } = useFlash();
  const [items, setItems] = useState<Practice[] | null>(null);
  const [inactive, setInactive] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Practice | "new" | null>(null);

  const load = useCallback(() => {
    appApi<Practice[]>(`/practices?include_inactive=${inactive}`).then(setItems).catch(fail);
  }, [inactive, fail]);
  useEffect(() => { load(); }, [load]);

  const t = q.trim().toLowerCase();
  const visible = (items || []).filter((p) => !t || p.name.toLowerCase().includes(t) || (p.code || "").toLowerCase().includes(t));

  return (
    <div>
      <div className="mr-toolbar">
        <div className="mr-row">
          {canWrite && <button className="primary-button" onClick={() => setEditing("new")}>+ Nueva práctica</button>}
          <input className="mr-search" placeholder="Buscar práctica o código…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar práctica" />
        </div>
        <label className="mr-inline-checks" style={{ paddingTop: 0 }}>
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Ver las que ya no se usan
        </label>
      </div>
      {!items ? <Loading /> : visible.length === 0 ? (
        <Empty title={t ? "No hay prácticas con ese nombre" : "La lista de precios está vacía"}>
          {canWrite ? "Cargá las prácticas con su precio (consulta, limpieza, extracción…). Si una se llama igual que un hallazgo del odontograma, el presupuesto toma su precio solo." : "La carga el profesional o el administrador."}
        </Empty>
      ) : (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead><tr><th>Código</th><th>Práctica</th><th className="num">Precio</th><th></th></tr></thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className={canWrite ? "is-click" : ""} onClick={() => canWrite && setEditing(p)}>
                  <td>{p.code || "—"}</td>
                  <td><strong>{p.name}</strong></td>
                  <td className="num">{money(p.price)}</td>
                  <td className="num">{!p.active && <Pill tone="gray">No se usa</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mr-hint" style={{ marginTop: 10 }}>
        Para que “Armar desde el odontograma” ponga el precio solo, usá estos nombres: Caries, Obturación, Sellador, Corona, Endodoncia, Extracción, Implante, Prótesis, Perno, Fractura.
      </p>
      {editing && <PracticeForm practice={editing === "new" ? null : editing} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); onChanged(); show("Práctica guardada"); }} />}
      {flash}
    </div>
  );
}

function PracticeForm({ practice, onClose, onSaved }: { practice: Practice | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(practice?.name || "");
  const [code, setCode] = useState(practice?.code || "");
  const [price, setPrice] = useState(practice ? String(practice.price) : "");
  const [active, setActive] = useState(practice?.active ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (name.trim().length < 2) return setError("Escribí el nombre de la práctica");
    setError("");
    setSaving(true);
    try {
      await appApi(practice ? `/practices/${practice.id}` : "/practices", {
        method: practice ? "PUT" : "POST",
        body: { name: name.trim(), code: strOrNull(code), price: numOrNull(price) || 0, active },
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow="LISTA DE PRECIOS" title={practice ? practice.name : "Nueva práctica"} onClose={onClose}
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar práctica"}</button>
      </>}>
      <div className="product-form">
        <Field label="Práctica"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} placeholder="Ej. Extracción" autoFocus /></Field>
        <div className="form-row">
          <Field label="Código (opcional)"><input value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} /></Field>
          <Field label="Precio"><div className="mr-input-suffix"><span>$</span><input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></div></Field>
        </div>
        {practice && (
          <div className="mr-inline-checks">
            <label><input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} /> Ya no se usa (no aparece al armar presupuestos)</label>
          </div>
        )}
        <small className="mr-hint">Cambiar el precio no modifica los presupuestos ya armados.</small>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Presupuestos;
