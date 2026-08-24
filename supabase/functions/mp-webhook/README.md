# Acessórios pagos do mascote (Mercado Pago)

Duas funções, duas tabelas, e uma regra que não pode ser relaxada.

Cada acessório custa **R$ 0,99** (compra única). Cada categoria tem **um item grátis**
liberado pra todo mundo. XP não compra nada — ele só faz o gato crescer.

```
cliente clica R$ 0,99 → mp-checkout  (cria a cobrança, NÃO libera nada)
                        ↓ devolve init_point
navegador vai pro Mercado Pago → usuário paga (Pix / cartão / boleto)
                        ↓ MP chama nosso webhook
                   mp-webhook  (valida assinatura → consulta o pagamento →
                                confere o valor → grava pet_entitlements)
                        ↓
cliente volta em /perfil?compra=ok → pergunta os entitlements de novo
```

## A regra

**`pet_entitlements` é a única tabela do projeto que o cliente não escreve.** Isso
não é capricho. A policy de `profiles` permite ao dono atualizar a própria linha,
então tudo que mora lá pode ser reescrito pelo console do navegador. Enquanto XP
comprava acessório existia um `pet.owned` ali; com tudo pago, aquele campo virou
vetor de fraude e foi **removido** — uma linha de JS liberaria o item.

Por isso:

- `pet_entitlements` tem policy **só de SELECT**. Sem policy de insert/update/delete,
  ninguém escreve pela API pública, nem o dono.
- Quem escreve é o `mp-webhook`, com a service key, que passa por cima do RLS.
- No cliente não existe lista de comprados: `normalizePet` descarta `owned`/`spent`
  se aparecerem. Item grátis é de todos; item pago é `state.entitlements`, que vem do
  banco e nunca volta pra ele.

Se você mexer nisso, mexa sabendo: `petOwns()` em `lib/state.js` é a fronteira.

## Respondendo a pergunta "é fácil integrar?"

O caminho **Checkout Pro** é fácil: um POST cria a cobrança, você redireciona, e
recebe um webhook. O que dá trabalho não é a API — é o que está em volta:

1. **Validar a assinatura.** O endpoint é público. Sem HMAC, liberar item é um POST
   que qualquer um monta.
2. **Não confiar no corpo da notificação.** Ela só diz "o pagamento X mudou". Status,
   valor e dono vêm de uma consulta nossa.
3. **Conferir o valor.** Preferência pode ser alterada por fora; sem essa conferência,
   pagar R$ 0,01 leva o item.
4. **Idempotência.** O MP reenvia. `payment_id` como PK resolve.
5. **`pending` não é `approved`.** Pix e boleto ficam pendentes até liquidar. Conceder
   ali é entregar sem receber.

As cinco estão implementadas. A 5 é a que mais pega gente no Brasil, porque no cartão
aprovado tudo parece funcionar e só quebra no primeiro Pix.

## 1. Tabelas

Rode `supabase/schema.sql` no SQL editor. Ele cria `pet_entitlements` e
`pet_payments` com o RLS certo (e é idempotente, pode rodar de novo).

## 2. Conta e credenciais do Mercado Pago

1. Crie a aplicação em <https://www.mercadopago.com.br/developers/panel/app>.
2. Em **Credenciais de produção**, copie o **Access Token**. Comece pelas de
   **teste** se quiser experimentar antes — mas então use o token de teste E o
   secret de teste. Misturar ambiente é a falha silenciosa mais comum: a assinatura
   simplesmente nunca valida.
3. Em **Webhooks → Configurar notificação**:
   - URL: `https://<PROJECT_REF>.functions.supabase.co/mp-webhook`
   - Evento: **Pagamentos**
   - Revele e copie a **chave secreta** (é o `MP_WEBHOOK_SECRET`).

## 3. Segredos

```bash
supabase secrets set \
  MP_ACCESS_TOKEN="APP_USR-..." \
  MP_WEBHOOK_SECRET="..." \
  SITE_URL="https://seudominio.com"
```

`SITE_URL` é pra onde o usuário volta depois de pagar, e também o `Access-Control-Allow-Origin`
do checkout. Sem barra no fim. Em desenvolvimento, `http://localhost:3000`.

O cliente não precisa de variável nova: a URL da função sai de
`NEXT_PUBLIC_SUPABASE_URL`.

## 4. Deploy

```bash
supabase functions deploy mp-checkout
supabase functions deploy mp-webhook
```

`mp-webhook` vai com **Verify JWT desligado** (já está em `supabase/config.toml`). O
Mercado Pago não manda JWT — a chamada vem do servidor dele. Com a verificação
ligada, o gateway recusa **antes** de entrar no código, e aí a assinatura HMAC, que é
o que de fato autoriza, nunca é conferida.

`mp-checkout` mantém a verificação ligada e **ainda** confere o token no código: a
identidade sai do JWT, nunca do corpo do request.

## 5. Testar

Checkout, com a sessão de um usuário logado (pegue o token no devtools →
Application → Local Storage → `sb-...-auth-token`):

```bash
curl -i -X POST 'https://<PROJECT_REF>.functions.supabase.co/mp-checkout' \
  -H 'Authorization: Bearer <ACCESS_TOKEN_DO_USUARIO>' \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"crown"}'
```

Esperado: `200 {"url":"https://www.mercadopago.com.br/...","itemId":"crown","priceBRL":0.99}`.
Abrir essa URL leva pra tela de pagamento real.

Webhook sem assinatura (tem que recusar):

```bash
curl -i -X POST 'https://<PROJECT_REF>.functions.supabase.co/mp-webhook?data.id=123&type=payment'
# esperado: 401 assinatura_ausente
```

Fluxo inteiro: use **cartão de teste** com credencial de teste (a lista está no painel
do MP, em "Contas de teste"). Depois teste **um Pix**, não só cartão — é o caminho que
passa por `pending` antes de `approved`, e é onde integrações quebram.

Conferir o que chegou:

```sql
select payment_id, status, amount, item_id, created_at from pet_payments order by created_at desc limit 10;
select * from pet_entitlements order by granted_at desc limit 10;
```

Logs da função: `supabase functions logs mp-webhook`.

## 6. Catálogo mora em dois lugares (de propósito)

`PET_ITEMS` em `lib/state.js` pinta a tela. `ITEM_PRICE` + `PAID_ITEMS` em
`_shared/items.ts` **cobram**. A duplicação existe porque a função roda em Deno e não
importa o bundle do Next; o cliente é o lado que não manda. O script também garante
que nenhum item **grátis** entrou na lista vendável — cobrar por algo que a pessoa já
tem é o pior bug possível aqui.

O que impede os dois de divergirem:

```bash
bun run check:pet     # roda as duas suítes, inclusive a paridade de preço
```

Divergiu, o script quebra. Mudou preço ou item? Mude nos dois e rode.

## Limites que vale saber

- **Reembolso não é tratado.** Cancelar/estornar no painel do MP **não** revoga o
  entitlement — a linha continua lá. Se isso virar problema, o caminho é tratar
  `status` `refunded`/`charged_back` no webhook e apagar a linha.
- **Sem assinatura recorrente.** É compra única (`preferences`). Recorrência no MP é
  outra API (`preapproval`).
- **Sem nota fiscal.** Emissão é problema seu, fora daqui.
- **Direito de arrependimento (CDC, 7 dias)** se aplica a compra online no Brasil.
  Não sou advogado — só sinalizando que existe e que o fluxo de reembolso acima
  ainda não está implementado.
- **Cosmético, e a tela diz isso.** Acessório não dá XP, não sobe nível e não mexe no
  ranking. Vender vantagem de progresso num app de disciplina seria vender a ilusão
  de ter feito o trabalho.
- **Taxa de gateway em R$ 0,99.** No Pix a taxa é percentual e sobra quase tudo; no
  cartão a parte fixa pode comer a maior parte do valor. Confira sua tabela no painel
  do MP antes de contar com a receita de cartão.
