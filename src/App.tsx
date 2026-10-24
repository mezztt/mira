import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { THEME_KEY } from "./config";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Panel general (Mezztt)
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import Sistemas from "./pages/admin/Sistemas";
import Pagos from "./pages/admin/Pagos";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminSettings from "./pages/admin/AdminSettings";
import MailCenter from "./pages/admin/MailCenter";

// Sistema (consultorio o círculo)
import ClientLayout from "./pages/app/ClientLayout";
import Inicio from "./pages/app/Inicio";
import Usuarios from "./pages/app/Usuarios";
import Configuracion from "./pages/app/Configuracion";
// consultorio
import Agenda from "./pages/app/consultorio/Agenda";
import Pacientes from "./pages/app/consultorio/Pacientes";
import Paciente from "./pages/app/consultorio/Paciente";
import Cobros from "./pages/app/consultorio/Cobros";
import Profesionales from "./pages/app/consultorio/Profesionales";
import Presupuestos from "./pages/app/consultorio/Presupuestos";
// consultorio y círculo
import Reportes from "./pages/app/Reportes";
// círculo médico
import Padron from "./pages/app/circulo/Padron";
import Convenios from "./pages/app/circulo/Convenios";
import Prestaciones from "./pages/app/circulo/Prestaciones";
import Presentaciones from "./pages/app/circulo/Presentaciones";
import Liquidaciones from "./pages/app/circulo/Liquidaciones";
import Portal from "./pages/app/circulo/Portal";

// Impresos
import PrintDocumento from "./pages/print/PrintDocumento";
import PrintHC from "./pages/print/PrintHC";
import PrintRecibo from "./pages/print/PrintRecibo";
import PrintPresupuesto from "./pages/print/PrintPresupuesto";

// Web pública de turnos (pacientes)
import Reservar from "./pages/public/Reservar";
import Ticket from "./pages/public/Ticket";
import Legal from "./pages/public/Legal";

function App() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    // las páginas públicas siguen el tema del navegador (CSS prefers-color-scheme); useLightPage solo fija los tokens del panel en claro
    if (/^\/(t|legal)\//.test(window.location.pathname)) return;
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* PANEL GENERAL (Mezztt) */}
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/sistemas" element={<Sistemas />} />
          <Route path="/admin/pagos" element={<Pagos />} />
          <Route path="/admin/facturacion" element={<AdminBilling />} />
          <Route path="/admin/correos" element={<MailCenter />} />
          <Route path="/admin/configuracion" element={<AdminSettings />} />
        </Route>

        {/* SISTEMA */}
        <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
          <Route path="/app" element={<Inicio />} />
          <Route path="/app/agenda" element={<Agenda />} />
          <Route path="/app/pacientes" element={<Pacientes />} />
          <Route path="/app/pacientes/:id" element={<Paciente />} />
          <Route path="/app/cobros" element={<Cobros />} />
          <Route path="/app/profesionales" element={<Profesionales />} />
          <Route path="/app/presupuestos" element={<Presupuestos />} />
          <Route path="/app/reportes" element={<Reportes />} />
          <Route path="/app/padron" element={<Padron />} />
          <Route path="/app/convenios" element={<Convenios />} />
          <Route path="/app/prestaciones" element={<Prestaciones />} />
          <Route path="/app/presentaciones" element={<Presentaciones />} />
          <Route path="/app/liquidaciones" element={<Liquidaciones />} />
          <Route path="/app/portal" element={<Portal />} />
          <Route path="/app/usuarios" element={<Usuarios />} />
          <Route path="/app/configuracion" element={<Configuracion />} />
        </Route>

        {/* IMPRESOS (sin menú) */}
        <Route path="/print/documento/:id" element={<ProtectedRoute><PrintDocumento /></ProtectedRoute>} />
        <Route path="/print/hc/:id" element={<ProtectedRoute><PrintHC /></ProtectedRoute>} />
        <Route path="/print/presupuesto/:id" element={<ProtectedRoute><PrintPresupuesto /></ProtectedRoute>} />
        <Route path="/print/recibo/:sid/:lineId" element={<ProtectedRoute><PrintRecibo /></ProtectedRoute>} />
        <Route path="/print/mi-recibo/:lineId" element={<ProtectedRoute><PrintRecibo portal /></ProtectedRoute>} />

        {/* WEB DE TURNOS */}
        <Route path="/t/:slug" element={<Reservar />} />
        <Route path="/t/:slug/turno/:code" element={<Ticket />} />

        {/* LEGALES (sin login) */}
        <Route path="/legal/terminos" element={<Legal doc="terminos" />} />
        <Route path="/legal/privacidad" element={<Legal doc="privacidad" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
