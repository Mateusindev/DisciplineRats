// Constantes + helpers puros de estado/gamificação (sem JSX).

export const TIPS = [
  "Tenha clareza do ponto A ao ponto B: onde você está hoje e onde quer chegar.",
  "Monte um plano de ação intencional. Transforme metas em hábitos diários.",
  "Torne o planejamento inegociável. Visualize seus objetivos todos os dias.",
  "Esteja em um ambiente que te motive, ensine e inspire a melhorar.",
  "Esteja disposta a superar as tentativas de autossabotagem da sua mente.",
];

export const EXERCISE_TYPES = ["Musculação", "Cardio", "Caminhada", "Alongamento", "Outro"];

// ===== Água (Water Tracker) =====
// state.water = { [date]: { goal, entries: [{ id, ml, time }] } } — `time` em ms
// epoch, `goal` é a meta vigente naquele dia (a semana não muda de cor quando a meta
// muda). Ordem das chaves importa pro diff-sync: o normalizador e o reducer criam
// os objetos na MESMA ordem.
export const WATER_GOAL_DEFAULT = 2000;
export const WATER_GOAL_MIN = 100;
export const WATER_GOAL_MAX = 10000;
export const WATER_ENTRY_MAX = 5000;
export const WATER_QUICK = [200, 300, 500];
export const WATER_GOAL_PRESETS = [1500, 2000, 2500, 3000];
export const WATER_REMINDERS = [0, 60, 120]; // minutos sem registrar até avisar; 0 = desligado
// Janela do dia usada pro ritmo ideal e pros lembretes
export const WATER_DAY_START_H = 7;
export const WATER_DAY_END_H = 22;

export const waterGoal = (state) => {
  const g = Math.round(Number(state?.settings?.waterGoal) || 0);
  return g >= WATER_GOAL_MIN && g <= WATER_GOAL_MAX ? g : WATER_GOAL_DEFAULT;
};
export const waterEntries = (state, date) => (Array.isArray(state?.water?.[date]?.entries) ? state.water[date].entries : []);
export const waterTotal = (state, date) => waterEntries(state, date).reduce((sum, e) => sum + e.ml, 0);
// meta do dia: a gravada no dia, ou a atual pra dia sem registro
export const waterDayGoal = (state, date) => state?.water?.[date]?.goal || waterGoal(state);
export const waterRatio = (state, date) => waterTotal(state, date) / waterDayGoal(state, date);

// Fração do dia (janela 7h–22h) já passada: onde o nível "deveria" estar agora.
export function waterPaceRatio(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  return Math.min(Math.max((h - WATER_DAY_START_H) / (WATER_DAY_END_H - WATER_DAY_START_H), 0), 1);
}

// Dias seguidos com meta batida (hoje só conta depois de bater).
export function waterStreak(state, today = getDateStr(0)) {
  let d = waterRatio(state, today) >= 1 ? today : shiftDate(today, -1);
  let n = 0;
  while (waterRatio(state, d) >= 1 && n < 10000) {
    n++;
    d = shiftDate(d, -1);
  }
  return n;
}

// O registro nasce FORA do reducer: updater de setState pode rodar duas vezes
// (StrictMode), e id gerado lá dentro sairia diferente em cada execução.
export function makeWaterEntry(ml) {
  ml = Math.round(Number(ml));
  if (!(ml > 0) || ml > WATER_ENTRY_MAX) return null;
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ml, time: Date.now() };
}

export function addWaterEntry(prev, date, entry) {
  if (!entry) return prev;
  const day = prev.water?.[date];
  return {
    ...prev,
    water: { ...(prev.water || {}), [date]: { goal: day?.goal || waterGoal(prev), entries: [...(day?.entries || []), entry] } },
  };
}

// Apagar o último registro do dia remove o dia inteiro: dia vazio não é registro.
export function removeWaterEntry(prev, date, id) {
  const day = prev.water?.[date];
  if (!day || !day.entries.some((e) => e.id === id)) return prev;
  const entries = day.entries.filter((e) => e.id !== id);
  const water = { ...prev.water };
  if (entries.length) water[date] = { goal: day.goal, entries };
  else delete water[date];
  return { ...prev, water };
}

// Trocar a meta vale a partir de hoje: o dia de hoje (se já tem registro) adota a
// meta nova, os dias passados guardam a deles.
export function setWaterGoal(prev, ml, today = getDateStr(0)) {
  ml = Math.round(Number(ml));
  if (!(ml >= WATER_GOAL_MIN && ml <= WATER_GOAL_MAX)) return prev;
  const day = prev.water?.[today];
  return {
    ...prev,
    settings: { ...prev.settings, waterGoal: ml },
    ...(day ? { water: { ...prev.water, [today]: { goal: ml, entries: day.entries } } } : {}),
  };
}

export function normalizeWater(parsed) {
  const out = {};
  if (!parsed || typeof parsed !== "object") return out;
  for (const [date, day] of Object.entries(parsed)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day || typeof day !== "object") continue;
    const entries = (Array.isArray(day.entries) ? day.entries : [])
      .filter((e) => e && e.id && Number(e.ml) > 0 && Number(e.time) > 0)
      .map((e) => ({ id: String(e.id), ml: Math.min(WATER_ENTRY_MAX, Math.round(Number(e.ml))), time: Number(e.time) }));
    if (!entries.length) continue;
    const g = Math.round(Number(day.goal) || 0);
    out[date] = { goal: g >= WATER_GOAL_MIN && g <= WATER_GOAL_MAX ? g : WATER_GOAL_DEFAULT, entries };
  }
  return out;
}

// ===== Agenda / Calendário =====
// state.calendar = { [date "YYYY-MM-DD"]: [ evento ] }
// evento = { id, title, cat, allDay:bool, start:"HH:MM"|null, end:"HH:MM"|null, note:string }
export const CALENDAR_CATS = [
  { id: "trabalho", label: "Trabalho", color: "#7c9cff" },
  { id: "pessoal", label: "Pessoal", color: "#b48cff" },
  { id: "saude", label: "Saúde", color: "#ff8a8a" },
  { id: "treino", label: "Treino", color: "#7ee0a1" },
  { id: "estudo", label: "Estudo", color: "#6bd6e0" },
  { id: "social", label: "Social", color: "#ffcf6b" },
  { id: "outro", label: "Outro", color: "#b0b6be" },
];
export const calCat = (id) => CALENDAR_CATS.find((c) => c.id === id) || CALENDAR_CATS[CALENDAR_CATS.length - 1];

// ordena eventos de um dia: dia-inteiro primeiro, depois por horário de início
export function sortEvents(events) {
  return [...(events || [])].sort((a, b) => {
    if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
    return (a.start || "").localeCompare(b.start || "");
  });
}
// rótulo de horário do evento
export function eventTimeLabel(e) {
  if (e.allDay) return "Dia inteiro";
  if (e.start && e.end) return `${e.start}–${e.end}`;
  return e.start || "";
}

// dia da semana de uma data: 0=Seg … 6=Dom (mesmo índice de DOW_SHORT e weekStartOf)
export const dowIndex = (dateStr) => (new Date(dateStr + "T00:00:00").getDay() + 6) % 7;

// ===== Agenda: recorrência semanal =====
// state.agendaRules = [ regra ]
//   regra = { id, title, cat, weekdays:[0..6], allDay, start, end, note, from, until, skips:[] }
//   from/until delimitam a vigência (until null = sem fim) · skips = datas puladas
//
// A ocorrência NUNCA é gravada: é calculada na leitura. Materializar semanas faria o blob
// crescer sem parar e transformaria "mudar o horário" em caçada por cópias.
// Toda a agenda lê por eventsForDate/eventsInRange, então nenhuma view sabe da diferença.

export function ruleOccursOn(rule, dateStr) {
  if (!rule || !Array.isArray(rule.weekdays) || !rule.weekdays.length) return false;
  if (rule.from && dateStr < rule.from) return false;
  if (rule.until && dateStr > rule.until) return false;
  if ((rule.skips || []).includes(dateStr)) return false;
  return rule.weekdays.includes(dowIndex(dateStr));
}

// id determinístico: a mesma ocorrência tem sempre a mesma chave (React key, edição, skip)
export const ruleOccurrence = (rule, dateStr) => ({
  id: `r:${rule.id}:${dateStr}`,
  ruleId: rule.id,
  virtual: true,
  date: dateStr,
  title: rule.title,
  cat: rule.cat,
  allDay: !!rule.allDay,
  start: rule.allDay ? null : rule.start || null,
  end: rule.allDay ? null : rule.end || null,
  note: rule.note || "",
});

// Ocorrências derivadas do plano de treino: divisão agendada naquele dia da semana.
// Só leitura na agenda — a verdade é o plano em /exercicio, pra não manter o mesmo
// horário em dois lugares.
// Horário do treino naquele dia da semana. `time` é o padrão da divisão/modalidade;
// `times` guarda exceção por dia ({ "3": "20:00" }, chave = 0=Seg..6=Dom, string por vir de
// JSON). Divisão feita em dois dias com horários diferentes é o caso comum, não a exceção.
export function workoutTimeFor(mod, div, dow) {
  const k = String(dow);
  return String(div?.times?.[k] || div?.time || mod?.times?.[k] || mod?.time || "").trim();
}

function workoutOccurrence(mod, div, dateStr) {
  const time = workoutTimeFor(mod, div, dowIndex(dateStr));
  return {
    id: `w:${mod.id}:${div?.id ?? "-"}:${dateStr}`,
    virtual: true,
    source: "workout",
    date: dateStr,
    title: div ? `${mod.name} · ${div.name}` : mod.name,
    cat: "treino",
    allDay: !time,
    start: time || null,
    end: null,
    note: "",
  };
}
export function workoutOccurrences(state, dateStr) {
  const dow = dowIndex(dateStr);
  const out = [];
  for (const m of state?.workoutPlan || []) {
    const divs = m.divisions || [];
    if (divs.length) {
      for (const d of divs) if ((d.weekdays || []).includes(dow)) out.push(workoutOccurrence(m, d, dateStr));
    } else if ((m.weekdays || []).includes(dow)) {
      out.push(workoutOccurrence(m, null, dateStr));
    }
  }
  return out;
}

// Único ponto de leitura da agenda: eventos gravados + ocorrências de regra + treino.
export function eventsForDate(state, dateStr) {
  const concrete = (state?.calendar?.[dateStr] || []).map((e) => ({ ...e, date: dateStr }));
  const fromRules = (state?.agendaRules || []).filter((r) => ruleOccursOn(r, dateStr)).map((r) => ruleOccurrence(r, dateStr));
  return sortEvents([...concrete, ...fromRules, ...workoutOccurrences(state, dateStr)]);
}

export function eventsInRange(state, fromStr, toStr) {
  const out = [];
  let d = fromStr;
  let guard = 0;
  while (d <= toStr && guard++ < 400) {
    out.push(...eventsForDate(state, d));
    d = shiftDate(d, 1);
  }
  return out;
}

// ============================================================================
// LEMBRETES DA AGENDA
//
// Materializa "o que avisar e quando" num instante absoluto. É o formato que o
// servidor entende: ele não precisa saber nada de regra semanal nem de treino
// derivado do plano — só olha `fireAt` e manda.
//
// O cliente é quem calcula, de propósito: a lógica de recorrência já vive aqui,
// e reimplementá-la no servidor criaria duas verdades que envelhecem separadas.
//
// Evento de DIA INTEIRO não entra: sem hora não existe "15 minutos antes". Avisar
// à meia-noite seria inventar um horário que o usuário não escolheu.
// ============================================================================
export const NOTIFY_LEAD_OPTIONS = [0, 5, 10, 15, 30, 60];
export const NOTIFY_HORIZON_DAYS = 30; // até onde a agenda é materializada

// chave estável por ocorrência: reenviar o mesmo dia/evento não duplica
const reminderKey = (ev, dateStr) => `${dateStr}:${ev.ruleId || ev.id}`;

export function agendaReminders(state, { leadMin = 15, horizonDays = NOTIFY_HORIZON_DAYS, from = new Date() } = {}) {
  const fromStr = getDateStr(0);
  const toStr = shiftDate(fromStr, horizonDays);
  const out = [];
  for (const ev of eventsInRange(state, fromStr, toStr)) {
    if (ev.allDay || !ev.start) continue;
    // hora local do evento → instante absoluto (o servidor precisa de UTC)
    const at = new Date(`${ev.date}T${ev.start}:00`);
    if (Number.isNaN(at.getTime())) continue;
    const fireAt = new Date(at.getTime() - leadMin * 60_000);
    if (fireAt <= from) continue; // passado não se avisa
    out.push({
      key: reminderKey(ev, ev.date),
      fireAt,
      eventAt: at,
      title: ev.title,
      body: leadMin > 0 ? `Começa às ${ev.start}, em ${leadMin} min` : `Começa agora, às ${ev.start}`,
      url: HOME_ROUTE, // a Agenda está desativada: o toque na notificação não pode cair na parede
    });
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}

export function normalizeAgendaRules(parsed) {
  return (Array.isArray(parsed) ? parsed : [])
    .filter((r) => r && r.id && Array.isArray(r.weekdays) && r.weekdays.length)
    .slice(0, 100)
    .map((r) => {
      const allDay = !!r.allDay;
      return {
        id: String(r.id),
        title: String(r.title || "").slice(0, 120),
        cat: CALENDAR_CATS.some((c) => c.id === r.cat) ? r.cat : "outro",
        weekdays: [...new Set(r.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b),
        allDay,
        start: allDay ? null : r.start || null,
        end: allDay ? null : r.end || null,
        note: String(r.note || "").slice(0, 500),
        from: r.from || null,
        until: r.until || null,
        skips: Array.isArray(r.skips) ? [...new Set(r.skips)].slice(-200) : [],
      };
    });
}

// ===== Mapa — planejamento de longo prazo =====
// state.mapa = { lanes:[raia], nodes:[nó], edges:[aresta], focusId: idDoNó|null }
//   raia   = { id, label, icon, color }  — área da vida; ordem do array = ordem das faixas
//   nó     = { id, kind:"meta"|"mirror"|"note", h, lane, ...payload }
//            h = coluna de horizonte · lane = faixa/área (null = "Sem área")
//            Posição é semântica, não pixel — guardar coordenada faria reordenar/apagar
//            uma raia reatribuir nós pra outra área da vida em silêncio.
//            Prioridade dentro da célula = ordem no array `nodes` (dnd-kit reordena).
//     meta   → { title, why, status, target }
//     mirror → { ref:{ type:"habit"|"card"|"goal"|"book", id }, fallbackLabel, note }
//              nunca cacheia label/progresso — rename e progresso precisam propagar.
//     note   → { text, color }
//   aresta = { id, from, to, kind:"leva"|"depende" } — relação sem desenho; vive no inspetor
// Shape é table-ready (PK uuid, plana): se o blob incomodar, mapa_nodes/mapa_edges com o
// diffById de lib/persistence.js é migração drop-in.

// O eixo do tempo é ontologia, não dado do usuário — ids fixos, fora do state.
export const MAPA_HORIZONS = [
  { id: "agora", label: "Agora", hint: "este trimestre" },
  { id: "d90", label: "90 dias", hint: "próximo ciclo" },
  { id: "y1", label: "1 ano", hint: "horizonte médio" },
  { id: "some", label: "3+ / algum dia", hint: "aspiração" },
];
export const mapaHorizon = (id) => MAPA_HORIZONS.find((h) => h.id === id) || MAPA_HORIZONS[0];

// Raias semeadas usam id STRING FIXO, nunca uuid: defaultState() roda a cada load, então
// uuid mintaria id novo por login e normalizeMapa zeraria o lane de todo nó (perda total).
// Ids fixos também deixam o merge byte-idêntico ao salvo = nenhuma escrita espúria no login.
// Raia criada pelo usuário usa uuid.
export const DEFAULT_MAPA_LANES = () => [
  { id: "corpo", label: "Corpo", icon: "fitness_center", color: "#7ee0a1" },
  { id: "mente", label: "Mente", icon: "psychology", color: "#b48cff" },
  { id: "carreira", label: "Carreira", icon: "work", color: "#7c9cff" },
  { id: "dinheiro", label: "Dinheiro", icon: "savings", color: "#ffcf6b" },
  { id: "relacoes", label: "Relações", icon: "groups", color: "#ff8a8a" },
];

export const MAPA_LANE_COLORS = ["#7ee0a1", "#b48cff", "#7c9cff", "#ffcf6b", "#ff8a8a", "#6bd6e0", "#b0b6be"];
export const MAPA_NOTE_COLORS = ["#ffcf6b", "#7ee0a1", "#7c9cff", "#ff8a8a", "#b48cff"];

export const MAPA_META_STATUS = [
  { id: "ideia", label: "Ideia", icon: "lightbulb" },
  { id: "ativo", label: "Ativo", icon: "bolt" },
  { id: "pausado", label: "Pausado", icon: "pause_circle" },
  { id: "feito", label: "Feito", icon: "task_alt" },
];
export const mapaStatus = (id) => MAPA_META_STATUS.find((s) => s.id === id) || MAPA_META_STATUS[0];

export const MAPA_EDGE_KINDS = [
  { id: "leva", label: "leva a" },
  { id: "depende", label: "depende de" },
];

export const MAPA_MAX_NODES = 200; // teto do blob jsonb (~130 B/nó)
export const MAPA_LIMITS = { title: 120, why: 500, note: 280, target: 60, lane: 24 };
export const HABIT_FORM_DAYS = 21; // streak tratado como "hábito formado" — base do pct do espelho

// arredonda pra 2 casas preservando null (usado nas estatísticas de peso)
const r2 = (n) => (n === null ? null : Math.round(n * 100) / 100);

// Ordem do array = ordem do sheet MAIS no mobile (que é uma grade chapada). Mantida igual à
// ordem das seções, pro grid do celular ler como grupos implícitos sem custo nenhum.
// A sidebar do desktop usa NAV_SECTIONS, derivado do campo `group`.
export const TABS = [
  // Rótulos em inglês por escolha do dono do produto (o resto da copy segue
  // pt-BR). Mapa saiu da navegação — os dados continuam no estado
  // e no banco; reativar é descomentar abaixo e tirar a rota de DISABLED_ROUTES
  // (app/(app)/layout.js).
  { id: "missoes", label: "Task Tracker", icon: "view_kanban", path: "/missoes", group: "main" },
  { id: "habitos", label: "Habit Tracker", icon: "check_circle", path: "/habitos", group: "main" },
  { id: "sono", label: "Sleep Tracker", icon: "bedtime", path: "/sono", group: "main" },
  { id: "agua", label: "Water Tracker", icon: "water_drop", path: "/agua", group: "main" },
  { id: "exercicio", label: "Workout Tracker", icon: "fitness_center", path: "/exercicio", group: "main" },
  { id: "diario", label: "Day Tracker", icon: "edit_note", path: "/diario", group: "main" },
  { id: "leitura", label: "Book Tracker", icon: "menu_book", path: "/leitura", group: "main" },
  // { id: "mapa", label: "Mapa", icon: "account_tree", path: "/mapa", group: "planos" },
  // desativados por enquanto — reativar removendo o comentário (e tirando de DISABLED_ROUTES).
  // Reativar carteira/analise pede também recriar o grupo "balanco" em NAV_GROUPS.
  //
  // Reativar foco/agenda pede também: devolver o id a MOBILE_PRIMARY
  // (hoje ocupado por sono/diário), rever HOME_ROUTE (e a cópia à mão em
  // public/sw.js), e devolver o href "/missoes" ao espelho de card do Mapa.
  // A Agenda leva junto /rotina, que redireciona pra ela e por isso também está
  // em DISABLED_ROUTES.
  // { id: "foco", label: "Foco", icon: "timer", path: "/foco", group: "hoje" },
  // { id: "calendario", label: "Agenda", icon: "calendar_month", path: "/calendario", group: "hoje" },
  //
  // Reativar dieta pede também devolver o id a MOBILE_PRIMARY (hoje com o diário
  // no lugar).
  // { id: "dieta", label: "Dieta", icon: "restaurant", path: "/dieta", group: "corpo" },
  // { id: "home", label: "Home", icon: "home", path: "/home", group: "hoje" },
  // { id: "carteira", label: "Carteira", icon: "account_balance_wallet", path: "/carteira", group: "balanco" },
  // { id: "analise", label: "Análise", icon: "insights", path: "/analise", group: "balanco" },
];

// Rota inicial do app: destino de `/`, do botão da tela "seção desativada", do
// reset de dados e do fallback de notificação. Uma constante em vez de quatro
// literais — desativar a seção de destino é mudar uma linha, não caçar quatro.
export const HOME_ROUTE = "/habitos";

// Com poucos destinos a sidebar não precisa de títulos de seção: um grupo sem
// rótulo. Tabs reativadas com group antigo caem na seção órfã (regra abaixo).
export const NAV_GROUPS = [
  { id: "main", label: null },
];

// Seções da sidebar, derivadas uma vez em escopo de módulo (custo zero por render).
// Regra anti-desaparecimento: tab sem `group` (ou com group desconhecido) cai numa seção
// final SEM título — nunca é omitida. Protege reativar uma rota sem lembrar do group.
export const NAV_SECTIONS = (() => {
  const byGroup = new Map(NAV_GROUPS.map((g) => [g.id, []]));
  const orphans = [];
  for (const t of TABS) (byGroup.get(t.group) ?? orphans).push(t); // `??`: get devolve undefined, e [] é truthy
  return [
    // filtro evita título órfão se as tabs de um grupo forem todas comentadas
    ...NAV_GROUPS.map((g) => ({ ...g, items: byGroup.get(g.id) })).filter((s) => s.items.length),
    ...(orphans.length ? [{ id: "_outros", label: null, items: orphans }] : []),
  ];
})();


export const DEFAULT_LOFI_URL = "https://youtu.be/KfRkr0h-L2g";

// extrai o ID de vídeo de várias formas de URL do YouTube (ou ID cru)
export function youtubeId(url) {
  if (!url) return null;
  const raw = String(url).trim();
  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "embed" || p === "live" || p === "shorts");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return null;
  } catch (e) {
    return /^[\w-]{11}$/.test(raw) ? raw : null;
  }
}
export const HABIT_ICONS = [
  "water_drop", "menu_book", "self_improvement", "directions_run", "bolt", "dark_mode",
  "fitness_center", "bedtime", "restaurant", "psychology", "savings", "brush",
  "code", "music_note", "sunny", "eco", "smoking_rooms", "no_drinks",
  "phone_disabled", "cleaning_services", "pets", "favorite", "school", "timer",
];

/* ---------- helpers ---------- */
export function pad(n) {
  return String(n).padStart(2, "0");
}
export function getDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// ============================================================================
// NUTRIÇÃO — basal, gasto diário e macros
//
// Tudo aqui é ESTIMATIVA estatística, não medição e não recomendação médica.
// Duas coisas que este bloco deliberadamente NÃO faz:
//   1. não inventa gasto de dia sem histórico (devolve null e a UI diz que falta dado);
//   2. não calcula micronutriente por peso/altura — recomendação de micro é valor fixo
//      por idade/sexo, e nenhum alimento do plano tem dado de micro pra comparar.
// ============================================================================

// state.body = { sex:"m"|"f", birth:"YYYY-MM-DD", heightCm, bodyFatPct|null,
//                goal:"cut"|"maintain"|"bulk", ratePct, targetKg|null,
//                proteinPerKg, fatPerKg, neat }
// state.weights = { [date]: kg }  — série de pesagens (mapa por data, igual ao sleep)

export const BODY_GOALS = [
  { id: "cut", label: "Perder gordura", sign: -1 },
  { id: "maintain", label: "Manter", sign: 0 },
  { id: "bulk", label: "Ganhar massa", sign: 1 },
];

// MET por tipo de exercício (compêndio de atividade física, valores aproximados
// pra intensidade média). O tipo vem de EXERCISE_TYPES.
export const MET_BY_TYPE = {
  Musculação: 5,
  Cardio: 8,
  Caminhada: 3.5,
  Alongamento: 2.5,
  Outro: 4,
};
export const MET_DEFAULT = 4;

export function ageFrom(birth) {
  if (!birth) return null;
  const b = new Date(birth + "T00:00:00");
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

// Basal. Katch-McArdle quando há % de gordura (usa massa magra, estimativa melhor);
// senão Mifflin-St Jeor, que é o padrão atual pra peso/altura/idade/sexo.
export function bmrFor(body, kg) {
  const h = Number(body?.heightCm) || 0;
  const age = ageFrom(body?.birth);
  const w = Number(kg) || 0;
  if (!w || !h || age === null || !body?.sex) return null;
  const bf = Number(body.bodyFatPct);
  if (bf > 0 && bf < 70) {
    const lean = w * (1 - bf / 100);
    return { kcal: Math.round(370 + 21.6 * lean), formula: "Katch-McArdle", usesLean: true };
  }
  const base = 10 * w + 6.25 * h - 5 * age;
  return { kcal: Math.round(body.sex === "m" ? base + 5 : base - 161), formula: "Mifflin-St Jeor", usesLean: false };
}

// Gasto LÍQUIDO de uma sessão: desconta 1 MET, que é o basal que já está contado
// no dia inteiro. Sem esse desconto o treino seria contado duas vezes.
export function sessionKcal(log, kg) {
  const w = Number(kg) || 0;
  const min = Number(log?.durationMin) || 0;
  if (!w || !min) return 0;
  const met = MET_BY_TYPE[log?.type] ?? MET_DEFAULT;
  const i = Math.min(5, Math.max(1, Number(log?.intensity) || 3));
  const adj = met * (0.7 + 0.15 * (i - 1)); // intensidade 3 = MET de tabela
  return Math.max(0, Math.round(((adj - 1) * 3.5 * w) / 200 * min));
}

export const currentWeight = (state) => {
  const dates = Object.keys(state?.weights || {}).sort();
  return dates.length ? Number(state.weights[dates[dates.length - 1]]) || null : null;
};

// série de pesagens ordenada + média móvel de 7 dias (a média é o sinal; o dia isolado oscila).
// A janela é de 7 DIAS DE CALENDÁRIO, não das 7 últimas pesagens: quem pesa 3× por mês
// teria uma "média de 7 dias" cobrindo dois meses, o que não é média de nada.
// `n` = quantas pesagens caíram na janela — com n=1 a "média" é o próprio dia, e a UI
// precisa saber disso pra não vender ruído como tendência.
export function weightSeries(state) {
  const w = state?.weights || {};
  const dates = Object.keys(w).sort();
  return dates.map((date, i) => {
    const from = shiftDate(date, -6);
    const win = [];
    for (let j = i; j >= 0 && dates[j] >= from; j--) win.push(Number(w[dates[j]]) || 0);
    const avg = win.reduce((s, v) => s + v, 0) / win.length;
    return { date, kg: Number(w[date]) || 0, avg: Math.round(avg * 100) / 100, n: win.length };
  });
}

// Estatística da evolução do peso numa janela de dias (`windowDays = 0` → série toda).
// A tendência sai de regressão linear sobre a MÉDIA MÓVEL, não sobre o dia isolado:
// água, sal e intestino movem o dia vários quilos e inclinariam a reta pra qualquer lado.
// Devolve null quando não há dado suficiente — nada aqui inventa número.
export function weightStats(state, windowDays = 30) {
  const all = weightSeries(state);
  if (!all.length) return null;
  const from = windowDays > 0 ? shiftDate(getDateStr(0), -(windowDays - 1)) : null;
  const series = from ? all.filter((s) => s.date >= from) : all;
  if (!series.length) return null;

  const first = series[0];
  const last = series[series.length - 1];
  const kgs = series.map((s) => s.kg);
  const spanDays = daysBetween(first.date, last.date);
  const r2 = (n) => Math.round(n * 100) / 100;

  // kg/dia por mínimos quadrados. Precisa de ≥3 pesagens e ≥7 dias de janela:
  // abaixo disso a reta é desenhada em cima de ruído e o número engana.
  let perDay = null;
  if (series.length >= 3 && spanDays >= 7) {
    const xs = series.map((s) => daysBetween(first.date, s.date));
    const ys = series.map((s) => s.avg);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    if (den > 0) perDay = num / den;
  }

  const goalCfg = BODY_GOALS.find((g) => g.id === state?.body?.goal) || BODY_GOALS[1];
  const ratePct = Math.min(1.5, Math.max(0, Number.isFinite(Number(state?.body?.ratePct)) ? Number(state.body.ratePct) : 0.5));
  const targetPerWeek = r2(goalCfg.sign * (ratePct / 100) * last.kg);

  const targetKg = Number(state?.body?.targetKg) || null;
  let eta = null; // { days, date } — só quando o ritmo medido caminha PRA o alvo
  if (targetKg && perDay) {
    const remaining = targetKg - last.avg;
    if (Math.abs(remaining) > 0.2 && Math.sign(remaining) === Math.sign(perDay)) {
      const days = Math.ceil(remaining / perDay);
      if (days > 0 && days < 3650) eta = { days, date: shiftDate(getDateStr(0), days) };
    }
  }

  return {
    series,
    first,
    last,
    count: series.length,
    spanDays,
    current: last.kg,
    avg: last.avg,
    avgSamples: last.n,
    delta: r2(last.kg - first.kg),
    deltaAvg: r2(last.avg - first.avg),
    min: Math.min(...kgs),
    max: Math.max(...kgs),
    perWeek: perDay === null ? null : r2(perDay * 7),
    targetPerWeek,
    goal: goalCfg.id,
    targetKg,
    toTarget: targetKg ? r2(targetKg - last.avg) : null,
    eta,
  };
}

// Gasto de UM dia: basal × fator de vida cotidiana + treinos registrados naquele dia.
export function tdeeForDate(state, dateStr, kg) {
  const b = bmrFor(state?.body, kg);
  if (!b) return null;
  const neat = Number(state?.body?.neat) || 1.2;
  const base = Math.round(b.kcal * neat);
  const logs = (state?.exerciseLogs || []).filter((l) => l.date === dateStr);
  const training = logs.reduce((s, l) => s + sessionKcal(l, kg), 0);
  return { base, training, total: base + training, sessions: logs.length };
}

// Média por dia da semana com base no histórico REAL (últimas `weeks` semanas).
// Dia da semana sem nenhum registro devolve samples:0 — a UI mostra que falta dado
// em vez de exibir número inventado.
export function weeklyEnergy(state, kg, weeks = 8) {
  const b = bmrFor(state?.body, kg);
  if (!b) return null;
  const neat = Number(state?.body?.neat) || 1.2;
  const base = Math.round(b.kcal * neat);
  const today = getDateStr(0);
  const rows = DOW_SHORT.map((label, dow) => ({ dow, label, base, samples: 0, trainingAvg: 0, scheduled: false, total: base }));

  // treino agendado no plano (indica intenção, mesmo sem histórico)
  for (const m of state?.workoutPlan || []) {
    const divs = m.divisions || [];
    if (divs.length) {
      for (const d of divs) for (const dow of d.weekdays || []) if (rows[dow]) rows[dow].scheduled = true;
    } else {
      for (const dow of m.weekdays || []) if (rows[dow]) rows[dow].scheduled = true;
    }
  }

  // A janela começa no PRIMEIRO registro de treino. Contar dias anteriores ao início do
  // uso puxaria toda média pra baixo e faria o app parecer preciso sobre nada.
  const logs = state?.exerciseLogs || [];
  const firstLog = logs.map((l) => l.date).filter(Boolean).sort()[0] || null;
  const acc = rows.map(() => ({ sum: 0, n: 0, trained: 0 }));
  if (firstLog) {
    for (let i = 0; i < weeks * 7; i++) {
      const d = shiftDate(today, -i);
      if (d < firstLog) continue;
      const dayLogs = logs.filter((l) => l.date === d);
      const dow = dowIndex(d);
      // dia sem treino também é amostra válida: é dia de descanso, gasta o basal
      acc[dow].sum += dayLogs.reduce((s, l) => s + sessionKcal(l, kg), 0);
      acc[dow].n += 1;
      if (dayLogs.length) acc[dow].trained += 1;
    }
  }
  return rows.map((r, dow) => {
    const a = acc[dow];
    const trainingAvg = a.n ? Math.round(a.sum / a.n) : 0;
    return {
      ...r,
      samples: a.n,
      trainedDays: a.trained,
      // agendado no plano mas nunca registrado: o número não representa o dia
      unproven: r.scheduled && a.trained === 0,
      trainingAvg,
      total: base + trainingAvg,
    };
  });
}

// Alvo calórico e macros. Nunca recomenda abaixo do basal — comer abaixo do gasto
// mínimo do corpo é a linha que não se cruza, então o valor é travado ali e sinalizado.
export function macroTargets(state, kg) {
  const b = bmrFor(state?.body, kg);
  const week = weeklyEnergy(state, kg);
  if (!b || !week) return null;
  const body = state.body || {};
  const maintenance = Math.round(week.reduce((s, r) => s + r.total, 0) / 7);
  const goal = BODY_GOALS.find((g) => g.id === body.goal) || BODY_GOALS[1];
  // % do peso por semana. `Number(x) ?? d` NÃO cai no default (NaN não é nullish) — daí o isFinite.
  const ratePct = Math.min(1.5, Math.max(0, Number.isFinite(Number(body.ratePct)) ? Number(body.ratePct) : 0.5));
  // 1 kg de gordura ≈ 7700 kcal → kcal/dia = kg/semana × 7700 / 7
  const deltaKcal = Math.round((goal.sign * ((ratePct / 100) * kg * 7700)) / 7);
  const raw = maintenance + deltaKcal;
  const floored = Math.max(raw, b.kcal);
  const protein = Math.round(kg * (Number(body.proteinPerKg) || 1.8));
  const fat = Math.round(kg * (Number(body.fatPerKg) || 0.8));
  const carbKcal = floored - protein * 4 - fat * 9;
  return {
    bmr: b.kcal,
    formula: b.formula,
    maintenance,
    delta: floored - maintenance,
    kcal: floored,
    clampedToBmr: floored > raw,
    aggressive: maintenance > 0 && (maintenance - floored) / maintenance > 0.25,
    protein,
    fat,
    carbs: Math.max(0, Math.round(carbKcal / 4)),
    carbsShort: carbKcal < 0, // proteína + gordura já passam do alvo
  };
}

// Referência de micronutrientes para ADULTOS, por sexo e faixa de idade.
// É consulta, não cálculo: estes valores não derivam de peso/altura, e o app não
// rastreia consumo de micro. Gestação, lactação e condições clínicas mudam tudo.
export function microReference(sex, age) {
  const f = sex === "f";
  const older = (age ?? 30) >= 51;
  const veryOld = (age ?? 30) >= 71;
  return [
    { name: "Fibra", value: f ? 25 : 38, unit: "g" },
    { name: "Água (total, inclui alimentos)", value: f ? 2.7 : 3.7, unit: "L" },
    { name: "Sódio (limite)", value: 2300, unit: "mg" },
    { name: "Potássio", value: f ? 2600 : 3400, unit: "mg" },
    { name: "Cálcio", value: (f && older) || veryOld ? 1200 : 1000, unit: "mg" },
    { name: "Ferro", value: f && !older ? 18 : 8, unit: "mg" },
    { name: "Magnésio", value: f ? (older ? 320 : 310) : older ? 420 : 400, unit: "mg" },
    { name: "Zinco", value: f ? 8 : 11, unit: "mg" },
    { name: "Vitamina C", value: f ? 75 : 90, unit: "mg" },
    { name: "Vitamina D", value: veryOld ? 20 : 15, unit: "µg" },
    { name: "Vitamina B12", value: 2.4, unit: "µg" },
  ];
}

export function normalizeBody(parsed) {
  const b = parsed && typeof parsed === "object" ? parsed : {};
  const clamp = (v, lo, hi, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : d;
  };
  return {
    sex: b.sex === "m" || b.sex === "f" ? b.sex : null,
    birth: typeof b.birth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.birth) ? b.birth : null,
    heightCm: clamp(b.heightCm, 100, 250, 0),
    bodyFatPct: b.bodyFatPct === null || b.bodyFatPct === "" ? null : clamp(b.bodyFatPct, 3, 70, null),
    goal: BODY_GOALS.some((g) => g.id === b.goal) ? b.goal : "maintain",
    ratePct: clamp(b.ratePct, 0, 1.5, 0.5),
    targetKg: b.targetKg === null || b.targetKg === "" || b.targetKg === undefined ? null : clamp(b.targetKg, 20, 400, null),
    proteinPerKg: clamp(b.proteinPerKg, 0.5, 3.5, 1.8),
    fatPerKg: clamp(b.fatPerKg, 0.3, 2, 0.8),
    neat: clamp(b.neat, 1.1, 1.6, 1.2),
  };
}

export function normalizeWeights(parsed) {
  const src = parsed && typeof parsed === "object" ? parsed : {};
  const out = {};
  for (const [date, kg] of Object.entries(src)) {
    const n = Number(kg);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && n > 20 && n < 400) out[date] = Math.round(n * 10) / 10;
  }
  return out;
}

// Formato de exibição do quadro de Missões. É só VISÃO: os dados são os mesmos
// (colunas com cards) nos dois, então trocar não move nem perde nada. Kanban é
// colunas lado a lado com rolagem horizontal; lista empilha as mesmas colunas na
// vertical em linhas densas — no celular a rolagem horizontal esconde metade do
// quadro, e quem tem muitos cards lê mais rápido em linha do que em cartão.
// A prancheta é a terceira visão porque planejar é a etapa ANTES do cartão: o
// quadro cobra o que já foi decidido, a prancheta é onde se decide (rabisca a
// ideia, liga as caixas, joga fora). Mesma aba porque é o mesmo assunto.
export const MISSOES_VIEWS = [
  { id: "kanban", label: "QUADRO", icon: "view_kanban" },
  { id: "lista", label: "LISTA", icon: "view_list" },
  { id: "prancheta", label: "PRANCHETA", icon: "draw" },
];
export const missoesView = (id) => (MISSOES_VIEWS.some((v) => v.id === id) ? id : MISSOES_VIEWS[0].id);

// ===== Prancheta (canvas de desenho das Missões) =====
// Cada página é uma folha; `elements` é a folha inteira, na ordem de empilhamento
// (índice maior desenha por cima). Vive em tabela própria (canvas_pages), não no
// jsonb do profile: traço é o único dado do app que cresce sem teto.
export const CANVAS_PAGES_MAX = 30;
export const CANVAS_ELEMENTS_MAX = 4000; // teto por página: acima disso o SVG começa a engasgar
export const CANVAS_PAGE_NAME_LEN = 40;
export const CANVAS_TEXT_LEN = 500;
export const CANVAS_EL_TYPES = ["pen", "line", "arrow", "rect", "ellipse", "diamond", "text"];

const num = (v, fb = 0) => (Number.isFinite(+v) ? +v : fb);

// Um elemento inválido é descartado inteiro em silêncio: meia-geometria (NaN em
// x, ponto sem par) vira traço fantasma que não dá pra selecionar nem apagar.
function normalizeCanvasElement(el) {
  if (!el || typeof el !== "object" || !el.id || !CANVAS_EL_TYPES.includes(el.type)) return null;
  const base = {
    id: String(el.id),
    type: el.type,
    stroke: typeof el.stroke === "string" ? el.stroke : "ink",
    width: Math.min(32, Math.max(1, num(el.width, 2))),
    opacity: Math.min(1, Math.max(0.1, num(el.opacity, 1))),
  };
  if (el.type === "pen") {
    const points = (Array.isArray(el.points) ? el.points : [])
      .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]))
      .map((p) => [+p[0], +p[1]]);
    return points.length >= 2 ? { ...base, points } : null;
  }
  if (el.type === "line" || el.type === "arrow") {
    return { ...base, x1: num(el.x1), y1: num(el.y1), x2: num(el.x2), y2: num(el.y2) };
  }
  if (el.type === "text") {
    const text = String(el.text ?? "").slice(0, CANVAS_TEXT_LEN);
    return text ? { ...base, x: num(el.x), y: num(el.y), text, size: Math.min(96, Math.max(8, num(el.size, 18))) } : null;
  }
  // rect | ellipse | diamond — largura/altura sempre positivas depois daqui
  return {
    ...base,
    x: num(el.x),
    y: num(el.y),
    w: Math.abs(num(el.w)),
    h: Math.abs(num(el.h)),
    fill: typeof el.fill === "string" ? el.fill : "none",
  };
}

export function normalizeCanvasPages(parsed) {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((p) => p && typeof p === "object" && p.id)
    .slice(0, CANVAS_PAGES_MAX)
    .map((p, i) => ({
      id: String(p.id),
      name: String(p.name ?? "").slice(0, CANVAS_PAGE_NAME_LEN) || `Página ${i + 1}`,
      pos: Number.isFinite(+p.pos) ? +p.pos : i,
      elements: (Array.isArray(p.elements) ? p.elements : []).map(normalizeCanvasElement).filter(Boolean).slice(0, CANVAS_ELEMENTS_MAX),
    }))
    .sort((a, b) => a.pos - b.pos);
}

// ===== Etiquetas do quadro =====
// A etiqueta vive no QUADRO, não dentro do card. Antes cada card carregava as suas:
// "Urgente" existia 10 vezes com 10 ids, renomear era 10 edições e filtrar por
// etiqueta era impossível. Agora o card guarda só `labelIds` e aponta pro catálogo.
export const BOARD_LABEL_COLORS = [
  "#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7",
  "#3b82f6", "#06b6d4", "#84cc16", "#ec4899", "#64748b",
];
export const BOARD_LABELS_MAX = 20; // catálogo maior que isso ninguém lembra de cor
export const BOARD_LABEL_LEN = 24;

// ---- checklist do cartão ----
// Título diz o que é, descrição diz como; nenhum dos dois dá onde marcar avanço.
// A checklist é a peça que faltava pro cartão ser o lugar onde se MEXE na tarefa e
// não só onde ela é descrita. Teto alto (não é hábito, é tarefa: 30 passos num
// projeto é normal), mas com teto — lista sem fim é lista que ninguém fecha.
export const BOARD_CHECKS_MAX = 30;
export const BOARD_CHECK_LEN = 120;

export const cardChecks = (c) => (Array.isArray(c?.checks) ? c.checks : []);

// null quando o cartão não tem checklist — deixa a UI distinguir "sem checklist" de
// "zero feitos" sem inventar um 0/0, igual habitStepProgress.
export function cardCheckProgress(c) {
  const items = cardChecks(c);
  if (!items.length) return null;
  const done = items.filter((i) => i.done).length;
  return { total: items.length, done, pending: items.length - done, complete: done === items.length };
}

export const boardLabels = (state) => (Array.isArray(state?.board?.labels) ? state.board.labels : []);

// Etiquetas de um card, já resolvidas. Id órfão é ignorado em silêncio — a etiqueta
// pode ter sido apagada do catálogo enquanto o card estava fora da tela.
export function cardLabels(state, card) {
  const ids = Array.isArray(card?.labelIds) ? card.labelIds : [];
  if (!ids.length) return [];
  const cat = boardLabels(state);
  return ids.map((id) => cat.find((l) => l.id === id)).filter(Boolean);
}

const withBoard = (prev, patch) => ({ ...prev, board: { ...prev.board, ...patch } });
const mapBoardCards = (prev, fn) =>
  withBoard(prev, { columns: (prev.board?.columns || []).map((c) => ({ ...c, cards: (c.cards || []).map(fn) })) });

// id vem de fora (crypto.randomUUID no chamador) pro reducer seguir puro
export function addBoardLabel(prev, label) {
  const cat = boardLabels(prev);
  if (!label?.id || cat.length >= BOARD_LABELS_MAX) return prev;
  return withBoard(prev, {
    labels: [...cat, { id: String(label.id), color: String(label.color || BOARD_LABEL_COLORS[0]), text: String(label.text || "").slice(0, BOARD_LABEL_LEN) }],
  });
}

export function updateBoardLabel(prev, id, patch) {
  return withBoard(prev, {
    labels: boardLabels(prev).map((l) =>
      l.id === id ? { ...l, ...patch, text: patch.text === undefined ? l.text : String(patch.text).slice(0, BOARD_LABEL_LEN) } : l
    ),
  });
}

// Apagar sai do catálogo E de todo card: id sobrando em card viraria etiqueta fantasma
// (invisível na tela, contada no filtro).
export function removeBoardLabel(prev, id) {
  const next = withBoard(prev, { labels: boardLabels(prev).filter((l) => l.id !== id) });
  return mapBoardCards(next, (k) => ((k.labelIds || []).includes(id) ? { ...k, labelIds: k.labelIds.filter((x) => x !== id) } : k));
}

export function toggleCardLabel(prev, colId, cardId, labelId) {
  return withBoard(prev, {
    columns: (prev.board?.columns || []).map((c) =>
      c.id !== colId
        ? c
        : {
            ...c,
            cards: (c.cards || []).map((k) => {
              if (k.id !== cardId) return k;
              const ids = Array.isArray(k.labelIds) ? k.labelIds : [];
              return { ...k, labelIds: ids.includes(labelId) ? ids.filter((x) => x !== labelId) : [...ids, labelId] };
            }),
          }
    ),
  });
}

// Único ponto anti-corrupção do quadro. Também é onde mora a MIGRAÇÃO das etiquetas
// que viviam dentro do card: elas sobem pro catálogo deduplicadas por cor+texto, então
// o mesmo "Urgente" repetido em 10 cards vira uma etiqueta só, e os 10 cards apontam
// pra ela. Roda em todo load, então a migração é idempotente.
export function normalizeBoard(parsed, fallback) {
  const raw = parsed && typeof parsed === "object" ? parsed : {};
  if (!Array.isArray(raw.columns) || !raw.columns.length) return fallback;

  const labels = [];
  const byKey = new Map(); // "cor|texto" → id, pro dedupe da migração
  const keyOf = (l) => `${String(l.color)}|${String(l.text || "").slice(0, BOARD_LABEL_LEN)}`;
  const push = (l) => {
    if (!l || !l.color) return null;
    const k = keyOf(l);
    if (byKey.has(k)) return byKey.get(k);
    if (labels.length >= BOARD_LABELS_MAX) return null;
    const id = String(l.id || `l${labels.length}-${String(l.color).replace("#", "")}`);
    labels.push({ id, color: String(l.color), text: String(l.text || "").slice(0, BOARD_LABEL_LEN) });
    byKey.set(k, id);
    return id;
  };
  for (const l of Array.isArray(raw.labels) ? raw.labels : []) push(l);
  // catálogo completo ANTES de mexer nos cards: labelIds só é validado contra o final
  for (const c of raw.columns) for (const k of Array.isArray(c?.cards) ? c.cards : []) for (const l of Array.isArray(k?.labels) ? k.labels : []) push(l);
  const known = new Set(labels.map((l) => l.id));

  const columns = raw.columns
    .filter((c) => c && c.id)
    .map((c) => ({
      id: String(c.id),
      name: String(c.name || "Lista").slice(0, 60),
      cards: (Array.isArray(c.cards) ? c.cards : [])
        .filter((k) => k && k.id)
        .map((k) => {
          const migrated = (Array.isArray(k.labels) ? k.labels : []).map((l) => byKey.get(keyOf(l))).filter(Boolean);
          const kept = (Array.isArray(k.labelIds) ? k.labelIds : []).filter((id) => known.has(id));
          const { labels: _drop, ...rest } = k;
          return {
            ...rest,
            id: String(k.id),
            text: String(k.text || "").slice(0, 280),
            priority: [1, 2, 3].includes(k.priority) ? k.priority : 2,
            done: !!k.done,
            archived: !!k.archived,
            due: typeof k.due === "string" ? k.due : "",
            desc: String(k.desc || "").slice(0, 2000),
            labelIds: [...new Set([...kept, ...migrated])],
            // Spread condicional: cartão que nunca teve checklist NÃO ganha um
            // `checks: []` no load. O board é um jsonb comparado inteiro, então um
            // campo novo em todos os cartões reescreveria o quadro no primeiro save
            // de cada sessão, sem nada ter mudado.
            ...(k.checks === undefined
              ? {}
              : {
                  checks: (Array.isArray(k.checks) ? k.checks : [])
                    .filter((i) => i && i.id && String(i.text || "").trim()) // item sem texto não carrega informação nenhuma
                    .slice(0, BOARD_CHECKS_MAX)
                    .map((i) => ({ id: String(i.id), text: String(i.text).slice(0, BOARD_CHECK_LEN), done: !!i.done })),
                }),
          };
        }),
    }));
  return { labels, columns };
}

// Conclui/reabre um card do quadro. Reducer puro reusável (missoes e foco chamam o MESMO),
// então a regra de mover pra coluna de concluídos não existe em duas versões.
// Card é livre de criar e de marcar.
export function toggleBoardCardState(prev, colId, cardId) {
  const cols = prev.board?.columns || [];
  const src = cols.find((c) => c.id === colId);
  const card = src?.cards?.find((k) => k.id === cardId);
  if (!card) return prev;
  const nd = !card.done;
  const updated = { ...card, done: nd };
  const doneCol = cols.find((c) => /conclu|feito|done/i.test(c.name)) || cols[cols.length - 1];
  // reabrir, ou concluir já estando na coluna de concluídos → atualiza no lugar
  const columns =
    !nd || !doneCol || doneCol.id === colId
      ? cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.map((k) => (k.id === cardId ? updated : k)) } : c))
      : cols.map((c) => {
          if (c.id === colId) return { ...c, cards: c.cards.filter((k) => k.id !== cardId) };
          if (c.id === doneCol.id) return { ...c, cards: [...c.cards, updated] };
          return c;
        });
  return { ...prev, board: { ...prev.board, columns } };
}

// Cards pendentes de todas as colunas, na ordem de urgência: atrasado, com prazo, sem prazo.
// Usado na Home e no Foco — a mesma pergunta ("o que falta?") merece a mesma resposta.
export function pendingCards(state) {
  const today = getDateStr(0);
  const rank = (k) => (k.due ? (k.due < today ? 0 : 1) : 2);
  const out = [];
  for (const c of state?.board?.columns || []) {
    for (const k of c.cards || []) if (!k.done && !k.archived) out.push({ ...k, colId: c.id, colName: c.name });
  }
  return out.sort(
    (a, b) => rank(a) - rank(b) || ((a.due || "9999") < (b.due || "9999") ? -1 : 1) || (b.priority || 2) - (a.priority || 2)
  );
}

// ===== Dieta: item = PORÇÃO BASE × quantidade =====
// item = { id, name, qty, unit, portionGrams, kcal, protein, carbs, fat }
// Os macros gravados são de UMA porção; o que entra na soma é multiplicado por `qty`.
// Assim "1 ovo = 78 kcal" viram 156 só mudando a quantidade pra 2, sem redigitar nada.
//
// Compatibilidade: item antigo não tem qty (→ 1) nem portionGrams (→ o `grams` que era
// o total). Com qty 1 o resultado é idêntico ao de antes, então nada precisa migrar.
export const DIET_UNITS = ["un", "g", "ml", "fatia", "colher", "xíc.", "porção"];

// Unidade de massa/volume muda o modelo mental: em grama ninguém pensa "1,5 porção",
// pensa "150 g". Nesses casos a tabela é "por N g" (N = portionGrams, 100 por padrão,
// como vem no rótulo) e a UI edita o TOTAL em gramas; qty continua sendo o fator, só
// deixa de ser o que a pessoa digita.
export const DIET_MASS_UNITS = ["g", "ml"];
export const isMassUnit = (unit) => DIET_MASS_UNITS.includes(unit);
export const dietItemIsMass = (item) => isMassUnit(item?.unit);
// gramas da tabela (base). 100 é o padrão de rótulo; item por unidade usa o que foi informado.
export const dietItemBaseGrams = (item) => dietItemPortionGrams(item) || (dietItemIsMass(item) ? 100 : 0);
// converte total em gramas → fator qty, sem ruído de ponto flutuante
export const dietQtyFromGrams = (grams, baseGrams) => {
  const b = Number(baseGrams) > 0 ? Number(baseGrams) : 100;
  const g = Number(grams) > 0 ? Number(grams) : 0;
  return Math.round((g / b) * 1000) / 1000;
};

// qty ausente (item antigo) = 1. Zero é aceito e vale zero: zerar o total precisa
// mostrar zero, não pular de volta pra uma porção — salto silencioso é o que confunde.
export const dietItemQty = (item) => {
  const n = Number(item?.qty);
  return Number.isFinite(n) && n >= 0 ? n : 1;
};

export const dietItemPortionGrams = (item) => {
  const n = Number(item?.portionGrams ?? item?.grams);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// valores JÁ multiplicados pela quantidade (é o que aparece na tela e entra na soma)
export function dietItemTotals(item) {
  const q = dietItemQty(item);
  const mul1 = (v) => Math.round((Number(v) || 0) * q * 10) / 10;
  return {
    qty: q,
    grams: Math.round(dietItemPortionGrams(item) * q),
    kcal: Math.round((Number(item?.kcal) || 0) * q),
    protein: mul1(item?.protein),
    carbs: mul1(item?.carbs),
    fat: mul1(item?.fat),
  };
}

export function dietTotals(entries) {
  return (entries || []).reduce(
    (t, e) => {
      const it = dietItemTotals(e);
      return {
        kcal: t.kcal + it.kcal,
        protein: t.protein + it.protein,
        carbs: t.carbs + it.carbs,
        fat: t.fat + it.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
// ===== Despensa: catálogo de alimentos reutilizáveis =====
// O mesmo "Ovo cozido" era redigitado com tabela nutricional e tudo, refeição após
// refeição. Aqui ele é cadastrado uma vez e o item do plano nasce preenchido.
//
// O item do plano guarda uma CÓPIA dos macros, não uma referência: `qty` e o ajuste
// em gramas pertencem ao item, e a soma do dia não pode mudar sozinha porque alguém
// editou o catálogo. O vínculo (`foodId`) existe pra permitir o contrário QUANDO é
// desejado — corrigir o alimento e mandar a correção descer pros itens que vieram
// dele, com confirmação. Item sem foodId (todos os antigos) segue intocado.
export const FOODS_MAX = 300;
export const FOOD_NAME_LEN = 60;

const foodKey = (name) => String(name || "").trim().toLowerCase();
const r1 = (v) => Math.max(0, Math.round((Number(v) || 0) * 10) / 10);
const rInt = (v) => Math.max(0, Math.round(Number(v) || 0));
const byName = (a, b) => a.name.localeCompare(b.name, "pt-BR");

export const foodList = (state) => (Array.isArray(state?.foods) ? state.foods : []);

// Único ponto anti-corrupção da despensa: nome duplicado, unidade inválida e macro
// negativo morrem aqui. Ordenado por nome porque a lista é lida, não empilhada.
export function normalizeFoods(parsed) {
  const out = [];
  const seen = new Set();
  for (const f of Array.isArray(parsed) ? parsed : []) {
    if (!f || !f.id) continue;
    const name = String(f.name || "").trim().slice(0, FOOD_NAME_LEN);
    const k = foodKey(name);
    if (!name || seen.has(k) || out.length >= FOODS_MAX) continue;
    seen.add(k);
    out.push({
      id: String(f.id),
      name,
      unit: DIET_UNITS.includes(f.unit) ? f.unit : "un",
      portionGrams: rInt(f.portionGrams),
      kcal: rInt(f.kcal),
      protein: r1(f.protein),
      carbs: r1(f.carbs),
      fat: r1(f.fat),
    });
  }
  return out.sort(byName);
}

export const findFoodByName = (state, name) => foodList(state).find((f) => foodKey(f.name) === foodKey(name)) || null;

// Busca por trecho do nome. Quem começa com o que foi digitado vem primeiro: quem
// digita "ov" quer "Ovo cozido", não "Arroz com ovo".
export function searchFoods(state, q, limit = 8) {
  const s = foodKey(q);
  if (!s) return [];
  const starts = (f) => (foodKey(f.name).startsWith(s) ? 0 : 1);
  return foodList(state)
    .filter((f) => foodKey(f.name).includes(s))
    .sort((a, b) => starts(a) - starts(b) || byName(a, b))
    .slice(0, limit);
}

// Item do plano → shape do catálogo (só a tabela de UMA porção; qty não vem).
export const foodFromItem = (item) => ({
  name: String(item?.name || "").trim().slice(0, FOOD_NAME_LEN),
  unit: DIET_UNITS.includes(item?.unit) ? item.unit : "un",
  portionGrams: rInt(dietItemPortionGrams(item)),
  kcal: rInt(item?.kcal),
  protein: r1(item?.protein),
  carbs: r1(item?.carbs),
  fat: r1(item?.fat),
});

// Catálogo → campos do item, prontos pra `qty` ser aplicado por cima.
export const itemFromFood = (food) => ({
  foodId: food.id,
  name: food.name,
  unit: food.unit,
  portionGrams: food.portionGrams,
  kcal: food.kcal,
  protein: food.protein,
  carbs: food.carbs,
  fat: food.fat,
});

// Grava ou atualiza. Nome já cadastrado ATUALIZA em vez de duplicar: duas linhas
// "Ovo cozido" com macros diferentes é pior que nenhuma. O id vem de fora (o reducer
// é puro) e o id existente ganha, pro vínculo dos itens não se perder no caminho.
export function upsertFood(prev, food) {
  const k = foodKey(food?.name);
  if (!k || !food?.id) return prev;
  const list = foodList(prev);
  const byId = list.findIndex((f) => f.id === food.id);
  const i = byId >= 0 ? byId : list.findIndex((f) => foodKey(f.name) === k);
  if (i < 0) {
    if (list.length >= FOODS_MAX) return prev;
    return { ...prev, foods: normalizeFoods([...list, { ...food }]) };
  }
  // Casou por ID = edição na despensa, e aí o nome novo vale (é um rename).
  // Casou só por NOME = alguém reusou o alimento digitando outra grafia; a grafia
  // cadastrada manda, senão salvar "ovo cozido" renomearia o "Ovo cozido" de todos.
  const merged = byId >= 0 ? { ...list[i], ...food, id: list[i].id } : { ...list[i], ...food, id: list[i].id, name: list[i].name };
  return { ...prev, foods: normalizeFoods(list.map((f, j) => (j === i ? merged : f))) };
}

// Excluir do catálogo NÃO mexe no plano: o item já é uma cópia, e apagar comida da
// despensa não devia esvaziar o prato. Ele só perde o vínculo.
export function removeFood(prev, id) {
  const dietPlan = (prev.dietPlan || []).map((m) => ({
    ...m,
    items: (m.items || []).map((it) => (it.foodId === id ? { ...it, foodId: null } : it)),
  }));
  return { ...prev, foods: foodList(prev).filter((f) => f.id !== id), dietPlan };
}

export function planItemsUsingFood(state, id) {
  let n = 0;
  for (const m of state?.dietPlan || []) for (const it of m.items || []) if (it.foodId === id) n++;
  return n;
}

// Empurra a correção do alimento pros itens que vieram dele. A QUANTIDADE do item é
// preservada: o que muda é a tabela nutricional, não quanto você come. Em item por
// massa isso significa recalcular `qty` a partir do total em gramas que estava na
// tela — mudar "por 100 g" pra "por 50 g" não pode dobrar o prato em silêncio.
export function applyFoodToPlan(prev, food) {
  return {
    ...prev,
    dietPlan: (prev.dietPlan || []).map((m) => ({
      ...m,
      items: (m.items || []).map((it) => {
        if (it.foodId !== food.id) return it;
        const next = { ...it, ...itemFromFood(food) };
        if (isMassUnit(food.unit)) next.qty = dietQtyFromGrams(dietItemTotals(it).grams, food.portionGrams || 100);
        return next;
      }),
    })),
  };
}

export function weekdayShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}
export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m)}:${pad(s)}`;
}
export function minutesToHm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m ? pad(m) : ""}`;
}
export function last7Dates() {
  return Array.from({ length: 7 }, (_, i) => getDateStr(-(6 - i)));
}
export function lastNDates(n) {
  return Array.from({ length: n }, (_, i) => getDateStr(-(n - 1 - i)));
}
export function fmtK(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n);
}

// ---- finanças ----
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function fmtMoney(n) {
  return BRL.format(Number(n) || 0);
}
export const monthKey = (dateStr) => (dateStr || getDateStr(0)).slice(0, 7); // "YYYY-MM"
export const EXPENSE_CATS = ["Alimentação", "Transporte", "Moradia", "Contas", "Lazer", "Saúde", "Educação", "Compras", "Outros"];
export const INCOME_CATS = ["Salário", "Freelas", "Investimento", "Presente", "Outros"];

const clampCount = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

// Único ponto anti-corrupção das estatísticas — todo load passa por mergeWithDefaults.
// `xp` de versões antigas (o app teve gamificação) é descartado aqui.
export function normalizeStats(parsed, base) {
  const { xp: _legacyXp, ...rest } = parsed && typeof parsed === "object" ? parsed : {};
  const s = { ...base, ...rest };
  s.streak = clampCount(s.streak, 100000);
  s.bestStreak = Math.max(clampCount(s.bestStreak, 100000), s.streak);
  s.totalSessions = clampCount(s.totalSessions, 1000000);
  s.totalMinutes = clampCount(s.totalMinutes, 100000000);
  s.todaySessions = clampCount(s.todaySessions, 1000);
  s.todayMinutes = clampCount(s.todayMinutes, 1440);
  return s;
}

export const BASE_SLEEP_MIN = 450;
// limites da meta de sono: 6h a 9h
export const SLEEP_GOAL_MIN = 360;
export const SLEEP_GOAL_MAX = 540;

// ---- qualidade do horário de dormir ----
export const SLEEP_LIMIT_DEFAULT = "23:30";

const hhmmToMin = (t) => {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
// noite: horários antes do meio-dia contam como madrugada (dia seguinte) p/ comparar com o limite noturno
const toEvening = (min) => (min < 12 * 60 ? min + 24 * 60 : min);

// Quão tarde a pessoa deitou, em minutos após o limite (negativo = deitou no horário/antes).
export function bedtimeLateness(bedtime, limit = SLEEP_LIMIT_DEFAULT) {
  return toEvening(hhmmToMin(bedtime)) - toEvening(hhmmToMin(limit));
}

// ===== Hábitos: prioridade + vícios (quit) =====
export const HABIT_PRIORITIES = [
  { v: 1, label: "BAIXA" },
  { v: 2, label: "NORMAL" },
  { v: 3, label: "ALTA" },
];
export const habitPriority = (h) => HABIT_PRIORITIES.find((p) => p.v === (h.priority || 2)) || HABIT_PRIORITIES[1];

// dias da semana (0=Seg … 6=Dom, casa com weekStartOf); índice de hoje: (getDay()+6)%7
export const DOW_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// mm:ss a partir de segundos (descanso entre séries)
export const mmss = (sec) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;

// ===== Microatividades: o checklist dentro do hábito =====
// Um hábito pode ser quebrado em passos ("levantar", "tênis", "10 min"). Enquanto
// houver passo aberto, o hábito NÃO pode ser marcado — a promessa da feature é
// justamente essa, e ela só vale se for impossível pular por fora. Por isso o
// bloqueio mora no reducer, não na tela: /habitos, a Home e o item de rotina da
// Agenda chamam todos o mesmo `toggleHabitState`.

export const HABIT_STEPS_MAX = 12; // teto por hábito: checklist maior que isso não é hábito, é projeto
export const HABIT_STEP_LEN = 80;

// Só o dia corrente decide alguma coisa (marcar hábito é sempre em `today`), então
// guardar o histórico inteiro seria inflar o jsonb pra nada. Uma semana cobre a
// virada de dia e o fuso, e nada além disso é lido.
const STEP_CHECK_KEEP_DAYS = 7;
function pruneStepChecks(map, today) {
  const floor = shiftDate(today, -(STEP_CHECK_KEEP_DAYS - 1));
  const out = {};
  for (const [d, ids] of Object.entries(map || {})) if (d >= floor && Array.isArray(ids) && ids.length) out[d] = ids;
  return out;
}

// ============================================================
// MÍNIMO EXECUTÁVEL — o piso do hábito. Texto curto que descreve a menor versão
// dele que ainda conta: "dez flexões", "abrir o caderno e ler um parágrafo".
//
// Existe pra resolver o dia ruim. A checklist promete que o hábito só é marcado
// com TODOS os passos fechados, e é essa promessa que dá valor à marcação — mas é
// ela também que mata a sequência num dia de gripe. O mínimo é a saída honesta:
// marca o dia e segura a sequência, igual ao dia cheio.
//
// Dia de mínimo é dia cumprido, ponto — sem meia marcação, sem
// bolinha vazada. O que o app mede é comparecimento: quem apareceu no dia ruim
// fazendo o mínimo declarado fez o que a regra pede. Cobrar metade transformaria
// o dia difícil em dia de segunda classe, que é o oposto do que a feature existe
// pra resolver.
//
// Não é brecha: o mínimo é declarado antes, com calma, e o dia vale o que foi
// declarado.
export const HABIT_MIN_LEN = 80;

export const habitMinimum = (h) => String(h?.minimum || "").trim();

// Onde o mínimo faz sentido: no diário e na meta semanal. Vício não tem mínimo (o
// dia bom é o dia sem recaída), e limite semanal muito menos — lá marcar é
// consumir, então "fiz o mínimo" seria elogiar o estouro.
export function habitMinAllowed(h) {
  const kind = h?.kind || "build";
  if (kind === "quit") return false;
  if (kind === "weekly" && h?.direction === "max") return false;
  return true;
}
export const habitHasMinimum = (h) => habitMinAllowed(h) && !!habitMinimum(h);

// Dia marcado PELO MÍNIMO, isto é: por fora da checklist. Não é rótulo de UI
// nenhuma — nada na tela distingue esse dia de um dia cheio. Serve só pro reducer
// saber que a marcação não veio dos passos, e por isso reabrir um passo não pode
// desmarcá-la. Cruza com doneDates de propósito: minDays sem check é resíduo.
export const habitMinDone = (h, dateStr) =>
  Array.isArray(h?.minDays) && h.minDays.includes(dateStr) && (h?.doneDates || []).includes(dateStr);

export const habitSteps = (h) => (Array.isArray(h?.steps) ? h.steps : []);
export const habitStepDone = (h, dateStr, stepId) => (h?.stepChecks?.[dateStr] || []).includes(stepId);

// null quando o hábito não usa checklist — deixa a UI distinguir "sem passos" de
// "zero passos feitos" sem inventar um 0/0.
export function habitStepProgress(h, dateStr) {
  const steps = habitSteps(h);
  if (!steps.length) return null;
  const done = new Set(h?.stepChecks?.[dateStr] || []);
  const doneCount = steps.filter((s) => done.has(s.id)).length;
  return { total: steps.length, done: doneCount, pending: steps.length - doneCount, complete: doneCount === steps.length };
}

// "este hábito está travado hoje?" — a pergunta que o reducer e a UI fazem.
export function habitStepsBlock(h, dateStr) {
  const p = habitStepProgress(h, dateStr);
  return !!p && !p.complete;
}

// Marca/desmarca um passo. Fechar o último conclui o hábito e
// reabrir um passo desmarca o hábito — senão existiria
// hábito "feito" com passo em aberto, que é o estado que a feature promete que
// não existe.
export function toggleHabitStep(prev, id, stepId, today) {
  const h = (prev.habits || []).find((x) => x.id === id);
  if (!h || (h.kind || "build") === "quit") return prev;
  const steps = habitSteps(h);
  if (!steps.some((s) => s.id === stepId)) return prev;

  const sel = new Set(h.stepChecks?.[today] || []);
  if (sel.has(stepId)) sel.delete(stepId);
  else sel.add(stepId);
  // regrava na ordem dos passos e descarta id órfão (passo apagado depois de marcado)
  const dayIds = steps.filter((s) => sel.has(s.id)).map((s) => s.id);
  const stepChecks = pruneStepChecks({ ...(h.stepChecks || {}), [today]: dayIds }, today);

  const next = { ...prev, habits: prev.habits.map((x) => (x.id === id ? { ...x, stepChecks } : x)) };
  const allDone = dayIds.length === steps.length;
  const marked = (h.doneDates || []).includes(today);
  // Dia salvo pelo mínimo é exceção nas duas pontas: reabrir passo NÃO desmarca (o
  // dia já valeu por fora da checklist) e fechar o último passo não remarca o que
  // já está marcado — só tira o dia de minDays, porque a partir daí a checklist
  // sustenta a marcação sozinha e volta a mandar nela.
  if (habitMinDone(h, today)) return allDone ? clearMinDay(next, id, today) : next;
  if (allDone !== marked) return toggleHabitState(next, id, today);
  return next;
}

// Marca o dia PELO MÍNIMO. Pula a trava da checklist — é literalmente pra isso que
// o mínimo existe — e conta como dia cumprido igual a qualquer outro. Dia já
// marcado não muda: desmarcar é caminho do toggle normal, um só, pra não haver
// dois jeitos de desfazer a mesma coisa.
export function markHabitMinimum(prev, id, today) {
  const h = (prev.habits || []).find((x) => x.id === id);
  if (!h || !habitHasMinimum(h)) return prev;
  const doneDates = h.doneDates || [];
  if (doneDates.includes(today)) return prev;
  const patch = {
    doneDates: [...doneDates, today],
    minDays: [...(Array.isArray(h.minDays) ? h.minDays : []), today],
  };
  return { ...prev, habits: prev.habits.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}

// Tira o dia de minDays sem mexer na marcação (o mínimo já valeu o dia inteiro).
// Só o reducer dos passos chama — não é ação de
// usuário, porque não existe mais "subir pro dia cheio": o dia já era cheio.
function clearMinDay(prev, id, today) {
  const h = (prev.habits || []).find((x) => x.id === id);
  if (!h || !Array.isArray(h.minDays) || !h.minDays.includes(today)) return prev;
  const minDays = h.minDays.filter((d) => d !== today);
  return { ...prev, habits: prev.habits.map((x) => (x.id === id ? { ...x, minDays } : x)) };
}

// Marca/desmarca hábito como concluído em `date`. Reducer puro reusável
// (habitos e home chamam o MESMO); quit não é toggle. Retorna o próximo state.
//
// `date` é qualquer dia, não só hoje: registrar atrasado é registrar.
export function toggleHabitState(prev, id, date) {
  const h = prev.habits.find((x) => x.id === id);
  if (!h || (h.kind || "build") === "quit") return prev;
  const doneDates = h.doneDates || [];
  const has = doneDates.includes(date);
  // Passo em aberto trava a marcação (desmarcar segue livre: reabrir nunca trava).
  // Só vale pra HOJE: dia passado não tem checklist pra fechar — os passos são
  // registro do dia corrente e nem aparecem em outra data —, então exigir a
  // checklist lá seria travar o registro atrasado por uma porta que não existe.
  if (!has && date === getDateStr(0) && habitStepsBlock(h, date)) return prev;
  let patch;
  if (has) {
    // o spread condicional é de propósito: hábito que nunca usou mínimo não ganha
    // um `minDays: []` do nada, que faria o diff-sync reescrever a linha por nada
    const wasMin = Array.isArray(h.minDays) && h.minDays.includes(date);
    patch = {
      doneDates: doneDates.filter((d) => d !== date),
      ...(wasMin ? { minDays: h.minDays.filter((d) => d !== date) } : {}),
    };
  } else {
    patch = { doneDates: [...doneDates, date] };
  }
  return { ...prev, habits: prev.habits.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}

// Marcos de dias limpos p/ vícios
export const QUIT_MILESTONES = [3, 7, 14, 30, 60, 90].map((days) => ({ days }));

// "YYYY-MM-DD" local a partir de ISO completo (truncar em UTC dá off-by-one em UTC-3)
export function localDateStr(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// b - a em dias (strings "YYYY-MM-DD")
export function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

// última recaída até hoje (quit usa doneDates como datas de recaída)
export function lastRelapse(doneDates) {
  const today = getDateStr(0);
  let last = null;
  for (const d of doneDates || []) if (d <= today && (!last || d > last)) last = d;
  return last;
}

// início do período limpo atual: última recaída, senão criação
export function quitPeriodStart(h) {
  return lastRelapse(h.doneDates) || localDateStr(h.createdAt);
}

export function cleanDays(h) {
  return Math.max(0, daysBetween(quitPeriodStart(h), getDateStr(0)));
}

export function bestCleanRun(h) {
  const today = getDateStr(0);
  const relapses = [...new Set((h.doneDates || []).filter((d) => d <= today))].sort();
  let best = 0;
  let prev = localDateStr(h.createdAt);
  for (const r of relapses) {
    best = Math.max(best, daysBetween(prev, r));
    prev = r;
  }
  return Math.max(best, Math.max(0, daysBetween(prev, today)));
}

// recaídas no intervalo [from, to] inclusivo
export function relapsesInWindow(doneDates, from, to) {
  return (doneDates || []).filter((d) => d >= from && d <= to).length;
}

// ===== meta semanal (kind "weekly"): pelo menos/no máximo N dias por semana =====
// segunda-feira da semana da data
export function weekStartOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // seg = 0
  return shiftDate(dateStr, -dow);
}

// dias marcados na semana corrente (segunda → hoje)
export function weekCount(h, today = getDateStr(0)) {
  const wk = weekStartOf(today);
  return (h.doneDates || []).filter((d) => d >= wk && d <= today).length;
}

export function computeHabitStreak(doneDates) {
  const set = new Set(doneDates || []);
  let streak = 0;
  let offset = set.has(getDateStr(0)) ? 0 : -1;
  while (set.has(getDateStr(offset))) {
    streak++;
    offset--;
  }
  return streak;
}

// ===== hábito agendado por dia da semana (só kind "build") =====
// h.weekdays = [0..6] com 0=Seg (casa com DOW_SHORT). Vazio/ausente = todos os dias.
// Dia não agendado é INVISÍVEL pro hábito: não cobra penalidade e não quebra a sequência.
export function habitWeekdays(h) {
  const wd = h?.weekdays;
  return Array.isArray(wd) ? wd.filter((d) => d >= 0 && d <= 6) : [];
}
export const habitIsScheduled = (h, dateStr) => {
  const wd = habitWeekdays(h);
  return wd.length === 0 || wd.includes(dowIndex(dateStr));
};
// rótulo curto dos dias ("SEG · QUA · SEX"), ou null quando é todo dia
export function habitScheduleLabel(h) {
  const wd = habitWeekdays(h);
  if (!wd.length || wd.length === 7) return null;
  return [...wd].sort((a, b) => a - b).map((d) => DOW_SHORT[d].toUpperCase()).join(" · ");
}

// Sequência de COMPROMISSOS cumpridos, não de dias de calendário: pula os dias não
// agendados. Sem weekdays o resultado é idêntico a computeHabitStreak.
export function habitStreak(h) {
  const done = new Set(h?.doneDates || []);
  const createdDay = h?.createdAt ? localDateStr(h.createdAt) : null;
  const today = getDateStr(0);
  // hoje agendado e ainda não feito não zera nada — o dia não acabou
  let offset = habitIsScheduled(h, today) && !done.has(today) ? -1 : 0;
  let streak = 0;
  let guard = 0;
  while (guard++ < 1000) {
    const d = getDateStr(offset);
    if (createdDay && d < createdDay) break;
    if (habitIsScheduled(h, d)) {
      if (!done.has(d)) break;
      streak++;
    }
    offset--;
  }
  return streak;
}

// maior sequência já alcançada no hábito (dias agendados seguidos, do dia de
// criação até hoje). Hoje só entra se já foi feito — dia em aberto não é falha.
export function bestHabitStreak(h) {
  const done = new Set(h?.doneDates || []);
  const createdDay = h?.createdAt ? localDateStr(h.createdAt) : null;
  const today = getDateStr(0);
  let best = 0;
  let run = 0;
  let offset = 0;
  // anda do dia de criação até hoje (offsets negativos), sem limite escondido
  const days = [];
  let guard = 0;
  while (guard++ < 3000) {
    const d = getDateStr(offset);
    if (createdDay && d < createdDay) break;
    days.push(d);
    offset--;
    if (!createdDay && guard > 400) break; // hábito sem createdAt: janela de 400d
  }
  for (const d of days.reverse()) {
    if (!habitIsScheduled(h, d)) continue;
    if (d === today && !done.has(d)) continue; // dia ainda em aberto
    if (done.has(d)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

// ============================================================================
// DIAS DE FOLGA JUSTIFICADA — doença, lesão, descanso planejado, imprevisto.
//
// state.restDays = { [date]: { reason, note } }
//
// Duas coisas que o dia marcado faz, e uma que ele NÃO faz:
//   1. abate a meta semanal de treino (meta 4 com 1 dia de folga cobra 3);
//   2. conta como dia ativo, então a sequência geral não quebra — você contou ao
//      app o que aconteceu, o que é registro, mesmo sem treino;
//   3. NÃO conta como treino. Faltar por doença não é vitória, é
//      neutro: o que se remove é a punição, não o esforço que não houve.
// ============================================================================
export const REST_REASONS = [
  { id: "doente", label: "Doente", icon: "sick" },
  { id: "lesao", label: "Lesão", icon: "healing" },
  { id: "descanso", label: "Descanso planejado", icon: "self_improvement" },
  { id: "imprevisto", label: "Imprevisto", icon: "event_busy" },
];
export const restReason = (id) => REST_REASONS.find((r) => r.id === id) || REST_REASONS[REST_REASONS.length - 1];
export const isRestDay = (state, date) => !!(state?.restDays || {})[date];

// dias de folga dentro da semana que começa em `weekStart` (segunda)
export function restDaysInWeek(restDays, weekStart) {
  if (!restDays || !weekStart) return 0;
  const end = shiftDate(weekStart, 6);
  return Object.keys(restDays).filter((d) => d >= weekStart && d <= end).length;
}

export function normalizeRestDays(parsed) {
  const src = parsed && typeof parsed === "object" ? parsed : {};
  const out = {};
  for (const [date, v] of Object.entries(src)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out[date] = {
      reason: REST_REASONS.some((r) => r.id === v?.reason) ? v.reason : "imprevisto",
      note: typeof v?.note === "string" ? v.note.slice(0, 140) : "",
    };
  }
  return out;
}

// marca/desmarca um dia. Reducer puro: a página de treino e a de análise chamam o MESMO.
export function toggleRestDay(prev, date, reason = "doente", note = "") {
  const cur = { ...(prev.restDays || {}) };
  if (cur[date]) delete cur[date];
  else cur[date] = { reason, note: (note || "").slice(0, 140) };
  return { ...prev, restDays: cur };
}

// ============================================================================
// ROTINA FIXA — o que se repete todo dia (ou em dias escolhidos), com hora.
//
// Diferente de hábito: hábito é coisa que você está CONSTRUINDO, com prioridade,
// sequência e penalidade. Rotina é o esqueleto do dia — tomar remédio, alongar,
// arrumar a cama. Errar um dia não é recaída, é um dia. Por isso aqui não existe
// penalidade nem sequência própria.
//
// state.routine = { items: [{ id, name, time, weekdays }] }   (weekdays [] = todo dia)
// state.routineChecks = { [date]: { [itemId]: 0 } } — a chave existir é o check
// ============================================================================
const ROUTINE_LEGACY_BONUS_KEY = "__all__";
export const ROUTINE_BLOCKS = [
  { id: "manha", label: "Manhã", icon: "wb_twilight", until: 12 * 60 },
  { id: "tarde", label: "Tarde", icon: "clear_day", until: 18 * 60 },
  { id: "noite", label: "Noite", icon: "bedtime", until: 24 * 60 },
  { id: "livre", label: "Sem hora", icon: "schedule", until: Infinity },
];

export function routineBlockOf(item) {
  const t = String(item?.time || "").trim();
  if (!t) return ROUTINE_BLOCKS[3];
  const [h, m] = t.split(":").map(Number);
  const min = (h || 0) * 60 + (m || 0);
  return ROUTINE_BLOCKS.find((b) => min < b.until) || ROUTINE_BLOCKS[2];
}

// "07:30" sim, "25:99" não — formato certo com valor impossível quebraria a ordenação
// e o bloco do dia sem ninguém perceber.
const validTime = (t) => {
  if (!/^\d{2}:\d{2}$/.test(t || "")) return false;
  const [h, m] = t.split(":").map(Number);
  return h < 24 && m < 60;
};

export function normalizeRoutine(parsed) {
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return {
    items: items
      .filter((i) => i && i.id != null)
      .slice(0, 60)
      .map((i) => ({
        id: i.id,
        name: String(i.name || "").slice(0, 80),
        time: validTime(i.time) ? i.time : "",
        weekdays: Array.isArray(i.weekdays) ? i.weekdays.filter((d) => d >= 0 && d <= 6) : [],
        habitId: i.habitId ?? null, // vínculo com um hábito existente (opcional)
      })),
  };
}

// Hábito vinculado ao item, se ainda existir. Vício fica de fora: lá você registra a
// recaída, não o acerto — marcar "feito" não teria sentido.
export function routineHabit(state, item) {
  if (!item?.habitId) return null;
  const h = (state?.habits || []).find((x) => x.id === item.habitId);
  return h && (h.kind || "build") !== "quit" ? h : null;
}

// Estado do item no dia. Item vinculado NÃO tem check próprio: quem manda é o hábito,
// senão existiriam duas verdades pro mesmo ato — marcar na rotina e o hábito continuar
// aberto, ou o contrário.
export function routineItemDone(state, dateStr, item) {
  const h = routineHabit(state, item);
  if (h) return (h.doneDates || []).includes(dateStr);
  return state?.routineChecks?.[dateStr]?.[item.id] !== undefined;
}

// item vale nesse dia? (sem dias marcados = todo dia)
export const routineScheduled = (item, dateStr) => !item?.weekdays?.length || item.weekdays.includes(dowIndex(dateStr));

// itens do dia, ordenados por hora (sem hora vão pro fim)
export function routineItemsFor(state, dateStr) {
  return (state?.routine?.items || [])
    .filter((i) => routineScheduled(i, dateStr))
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

export function routineDayStats(state, dateStr) {
  const items = routineItemsFor(state, dateStr);
  const done = items.filter((i) => routineItemDone(state, dateStr, i)).length;
  return { total: items.length, done, complete: items.length > 0 && done === items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

// Ocorrências pra agenda. Deliberadamente FORA de eventsForDate: rotina é ritmo, não
// compromisso — misturar as duas inflaria a contagem de eventos do mês e afogaria a
// grade em chips repetidos. Quem quer rotina na agenda pede por esta função.
export function routineOccurrences(state, dateStr) {
  return routineItemsFor(state, dateStr).map((i) => ({
    id: `r:${i.id}:${dateStr}`,
    virtual: true,
    source: "routine",
    itemId: i.id,
    habitId: routineHabit(state, i)?.id || null,
    done: routineItemDone(state, dateStr, i),
    date: dateStr,
    title: i.name,
    cat: "pessoal",
    allDay: !i.time,
    start: i.time || null,
    end: null,
    note: "",
  }));
}

// Marca/desmarca um item num dia. Reducer puro — a página de Rotina e a Agenda
// chamam o MESMO.
export function toggleRoutineCheck(prev, date, itemId) {
  const item = (prev.routine?.items || []).find((i) => i.id === itemId);
  const habit = item ? routineHabit(prev, item) : null;
  // Vinculado: quem marca é o hábito; o item da rotina vira só onde você alcança o hábito.
  if (habit) return toggleHabitState(prev, habit.id, date);

  const checks = { ...(prev.routineChecks || {}) };
  const day = { ...(checks[date] || {}) };
  // a chave de bônus de versões antigas (quando fechar o dia pagava XP) some na primeira edição
  delete day[ROUTINE_LEGACY_BONUS_KEY];
  if (day[itemId] !== undefined) delete day[itemId];
  else day[itemId] = 0;
  checks[date] = day;
  if (!Object.keys(day).length) delete checks[date];
  return { ...prev, routineChecks: checks };
}

// ---- sequência geral (streak) ----
// "dia ativo" = fez QUALQUER coisa registrável no app naquele dia.
// Conjunto de datas "YYYY-MM-DD" com atividade, de todas as áreas.
export function activeDaySet(state) {
  const s = new Set();
  const addKeys = (o) => o && Object.keys(o).forEach((k) => s.add(k));
  addKeys(state.focusHistory);
  addKeys(state.sleep);
  addKeys(state.water); // só existem dias com registro (removeWaterEntry apaga dia vazio)
  addKeys(state.routineChecks);
  const j = state.journal || {};
  Object.keys(j).forEach((k) => journalHasContent(j[k]) && s.add(k));
  (state.exerciseLogs || []).forEach((l) => l?.date && s.add(l.date));
  (state.gymSets || []).forEach((g) => g?.date && s.add(g.date));
  (state.habits || []).forEach((h) => {
    if ((h.kind || "build") !== "quit") (h.doneDates || []).forEach((d) => s.add(d));
  });
  addKeys(state.restDays); // folga justificada é registro: conta como dia ativo
  return s;
}

// sequência = dias consecutivos com atividade terminando hoje (ou ontem, pra
// não zerar antes do dia acabar). Derivada — imune a ordem e auto-corrige.
export function computeActivityStreak(state, today = getDateStr(0)) {
  const set = activeDaySet(state);
  if (!set.size) return 0;
  let cursor = set.has(today) ? today : shiftDate(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

// ---- diário ----
// campos escritos hoje. `dump` guarda o relato do dia (era o "despejo de emoções").
export const JOURNAL_FIELDS = ["gratitude", "memory", "dump", "posSituation", "posContribution", "negSituation", "negContribution"];
// campos que o formulário não escreve mais, mas que entradas antigas ainda têm.
// Continuam contando como conteúdo e são preservados na edição — histórico não se apaga.
export const JOURNAL_LEGACY_FIELDS = ["intention", "win"];
// entrada tem conteúdo se qualquer campo de texto foi preenchido
export function journalHasContent(e) {
  if (!e) return false;
  return [...JOURNAL_FIELDS, ...JOURNAL_LEGACY_FIELDS].some((k) => (e[k] || "").trim().length > 0);
}
// sequência de dias com entrada preenchida (a partir de hoje/ontem pra trás)
export function journalStreak(journal) {
  const j = journal || {};
  let streak = 0;
  let offset = journalHasContent(j[getDateStr(0)]) ? 0 : -1;
  while (journalHasContent(j[getDateStr(offset)])) {
    streak++;
    offset--;
  }
  return streak;
}

export function defaultState() {
  return {
    settings: {
      focusMin: 25,
      breakMin: 5,
      exerciseWeeklyGoal: 3,
      sleepGoalMin: 450,
      sleepLimit: "23:30", // deitar até esse horário = no horário
      waterGoal: WATER_GOAL_DEFAULT, // meta diária de água (ml)
      waterReminder: 0, // lembrete de água: minutos sem registrar até avisar (0 = desligado)
      mode: "light", // dark | light; ver lib/themes.js
      dietKcalGoal: 2000,
      dietProteinGoal: 150,
      dietCarbGoal: 200,
      dietFatGoal: 65,
      lofiUrl: DEFAULT_LOFI_URL,
      walletBudget: 0, // teto de gastos/mês (R$); 0 = sem orçamento
      walletCats: [], // categorias custom criadas pelo usuário
      bookCats: [], // categorias/gêneros custom de livros
      notifyAgenda: false, // lembrete de evento no celular (pede permissão)
      notifyLeadMin: 15, // quantos minutos antes avisar
      missoesView: "kanban", // kanban | lista — ver MISSOES_VIEWS
      sidebarCollapsed: false, // desktop: sidebar recolhida pra ganhar largura de tela
      dietSaveNewFoods: true, // item novo de refeição também entra na despensa
    },
    stats: {
      totalSessions: 0,
      totalMinutes: 0,
      todaySessions: 0,
      todayMinutes: 0,
      todayDate: getDateStr(0),
      streak: 0,
      bestStreak: 0,
      lastCompletedDate: null,
    },
    tasks: [],
    tasksDate: getDateStr(0),
    tasksBonusDate: null,
    habits: [],
    sleep: {},
    water: {}, // { [date]: { goal, entries: [{ id, ml, time }] } } — ver normalizeWater
    exerciseLogs: [],
    focusHistory: {}, // { [date]: { sessions, minutes } } — retrospecto de foco
    // despensa: alimentos cadastrados uma vez e reusados nas refeições
    //   { id, name, unit, portionGrams, kcal, protein, carbs, fat } — tabela de UMA porção
    foods: [],
    // plano de dieta fixo: blocos de refeição dinâmicos, cada um com seus itens
    dietPlan: [
      { id: 1, name: "Café da manhã", items: [] },
      { id: 2, name: "Almoço", items: [] },
      { id: 3, name: "Jantar", items: [] },
    ],
    // treinos por modalidade: modalidade → divisões → exercícios { id, name, detail }
    workoutPlan: [
      {
        id: 1,
        name: "Academia",
        divisions: [
          { id: 11, name: "Treino A", items: [], weekdays: [] },
          { id: 12, name: "Treino B", items: [], weekdays: [] },
        ],
      },
    ],
    // fichas arquivadas: snapshot { id, name, startDate, endDate, weeks, divisions, sessions, minutes, sets }
    workoutHistory: [],
    // dias de folga justificada: { [date]: { reason, note } } — abatem a meta semanal
    restDays: {},
    // séries de academia: { id, date, exercise, weight, reps|null, failure }
    gymSets: [],
    // diário: { [date]: { gratitude, memory, dump, posSituation, posContribution, negSituation, negContribution } }
    journal: {},
    // rotina fixa diária: items { id, name, time, weekdays } — bônus do dia mora nos checks
    routine: { items: [] },
    // checks da rotina: { [date]: { [itemId]: xpConcedido } }
    routineChecks: {},
    // quadro estilo Trello: catálogo de etiquetas + colunas
    //   labels  = [{ id, color, text }] — reusáveis entre cards
    //   columns = [{ id, name, cards:[{ id, text, priority, done, due, desc, labelIds, archived }] }]
    board: {
      labels: [],
      columns: [
        { id: "c1", name: "A fazer", cards: [] },
        { id: "c2", name: "Em progresso", cards: [] },
        { id: "c3", name: "Concluído", cards: [] },
      ],
    },
    // prancheta das missões: páginas de desenho { id, name, pos, elements }
    canvasPages: [],
    // estante: livros { id, title, author, total, page, status, rating, review, cover, startedAt, finishedAt }
    books: [],
    // agenda: { [date]: [{ id, title, cat, allDay, start, end, note }] }
    calendar: {},
    // regras de recorrência semanal da agenda; ocorrência é calculada, não gravada
    agendaRules: [],
    // perfil corporal p/ cálculo de basal, gasto e macros (idade sai de birth, não guardada)
    body: normalizeBody(null),
    // pesagens: { [date]: kg }
    weights: {},
    // finanças: transações { id, date, type:"income"|"expense", amount, category, note }
    transactions: [],
    // carteira jsonb: despesas fixas + metas de economia
    wallet: { fixed: [], goals: [] }, // fixed:{id,name,amount,category,day} goals:{id,name,target,saved}
    // mapa de longo prazo: raias (áreas da vida) + nós posicionados por horizonte × raia + arestas
    mapa: { lanes: DEFAULT_MAPA_LANES(), nodes: [], edges: [], focusId: null },
  };
}

export const isGymModality = (m) => /academia/i.test(m?.name || "");

// Academia é fixa: garante a modalidade no plano (usuários antigos podem ter deletado).
export function ensureAcademia(workoutPlan) {
  const plan = Array.isArray(workoutPlan) ? workoutPlan : [];
  if (plan.some(isGymModality)) return plan;
  return [
    {
      id: 1,
      name: "Academia",
      divisions: [
        { id: 11, name: "Treino A", items: [], weekdays: [] },
        { id: 12, name: "Treino B", items: [], weekdays: [] },
      ],
    },
    ...plan,
  ];
}

// ============================================================================
// FICHA DE TREINO — ciclo (por quanto tempo fico com ela) e histórico.
//
// `mod.cycle = { startDate:"YYYY-MM-DD", weeks:n }` — weeks 0 significa "sem prazo",
// que é diferente de "sem ciclo": quem não quer prazo continua com data de início e
// vê há quanto tempo está na mesma ficha, sem cobrança de vencimento.
//
// Ficha arquivada é SNAPSHOT: cópia profunda que não muda quando o plano muda depois.
// Sem isso "histórico" seria só um apontador pro plano atual e mentiria sobre o passado.
// ============================================================================
export const FICHA_WEEK_OPTIONS = [4, 6, 8, 12, 16];

export function fichaCycle(mod) {
  const c = mod?.cycle;
  const start = typeof c?.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.startDate) ? c.startDate : null;
  if (!start) return null;
  const weeks = Number(c?.weeks) > 0 ? Math.min(52, Math.round(Number(c.weeks))) : 0;
  const today = getDateStr(0);
  const dayNow = daysBetween(start, today) + 1; // 1-based; ≤0 = ficha começa no futuro
  const weekNow = Math.max(1, Math.ceil(dayNow / 7));
  if (!weeks) return { start, weeks: 0, dayNow, weekNow, endDate: null, daysLeft: null, totalDays: null, pct: null, expired: false };
  const totalDays = weeks * 7;
  const endDate = shiftDate(start, totalDays - 1);
  const daysLeft = daysBetween(today, endDate); // 0 = último dia; negativo = vencida
  return {
    start,
    weeks,
    dayNow,
    weekNow: Math.min(weeks, weekNow),
    endDate,
    daysLeft,
    totalDays,
    pct: Math.max(0, Math.min(100, Math.round((dayNow / totalDays) * 100))),
    expired: daysLeft < 0,
  };
}

// O que foi REGISTRADO na janela da ficha. Conta dado real; janela sem registro
// devolve zero em vez de estimativa.
export function fichaStats(state, modName, start, end = null) {
  const inWin = (d) => d >= start && (!end || d <= end);
  const logs = (state?.exerciseLogs || []).filter((l) => l.type === modName && inWin(l.date));
  const sets = (state?.gymSets || []).filter((s) => inWin(s.date));
  return {
    sessions: new Set(logs.map((l) => l.date)).size,
    minutes: logs.reduce((s, l) => s + (l.durationMin || 0), 0),
    sets: sets.length,
  };
}

const fichaSnapshot = (mod) =>
  (mod.divisions || []).map((d) => ({
    name: d.name || "",
    weekdays: Array.isArray(d.weekdays) ? [...d.weekdays] : [],
    items: (d.items || []).map((it) => ({ name: it.name || "", detail: it.detail || "" })),
  }));

// Arquiva a ficha da modalidade e abre um ciclo novo a partir de hoje.
// `clearItems` esvazia os exercícios (montar ficha nova do zero); sem ele os
// exercícios ficam e o ciclo só é renovado.
export function archiveFicha(prev, modId, { clearItems = false } = {}) {
  const mod = (prev.workoutPlan || []).find((m) => m.id === modId);
  if (!mod) return prev;
  const today = getDateStr(0);
  const cyc = fichaCycle(mod);
  const start = cyc?.start || today;
  // fim = hoje, ou o fim do ciclo se ele já passou (arquivar depois do vencimento
  // não deve inventar semanas que o plano não estava mais valendo)
  const end = cyc?.endDate && cyc.endDate < today ? cyc.endDate : today;
  const entry = {
    id: crypto.randomUUID(),
    name: mod.name || "Ficha",
    startDate: start,
    endDate: end,
    weeks: cyc?.weeks || 0,
    divisions: fichaSnapshot(mod),
    ...fichaStats(prev, mod.name, start, end),
    archivedAt: new Date().toISOString(),
  };
  return {
    ...prev,
    workoutHistory: [entry, ...(prev.workoutHistory || [])].slice(0, 60),
    workoutPlan: prev.workoutPlan.map((m) =>
      m.id !== modId
        ? m
        : {
            ...m,
            cycle: { startDate: today, weeks: cyc?.weeks || 0 },
            divisions: (m.divisions || []).map((d) => (clearItems ? { ...d, items: [] } : d)),
          }
    ),
  };
}

// Restaura uma ficha do histórico sobre a modalidade: as divisões do snapshot
// substituem as atuais e o ciclo recomeça hoje. O histórico não é consumido —
// restaurar não apaga o registro do passado.
export function restoreFicha(prev, modId, entryId) {
  const entry = (prev.workoutHistory || []).find((e) => e.id === entryId);
  const mod = (prev.workoutPlan || []).find((m) => m.id === modId);
  if (!entry || !mod) return prev;
  const divisions = (entry.divisions || []).map((d, i) => ({
    id: Date.now() + i,
    name: d.name || `Treino ${i + 1}`,
    weekdays: Array.isArray(d.weekdays) ? [...d.weekdays] : [],
    items: (d.items || []).map((it, k) => ({ id: Date.now() + i * 1000 + k, name: it.name || "", detail: it.detail || "" })),
  }));
  if (!divisions.length) return prev;
  return {
    ...prev,
    workoutPlan: prev.workoutPlan.map((m) =>
      m.id !== modId ? m : { ...m, divisions, cycle: { startDate: getDateStr(0), weeks: entry.weeks || 0 } }
    ),
  };
}

// Exercícios já executados, por nome: { [nome]: { sets, days, last, prWeight } }.
// Fonte é gymSets (série registrada = exercício feito de verdade); estar na ficha
// não conta, porque planejar não é ter feito.
export function gymHistoryByExercise(gymSets) {
  const out = {};
  for (const s of gymSets || []) {
    const key = (s.exercise || "").trim().toLowerCase();
    if (!key) continue;
    const e = (out[key] ||= { sets: 0, dates: new Set(), last: null, prWeight: 0 });
    e.sets++;
    e.dates.add(s.date);
    if (!e.last || s.date > e.last) e.last = s.date;
    if ((s.weight || 0) > e.prWeight) e.prWeight = s.weight || 0;
  }
  for (const k of Object.keys(out)) {
    out[k].days = out[k].dates.size;
    delete out[k].dates;
  }
  return out;
}

// Progressão por exercício: [{ date, max, volume }] ordenado por data.
// max = maior carga do dia; volume = Σ peso×reps (série "só falha" conta reps=1).
export function gymProgress(gymSets, exercise) {
  const byDate = {};
  for (const s of gymSets || []) {
    if (s.exercise !== exercise) continue;
    const d = (byDate[s.date] ||= { date: s.date, max: 0, volume: 0 });
    d.max = Math.max(d.max, s.weight || 0);
    d.volume += (s.weight || 0) * (s.reps || 1);
  }
  return Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// exercícios distintos já registrados (mais recente primeiro)
export function gymExercises(gymSets) {
  const seen = new Map(); // nome → data mais recente
  for (const s of gymSets || []) {
    if (!seen.has(s.exercise) || s.date > seen.get(s.exercise)) seen.set(s.exercise, s.date);
  }
  return [...seen.entries()].sort((a, b) => (a[1] > b[1] ? -1 : 1)).map(([name]) => name);
}

// PR (recorde pessoal) de um exercício: maior carga já registrada; desempate por mais reps.
// Retorna { weight, reps, date } ou null. Ignora séries sem carga (peso 0).
export function gymPR(gymSets, exercise) {
  let best = null;
  for (const s of gymSets || []) {
    if (s.exercise !== exercise) continue;
    const w = s.weight || 0;
    if (w <= 0) continue;
    const reps = s.reps || 0;
    if (!best || w > best.weight || (w === best.weight && reps > (best.reps || 0))) {
      best = { weight: w, reps: s.reps ?? null, date: s.date };
    }
  }
  return best;
}

// ---- Mapa: derivados ----

// % de progresso de leitura e de meta de economia (eram fórmulas inline duplicadas)
export const bookPct = (b) => (b?.total > 0 ? Math.min(100, Math.round(((b.page || 0) / b.total) * 100)) : 0);

// Ritmo de leitura pra fechar o livro na data-alvo (book.targetDate).
// Devolve `null` quando falta dado — sem total de páginas ou sem alvo não há conta.
//   reason: "no-total" | "no-target"
//   state:  "done" | "late" | "due-today" | "ok"
//   ahead:  páginas à frente (+) ou atrás (−) do esperado pro dia de hoje
export function readingPace(b, today = getDateStr(0)) {
  if (!b) return null;
  const total = Number(b.total) || 0;
  const page = Math.min(total, Math.max(0, Number(b.page) || 0));
  if (!total) return { reason: "no-total" };
  const pagesLeft = Math.max(0, total - page);
  if (b.status === "done" || pagesLeft === 0) return { state: "done", pagesLeft: 0 };
  if (!b.targetDate) return { reason: "no-target", pagesLeft };

  // dias restantes CONTANDO hoje: alvo hoje = 1 dia, não 0
  const daysLeft = daysBetween(today, b.targetDate) + 1;
  if (daysLeft <= 0) {
    return { state: "late", pagesLeft, daysLate: -daysLeft + 1, perDay: pagesLeft };
  }

  // esperado pra hoje pela reta início→alvo (sem início, a reta começa hoje)
  const start = b.startedAt && b.startedAt <= today ? b.startedAt : today;
  const span = daysBetween(start, b.targetDate) + 1;
  const elapsed = Math.min(span, daysBetween(start, today) + 1);
  const expectedPage = span > 0 ? Math.round((total * elapsed) / span) : page;

  return {
    state: daysLeft === 1 ? "due-today" : "ok",
    pagesLeft,
    daysLeft,
    perDay: Math.ceil(pagesLeft / daysLeft), // arredonda pra cima: fração não fecha no prazo
    expectedPage,
    ahead: page - expectedPage,
  };
}
export const goalPct = (g) => (g?.target > 0 ? Math.min(100, Math.round(((g.saved || 0) / g.target) * 100)) : 0);

const mirrorBroken = (type, label) => ({
  ok: false,
  type: type || null,
  label: label || "Referência perdida",
  sub: "O item original foi excluído",
  pct: 0,
  done: false,
  icon: "link_off",
  href: null,
});

// Resolve um nó espelho contra o state ATUAL. Recebe o ref (não o nó) pra Home e lista
// poderem chamar direto. Nada aqui é cacheado no mapa — rename/progresso propagam sozinhos.
// → { ok, type, label, sub, pct, done, icon, href }
export function resolveMirror(state, ref) {
  if (!ref?.type || !ref?.id) return mirrorBroken(null, "Sem referência");
  const s = state || {};
  switch (ref.type) {
    case "habit": {
      const h = (s.habits || []).find((x) => x.id === ref.id);
      if (!h) return mirrorBroken("habit");
      const kind = h.kind || "build";
      const base = { ok: true, type: "habit", label: h.name || "Hábito", href: "/habitos" };
      if (kind === "weekly") {
        const n = weekCount(h);
        const t = h.weeklyTarget || 3;
        const max = h.direction === "max";
        return {
          ...base,
          icon: h.icon || "repeat",
          pct: t > 0 ? Math.min(100, Math.round((n / t) * 100)) : 0,
          sub: `${n}/${t} nesta semana · ${max ? "no máximo" : "no mínimo"}`,
          done: max ? n <= t : n >= t,
        };
      }
      if (kind === "quit") {
        const clean = cleanDays(h);
        const next = QUIT_MILESTONES.find((m) => m.days > clean);
        return {
          ...base,
          icon: h.icon || "block",
          pct: next ? Math.min(100, Math.round((clean / next.days) * 100)) : 100,
          sub: next ? `${clean}d limpo · próximo marco ${next.days}d` : `${clean}d limpo`,
          done: false,
        };
      }
      const st = habitStreak(h);
      const sched = habitScheduleLabel(h);
      return {
        ...base,
        icon: h.icon || "check_circle",
        pct: Math.min(100, Math.round((st / HABIT_FORM_DAYS) * 100)),
        sub: st > 0 ? (sched ? `${st} em sequência · ${sched}` : `${st}d seguidos`) : sched || "sem sequência",
        done: (h.doneDates || []).includes(getDateStr(0)),
      };
    }
    case "card": {
      for (const col of s.board?.columns || []) {
        const c = (col.cards || []).find((x) => x.id === ref.id);
        if (!c) continue;
        const due = c.due ? ` · ${c.due.slice(8, 10)}/${c.due.slice(5, 7)}` : "";
        return {
          ok: true,
          type: "card",
          label: c.text || "Missão",
          icon: "flag",
          href: null, // /missoes está desativada — link levaria pra DisabledScreen
          pct: c.done ? 100 : 0,
          sub: `${col.name}${due}`,
          done: !!c.done,
        };
      }
      return mirrorBroken("card");
    }
    case "goal": {
      const g = (s.wallet?.goals || []).find((x) => x.id === ref.id);
      if (!g) return mirrorBroken("goal");
      return {
        ok: true,
        type: "goal",
        label: g.name || "Meta",
        icon: "savings",
        href: null, // /carteira está desativada — link levaria pra DisabledScreen

        pct: goalPct(g),
        sub: `${fmtMoney(g.saved)} de ${fmtMoney(g.target)}`,
        done: (g.saved || 0) >= (g.target || 0) && g.target > 0,
      };
    }
    case "book": {
      const b = (s.books || []).find((x) => x.id === ref.id);
      if (!b) return mirrorBroken("book");
      const status = b.status === "done" ? "concluído" : b.status === "reading" ? "lendo" : "quero ler";
      return {
        ok: true,
        type: "book",
        label: b.title || "Livro",
        icon: "menu_book",
        href: "/leitura",
        pct: b.status === "done" ? 100 : bookPct(b),
        sub: b.total > 0 ? `pág. ${b.page || 0}/${b.total}` : status,
        done: b.status === "done",
      };
    }
    default:
      return mirrorBroken(ref.type);
  }
}

// Opções agrupadas pro seletor de espelho. Concentra o conhecimento das 4 shapes aqui.
// → [{ group, items:[{ value:"tipo:id", label }] }]
export function mapaRefOptions(state) {
  const s = state || {};
  const groups = [];
  const push = (group, items) => items.length && groups.push({ group, items });

  push(
    "Hábitos",
    (s.habits || []).map((h) => ({ value: `habit:${h.id}`, label: h.name || "Hábito" }))
  );
  const cards = [];
  for (const col of s.board?.columns || []) {
    for (const c of col.cards || []) if (!c.done) cards.push({ value: `card:${c.id}`, label: c.text || "Missão" });
  }
  push("Missões", cards);
  // "Metas de economia" fora: /carteira está desativada, então não há onde criar nem editar
  // uma. Espelho de meta que já exista segue resolvendo — só não dá pra criar novo.
  push(
    "Leitura",
    (s.books || []).filter((b) => b.status !== "done").map((b) => ({ value: `book:${b.id}`, label: b.title || "Livro" }))
  );
  return groups;
}

// Nó fixado como foco do trimestre, já resolvido. Consumido pela Home — que hoje está
// fora da navegação, então o card só reaparece se a Home for reativada.
// → { node, lane, horizon, mirror } | null
export function mapaFocus(state) {
  const m = state?.mapa;
  if (!m?.focusId) return null;
  const node = (m.nodes || []).find((n) => n.id === m.focusId);
  if (!node) return null;
  return {
    node,
    lane: (m.lanes || []).find((l) => l.id === node.lane) || null,
    horizon: mapaHorizon(node.h),
    mirror: node.kind === "mirror" ? resolveMirror(state, node.ref) : null,
  };
}

// Único ponto anti-corrupção do mapa — todo load passa por mergeWithDefaults.
export function normalizeMapa(parsed) {
  const raw = parsed && typeof parsed === "object" ? parsed : {};

  // raias: dedupe por id, label limitado; vazio volta pro default
  const seenLane = new Set();
  let lanes = (Array.isArray(raw.lanes) ? raw.lanes : [])
    .filter((l) => l && l.id && !seenLane.has(l.id) && seenLane.add(l.id))
    .map((l, i) => ({
      id: String(l.id),
      label: String(l.label || "Área").slice(0, MAPA_LIMITS.lane),
      icon: l.icon || "circle",
      color: l.color || MAPA_LANE_COLORS[i % MAPA_LANE_COLORS.length],
    }));
  if (!lanes.length) lanes = DEFAULT_MAPA_LANES();
  const laneIds = new Set(lanes.map((l) => l.id));

  const horizonIds = new Set(MAPA_HORIZONS.map((h) => h.id));
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
    .filter((n) => n && n.id && (n.kind === "meta" || n.kind === "mirror" || n.kind === "note"))
    .slice(0, MAPA_MAX_NODES)
    .map((n) => {
      const base = {
        id: String(n.id),
        kind: n.kind,
        h: horizonIds.has(n.h) ? n.h : MAPA_HORIZONS[0].id,
        // raia apagada/renomeada por id → "Sem área" (visível e re-atribuível), nunca outra área
        lane: n.lane && laneIds.has(n.lane) ? n.lane : null,
      };
      if (n.kind === "meta") {
        return {
          ...base,
          title: String(n.title || "").slice(0, MAPA_LIMITS.title),
          why: String(n.why || "").slice(0, MAPA_LIMITS.why),
          status: MAPA_META_STATUS.some((s) => s.id === n.status) ? n.status : "ideia",
          target: String(n.target || "").slice(0, MAPA_LIMITS.target),
        };
      }
      if (n.kind === "mirror") {
        // ref irresolvível NÃO é podada: habits/board/books vêm de fontes distintas e a
        // ausência pode ser legítima. A UI mostra "Referência perdida" com Reapontar/Excluir.
        return {
          ...base,
          ref: n.ref && n.ref.type && n.ref.id ? { type: String(n.ref.type), id: String(n.ref.id) } : null,
          fallbackLabel: String(n.fallbackLabel || "").slice(0, MAPA_LIMITS.title),
          note: String(n.note || "").slice(0, MAPA_LIMITS.note),
        };
      }
      return {
        ...base,
        text: String(n.text || "").slice(0, MAPA_LIMITS.note),
        color: n.color || MAPA_NOTE_COLORS[0],
      };
    });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const seenEdge = new Set();
  const edges = (Array.isArray(raw.edges) ? raw.edges : [])
    .filter((e) => e && e.id && nodeIds.has(e.from) && nodeIds.has(e.to) && e.from !== e.to)
    .filter((e) => {
      const k = `${e.from}>${e.to}>${e.kind}`;
      return !seenEdge.has(k) && seenEdge.add(k);
    })
    .map((e) => ({
      id: String(e.id),
      from: e.from,
      to: e.to,
      kind: MAPA_EDGE_KINDS.some((k) => k.id === e.kind) ? e.kind : "leva",
    }));

  return { lanes, nodes, edges, focusId: nodeIds.has(raw.focusId) ? raw.focusId : null };
}

// Saneia os passos e os checks: id órfão, texto gigante, checklist acima do teto e
// dia velho morrem aqui. Único ponto por onde todo load passa.
export function normalizeHabits(parsed) {
  const today = getDateStr(0);
  return (Array.isArray(parsed) ? parsed : []).map((h) => {
    if (!h || typeof h !== "object") return h;
    const steps = (Array.isArray(h.steps) ? h.steps : [])
      .filter((s) => s && s.id)
      .slice(0, HABIT_STEPS_MAX)
      .map((s) => ({ id: String(s.id), text: String(s.text || "").slice(0, HABIT_STEP_LEN) }));
    // hábito sem checklist volta com a MESMA identidade: merge byte-idêntico = nenhuma escrita no login
    if (!steps.length) return h.steps === undefined && h.stepChecks === undefined ? h : { ...h, steps: [], stepChecks: {} };
    const ids = new Set(steps.map((s) => s.id));
    const cleaned = {};
    for (const [d, list] of Object.entries(h.stepChecks && typeof h.stepChecks === "object" ? h.stepChecks : {})) {
      const keep = (Array.isArray(list) ? list : []).filter((x) => ids.has(x));
      if (keep.length) cleaned[d] = keep;
    }
    return { ...h, steps, stepChecks: pruneStepChecks(cleaned, today) };
  });
}

export function mergeWithDefaults(parsed) {
  const d = defaultState();
  parsed = parsed || {};
  const settings = { ...d.settings, ...(parsed.settings || {}) };
  settings.sleepGoalMin = Math.min(SLEEP_GOAL_MAX, Math.max(SLEEP_GOAL_MIN, settings.sleepGoalMin || BASE_SLEEP_MIN));
  settings.missoesView = missoesView(settings.missoesView);
  settings.waterGoal = waterGoal({ settings });
  settings.waterReminder = WATER_REMINDERS.includes(settings.waterReminder) ? settings.waterReminder : 0;
  settings.sidebarCollapsed = !!settings.sidebarCollapsed;
  settings.dietSaveNewFoods = settings.dietSaveNewFoods !== false;
  // nome/pelagem do mascote de versões antigas: o rato agora é fixo
  delete settings.petName;
  delete settings.petCoat;
  return {
    settings,
    stats: normalizeStats(parsed.stats, d.stats),
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    tasksDate: parsed.tasksDate || d.tasksDate,
    tasksBonusDate: parsed.tasksBonusDate || null,
    habits: normalizeHabits(parsed.habits),
    sleep: parsed.sleep && typeof parsed.sleep === "object" ? parsed.sleep : {},
    water: normalizeWater(parsed.water),
    exerciseLogs: Array.isArray(parsed.exerciseLogs) ? parsed.exerciseLogs : [],
    focusHistory: parsed.focusHistory && typeof parsed.focusHistory === "object" ? parsed.focusHistory : {},
    foods: normalizeFoods(parsed.foods),
    dietPlan: Array.isArray(parsed.dietPlan) ? parsed.dietPlan : d.dietPlan,
    workoutPlan: ensureAcademia(Array.isArray(parsed.workoutPlan) ? parsed.workoutPlan : d.workoutPlan),
    workoutHistory: Array.isArray(parsed.workoutHistory) ? parsed.workoutHistory : [],
    gymSets: Array.isArray(parsed.gymSets) ? parsed.gymSets : [],
    restDays: normalizeRestDays(parsed.restDays),
    journal: parsed.journal && typeof parsed.journal === "object" ? parsed.journal : {},
    routine: normalizeRoutine(parsed.routine),
    routineChecks: parsed.routineChecks && typeof parsed.routineChecks === "object" ? parsed.routineChecks : {},
    board: normalizeBoard(parsed.board, d.board),
    canvasPages: normalizeCanvasPages(parsed.canvasPages),
    books: Array.isArray(parsed.books) ? parsed.books : [],
    calendar: parsed.calendar && typeof parsed.calendar === "object" ? parsed.calendar : {},
    agendaRules: normalizeAgendaRules(parsed.agendaRules),
    body: normalizeBody(parsed.body),
    weights: normalizeWeights(parsed.weights),
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    wallet: {
      fixed: Array.isArray(parsed.wallet?.fixed) ? parsed.wallet.fixed : [],
      goals: Array.isArray(parsed.wallet?.goals) ? parsed.wallet.goals : [],
    },
    mapa: normalizeMapa(parsed.mapa),
  };
}

export function playAlarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === "suspended") ctx.resume(); // autoplay policy: retoma se suspenso
    const beep = (freq, start, dur = 0.18, vol = 0.22) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };
    const t0 = ctx.currentTime + 0.05;
    for (let burst = 0; burst < 3; burst++) {
      const b = t0 + burst * 0.85;
      beep(880, b);
      beep(880, b + 0.22);
      beep(1175, b + 0.44);
    }
    setTimeout(() => ctx.close(), 3200);
  } catch (e) {}
}

export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.14;
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.start(start);
      osc.stop(start + 0.34);
    });
    setTimeout(() => ctx.close(), 700);
  } catch (e) {}
}
