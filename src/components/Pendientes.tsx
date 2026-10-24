import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, money } from "../config";
import type { PendingItem } from "../config";
import { useRefreshKey } from "./ui";

/**
 * Panel «Pendientes»: lo que requiere acción hoy, con su cantidad y un clic a la pantalla.
 * exclude: claves que esa pantalla ya muestra de otra forma · hideEmpty: no ocupa lugar si no hay nada.
 */
export default function Pendientes({ exclude, hideEmpty }: { exclude?: string[]; hideEmpty?: boolean } = {}) {
  const navigate = useNavigate();
  const refreshKey = useRefreshKey();
  const [items, setItems] = useState<PendingItem[] | null>(null);

  useEffect(() => {
    const load = () => appApi<{ items: PendingItem[] }>("/dashboard/pending").then((r) => setItems(r.items)).catch(() => setItems((x) => x || []));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [refreshKey]);

  if (!items) return null;
  const list = exclude ? items.filter((i) => !exclude.includes(i.key)) : items;
  if (hideEmpty && list.length === 0) return null;
  return (
    <div className="mr-card mr-pending" aria-label="Pendientes" data-tour="pendientes">
      <div className="mr-card-head">
        <div><h2>Pendientes</h2><p>{list.length ? "Lo que hay para resolver hoy. Tocá uno para ir a esa pantalla." : "No hay nada esperando."}</p></div>
      </div>
      {list.length === 0 ? <div className="mr-pending-ok"><span aria-hidden="true">✓</span> Todo al día</div> : (
        <div className="mr-pending-grid">
          {list.map((i) => (
            <button key={i.key} type="button" className={`mr-pending-item is-${i.tone}`} onClick={() => navigate(i.path)}>
              <b>{i.count}</b>
              <span><strong>{i.label}</strong><small>{i.hint}{i.amount ? `${i.hint ? " · " : ""}${money(i.amount)}` : ""}</small></span>
              <i aria-hidden="true">›</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
