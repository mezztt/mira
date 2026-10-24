import { useEffect, useRef, useState } from "react";
import { appApi } from "../config";

interface Notif {
  id: number;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

const POLL_MS = 20000;

const NOTIF_ICON: Record<string, string> = {
  TURNO_WEB: "★", TURNO_CANCELADO: "×", TURNO_AUSENTE: "∅", EN_ESPERA: "⧗",
  OBSERVADA: "!", DEBITO: "−", LIQUIDACION: "$",
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "recién";
  if (diff < 60) return `hace ${Math.floor(diff)} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)} h`;
  return new Date(iso).toLocaleDateString("es-AR");
}

/** Pitido corto cuando llega un aviso nuevo (sin archivos de audio) */
function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch { /* sin sonido */ }
}

/**
 * Campanita de notificaciones + avisos emergentes.
 * Consulta cada 20 s: ahí el servidor también marca los ausentes y avisa
 * turnos web, pacientes en sala de espera, observaciones, débitos y liquidaciones.
 */
function NotificationsBell({ onNew }: { onNew?: () => void }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Notif[]>([]);
  const lastSeen = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await appApi<{ unread_count: number; notifications: Notif[] }>("/notifications");
      setItems(data.notifications);
      setUnread(data.unread_count);
      const maxId = data.notifications.reduce((m, n) => Math.max(m, n.id), 0);
      if (lastSeen.current !== null) {
        const fresh = data.notifications.filter((n) => n.id > (lastSeen.current as number) && !n.read);
        if (fresh.length) {
          setToasts((t) => [...fresh, ...t].slice(0, 4));
          beep();
          onNew?.();
          fresh.forEach((n) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 12000));
        }
      }
      lastSeen.current = Math.max(lastSeen.current ?? 0, maxId);
    } catch { /* sin conexión: reintenta en el próximo ciclo */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function markRead(n: Notif) {
    if (n.read) return;
    await appApi(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function markAll() {
    await appApi("/notifications/read-all", { method: "POST" }).catch(() => {});
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  return (
    <>
      <div className="mr-bell-wrap" ref={boxRef}>
        <button className="mr-bell" onClick={() => setOpen(!open)} aria-label="Notificaciones">
          🔔{unread > 0 && <span className="mr-bell-count">{unread > 9 ? "9+" : unread}</span>}
        </button>
        {open && (
          <div className="mr-bell-panel">
            <div className="mr-bell-head">
              <strong>Notificaciones</strong>
              {unread > 0 && <button onClick={markAll}>Marcar todas como leídas</button>}
            </div>
            {items.length === 0 ? (
              <p className="mr-muted" style={{ padding: 16 }}>No hay notificaciones.</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id} className={n.read ? "" : "is-unread"} onClick={() => markRead(n)}>
                    <span className={`mr-notif-icon t-${n.type}`}>{NOTIF_ICON[n.type] || "•"}</span>
                    <div>
                      <strong>{n.title}</strong>
                      {n.message && <p>{n.message}</p>}
                      <small>{timeAgo(n.created_at)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mr-toasts">
        {toasts.map((n) => (
          <div key={n.id} className={`mr-toast t-${n.type}`} onClick={() => { markRead(n); setToasts((t) => t.filter((x) => x.id !== n.id)); }}>
            <strong>{n.title}</strong>
            {n.message && <span>{n.message}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

export default NotificationsBell;
