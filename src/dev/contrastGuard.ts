/* =========================================================
   GUARDIA DE CONTRASTE (solo en desarrollo, `npm run dev`)
   ---------------------------------------------------------
   Revisa cada texto, campo e ícono visible contra su fondo real
   y avisa si no se lee bien (norma WCAG AA):
     · texto normal  ≥ 4.5 : 1
     · texto grande  ≥ 3   : 1  (18px, o 14px en negrita)
     · íconos / svg  ≥ 3   : 1
   Si encuentra algo:
     · lo marca con un borde rojo punteado en pantalla
     · lo lista en la consola (F12) con el contraste y los colores
   También podés correrlo a mano en la consola: revisarContraste()
   En producción (`npm run build`) este archivo no se incluye.
========================================================= */

type RGBA = { r: number; g: number; b: number; a: number };
export type ContrastIssue = { el: Element; text: string; ratio: number; need: number; fg: string; bg: string };

const MARK = "data-contrast-warn";

function parse(c: string): RGBA | null {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function hex(h: string): RGBA {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
}
function lum({ r, g, b }: RGBA) {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function blend(top: RGBA, bot: RGBA): RGBA {
  const a = top.a;
  return { r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a), a: 1 };
}
function ratioOf(a: RGBA, b: RGBA) {
  const L1 = lum(a), L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
const css = (c: RGBA) => `rgb(${c.r | 0}, ${c.g | 0}, ${c.b | 0})`;

/** Color de fondo efectivo detrás de un elemento (suma capas semitransparentes y degradados). */
function backgroundOf(el: Element): RGBA {
  const layers: RGBA[] = [];
  let gradient: string | null = null;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== "none" && !cs.backgroundImage.startsWith("url")) gradient = cs.backgroundImage;
    const c = parse(cs.backgroundColor);
    if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    if (gradient) break;
  }
  let base: RGBA = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  if (base.a === 0) base = { r: 255, g: 255, b: 255, a: 1 };
  if (gradient) {
    const cols = (gradient.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) || [])
      .map((c) => (c.startsWith("#") ? hex(c) : parse(c)))
      .filter((c): c is RGBA => !!c);
    if (cols.length) {
      const n = cols.length;
      layers.push(cols.reduce((s, c) => ({ r: s.r + c.r / n, g: s.g + c.g / n, b: s.b + c.b / n, a: 1 }), { r: 0, g: 0, b: 0, a: 1 }));
    }
  }
  let col = base;
  for (let i = layers.length - 1; i >= 0; i--) col = blend(layers[i], col);
  return col;
}

function visible(el: Element) {
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || cs.display === "none") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function opacityChain(el: Element) {
  let op = 1;
  for (let n: Element | null = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity);
  return op;
}
/** Elementos que a propósito se ven apagados (deshabilitados, horarios pasados, ocupados). */
const DIMMED = "[disabled],.past,.is-past,.is-full,.mr-slot.done,.pub-court.is-taken,[data-contrast-ignore]";

export function revisarContraste(): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  const seen = new Set<Element>();

  // 1) textos
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = (node.textContent || "").trim();
    const el = node.parentElement;
    if (!text || !el || seen.has(el) || el.closest("script,style,input,textarea,select,option")) continue;
    if (!visible(el)) continue;
    const op = opacityChain(el);
    if (op === 0) continue;
    const cs = getComputedStyle(el);
    const fg0 = parse(cs.color);
    if (!fg0) continue;
    const bg = backgroundOf(el);
    const fg = blend({ ...fg0, a: fg0.a * op }, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight) >= 600;
    const need = el.closest(DIMMED) ? 2.2 : size >= 18 || (size >= 14 && bold) ? 3 : 4.5;
    const ratio = ratioOf(fg, bg);
    if (ratio < need) { seen.add(el); issues.push({ el, text: text.slice(0, 50), ratio, need, fg: css(fg), bg: css(bg) }); }
  }

  // 2) campos de formulario (valor escrito)
  document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),select,textarea").forEach((el) => {
    if (!visible(el)) return;
    const fg0 = parse(getComputedStyle(el).color);
    if (!fg0) return;
    const bg = backgroundOf(el);
    const ratio = ratioOf(blend(fg0, bg), bg);
    const need = el.closest(DIMMED) ? 2.2 : 4.5;
    if (ratio < need) issues.push({ el, text: `[campo ${(el as HTMLInputElement).placeholder || el.tagName.toLowerCase()}]`, ratio, need, fg: css(fg0), bg: css(bg) });
  });

  // 3) íconos svg monocromo (los que usan currentColor o un fill/stroke único)
  document.querySelectorAll("svg").forEach((svg) => {
    if (!visible(svg) || svg.closest(DIMMED) || svg.closest("[data-contrast-ignore]")) return;
    // los dibujos de canchas tienen fondo propio: se revisan sus textos, no el dibujo
    if (svg.querySelectorAll("*").length > 12) return;
    const shape = svg.querySelector("path,circle,rect,polygon,line,polyline");
    if (!shape) return;
    const cs = getComputedStyle(shape);
    const paint = cs.fill && cs.fill !== "none" ? cs.fill : cs.stroke;
    const fg0 = parse(paint || "");
    if (!fg0 || fg0.a === 0) return;
    const bg = backgroundOf(svg.parentElement || svg);
    const ratio = ratioOf(blend({ ...fg0, a: fg0.a * opacityChain(svg) }, bg), bg);
    if (ratio < 3) issues.push({ el: svg, text: "[ícono]", ratio, need: 3, fg: css(fg0), bg: css(bg) });
  });

  // 4) imágenes que no cargaron (se verían como un hueco)
  document.querySelectorAll("img").forEach((img) => {
    if (visible(img) && img.complete && img.naturalWidth === 0) {
      issues.push({ el: img, text: `[imagen rota ${img.getAttribute("src")}]`, ratio: 0, need: 1, fg: "-", bg: "-" });
    }
  });

  return issues;
}

function paint(issues: ContrastIssue[]) {
  document.querySelectorAll(`[${MARK}]`).forEach((n) => {
    (n as HTMLElement).style.outline = "";
    n.removeAttribute(MARK);
  });
  issues.forEach(({ el, ratio, need }) => {
    const h = el as HTMLElement;
    h.setAttribute(MARK, `${ratio.toFixed(2)} < ${need}`);
    if (h.style) h.style.outline = "2px dashed #e11d48";
  });
}

let lastKey = "";
function run() {
  const issues = revisarContraste();
  paint(issues);
  const key = issues.map((i) => i.text + i.ratio.toFixed(2)).join("|");
  if (key === lastKey) return;
  lastKey = key;
  if (issues.length) {
    console.groupCollapsed(`%c⚠ Contraste: ${issues.length} elemento(s) difíciles de leer`, "color:#e11d48;font-weight:700");
    console.table(issues.map((i) => ({ texto: i.text, contraste: i.ratio.toFixed(2), minimo: i.need, color: i.fg, fondo: i.bg })));
    issues.forEach((i) => console.log(i.el));
    console.groupEnd();
  }
}

export function startContrastGuard() {
  (window as unknown as { revisarContraste: () => void }).revisarContraste = () => {
    lastKey = "";
    run();
    return "listo: mirá la tabla de arriba (vacía = todo se lee bien)";
  };
  let timer: number | undefined;
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(run, 1200); };
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  schedule();
}
