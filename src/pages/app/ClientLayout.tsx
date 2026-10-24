import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  appApi, canAccess, getSessionUser, moduleLabel, KIND_LABELS, ROLE_LABELS, THEME_KEY, TOKEN_KEY, USER_KEY, longDate,
} from "../../config";
import type { PatientLite, SessionUser } from "../../config";
import NotificationsBell from "../../components/NotificationsBell";
import { MiraLogo, SidebarSignature } from "../../components/Brand";
import Assistant from "../../components/Assistant";
import Tour, { startTour } from "../../components/tour/Tour";
import { tourSteps } from "../../components/tour/steps";

const ICONS: Record<string, string> = {
  inicio: "home", agenda: "calendar", pacientes: "patient", cobros: "cash", profesionales: "doctor",
  padron: "list", convenios: "agreement", prestaciones: "edit", presentaciones: "upload", liquidaciones: "transfer", portal_medico: "portal",
  usuarios: "customers", configuracion: "settings", presupuestos: "budget", reportes: "reports",
};

const MENU: Record<string, { section: string; items: string[] }[]> = {
  CONSULTORIO: [
    { section: "DÍA A DÍA", items: ["inicio", "agenda", "pacientes", "cobros", "presupuestos"] },
    { section: "CONSULTORIO", items: ["profesionales", "reportes", "usuarios", "configuracion"] },
  ],
  CIRCULO: [
    { section: "GESTIÓN", items: ["inicio", "padron", "convenios", "agenda"] },
    { section: "FACTURACIÓN", items: ["prestaciones", "presentaciones", "liquidaciones", "reportes"] },
    { section: "CÍRCULO", items: ["usuarios", "configuracion"] },
  ],
  // el médico del círculo: su portal y su agenda, nada más
  MEDICO: [{ section: "MI CUENTA", items: ["portal_medico", "agenda"] }],
};

const PATH: Record<string, string> = { inicio: "/app", portal_medico: "/app/portal" };
const pathFor = (m: string) => PATH[m] || `/app/${m}`;
const LABEL: Record<string, string> = {
  agenda: "Agenda", padron: "Padrón", convenios: "Convenios", prestaciones: "Prestaciones",
  presentaciones: "Presentaciones", liquidaciones: "Liquidaciones", portal_medico: "Mi portal",
  documentos: "Documentos", presupuestos: "Presupuestos", reportes: "Reportes",
};
/** Pantallas que puede abrir el médico del círculo (según los módulos del círculo) */
const DOCTOR_PATHS: [string, string][] = [["portal_medico", "/app/portal"], ["agenda", "/app/agenda"]];

function QuickSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PatientLite[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems([]); return; }
    const t = window.setTimeout(() => {
      appApi<{ items: PatientLite[] }>(`/patients?limit=8&q=${encodeURIComponent(term)}`)
        .then((r) => { setItems(r.items); setOpen(true); }).catch(() => setItems([]));
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="mr-quick-search" ref={box} data-tour="search">
      <span aria-hidden="true">⌕</span>
      <input placeholder="Buscar paciente por nombre o DNI…" value={q} onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)} aria-label="Buscar paciente" />
      {open && q.trim().length >= 2 && (
        <div className="mr-quick-results">
          {items.length === 0 ? <button type="button" disabled><small>Sin resultados</small></button> : items.map((p) => (
            <button key={p.id} type="button" onClick={() => { setOpen(false); setQ(""); navigate(`/app/pacientes/${p.id}`); }}>
              <span><strong>{p.full_name}</strong></span>
              <small>{p.dni ? `DNI ${p.dni}` : ""}{p.insurance_name ? ` · ${p.insurance_name}` : ""}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(getSessionUser());
  const [clock, setClock] = useState(new Date());
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);   // en el celular el menú se abre con un botón

  // refresca módulos/rol por si los cambiaron desde el panel general
  useEffect(() => {
    appApi<SessionUser>("/auth/me")
      .then((me) => { localStorage.setItem(USER_KEY, JSON.stringify(me)); setUser(me); })
      .catch(() => {});
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // el médico del círculo solo tiene su portal y su agenda (lo que el círculo tenga contratado)
  useEffect(() => {
    if (user?.role !== "MEDICO") return;
    const allowed = DOCTOR_PATHS.filter(([m]) => canAccess(user, m)).map(([, p]) => p);
    if (allowed.length && !allowed.includes(location.pathname)) navigate(allowed[0], { replace: true });
  }, [user, location.pathname, navigate]);

  // módulos extra: si el plan no lo tiene o el rol no puede verlo, vuelve al inicio
  useEffect(() => {
    if (!user || user.role === "MEDICO") return;
    const guarded = ["presupuestos", "reportes", "agenda"].find((m) => location.pathname === `/app/${m}`);
    if (guarded && !canAccess(user, guarded)) navigate("/app", { replace: true });
  }, [user, location.pathname, navigate]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const kind = user?.kind || "CONSULTORIO";
  const isDoctor = user?.role === "MEDICO";
  const sections = (MENU[isDoctor ? "MEDICO" : kind] || []).map((s) => ({ ...s, items: s.items.filter((m) => canAccess(user, m)) })).filter((s) => s.items.length);
  const labelFor = (m: string) => {
    if (m === "agenda" && kind === "CIRCULO") return isDoctor ? "Mi agenda" : "Agenda de médicos";
    return LABEL[m] || moduleLabel(m, kind);
  };
  const current = location.pathname.startsWith("/app/pacientes") ? "pacientes"
    : Object.keys(ICONS).find((m) => location.pathname === pathFor(m)) || "inicio";

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className={`app-layout ${menuOpen ? "mr-menu-open" : ""}`}>
      {menuOpen && <button type="button" className="mr-menu-backdrop" aria-label="Cerrar el menú" onClick={() => setMenuOpen(false)} />}
      <aside className="sidebar" id="mr-sidebar">
        <div className="sidebar-brand">
          <MiraLogo size={40} />
          <div className="sidebar-brand-text">
            <strong>{user?.company_name || "MIRA"}</strong>
            <span>MIRA · {KIND_LABELS[kind]}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {sections.map((s) => (
            <div key={s.section}>
              {sections.length > 1 && <div className="nav-section">{s.section}</div>}
              {s.items.map((m) => (
                <button key={m} data-tour={`nav-${m}`} className={`nav-item ${current === m ? "active" : ""}`} onClick={() => navigate(pathFor(m))}>
                  <span aria-hidden="true"><Icon name={ICONS[m]} /></span>
                  <span className="nav-item-text">{labelFor(m)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="mr-user-mini">
            <strong>{user?.name}</strong>
            <span>{ROLE_LABELS[user?.role || ""] || user?.role}</span>
          </div>
          <button className="logout-button" data-tour="theme" onClick={toggleTheme} style={{ marginBottom: 6 }}>
            <span className="nav-item-text with-icon"><Icon name={theme === "dark" ? "sun" : "moon"} size={15} />{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <button className="logout-button" data-tour="tour-help" onClick={startTour} style={{ marginBottom: 6 }}><span className="nav-item-text with-icon"><Icon name="help" size={15} />¿Cómo funcionamos?</span></button>
          <button className="logout-button" onClick={logout}><span className="nav-item-text with-icon"><Icon name="logout" size={15} />Cerrar sesión</span></button>
          <SidebarSignature />
        </div>
      </aside>
      {user && <Tour steps={tourSteps(user)} storageKey={`mira_${user.role.toLowerCase()}_${user.id ?? "x"}`} />}
      {user && <Assistant user={user} />}
      <div className="main-area">
        <header className="mr-topbar">
          <button type="button" className="mr-menu-button" aria-label="Abrir el menú" aria-expanded={menuOpen} aria-controls="mr-sidebar"
            onClick={() => setMenuOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="mr-topbar-when">
            <span className="mr-topbar-date">{longDate(clock)}</span>
            <strong className="mr-topbar-clock">{clock.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}</strong>
          </div>
          <div className="mr-topbar-right">
            {kind === "CONSULTORIO" && canAccess(user, "pacientes") && <QuickSearch />}
            <span data-tour="bell" className="mr-tour-wrap"><NotificationsBell onNew={() => setRefreshKey((k) => k + 1)} /></span>
          </div>
        </header>
        <main className="page-content">
          {/* refreshKey: cuando llega un aviso nuevo, las pantallas se recargan solas */}
          <Outlet context={{ refreshKey }} />
        </main>
      </div>
    </div>
  );
}

export default ClientLayout;
