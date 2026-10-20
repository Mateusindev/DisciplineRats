# Discipline Rats

Painel de autodisciplina: registre hábitos, sono, treinos, diário e leitura, planeje o longo prazo no Mapa — e veja seu rato crescer com o XP que isso rende.

Construído com **Next.js 15** (App Router) + **Supabase**. Instalável como app (PWA).

## Funcionalidades

### Hoje
- **Hábitos** — três tipos: diário (com dias da semana escolhidos), semanal (mínimo ou limite de vezes por semana) e corte de vício (registra recaída, conta dias limpo).
  - Prioridade baixa/normal/alta (10/15/25 XP), "porquê" curto no topo do card.
  - Microatividades: checklist de até 12 passos que trava a marcação do dia até fechar.
  - **Mínimo executável**: a menor versão que ainda conta — marca o dia inteiro, mesmo XP, mesma sequência.
  - Desktop: matriz do mês com registro retroativo (qualquer dia já vivido). Celular: blocos do dia, um toque marca hoje.

### Corpo
- **Sono** — hora de deitar/acordar, qualidade e nota; meta de duração e horário limite (passar dele pede justificativa). Registro retroativo de até 30 noites, gráfico de 7 dias.
- **Exercício** — plano por modalidade e divisão, ciclo da ficha com histórico, agenda semanal, registro de treino (inclusive retroativo), folga justificada, séries de academia com curva de progressão e recorde, catálogo de exercícios.

### Mente
- **Diário** — perguntas guiadas (gratidão, memória, relato, situações do dia), uma entrada por dia, histórico por mês, sequência de escrita.
- **Leitura** — estante Quero ler / Lendo / Concluído, busca no OpenLibrary, progresso por página com meta de término, nota e resenha.

### Planos
- **Mapa** — planejamento de longo prazo em colunas de horizonte × faixas de área da vida. Itens Meta, Nota e Espelho (progresso ao vivo de um hábito ou livro), ligações "leva a"/"depende de", foco do trimestre. Vira lista no celular.

### Perfil e pet
- XP, nível, posição no ranking, estatísticas e insígnias; tema claro/escuro; reiniciar dados.
- **Pet** — o rato cresce com o XP (XP não compra nada, só faz crescer). Nome, espécie, pelagem e acessórios: um grátis por categoria, os demais R$ 0,99 via Mercado Pago. O bicho também aparece numa faixa no topo de cada aba comentando o dia.

### Gamificação
XP vem de hábitos, sono na meta, treinos e diário, com multiplicador de sequência (+5%/dia, até +50%). O XP é do servidor: o cliente manda só o delta, aplicado pela RPC `apply_xp_delta` com teto diário de 1500. Detalhes em [`CLAUDE.md`](CLAUDE.md#gamification).

### Desativadas
Foco (Pomodoro), Agenda/Rotina, Missões, Dieta, Home, Carteira, Análise e Grupos seguem no código, fora do menu e bloqueadas por URL (`TABS` em `lib/state.js` + `DISABLED_ROUTES` em `app/(app)/layout.js`).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router, React 19), JavaScript |
| Estilo | Tailwind CSS v4 (tokens Material 3 em `app/globals.css`) |
| Back-end | Supabase (Postgres + Auth + Edge Functions), acesso direto do cliente via anon key |
| Persistência | tabelas normalizadas por domínio + `jsonb` em `profiles`, diff-sync com debounce |

Sem API routes no Next — o navegador fala direto com o Supabase, protegido por Row Level Security.

## Como rodar

Requer [Bun](https://bun.sh).

```bash
bun install
bun run dev
```

Abre em `http://localhost:3000`. Sem Supabase configurado o app abre sem login, mas **não salva nada** (estado só em memória).

### Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor (tabelas, RLS, triggers, XP server-side, view `leaderboard`). [`supabase/exercises_seed.sql`](supabase/exercises_seed.sql) popula o catálogo de exercícios.
3. Copie `.env.local.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

4. Loja do pet: deploy de `supabase/functions/mp-checkout` e `mp-webhook` — ver [`supabase/functions/mp-webhook/README.md`](supabase/functions/mp-webhook/README.md).

## Scripts

```bash
bun run dev        # dev server
bun run build      # build de produção (é o gate de correção — não há testes)
bun run start      # serve o build
bun run check:pet  # catálogo do pet: UI × Edge Functions batem
```

## Estrutura

```
app/
  (app)/              rotas autenticadas, uma pasta por aba
    AppContext.js     estado global, carga, diff-sync com debounce, toasts
    layout.js         sidebar + bottom nav + rotas desativadas
  login/              auth
components/           primitivos (ui.js), arte do pet (PetArt.js), faixa do pet (BichoDaTela.js)
lib/
  state.js            TABS, defaults, regras de XP/streak, helpers puros
  persistence.js      load/sync com o Supabase
  petMood.js          o que o pet diz em cada aba
supabase/
  schema.sql          schema do banco
  functions/          Edge Functions (Mercado Pago, lembretes push)
public/               manifest, service worker, ícones
```
