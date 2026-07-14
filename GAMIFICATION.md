# Gamificação — Discipline Rats

Regras de XP e níveis (implementadas em `app/page.js`).

## Fontes de XP

| Fonte | XP base | Frequência |
|---|---|---|
| Sessão de foco concluída | **50** (a 25 min; escala com a duração) | por sessão |
| Zerar todas as metas do dia | **+10** | 1x/dia (`tasksBonusDate`) |
| Dormir ≥ meta de sono | **50** (a 7h30; escala com a meta) | 1x/noite (`sleep[date].xpAwarded`) |
| Treino registrado | **40** | por treino |

### XP proporcional (foco e sono)

- Foco: `round(50 × focusMin / 25)` — mais tempo de pomodoro = mais XP; menos = menos. (`focusXp`)
- Sono: `round(50 × sleepGoalMin / 450)` — meta maior = mais XP. (`sleepXp`)
- Meta de sono limitada a **6h–9h** (`SLEEP_GOAL_MIN`/`SLEEP_GOAL_MAX`).

## Multiplicador de streak

`mult = 1 + min(0.05 × streak, 0.50)`

- +5% de XP por dia de sequência, teto **+50%** (10 dias).
- Aplicado a TODAS as fontes no momento em que o XP é ganho.
- Streak = dias consecutivos com ao menos 1 sessão de foco concluída.

## Curva de nível (escalonada suave)

Custo do nível N → N+1: `500 + 250 × (N-1)`

| Nível | XP p/ subir | XP acumulado |
|---|---|---|
| 1→2 | 500 | 0 |
| 2→3 | 750 | 500 |
| 3→4 | 1000 | 1250 |
| 4→5 | 1250 | 2250 |
| 5→6 | 1500 | 3500 |

## Tiers (títulos)

| Tier | Níveis |
|---|---|
| Iniciante | 1–2 |
| Aprendiz de Ferro | 3–5 |
| Forjador | 6–9 |
| Veterano de Aço | 10–14 |
| Mestre de Titânio | 15+ |

## Estado persistido (relevante à gamificação)

```
stats.xp            número total de XP
stats.streak        sequência atual
stats.bestStreak    melhor sequência
tasksBonusDate      última data em que ganhou bônus de metas
sleep[date].xpAwarded  já pagou XP daquela noite?
settings.sleepGoalMin  meta de sono em minutos (default 450 = 7h30)
```

## Ideias futuras (não implementadas)

- Conquistas/badges por marcos (7/30/100 dias, N sessões).
- Penalidade/decay de streak.
- Leaderboard real (view `leaderboard` já criada no schema).
