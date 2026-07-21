"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppProvider, useApp } from "./AppContext";
import { MI, Caps } from "@/components/ui";
import { TABS, gamify, fmtK } from "@/lib/state";
import { hasSupabase } from "@/lib/persistence";
import { DEFAULT_MODE } from "@/lib/themes";

// bottom nav mobile: 4 destinos fixos + MAIS (bottom sheet com o resto)
const MOBILE_PRIMARY = ["home", "habitos", "exercicio", "sono"];

function Chrome({ children }) {
  const { loaded, state, handleLogout, setSetting } = useApp();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-outline">
        <p className="font-label-caps text-label-caps">CARREGANDO PAINEL...</p>
      </div>
    );
  }

  const g = gamify(state.stats);

  const mode = state.settings.mode || DEFAULT_MODE;

  return (
    <div className="min-h-screen bg-background">
      {/* toggle de tema sutil (canto) */}
      <button
        onClick={() => setSetting("mode", mode === "light" ? "dark" : "light")}
        aria-label={mode === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
        title="Alternar tema"
        className="fixed top-3 right-3 z-[60] w-8 h-8 rounded-full grid place-items-center text-on-surface-variant/50 hover:text-on-surface hover:bg-surface-variant/50 transition"
      >
        <MI name={mode === "light" ? "dark_mode" : "light_mode"} className="text-[18px]" />
      </button>

      {/* Side nav (desktop) — clássica */}
      <aside className="hidden md:flex flex-col bg-surface-container border-r border-outline-variant w-64 fixed left-0 top-0 bottom-0 pt-6 pb-6 z-40">
        <div className="px-6 mb-6 flex items-center justify-between">
          <div className="font-headline-md text-headline-md font-black text-primary tracking-tighter flex items-center gap-2 leading-none">
            <MI name="fitness_center" className="text-primary-container" /> DISCIPLINE<br />RATS
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/perfil"
              aria-label="Perfil"
              className={`p-1 transition active:opacity-80 ${pathname === "/perfil" ? "text-primary-container" : "text-primary"}`}
            >
              <MI name="account_circle" fill={pathname === "/perfil"} />
            </Link>
          </div>
        </div>
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold">
              {g.level}
            </div>
            <div>
              <div className="font-headline-md text-headline-md text-primary leading-tight">{g.tier}</div>
              <Caps className="text-[10px] text-outline-variant">MODO DISCIPLINE RATS</Caps>
            </div>
          </div>
          <div className="w-full bg-surface-variant h-1.5 rounded-full mt-4">
            <div className="bg-primary-container h-full rounded-full" style={{ width: `${g.pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-label-caps text-outline mt-1">
            <span>NÍVEL {g.level}</span>
            <span>{fmtK(g.xp)} XP</span>
          </div>
        </div>

        <nav className="flex-1">
          {TABS.map((t) => {
            const active = pathname === t.path;
            return (
              <Link
                key={t.id}
                href={t.path}
                className={`w-[calc(100%-1rem)] mx-2 my-1 px-4 py-3 flex items-center gap-3 font-label-caps text-label-caps rounded-lg active:scale-95 duration-150 transition ${
                  active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
                }`}
              >
                <MI name={t.icon} fill={active} /> {t.label.toUpperCase()}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 mt-auto space-y-2">
          {hasSupabase() && (
            <button
              onClick={handleLogout}
              className="w-full py-2 flex items-center justify-center gap-2 text-outline hover:text-error font-label-caps text-[10px] transition"
            >
              <MI name="logout" className="text-sm" /> SAIR
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="md:pl-64 pt-8 pb-32 md:pb-12 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-container-padding py-8">
          {children}
        </div>
      </main>

      {/* Bottom sheet MAIS (mobile) */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Mais seções">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 w-full bg-surface-container-highest rounded-t-2xl border-t border-white/10 shadow-2xl px-4 pt-3 pb-28">
            <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-4" />
            <div className="grid grid-cols-4 gap-2">
              {TABS.filter((t) => !MOBILE_PRIMARY.includes(t.id)).map((t) => {
                const active = pathname === t.path;
                return (
                  <Link
                    key={t.id}
                    href={t.path}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition active:scale-95 ${
                      active ? "bg-primary-container/20 text-primary" : "text-on-surface-variant hover:bg-surface-variant/40"
                    }`}
                  >
                    <MI name={t.icon} fill={active} />
                    <Caps className="text-[10px]">{t.label}</Caps>
                  </Link>
                );
              })}
              <Link
                href="/perfil"
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition active:scale-95 ${
                  pathname === "/perfil" ? "bg-primary-container/20 text-primary" : "text-on-surface-variant hover:bg-surface-variant/40"
                }`}
              >
                <MI name="account_circle" fill={pathname === "/perfil"} />
                <Caps className="text-[10px]">Perfil</Caps>
              </Link>
              {hasSupabase() && (
                <button
                  onClick={handleLogout}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition active:scale-95 text-on-surface-variant hover:bg-surface-variant/40 hover:text-error"
                >
                  <MI name="logout" />
                  <Caps className="text-[10px]">Sair</Caps>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav (mobile): pill flutuante — 4 fixos + MAIS */}
      <nav className="fixed bottom-5 left-4 right-4 z-50 flex justify-around items-center px-2 py-2 md:hidden bg-surface-container-highest/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/10">
        {TABS.filter((t) => MOBILE_PRIMARY.includes(t.id)).map((t) => {
          const active = pathname === t.path && !moreOpen;
          return (
            <Link
              key={t.id}
              href={t.path}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition ${active ? "text-primary scale-110 font-bold" : "text-on-surface-variant"}`}
            >
              <MI name={t.icon} fill={active} />
              <Caps className="text-[10px] mt-0.5">{t.label}</Caps>
            </Link>
          );
        })}
        {(() => {
          const overflowActive = moreOpen || !TABS.some((t) => MOBILE_PRIMARY.includes(t.id) && t.path === pathname);
          return (
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-label="Mais seções"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition ${overflowActive ? "text-primary scale-110 font-bold" : "text-on-surface-variant"}`}
            >
              <MI name="apps" fill={moreOpen} />
              <Caps className="text-[10px] mt-0.5">Mais</Caps>
            </button>
          );
        })()}
      </nav>

    </div>
  );
}

export default function AppLayout({ children }) {
  return (
    <AppProvider>
      <Chrome>{children}</Chrome>
    </AppProvider>
  );
}
