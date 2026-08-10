// Light/dark mode. The actual colors live in app/globals.css:
//   - dark (default): navy/slate surfaces, verde de ação + azul de destaque
//   - html.light: azul sobre superfícies claras e frias
// applyMode just toggles the `light`/`dark` class on <html>; the CSS does the rest.

export const MODES = [
  { id: "dark", label: "Escuro", icon: "dark_mode" },
  { id: "light", label: "Claro", icon: "light_mode" },
];

export const DEFAULT_MODE = "dark";

export function applyMode(mode) {
  if (typeof document === "undefined") return;
  const m = MODES.some((x) => x.id === mode) ? mode : DEFAULT_MODE;
  const root = document.documentElement;
  root.classList.toggle("light", m === "light");
  root.classList.toggle("dark", m === "dark");
}
