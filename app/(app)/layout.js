"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppProvider, useApp } from "./AppContext";
import { MI } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { HelpButton } from "@/components/help";
import BichoDaTela from "@/components/BichoDaTela";
import { TABS, NAV_SECTIONS, HOME_ROUTE, gamify, fmtK } from "@/lib/state";
import { hasSupabase } from "@/lib/persistence";
import { DEFAULT_MODE } from "@/lib/themes";

// Rotas desativadas: fora do menu, mas acessíveis por URL — bloqueadas aqui.
// /rotina entra junto com a Agenda: ela é só um redirect pra lá (ver rotina/page.js),
// e sem isto o usuário veria o loader antes de bater na mesma parede.
// /exercicio e /mapa saíram da navegação junto (dados intactos — ver TABS).
const DISABLED_ROUTES = ["/dieta", "/foco", "/calendario", "/missoes", "/rotina", "/home", "/carteira", "/analise", "/grupos", "/exercicio", "/mapa"];

// Rótulo curto pra barra de baixo do celular: 5 destinos em 360px não cabem
// "Habit Tracker" inteiro sem quebrar a linha.
const SHORT = { habitos: "Habits", sono: "Sleep", diario: "Journal", leitura: "Reading" };

function DisabledScreen() {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh] gap-3">
      <MI name="do_not_disturb_on" className="text-[32px] text-outline" />
      <h1 className="text-xl font-semibold tracking-tight text-on-surface">Seção desativada</h1>
      <p className="text-on-surface-variant text-sm max-w-sm">Esta parte está temporariamente indisponível.</p>
      <Button asChild size="sm" className="mt-2">
        <Link href={HOME_ROUTE}>Voltar pros hábitos</Link>
      </Button>
    </div>
  );
}

// Marca: o rato do logo + nome. Some o nome quando a sidebar vira trilho de ícones.
function Brand() {
  return (
    <Link href={HOME_ROUTE} className="flex items-center gap-2.5 min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <img src="/logo.jpg" alt="" width={32} height={32} className="size-8 rounded-md shrink-0 object-cover" />
      <span className="truncate text-sm font-semibold tracking-tight text-on-surface group-data-[collapsible=icon]:hidden">Discipline Rats</span>
    </Link>
  );
}

function NavSidebar({ pathname, g, mode, toggleMode, onLogout }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => isMobile && setOpenMobile(false);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3 group-data-[collapsible=icon]:px-2">
        <Brand />
      </SidebarHeader>

      <SidebarContent className="ff-scroll">
        {NAV_SECTIONS.map((s) => (
          <SidebarGroup key={s.id}>
            {s.label && <SidebarGroupLabel>{s.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {s.items.map((t) => {
                  const active = pathname === t.path;
                  return (
                    <SidebarMenuItem key={t.id}>
                      <SidebarMenuButton asChild isActive={active} tooltip={t.label} className="h-9 gap-2.5 text-[14px]">
                        <Link href={t.path} onClick={close} aria-current={active ? "page" : undefined}>
                          <MI name={t.icon} fill={active} className="text-[18px] shrink-0" />
                          <span>{t.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-3 p-3 group-data-[collapsible=icon]:p-2">
        {/* nível em uma linha: o tier e a barra completa estão no Perfil */}
        <div className="px-1 group-data-[collapsible=icon]:hidden">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-on-surface">Nível {g.level}</span>
            <span className="tabular text-outline">{fmtK(g.xp)} XP</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-surface-variant overflow-hidden">
            <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${g.pct}%` }} />
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="Conta" className="data-[state=open]:bg-sidebar-accent">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-variant text-on-surface">
                    <MI name="person" className="text-[18px]" />
                  </span>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium text-on-surface">Minha conta</span>
                    <span className="truncate text-xs text-outline">{g.tier}</span>
                  </span>
                  <MI name="unfold_more" className="text-[18px] text-outline" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" sideOffset={8} className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/perfil" onClick={close}><MI name="account_circle" className="text-[18px]" /> Perfil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/perfil#mascote" onClick={close}><MI name="pets" className="text-[18px]" /> Meu mascote</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleMode}>
                  <MI name={mode === "light" ? "dark_mode" : "light_mode"} className="text-[18px]" />
                  {mode === "light" ? "Modo escuro" : "Modo claro"}
                </DropdownMenuItem>
                {hasSupabase() && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={onLogout}>
                      <MI name="logout" className="text-[18px]" /> Sair
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function Chrome({ children }) {
  const { loaded, state, handleLogout, setSetting } = useApp();
  const pathname = usePathname();

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 min-h-screen bg-background">
        <img src="/logo.jpg" alt="" width={40} height={40} className="size-10 rounded-lg opacity-90" />
        <p className="text-sm text-outline">Carregando…</p>
      </div>
    );
  }

  const g = gamify(state.stats);
  const mode = state.settings.mode || DEFAULT_MODE;
  const toggleMode = () => setSetting("mode", mode === "light" ? "dark" : "light");
  // Recolher a sidebar é preferência, não estado de tela: mora em settings pra
  // sobreviver ao reload e seguir a pessoa entre aparelhos. Ctrl/Cmd+B vem do
  // SidebarProvider e passa por aqui (onOpenChange).
  const open = !state.settings.sidebarCollapsed;
  const tab = TABS.find((t) => t.path === pathname);
  const title = tab?.label || (pathname === "/perfil" ? "Perfil" : "Discipline Rats");

  return (
    <SidebarProvider open={open} onOpenChange={(o) => setSetting("sidebarCollapsed", !o)}>
      <NavSidebar pathname={pathname} g={g} mode={mode} toggleMode={toggleMode} onLogout={handleLogout} />

      <SidebarInset className="min-w-0 bg-background">
        {/* Barra do topo: onde estou + ações de canto. No celular a marca entra no
            lugar do botão de recolher (lá a navegação é a barra de baixo). */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-outline-variant bg-background px-4 md:px-6">
          <SidebarTrigger className="-ml-1.5 hidden md:inline-flex text-on-surface-variant" />
          <Separator orientation="vertical" className="mx-1 hidden md:block data-[orientation=vertical]:h-4" />
          <img src="/logo.jpg" alt="" width={24} height={24} className="size-6 rounded md:hidden" />
          <span className="truncate text-sm font-medium text-on-surface">{title}</span>
          <div className="ml-auto flex items-center gap-0.5">
            <HelpButton pathname={pathname} />
            {/* O mascote mora no perfil, que é fundo de menu — sem um atalho ninguém
                passa por lá pra ver o bicho crescer. Aponta pra âncora da seção. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon-sm" className={pathname === "/perfil" ? "text-on-surface" : "text-on-surface-variant"}>
                  <Link href="/perfil#mascote" aria-label="Ver meu mascote">
                    <MI name="pets" className="text-[18px]" fill={pathname === "/perfil"} />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Meu mascote</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleMode}
                  aria-label={mode === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
                  className="text-on-surface-variant"
                >
                  <MI name={mode === "light" ? "dark_mode" : "light_mode"} className="text-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Alternar tema</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <main className="flex-1 pb-28 md:pb-12">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
            {DISABLED_ROUTES.includes(pathname) ? (
              <DisabledScreen />
            ) : (
              <>
                {/* o mascote comentando a seção atual — ele mesmo decide onde não aparecer */}
                <BichoDaTela state={state} pathname={pathname} />
                {children}
              </>
            )}
          </div>
        </main>
      </SidebarInset>

      {/* Barra de baixo (celular): os quatro registros + Perfil. Barra lisa presa à
          borda, não pílula flutuante — mesma superfície do resto do chrome. */}
      <nav
        aria-label="Navegação"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-outline-variant bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {[...TABS.map((t) => ({ ...t, short: SHORT[t.id] || t.label })), { id: "perfil", short: "Perfil", icon: "account_circle", path: "/perfil" }].map((t) => {
          const active = pathname === t.path;
          return (
            <Link
              key={t.id}
              href={t.path}
              aria-current={active ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active ? "text-on-surface" : "text-outline hover:text-on-surface-variant"
              }`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? "bg-surface-variant" : ""}`}>
                <MI name={t.icon} fill={active} className="text-[20px]" />
              </span>
              {t.short}
            </Link>
          );
        })}
      </nav>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }) {
  return (
    <AppProvider>
      <Chrome>{children}</Chrome>
    </AppProvider>
  );
}
