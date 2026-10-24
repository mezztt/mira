import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL, APP_BRAND, APP_NAME, APP_VERSION, DEFAULT_BRAND_LINKS, THEME_KEY } from "../config";
import type { BrandLinks } from "../config";

// =====================================================================
// Logos (familia Mezztt: misma construcción, cambian el color y la letra)
// =====================================================================
const LOGO_PATH = "M14 35 V19 L24 30 L34 19 V35";           // la M de MIRA
export const BRAND_COLOR = "#0b5f68";
export const BRAND_ACCENT = "#6fd0d7";

function FamilyLogo({ size, label, color, accent, path }: { size: number; label: string; color: string; accent: string; path: string }) {
  return (
    <svg className="mr-logo" data-contrast-ignore width={size} height={size} viewBox="0 0 48 48" aria-label={label} role="img">
      <rect width="48" height="48" rx="13" fill={color} />
      <path d={path} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="37" cy="11" r="3" fill={accent} />
    </svg>
  );
}

/** Logo de MIRA */
export function MiraLogo({ size = 40 }: { size?: number }) {
  return <FamilyLogo size={size} label={APP_NAME} color={BRAND_COLOR} accent={BRAND_ACCENT} path={LOGO_PATH} />;
}

/** Logo de Mezztt (la marca con la que firmás tus sistemas) */
export function MezzttMark({ size = 18 }: { size?: number }) {
  return <img className="mr-logo" src="/mezztt-logo.png" width={size} height={size} alt={APP_BRAND} style={{ borderRadius: "27%" }} />;
}

// =====================================================================
// Enlaces de marca (Instagram del sistema, Instagram y página de Mezztt)
// =====================================================================
let brandCache: BrandLinks | null = null;
let brandRequest: Promise<BrandLinks> | null = null;

const isUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//i.test(v);

function loadBrandLinks(): Promise<BrandLinks> {
  if (!brandRequest) {
    brandRequest = fetch(`${API_URL}/public/brand`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Partial<BrandLinks>) => {
        brandCache = {
          system_instagram_url: isUrl(d.system_instagram_url) ? d.system_instagram_url : DEFAULT_BRAND_LINKS.system_instagram_url,
          mezztt_instagram_url: isUrl(d.mezztt_instagram_url) ? d.mezztt_instagram_url : DEFAULT_BRAND_LINKS.mezztt_instagram_url,
          mezztt_site_url: isUrl(d.mezztt_site_url) ? d.mezztt_site_url : "",
        };
        return brandCache;
      })
      .catch(() => DEFAULT_BRAND_LINKS);   // si falla, quedan los valores por defecto
  }
  return brandRequest;
}

/** Para que el panel vuelva a pedirlos después de cambiarlos */
export function resetBrandLinks() {
  brandCache = null;
  brandRequest = null;
}

/** Enlaces de marca: arranca con los valores por defecto y pide /public/brand una sola vez. */
export function useBrandLinks(): BrandLinks {
  const [links, setLinks] = useState<BrandLinks>(brandCache || DEFAULT_BRAND_LINKS);
  useEffect(() => {
    let alive = true;
    loadBrandLinks().then((l) => { if (alive) setLinks(l); });
    return () => { alive = false; };
  }, []);
  return links;
}

/** "Mezztt" como enlace a su página (o a su Instagram si todavía no hay página) */
export function MezzttLink({ className }: { className?: string }) {
  const links = useBrandLinks();
  return (
    <a className={`mr-brand-link ${className || ""}`} href={links.mezztt_site_url || links.mezztt_instagram_url}
      target="_blank" rel="noopener noreferrer">{APP_BRAND}</a>
  );
}

/** Ícono de Instagram (SVG propio, sin librerías) */
export function InstagramLink({ href, label, size = 19 }: { href: string; label: string; size?: number }) {
  return (
    <a className="mr-ig" href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5.2" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
      </svg>
    </a>
  );
}

/** Marca escrita: nombre + "v1.0.0 · by Mezztt" */
export function BrandWordmark({ size = 44, tagline, instagram }: { size?: number; tagline?: string; instagram?: boolean }) {
  const links = useBrandLinks();
  return (
    <div className="mr-wordmark">
      <MiraLogo size={size} />
      <div>
        <strong>{APP_NAME}</strong>
        <small>
          v{APP_VERSION} · by <MezzttLink />
          {instagram && <InstagramLink href={links.mezztt_instagram_url} label={`Instagram de ${APP_BRAND}`} size={16} />}
        </small>
        {tagline && <span>{tagline}</span>}
      </div>
    </div>
  );
}

/** Firma del sistema para el pie del menú lateral */
export function SidebarSignature() {
  const links = useBrandLinks();
  return (
    <div className="mr-signature">
      <MiraLogo size={26} />
      <span className="mr-signature-text">
        <strong>{APP_NAME} v{APP_VERSION}</strong>
        <small>by <MezzttLink /></small>
      </span>
      <InstagramLink href={links.system_instagram_url} label={`Instagram de ${APP_NAME}`} />
    </div>
  );
}

/** Las páginas públicas no usan el tema del panel: mientras se ven, los tokens del panel quedan en claro
 *  (si el encargado dejó el sistema en modo oscuro en este navegador, no se mezcla). El claro/oscuro de
 *  la página lo decide el navegador de quien la abre (prefers-color-scheme, ver mira.css). */
export function useLightPage() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
    return () => { root.setAttribute("data-theme", localStorage.getItem(THEME_KEY) || "light"); };
  }, []);
}

/** Enlaces a los textos legales */
export function LegalLinks() {
  return (
    <nav className="mr-legal-links" aria-label="Legales">
      <Link to="/legal/terminos">Términos</Link>
      <span aria-hidden="true">·</span>
      <Link to="/legal/privacidad">Privacidad</Link>
    </nav>
  );
}

/** Pie para páginas públicas y login: marca, redes y legales */
export function PoweredBy({ light = false, legal = true }: { light?: boolean; legal?: boolean }) {
  const links = useBrandLinks();
  return (
    <div className={`mr-powered ${light ? "is-light" : ""}`}>
      <div className="mr-powered-row">
        <MiraLogo size={20} />
        <span className="mr-powered-name">{APP_NAME}</span>
        <span>v{APP_VERSION}</span>
        <InstagramLink href={links.system_instagram_url} label={`Seguí a ${APP_NAME} en Instagram`} />
        <span className="mr-powered-sep" aria-hidden="true">·</span>
        <span>by <MezzttLink /></span>
        <InstagramLink href={links.mezztt_instagram_url} label={`Instagram de ${APP_BRAND}`} />
      </div>
      {legal && <LegalLinks />}
    </div>
  );
}
