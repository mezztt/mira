import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Icon from "../../components/Icons";
import { ADMIN_TOKEN_KEY, THEME_KEY } from "../../config";
import { useEffect, useState } from "react";
import Tour from "../../components/tour/Tour";
import { adminTourSteps } from "../../components/tour/steps";
import { MezzttLink, MiraLogo, SidebarSignature } from "../../components/Brand";

const NAV = [
  { section: "GESTIÓN" },
  { path: "/admin", icon: "home", label: "Inicio" },
  { path: "/admin/sistemas", icon: "systems", label: "Sistemas" },
  { path: "/admin/pagos", icon: "cash", label: "Pagos" },
  { path: "/admin/facturacion", icon: "invoice", label: "Facturación" },
  { path: "/admin/correos", icon: "mail", label: "Correos" },
  { section: "SISTEMA" },
  { path: "/admin/configuracion", icon: "settings", label: "Configuración" },
] as const;

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [menuOpen, setMenuOpen] = useState(false);   // en el celular el menú se abre con un botón

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
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
            <strong>MIRA</strong>
            <span>Panel general · <MezzttLink /></span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            "section" in item ? (
              <div key={i} className="nav-section">{item.section}</div>
            ) : (
              <button
                key={item.path}
                data-tour={`admin-${item.path.split("/")[2] || "inicio"}`}
                className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <span aria-hidden="true"><Icon name={item.icon} /></span>
                <span className="nav-item-text">{item.label}</span>
              </button>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <SidebarSignature />
          <button className="logout-button" data-tour="theme" onClick={toggleTheme} style={{ marginBottom: 6 }}>
            <span className="nav-item-text with-icon"><Icon name={theme === "dark" ? "sun" : "moon"} size={15} />{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <button className="logout-button" onClick={logout}>
            <span className="nav-item-text with-icon"><Icon name="logout" size={15} />Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <Tour steps={adminTourSteps()} storageKey="mira_superadmin_x" />
      <div className="main-area">
        <header className="mr-topbar mr-topbar-admin">
          <button type="button" className="mr-menu-button" aria-label="Abrir el menú" aria-expanded={menuOpen} aria-controls="mr-sidebar"
            onClick={() => setMenuOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <strong>MIRA · Panel general</strong>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
