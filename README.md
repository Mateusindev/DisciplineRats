# Discipline Rats

Painel de autodisciplina: registre foco, hábitos, sono, exercício e dieta, ganhe XP e suba de nível. Retrospecto de 30 dias na página de Análise.

Construído com **Next.js 15** (App Router) + **Supabase**. Roda offline em `localStorage` quando o Supabase não está configurado.

## Funcionalidades

- **Foco** — timer Pomodoro; sessão concluída dá XP.
- **Hábitos** — checklist diário com sequências.
- **Sono** — registra hora de dormir/acordar, calcula duração, XP ao bater a meta.
- **Exercício** — log de treinos, meta semanal, heatmap de volume e frequência (layout Iron Focus / bento grid).
- **Análise** — retrospecto de 30 dias de foco, sono e treino, com gráfico combinado sono + treino.
- **Gamificação** — XP, níveis, tiers e multiplicador de sequência. Regras em [`GAMIFICATION.md`](GAMIFICATION.md).
- **Toasts** — feedback ao salvar registros.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Estilo | Tailwind CSS v4 |
| Back-end | Supabase (Postgres + Auth), acesso direto do cliente via anon key |
| Persistência | blob `jsonb` em `profiles.state`; fallback `localStorage` |

Sem API routes no Next — o navegador fala direto com o Supabase, protegido por Row Level Security.

## Como rodar

Requer [Bun](https://bun.sh).

```bash
bun install
bun run dev
```

Abre em `http://localhost:3000`.

### Supabase (opcional)

Sem env configurado, o app roda 100% em `localStorage`. Para persistir na nuvem:

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor (cria `profiles`, RLS, trigger de perfil e a view `leaderboard`).
3. Copie `.env.local.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## Scripts

```bash
bun run dev     # dev server
bun run build   # build de produção
bun run start   # serve o build
bun run lint    # lint
```

## Estrutura

```
app/
  (app)/            rotas autenticadas (foco, habitos, sono, exercicio, dieta, analise)
    AppContext.js   estado global, persistência com debounce, toasts
    layout.js       navbar + sidebar + bottom nav
  login/            auth
components/ui.js    componentes compartilhados (MI, Caps, StarRating, ...)
lib/
  state.js          constantes + helpers puros de estado/gamificação
  persistence.js    load/save (Supabase ou localStorage)
  supabaseClient.js cliente Supabase (null se sem env)
supabase/schema.sql schema do banco
```
