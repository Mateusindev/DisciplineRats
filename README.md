# Discipline Rats

Painel de autodisciplina: registre hábitos, sono, treinos, diário e leitura, organize tarefas num quadro estilo Trello — com o rato do app comentando seu dia.

Construído com **Next.js 15** (App Router) + **Supabase**. Instalável como app (PWA).

## Funcionalidades

### Hoje
- **Hábitos** — três tipos: diário (com dias da semana escolhidos), semanal (mínimo ou limite de vezes por semana) e corte de vício (registra recaída, conta dias limpo).
  - Prioridade baixa/normal/alta, "porquê" curto no topo do card.
  - Microatividades: checklist de até 12 passos que trava a marcação do dia até fechar.
  - **Mínimo executável**: a menor versão que ainda conta — marca o dia inteiro, mesma sequência.
  - Desktop: matriz do mês com registro retroativo (qualquer dia já vivido). Celular: blocos do dia, um toque marca hoje.

### Corpo
- **Sono** — hora de deitar/acordar, qualidade e nota; meta de duração e horário limite (passar dele pede justificativa). Registro retroativo de até 30 noites, gráfico de 7 dias.
- **Água** — copo animado que enche até a meta diária, atalhos +200/+300/+500 (teclas 1/2/3), linha do ritmo ideal, semana com sequência, histórico do dia e lembrete opcional.
- **Exercício** — plano por modalidade e divisão, ciclo da ficha com histórico, agenda semanal, registro de treino (inclusive retroativo), folga justificada, séries de academia com curva de progressão e recorde, catálogo de exercícios.

### Mente
- **Diário** — perguntas guiadas (gratidão, memória, relato, situações do dia), uma entrada por dia, histórico por mês, sequência de escrita.
- **Leitura** — estante Quero ler / Lendo / Concluído, busca no OpenLibrary, progresso por página com meta de término, nota e resenha.

### Planos
- **Board** — quadro estilo Trello (kanban/lista) com etiquetas, prazos e checklist por card, mais a Prancheta (canvas de desenho).
- **Mapa** — planejamento de longo prazo em colunas de horizonte × faixas de área da vida. Itens Meta, Nota e Espelho (progresso ao vivo de um hábito ou livro), ligações "leva a"/"depende de", foco do trimestre. Vira lista no celular.

### Perfil e mascote
- Nick, sequência, estatísticas; tema claro/escuro; reiniciar dados.
- **O rato** — o mascote do app aparece numa faixa no topo de cada aba comentando o dia (e na tela de sono, na cama). Sem gamificação: não há XP, nível, ranking nem loja.

### Desativadas
Foco (Pomodoro), Agenda/Rotina, Mapa, Dieta, Home, Carteira e Análise seguem no código, fora do menu e bloqueadas por URL (`TABS` em `lib/state.js` + `DISABLED_ROUTES` em `app/(app)/layout.js`).

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
2. Rode [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor (tabelas, RLS, triggers). Banco já no ar: só a tabela da água está em [`supabase/patch-agua.sql`](supabase/patch-agua.sql). [`supabase/exercises_seed.sql`](supabase/exercises_seed.sql) popula o catálogo de exercícios.
3. Copie `.env.local.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```


## Scripts

```bash
bun run dev        # dev server
bun run build      # build de produção (é o gate de correção — não há testes)
bun run start      # serve o build
```

## Estrutura

```
app/
  (app)/              rotas autenticadas, uma pasta por aba
    AppContext.js     estado global, carga, diff-sync com debounce, toasts
    layout.js         sidebar + bottom nav + rotas desativadas
  login/              auth
components/           primitivos (ui.js), arte do rato (PetArt.js), faixa do rato (BichoDaTela.js)
lib/
  state.js            TABS, defaults, regras de streak, helpers puros
  persistence.js      load/sync com o Supabase
  petMood.js          o que o rato diz em cada aba
supabase/
  schema.sql          schema do banco
  functions/          Edge Function de lembretes push
public/               manifest, service worker, ícones
```
