// ============================================================================
// O QUE O GATO ACHA DE CADA TELA.
//
// Uma função só, e não um pedaço de lógica dentro de cada página, porque o estado
// do app inteiro é UM objeto: dado `state`, dá pra responder "como está a tela de
// hábitos" sem estar dentro dela. Espalhar isso por sete páginas seria sete
// lugares pra esquecer de atualizar quando a regra mudar.
//
// Devolve sempre a mesma forma — pose, título, uma linha e, quando existir, um
// percentual — e a faixa (`components/BichoDaTela.js`) só desenha. As poses são as
// mesmas do cercado do perfil: "happy" (fechou), "idle" (em andamento), "sit"
// (devendo) e "sleep" (não há nada pra fazer aqui hoje).
//
// Nada aqui escreve estado: é leitura pura.
// ============================================================================

import {
  getDateStr,
  eventsForDate,
  routineDayStats,
  pendingCards,
  habitIsScheduled,
  weekStartOf,
  shiftDate,
  restDaysInWeek,
  dietTotals,
  journalHasContent,
  journalStreak,
  bookPct,
  waterGoal,
  waterTotal,
  waterEntries,
  waterPaceRatio,
  waterStreak,
} from "./state";

const pctOf = (done, total) => (total > 0 ? Math.round((done / total) * 100) : null);

// tone: "good" fechou, "warn" está devendo, "idle" em andamento ou sem dado.
const scene = (act, tone, title, line, pct = null) => ({ act, tone, title, line, pct });

function calendario(state, today) {
  const evs = eventsForDate(state, today).length;
  const r = routineDayStats(state, today);
  const compromissos = `${evs} ${evs === 1 ? "compromisso" : "compromissos"}`;
  if (!evs && !r.total) return scene("sleep", "idle", "agenda", "dia limpo — ele aproveitou pra dormir");
  if (r.total && r.complete) return scene("happy", "good", "agenda", `rotina fechada · ${compromissos}`, 100);
  if (!r.total) return scene("idle", "idle", "agenda", `${compromissos} hoje`);
  return scene("idle", "idle", "agenda", `${r.done}/${r.total} da rotina · ${compromissos}`, r.pct);
}

function missoes(state, today) {
  const pend = pendingCards(state);
  const atrasados = pend.filter((c) => c.due && c.due < today).length;
  const total = (state?.board?.columns || []).reduce((n, c) => n + (c.cards || []).filter((k) => !k.archived).length, 0);
  if (!total) return scene("sleep", "idle", "missões", "quadro vazio — nada pra perseguir");
  if (!pend.length) return scene("happy", "good", "missões", "quadro limpo — tudo fechado", 100);
  if (atrasados) return scene("sit", "warn", "missões", `${atrasados} ${atrasados === 1 ? "card atrasado" : "cards atrasados"} de ${pend.length} em aberto`, pctOf(total - pend.length, total));
  return scene("idle", "idle", "missões", `${pend.length} em aberto de ${total}`, pctOf(total - pend.length, total));
}

function habitos(state, today) {
  // Hábito de largar (kind "quit") fica de fora: lá `doneDates` é recaída, então
  // contá-lo como "feito hoje" inverteria o placar.
  const hoje = (state?.habits || []).filter((h) => (h.kind || "build") !== "quit" && habitIsScheduled(h, today));
  const feitos = hoje.filter((h) => (h.doneDates || []).includes(today)).length;
  if (!hoje.length) return scene("sleep", "idle", "hábitos", "nada agendado pra hoje");
  if (feitos === hoje.length) return scene("happy", "good", "hábitos", `tudo feito · ${feitos} de ${hoje.length}`, 100);
  // Sem nada marcado ele senta e espera, mas o tom NÃO é de cobrança: às 8 da
  // manhã ninguém está devendo o dia. Cobrar cedo é o jeito rápido de a faixa
  // virar ruído que se aprende a ignorar.
  return scene(feitos ? "idle" : "sit", "idle", "hábitos", `${feitos}/${hoje.length} marcados hoje`, pctOf(feitos, hoje.length));
}

function exercicio(state, today) {
  const meta = Number(state?.settings?.exerciseWeeklyGoal) || 0;
  const ini = weekStartOf(today);
  const fim = shiftDate(ini, 6);
  const logs = (state?.exerciseLogs || []).filter((l) => l.date >= ini && l.date <= fim);
  const hojeTreinou = logs.some((l) => l.date === today);
  // Folga justificada ABATE a meta da semana — é a mesma conta de /exercicio.
  // Ignorar isso aqui fazia o mascote cobrar um treino que o app já tinha
  // perdoado, e discordar do número na tela ao lado.
  const folgas = restDaysInWeek(state?.restDays, ini);
  const alvo = Math.max(0, meta - folgas);
  const abatidas = folgas ? ` · ${folgas} folga${folgas > 1 ? "s" : ""} abatida${folgas > 1 ? "s" : ""}` : "";

  if (!meta) return scene("sleep", "idle", "exercício", "sem meta semanal definida");
  if (!(state?.exerciseLogs || []).length && !folgas) return scene("sleep", "idle", "exercício", "nenhum treino registrado ainda");
  // Meta zerada por folga não é meta batida nem meta furada: a semana foi perdoada.
  if (!alvo) return scene("sleep", "idle", "exercício", `semana justificada · ${folgas} folga${folgas > 1 ? "s" : ""} abate${folgas > 1 ? "m" : ""} a meta de ${meta}`);
  if (logs.length >= alvo) return scene("happy", "good", "exercício", `meta da semana batida · ${logs.length}/${alvo}${abatidas}`, 100);

  const linha = `${logs.length}/${alvo} treinos na semana${hojeTreinou ? " · treinou hoje" : abatidas}`;
  // Só vira cobrança no domingo: até lá a semana ainda tem pra onde correr.
  const fimDaSemana = today === fim;
  return scene(hojeTreinou ? "idle" : "sit", fimDaSemana && !hojeTreinou ? "warn" : "idle", "exercício", linha, pctOf(logs.length, alvo));
}

function dieta(state) {
  const itens = (state?.dietPlan || []).flatMap((m) => m.items || []);
  const meta = Number(state?.settings?.dietKcalGoal) || 0;
  if (!itens.length) return scene("sleep", "idle", "dieta", "plano vazio — tigela vazia também");
  const kcal = Math.round(dietTotals(itens).kcal);
  if (!meta) return scene("idle", "idle", "dieta", `plano em ${kcal} kcal · sem meta`);
  const folga = Math.round(meta * 0.08); // 8% de tolerância: dieta não é balança de precisão
  const pct = Math.min(100, Math.round((kcal / meta) * 100));
  if (kcal > meta + folga) return scene("sit", "warn", "dieta", `${kcal} kcal · ${kcal - meta} acima da meta`, pct);
  if (kcal < meta - folga) return scene("idle", "idle", "dieta", `${kcal} kcal · faltam ${meta - kcal} pra meta`, pct);
  return scene("happy", "good", "dieta", `${kcal} kcal · plano na meta`, pct);
}

function diario(state, today) {
  const escreveu = journalHasContent(state?.journal?.[today]);
  const seq = journalStreak(state?.journal);
  if (escreveu) return scene("happy", "good", "diário", `escrito hoje · ${seq} ${seq === 1 ? "dia seguido" : "dias seguidos"}`, 100);
  // Sequência em risco é a única cobrança que o diário faz — e só existe pra quem
  // tem sequência. Quem nunca escreveu não está falhando com nada.
  if (seq) return scene("sit", "warn", "diário", `${seq} ${seq === 1 ? "dia" : "dias"} de sequência em risco — nada hoje ainda`);
  if (!Object.keys(state?.journal || {}).length) return scene("sleep", "idle", "diário", "caderno em branco — comece quando quiser");
  return scene("sit", "idle", "diário", "nenhuma entrada hoje");
}

function leitura(state) {
  const lendo = (state?.books || []).filter((b) => b.status === "reading");
  if (!lendo.length) return scene("sleep", "idle", "leitura", "nenhum livro em curso");
  // o mais adiantado é o que ele comenta: é o que está prestes a fechar
  const b = [...lendo].sort((x, y) => bookPct(y) - bookPct(x))[0];
  const pct = bookPct(b);
  const titulo = String(b.title || "Sem título");
  if (pct >= 100) return scene("happy", "good", "leitura", `${titulo} · na última página`, 100);
  return scene("idle", "idle", "leitura", `${titulo} · ${pct}%`, pct);
}

function agua(state, today) {
  const goal = waterGoal(state);
  const total = waterTotal(state, today);
  const pct = Math.min(100, Math.round((total / goal) * 100));
  const fmt = (n) => Math.round(n).toLocaleString("pt-BR");
  if (total >= goal) return scene("happy", "good", "água", `meta batida · ${fmt(total)} ml`, 100);
  // Atraso de verdade é ficar bem abaixo do ritmo com o dia já andado — manhã sem
  // copo nenhum é só manhã. Conta nova (nunca registrou nada) nunca leva bronca.
  const nuncaRegistrou = !Object.keys(state?.water || {}).length;
  if (nuncaRegistrou) return scene("idle", "idle", "água", "copo vazio — o primeiro é o mais fácil", 0);
  const pace = waterPaceRatio();
  const ideal = goal * pace;
  if (pace >= 0.5 && total < ideal * 0.6) return scene("sit", "warn", "água", `${fmt(ideal - total)} ml atrás do ritmo de hoje`, pct);
  if (!waterEntries(state, today).length) {
    const seq = waterStreak(state, today);
    return scene("idle", "idle", "água", seq ? `nada ainda hoje · ${seq} ${seq === 1 ? "dia" : "dias"} de meta seguidos` : "nada ainda hoje", 0);
  }
  return scene("idle", "idle", "água", `${fmt(total)} de ${fmt(goal)} ml`, pct);
}

const BY_TAB = { calendario, missoes, habitos, exercicio, dieta, diario, leitura, agua };

export function petScene(tab, state, today = getDateStr(0)) {
  const fn = BY_TAB[tab];
  if (!fn || !state) return null;
  try {
    return fn(state, today);
  } catch {
    // Nenhuma faixa de mascote vale derrubar a tela inteira que ela decora.
    return null;
  }
}

export const petSceneTabs = Object.keys(BY_TAB);
