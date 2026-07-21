// Brand color presets. Each theme fills the --brand-* CSS vars defined in
// app/globals.css. Selecting one writes these vars onto <html> at runtime, so
// the whole app recolors instantly and it persists in settings.theme.
//
// To add a color: append an entry here. `swatch` drives the picker dot.

export const THEMES = [
  {
    id: "purple",
    label: "Roxo",
    swatch: "#a98bff",
    accent: "#a98bff", accentDim: "#d0bcff", pale: "#e9ddff",
    deep: "#4f378b", deepest: "#21005d", onAccent: "#381e72", inverse: "#7c5cd6",
  },
  {
    id: "purpleDark",
    label: "Roxo escuro",
    swatch: "#7c5cff",
    accent: "#7c5cff", accentDim: "#a58bff", pale: "#e4dbff",
    deep: "#331b6f", deepest: "#150049", onAccent: "#f3edff", inverse: "#5333c4",
  },
  {
    id: "indigo",
    label: "Índigo",
    swatch: "#8ab4ff",
    accent: "#8ab4ff", accentDim: "#b3ccff", pale: "#dde8ff",
    deep: "#264b8f", deepest: "#001947", onAccent: "#06285d", inverse: "#3f66c4",
  },
  {
    id: "teal",
    label: "Turquesa",
    swatch: "#4fd6c4",
    accent: "#4fd6c4", accentDim: "#86e6d9", pale: "#cdf3ec",
    deep: "#12564d", deepest: "#00201c", onAccent: "#003731", inverse: "#2f9488",
  },
  {
    id: "green",
    label: "Verde",
    swatch: "#7bd88f",
    accent: "#7bd88f", accentDim: "#a6e6b3", pale: "#d4f3da",
    deep: "#1f5b2e", deepest: "#002109", onAccent: "#003914", inverse: "#3a9850",
  },
  {
    id: "amber",
    label: "Âmbar",
    swatch: "#ffc107",
    accent: "#ffc107", accentDim: "#fabd00", pale: "#ffe4af",
    deep: "#6d5100", deepest: "#261a00", onAccent: "#3f2e00", inverse: "#785900",
  },
  {
    id: "orange",
    label: "Laranja",
    swatch: "#ffb26b",
    accent: "#ffb26b", accentDim: "#ffcfa0", pale: "#ffe3cb",
    deep: "#8a4d17", deepest: "#2b1500", onAccent: "#4a2800", inverse: "#c47828",
  },
  {
    id: "rose",
    label: "Rosa",
    swatch: "#ff9ec7",
    accent: "#ff9ec7", accentDim: "#ffc0da", pale: "#ffdcea",
    deep: "#7d2a4f", deepest: "#370018", onAccent: "#5a0d34", inverse: "#c4497f",
  },
  {
    id: "crimson",
    label: "Carmesim",
    swatch: "#ff8a94",
    accent: "#ff8a94", accentDim: "#ffb3b8", pale: "#ffd9dc",
    deep: "#8c1d28", deepest: "#3a000a", onAccent: "#5f0512", inverse: "#c4495a",
  },
];

export const DEFAULT_THEME = "purple";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// Maps a theme object -> the --brand-* CSS custom properties.
function themeVars(t) {
  const [r, g, b] = hexToRgb(t.accent);
  return {
    "--brand-accent": t.accent,
    "--brand-accent-dim": t.accentDim,
    "--brand-pale": t.pale,
    "--brand-deep": t.deep,
    "--brand-deepest": t.deepest,
    "--brand-on-accent": t.onAccent,
    "--brand-inverse": t.inverse,
    "--brand-glow": `rgba(${r}, ${g}, ${b}, 0.22)`,
  };
}

// Applies a theme by id to <html>. Unknown id -> default. Safe on server (no-op).
export function applyTheme(id) {
  if (typeof document === "undefined") return;
  const t = THEMES.find((x) => x.id === id) || THEMES.find((x) => x.id === DEFAULT_THEME);
  if (!t) return;
  const root = document.documentElement;
  const vars = themeVars(t);
  for (const k in vars) root.style.setProperty(k, vars[k]);
}
