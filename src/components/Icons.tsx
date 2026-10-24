// Íconos del menú y de la barra superior: trazo simple, todos del mismo tamaño y grosor,
// heredan el color del texto (se ven igual en claro y oscuro).
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.2 8.2 7.8 5.6 7.8-5.6" /></>,
  home: <><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>,
  orders: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4.5V3h6v1.5" /><path d="M9 10h6M9 14h6M9 18h3" /></>,
  deliveries: <><path d="M3 6.5h11v9.5H3z" /><path d="M14 9.5h3.5L21 13v3h-7" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  sell: <><circle cx="9" cy="19.5" r="1.4" /><circle cx="17.5" cy="19.5" r="1.4" /><path d="M3 4h2.6l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.6" /></>,
  store: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" /></>,
  cash: <><rect x="3" y="6.5" width="18" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 10v4M17.5 10v4" /></>,
  invoice: <><path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2.5-1.6L8 20.5 6 19.2z" /><path d="M9 8h6M9 12h6" /></>,
  accounts: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><path d="M7 14.5h4" /></>,
  products: <><path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" /><path d="M4 8l8 4.5L20 8" /><path d="M12 12.5v8" /></>,
  customers: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.4-3.3 2.6-5 5.5-5s5.1 1.7 5.5 5" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17.5 14.8c1.7.6 2.7 2.2 3 4.7" /></>,
  stock: <><path d="M12 4 20.5 8.5 12 13 3.5 8.5z" /><path d="M3.5 12.5 12 17l8.5-4.5" /><path d="M3.5 16.2 12 20.7l8.5-4.5" /></>,
  suppliers: <><path d="M4 20.5V9l8-5 8 5v11.5" /><path d="M9 20.5v-6h6v6" /><path d="M9 10.5h6" /></>,
  purchases: <><path d="M5 8h14l-1 12.5H6z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  reports: <><path d="M4 20.5h16" /><path d="M7 20.5v-7M12 20.5V5M17 20.5v-10" /></>,
  sellers: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20.5c.5-3.8 3.2-5.8 7-5.8s6.5 2 7 5.8" /><path d="m9.8 17.6 1.6 1.6 3-3.2" /></>,
  users: <><circle cx="12" cy="8.2" r="3.6" /><path d="M5 20.5c.5-3.9 3.2-6 7-6s6.5 2.1 7 6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" /></>,
  systems: <><rect x="4" y="4" width="7" height="7" rx="1.8" /><rect x="13" y="4" width="7" height="7" rx="1.8" /><rect x="4" y="13" width="7" height="7" rx="1.8" /><rect x="13" y="13" width="7" height="7" rx="1.8" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  court: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M12 5.5v13" /><circle cx="12" cy="12" r="2.4" /></>,
  cup: <><path d="M7 8.5h10l-1.2 12H8.2z" /><path d="M6 8.5h12" /><path d="M13.5 8.5 15 3.5" /></>,
  trophy: <><path d="M8 4.5h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5.5c0 2.6 1 4 2.9 4.3M16 6h2.5c0 2.6-1 4-2.9 4.3" /><path d="M12 13.5v3.5M8.5 20.5h7M9.5 17h5v3.5h-5z" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  patient: <><circle cx="12" cy="8.2" r="3.6" /><path d="M5 20.5c.5-3.9 3.2-6 7-6s6.5 2.1 7 6" /></>,
  doctor: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></>,
  list: <><path d="M8.5 7h11M8.5 12h11M8.5 17h11" /><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" /></>,
  agreement: <><path d="M6.5 3.5h8l3.5 3.5v13.5h-11.5z" /><path d="M14.5 3.5V7H18" /><path d="M9.5 12h5M9.5 16h5" /></>,
  edit: <><path d="M4.5 19.5l1-4L16 5a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6L8.5 18.5z" /><path d="M14.5 6.5l3 3" /></>,
  upload: <><path d="M12 15.5v-11" /><path d="m7.5 9 4.5-4.5L16.5 9" /><path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" /></>,
  transfer: <><path d="M4 8.5h15" /><path d="m15.5 5 3.5 3.5-3.5 3.5" /><path d="M20 15.5H5" /><path d="m8.5 12-3.5 3.5L8.5 19" /></>,
  portal: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /></>,
  budget: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 7.5h7" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></>,
  sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" /></>,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  bell: <><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  logout: <><path d="M14 4.5h4.5v15H14" /><path d="M4 12h10" /><path d="m10.5 8.5 3.5 3.5-3.5 3.5" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8" /><path d="M12 16.8h.01" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg className="ui-icon" data-contrast-ignore width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] || PATHS.home}
    </svg>
  );
}
