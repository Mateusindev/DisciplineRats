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
// Nada aqui concede XP nem escreve estado: é leitura pura.
// ============================================================================

import {
  getDateStr,
  eventsForDate,
  routineDayStats,
  pendingCards,
  habitIsScheduled,
  weekStartOf,
  shiftDate,
  dietTotals,
  journalHasContent,
  journalStreak,
  bookPct,
} from "./state";

const pctOf = (done, total) => (total > 0 ? Math.round((done / total) * 100) : null);

// tone: "good" fechou, "warn" está devendo, "idle" em andamento ou sem dado.
const scene = (act, tone, title, line, pct = null) => ({ act, tone, title, line, pct });

function calendario(state, today) {
  const evs = eventsForDate(state, today).length;
  const r = routineDayStats(state, today);
  const compromissos = `${evs} ${evs === 1 ? "COMPROMISSO" : "COMPROMISSOS"}`;
  if (!evs && !r.total) return scene("sleep", "idle", "AGENDA", "DIA LIMPO — ELE APROVEITOU PRA DORMIR");
  if (r.total && r.complete) return scene("happy", "good", "AGENDA", `ROTINA FECHADA · ${compromissos}`, 100);
  if (!r.total) return scene("idle", "idle", "AGENDA", `${compromissos} HOJE`);
  return scene("idle", "idle", "AGENDA", `${r.done}/${r.total} DA ROTINA · ${compromissos}`, r.pct);
}

function missoes(state, today) {
  const pend = pendingCards(state);
  const atrasados = pend.filter((c) => c.due && c.due < today).length;
  const total = (state?.board?.columns || []).reduce((n, c) => n + (c.cards || []).filter((k) => !k.archived).length, 0);
  if (!total) return scene("sleep", "idle", "MISSÕES", "QUADRO VAZIO — NADA PRA PERSEGUIR");
  if (!pend.length) return scene("happy", "good", "MISSÕES", "QUADRO LIMPO — TUDO FECHADO", 100);
  if (atrasados) return scene("sit", "warn", "MISSÕES", `${atrasados} ${atrasados === 1 ? "CARD ATRASADO" : "CARDS ATRASADOS"} DE ${pend.length} EM ABERTO`, pctOf(total - pend.length, total));
  return scene("idle", "idle", "MISSÕES", `${pend.length} EM ABERTO DE ${total}`, pctOf(total - pend.length, total));
}

function habitos(state, today) {
  // Hábito de largar (kind "quit") fica de fora: lá `doneDates` é recaída, então
  // contá-lo como "feito hoje" inverteria o placar.
  const hoje = (state?.habits || []).filter((h) => (h.kind || "build") !== "quit" && habitIsScheduled(h, today));
  const feitos = hoje.filter((h) => (h.doneDates || []).includes(today)).length;
  if (!hoje.length) return scene("sleep", "idle", "HÁBITOS", "NADA AGENDADO PRA HOJE");
  if (feitos === hoje.length) return scene("happy", "good", "HÁBITOS", `TUDO FEITO · ${feitos} DE ${hoje.length}`, 100);
  // Sem nada marcado ele senta e espera, mas o tom NÃO é de cobrança: às 8 da
  // manhã ninguém está devendo o dia. Cobrar cedo é o jeito rápido de a faixa
  // virar ruído que se aprende a ignorar.
  return scene(feitos ? "idle" : "sit", "idle", "HÁBITOS", `${feitos}/${hoje.length} MARCADOS HOJE`, pctOf(feitos, hoje.length));
}

function exercicio(state, today) {
  const meta = Number(state?.settings?.exerciseWeeklyGoal) || 0;
  const ini = weekStartOf(today);
  const fim = shiftDate(ini, 6);
  const logs = (state?.exerciseLogs || []).filter((l) => l.date >= ini && l.date <= fim);
  const hojeTreinou = logs.some((l) => l.date === today);
  if (!meta) return scene("sleep", "idle", "EXERCÍCIO", "SEM META SEMANAL DEFINIDA");
  if (!(state?.exerciseLogs || []).length) return scene("sleep", "idle", "EXERCÍCIO", "NENHUM TREINO REGISTRADO AINDA");
  if (logs.length >= meta) return scene("happy", "good", "EXERCÍCIO", `META DA SEMANA BATIDA · ${logs.length}/${meta}`, 100);
  const linha = `${logs.length}/${meta} TREINOS NA SEMANA${hojeTreinou ? " · TREINOU HOJE" : ""}`;
  // Só vira cobrança no domingo: até lá a semana ainda tem pra onde correr.
  const fimDaSemana = today === fim;
  return scene(hojeTreinou ? "idle" : "sit", fimDaSemana && !hojeTreinou ? "warn" : "idle", "EXERCÍCIO", linha, pctOf(logs.length, meta));
}

function dieta(state) {
  const itens = (state?.dietPlan || []).flatMap((m) => m.items || []);
  const meta = Number(state?.settings?.dietKcalGoal) || 0;
  if (!itens.length) return scene("sleep", "idle", "DIETA", "PLANO VAZIO — TIGELA VAZIA TAMBÉM");
  const kcal = Math.round(dietTotals(itens).kcal);
  if (!meta) return scene("idle", "idle", "DIETA", `PLANO EM ${kcal} KCAL · SEM META`);
  const folga = Math.round(meta * 0.08); // 8% de tolerância: dieta não é balança de precisão
  const pct = Math.min(100, Math.round((kcal / meta) * 100));
  if (kcal > meta + folga) return scene("sit", "warn", "DIETA", `${kcal} KCAL · ${kcal - meta} ACIMA DA META`, pct);
  if (kcal < meta - folga) return scene("idle", "idle", "DIETA", `${kcal} KCAL · FALTAM ${meta - kcal} PRA META`, pct);
  return scene("happy", "good", "DIETA", `${kcal} KCAL · PLANO NA META`, pct);
}

function diario(state, today) {
  const escreveu = journalHasContent(state?.journal?.[today]);
  const seq = journalStreak(state?.journal);
  if (escreveu) return scene("happy", "good", "DIÁRIO", `ESCRITO HOJE · ${seq} ${seq === 1 ? "DIA SEGUIDO" : "DIAS SEGUIDOS"}`, 100);
  // Sequência em risco é a única cobrança que o diário faz — e só existe pra quem
  // tem sequência. Quem nunca escreveu não está falhando com nada.
  if (seq) return scene("sit", "warn", "DIÁRIO", `${seq} ${seq === 1 ? "DIA" : "DIAS"} DE SEQUÊNCIA EM RISCO — NADA HOJE AINDA`);
  if (!Object.keys(state?.journal || {}).length) return scene("sleep", "idle", "DIÁRIO", "CADERNO EM BRANCO — COMECE QUANDO QUISER");
  return scene("sit", "idle", "DIÁRIO", "NENHUMA ENTRADA HOJE");
}

function leitura(state) {
  const lendo = (state?.books || []).filter((b) => b.status === "reading");
  if (!lendo.length) return scene("sleep", "idle", "LEITURA", "NENHUM LIVRO EM CURSO");
  // o mais adiantado é o que ele comenta: é o que está prestes a fechar
  const b = [...lendo].sort((x, y) => bookPct(y) - bookPct(x))[0];
  const pct = bookPct(b);
  const titulo = String(b.title || "SEM TÍTULO").toUpperCase();
  if (pct >= 100) return scene("happy", "good", "LEITURA", `${titulo} · NA ÚLTIMA PÁGINA`, 100);
  return scene("idle", "idle", "LEITURA", `${titulo} · ${pct}%`, pct);
}

const BY_TAB = { calendario, missoes, habitos, exercicio, dieta, diario, leitura };

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
