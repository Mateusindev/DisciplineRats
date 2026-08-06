// Conteúdo dos tutoriais por página (dado puro, sem JSX — ver components/help.js pro render).
//
// Regras de XP aqui descritas foram lidas das constantes reais em lib/state.js:
// XP (:325), HABIT_PRIORITIES, QUIT_MILESTONES, WEEKLY_BONUS, streakMult, gamify,
// computeSleepXp, computeExercisePenalty, computeHabitDailyPenalty. Se mexer nas regras,
// mexer aqui também — texto de ajuda errado é pior que ajuda nenhuma.
//
// Shape de uma entrada:
//   { title, icon, tagline,
//     sections: [{ label, body?: [str], list?: [str], table?: { head:[a,b], rows:[[a,b]] } }],
//     xp: { none?: bool, note?: str, rows?: [[acao, valor]] },
//     tips: [str] }
// Em qualquer string, **texto** virá em negrito.

// Explicador da gamificação, colado (recolhido) no fim de TODA ajuda — o sistema é global,
// não faz sentido repetir em 15 lugares.
export const HELP_GLOBAL = {
  label: "COMO XP, NÍVEL E SEQUÊNCIA FUNCIONAM",
  body: [
    "**XP** é o placar único do app. Quase toda ação registrada rende XP; algumas cobram XP quando você deixa um período fechar sem cumprir o combinado.",
    "**Nível** sai do XP acumulado. O nível 1 pede 500 XP, e cada nível seguinte pede 250 mais que o anterior — 500, 750, 1.000, 1.250, e assim por diante. Não existe perder nível: o XP total é o que conta.",
    "**Sequência** é o número de dias consecutivos em que você registrou **qualquer coisa** no app — foco, sono, humor, diário, treino, série de academia ou check de hábito. Não precisa ser a mesma coisa todo dia.",
    "A sequência é **recalculada do histórico** cada vez que o app abre, não guardada como contador. Isso a torna imune a ordem de registro e faz ela se autocorrigir. Ela também não zera no meio do dia: enquanto o dia de hoje não fechou, ontem ainda segura a corrente.",
    "**Multiplicador de sequência:** cada dia de sequência soma 5% em todo XP que você ganha, com teto de **+50%** (atingido em 10 dias). O multiplicador é aplicado **no momento do ganho** — o XP que já entrou não é recalculado depois.",
  ],
  table: {
    head: ["Nível", "Patente"],
    rows: [
      ["1–2", "INICIANTE"],
      ["3–5", "APRENDIZ DE FERRO"],
      ["6–9", "FORJADOR"],
      ["10–14", "VETERANO DE AÇO"],
      ["15+", "MESTRE DE TITÂNIO"],
    ],
  },
};

export const HELP = {
  // ============================================================ HOJE
  "/home": {
    title: "Home",
    icon: "home",
    tagline: "O painel do dia. Serve pra responder uma pergunta só: o que falta fazer hoje?",
    sections: [
      {
        label: "O QUE VOCÊ VÊ NO TOPO",
        list: [
          "**Sequência** — dias consecutivos com algum registro. A chama fica acesa enquanto a corrente não quebra.",
          "**Nível** e a patente correspondente.",
          "**XP total** acumulado, e abaixo a barra do quanto falta pro próximo nível.",
        ],
      },
      {
        label: "FOCO DO TRIMESTRE",
        body: [
          "Se você fixou um item no **Mapa**, ele aparece aqui em destaque, no topo de tudo, com o progresso do dia. É o elo entre o plano de longo prazo e o que você faz hoje.",
          "Nada aparece se nenhum item estiver fixado. Pra fixar, abra um item no Mapa e use **FIXAR COMO FOCO DO TRIMESTRE**.",
        ],
      },
      {
        label: "MISSÕES PENDENTES",
        body: [
          "Lista os cards não concluídos do quadro de Missões, ordenados por urgência: **atrasadas primeiro**, depois as com prazo mais próximo, depois por prioridade. Mostra até 5.",
        ],
      },
      {
        label: "HÁBITOS DO DIA",
        body: [
          "Dá pra marcar hábito direto daqui, sem abrir a página de Hábitos — o XP é exatamente o mesmo. Hábitos de corte de vício não aparecem aqui, porque o fluxo deles é diferente (você registra a recaída, não o acerto).",
        ],
      },
      {
        label: "TREINO DE HOJE",
        body: [
          "Se alguma divisão do seu plano de treino está agendada pro dia da semana de hoje, ela aparece com os exercícios. O agendamento é feito na página de Exercício.",
        ],
      },
    ],
    xp: {
      none: true,
      note: "A Home não tem XP próprio — ela é um atalho. Marcar hábito daqui rende exatamente o mesmo que marcar na página de Hábitos, multiplicador incluído.",
    },
    tips: [
      "Se a Home está vazia, é sinal de que falta configurar: crie um hábito, um card de missão e agende um treino.",
      "Abra o app pelo menos uma vez por dia mesmo sem registrar nada: é na abertura que o app calcula bônus de período fechado e penalidades pendentes.",
    ],
  },

  "/rotina": {
    title: "Rotina",
    icon: "checklist",
    tagline: "O esqueleto do dia: o que se repete sempre, com hora. É a lista que não devia precisar de força de vontade — remédio, alongar, arrumar a cama.",
    sections: [
      {
        label: "ROTINA NÃO É HÁBITO",
        body: [
          "**Hábito** é o que você está construindo: tem prioridade, sequência e **multa** por dia perdido. **Rotina** é o que já deveria ser automático.",
          "Por isso aqui não existe penalidade nem sequência própria. Errar um dia é um dia, não uma recaída — e um app que cobra multa pelo esqueleto do dia só ensina a marcar o que não foi feito.",
        ],
      },
      {
        label: "ITEM COM HORA E DIA",
        body: [
          "Cada item tem nome, **hora opcional** e os **dias da semana** em que vale (nenhum marcado = todo dia). A hora agrupa o item em manhã, tarde ou noite; sem hora ele cai em *sem hora*.",
          "Dá pra fechar **até 7 dias atrás** pelas setas do topo — o dia de ontem que você esqueceu de marcar não vira mentira nem some.",
        ],
      },
      {
        label: "NA AGENDA",
        body: [
          "Item com hora aparece na **Agenda**, no horário certo, e pode ser **marcado de lá** — é o mesmo dado e a mesma regra de XP, não uma cópia.",
          "Na visão de mês a rotina não vira lista: cada dia mostra uma pílula **feitos/total**, que acende quando o dia fecha. Seis itens iguais repetidos em cada quadradinho seriam ruído; o que interessa ali é se fechou.",
          "Rotina fica **fora da contagem de eventos** do mês de propósito: ela é ritmo, não compromisso, e inflaria o número que responde *o que tenho marcado?*.",
        ],
      },
      {
        label: "O QUE VOCÊ VÊ",
        body: [
          "A barra do topo mostra quantos itens do dia já foram, e acende quando fecha. Embaixo, os **últimos 7 dias** em colunas: barra cheia é dia fechado, traço é dia sem item agendado — que não é falha.",
          "Excluir um item **não** apaga as marcações passadas nem estorna XP já ganho: o histórico é o que aconteceu.",
        ],
      },
    ],
    xp: {
      rows: [
        ["Item marcado", "5 XP"],
        ["Fechar todos os itens do dia", "+15 XP de bônus"],
        ["Dia perdido", "sem penalidade"],
      ],
      note: "O XP de cada check fica gravado com o valor exato do momento (multiplicador incluído), então desmarcar devolve o que deu — e desmarcar um item de um dia fechado devolve o bônus junto.",
    },
    tips: [
      "Comece com três itens. Rotina de quinze itens é lista de tarefas disfarçada, e você vai abandonar.",
      "Coloque hora no que tem hora de verdade. O resto fica em *sem hora* e não vira cobrança de horário.",
    ],
  },

  "/habitos": {
    title: "Hábitos",
    icon: "check_circle",
    tagline: "O motor de repetição do app. Três tipos de hábito, com regras bem diferentes — vale ler antes de criar o primeiro.",
    sections: [
      {
        label: "OS TRÊS TIPOS",
        list: [
          "**Diário (construir)** — pra fazer todo dia. Marca e pronto. É o único tipo que **cobra XP** quando um dia fecha sem check.",
          "**Semanal** — pra metas do tipo *pelo menos 3× por semana* ou *no máximo 2× por semana*. Você escolhe a direção e o alvo.",
          "**Corte de vício** — pra parar com algo. Aqui a lógica **inverte**: você não marca o acerto, você registra a **recaída**. O app conta seus dias limpos a partir da última recaída.",
        ],
      },
      {
        label: "O PORQUÊ DO HÁBITO",
        body: [
          "Todo hábito aceita um **porquê**: uma linha dizendo o que você ganha cumprindo ele. Ele é perguntado na criação, quando a motivação ainda está fresca, e dá pra escrever ou mudar depois pelo lápis do card.",
          "O porquê aparece **no topo do card, antes do botão de marcar** — é ele que você lê no dia em que não está com vontade. Em hábito de corte de vício ele também aparece na confirmação da recaída, que é o momento exato em que ele tem função.",
          "Limite de 140 caracteres, de propósito: motivo que não cabe numa linha não é lido na hora da decisão. Instrução longa (como executar, onde, com o quê) vai no campo de **detalhes**.",
          "Hábito sem porquê mostra um convite pra escrever um. Não bloqueia nada e não vale XP — é lembrete, não cobrança.",
        ],
      },
      {
        label: "DIÁRIO EM DIAS ESPECÍFICOS",
        body: [
          "Hábito diário aceita **dias da semana**. Deixar vazio significa todo dia; marcar seg/qua/sex faz o hábito existir só nesses três.",
          "Dia fora da agenda é **invisível** pro hábito: não cobra penalidade e não quebra a sequência. É o que resolve o caso da academia — treino de seg/qua/sex não deve pagar multa por domingo.",
          "Quando o hábito tem agenda, a sequência conta **compromissos cumpridos**, não dias de calendário. Seg/qua/sex cumprido por três semanas mostra 9, não 1.",
          "Em dia de descanso o card mostra *DESCANSO HOJE* e o botão vira **MARCAR EXTRA** — treinar fora da agenda é bônus, rende XP normal e nunca é obrigação.",
        ],
      },
      {
        label: "PRIORIDADE MUDA O VALOR",
        body: [
          "Todo hábito tem prioridade, e ela define quanto vale: **BAIXA 10 XP**, **NORMAL 15 XP**, **ALTA 25 XP** por check. A prioridade também multiplica os bônus de marco e de semana fechada (0,75× / 1× / 1,5×).",
        ],
      },
      {
        label: "SEMANAL: COMO O BÔNUS FECHA",
        body: [
          "Durante a semana o contador mostra quanto você já fez. O bônus só é pago quando a **semana fecha** (a semana começa na segunda) e o app confere se você ficou dentro da meta.",
          "Hábito do tipo *no máximo* é um caso especial: marcar **não dá XP nenhum na hora** — marcar ali é registrar que aconteceu, e o prêmio vem no fim da semana se você tiver ficado abaixo do limite.",
          "O bônus é pago uma vez por semana e não repete, mesmo reabrindo o app. Semana fora da meta simplesmente não paga.",
        ],
      },
      {
        label: "CORTE DE VÍCIO: MARCOS",
        body: ["Quanto mais tempo limpo, maiores os prêmios. Cada marco paga uma vez por período limpo — recaída reinicia a contagem."],
        table: {
          head: ["Dias limpo", "XP base"],
          rows: [
            ["3 dias", "15 XP"],
            ["7 dias", "35 XP"],
            ["14 dias", "70 XP"],
            ["30 dias", "150 XP"],
            ["60 dias", "300 XP"],
            ["90 dias", "500 XP"],
          ],
        },
      },
      {
        label: "DESMARCAR ESTORNA",
        body: [
          "Marcou sem querer? Desmarcar devolve **exatamente** o XP que aquele check deu, com multiplicador e tudo. Não dá pra ganhar XP marcando e desmarcando.",
        ],
      },
    ],
    xp: {
      rows: [
        ["Check de hábito diário", "10 / 15 / 25 XP conforme prioridade"],
        ["Semana fechada dentro da meta", "25 XP (mínimo) ou 30 XP (máximo), × prioridade"],
        ["Marco de dias limpo", "15 a 500 XP, × prioridade"],
        ["Penalidade: dia fechado sem check", "metade do valor do hábito"],
      ],
      note: "A penalidade só vale pro tipo **diário**, só nos dias da agenda, é avaliada quando você abre o app, e tem teto de 7 dias — sumir por um mês não gera cobrança retroativa de um mês. Hábito semanal e corte de vício não têm penalidade diária.",
    },
    tips: [
      "Hábito que não é pra todo dia: marque os dias da semana. Sem isso o app cobra multa nos seus dias de descanso.",
      "Não crie 10 hábitos de prioridade ALTA. A penalidade diária escala junto, e a conta vira dívida.",
      "Se você quer reduzir algo sem cortar de vez, use **semanal / no máximo** em vez de corte de vício.",
      "A data de criação do hábito importa: nada é cobrado antes dela, e o bônus semanal só começa na primeira semana cheia.",
    ],
  },

  // ============================================================ CORPO
  "/sono": {
    title: "Sono",
    icon: "bedtime",
    tagline: "O sono e o humor que ele produziu, lado a lado. A regra de XP daqui é a mais elaborada do app: dormir bem depende de **quanto** você dormiu e de **a que hora** foi deitar.",
    sections: [
      {
        label: "O QUE VOCÊ REGISTRA",
        list: [
          "**Hora de deitar** e **hora de acordar** — a duração é calculada daí.",
          "**Qualidade** de 1 a 5 estrelas, subjetiva.",
          "**Nota** livre, opcional.",
          "**Justificativa**, obrigatória se você deitou depois do limite. O app não deixa salvar sem — a ideia é te fazer nomear o motivo.",
        ],
      },
      {
        label: "AS DUAS METAS",
        body: [
          "**Meta de duração** — quanto você quer dormir (ajustável de 6h a 9h, padrão 7h30). Bater a meta é o que libera o prêmio.",
          "**Limite de horário** — a hora até a qual deitar conta como *no horário* (padrão 23:30). Passar disso derruba o prêmio progressivamente.",
        ],
      },
      {
        label: "COMO O PRÊMIO É CALCULADO",
        body: [
          "Se você **bateu a meta de duração**: recebe o prêmio base, multiplicado por um fator de horário. Deitou dentro do limite → fator cheio. Cada minuto de atraso reduz o fator linearmente, e ele **zera em 90 minutos de atraso**. Passando disso o fator fica negativo — ou seja, dormir o suficiente mas deitar muito tarde pode **custar** XP.",
          "Se você **não bateu a meta**: leva penalidade. E a penalidade é multiplicada por até **2×** conforme o atraso pra deitar. Dormir pouco *e* tarde é o pior caso possível.",
          "O prêmio base escala com a sua meta: metas maiores valem mais XP por noite, proporcionalmente.",
        ],
      },
      {
        label: "GRÁFICO DE 7 DIAS",
        body: [
          "A linha mostra a duração das últimas 7 noites contra a sua meta. Noites em que você deitou tarde aparecem marcadas, e passar o mouse mostra a justificativa que você escreveu. É aí que o padrão aparece: as justificativas repetidas são o problema real.",
          "Logo abaixo, a faixa de **humor nos mesmos dias**, com uma carinha por dia — leitura, não registro (o humor se marca na página de **Humor**). Ela existe pra você ler as duas linhas juntas: noite curta na terça e humor no chão na quarta é a informação que nenhuma das duas telas daria sozinha.",
        ],
      },
    ],
    xp: {
      rows: [
        ["Bateu a meta, deitou no horário", "50 XP escalado pela sua meta"],
        ["Bateu a meta, deitou tarde", "prêmio reduzido, zerando em 90 min de atraso"],
        ["Bateu a meta, mais de 90 min tarde", "vira XP negativo"],
        ["Não bateu a meta", "−25 XP escalado pela meta, até 2× conforme o atraso"],
      ],
      note: "O multiplicador de sequência só se aplica ao prêmio **positivo**. Penalidade é valor fixo — sequência longa não amortece noite ruim.",
    },
    tips: [
      "Ajuste o limite de horário pra sua realidade antes de sair registrando. Limite irreal só gera penalidade e justificativa inventada.",
      "Registre de manhã, ao acordar, enquanto você lembra da hora que apagou de verdade.",
      "Seja honesto no humor mesmo em dia ruim. Registro maquiado inutiliza a faixa de 7 dias e o diagnóstico da página de Humor.",
    ],
  },

  "/exercicio": {
    title: "Exercício",
    icon: "fitness_center",
    tagline: "Duas coisas em uma página: o **plano** (o que você pretende treinar) e o **registro** (o que você treinou de fato). Mais o acompanhamento de carga da academia.",
    sections: [
      {
        label: "PLANO: MODALIDADE → DIVISÃO → EXERCÍCIO",
        body: [
          "O plano tem três níveis. **Modalidade** é a atividade (Academia, Corrida, Jiu-jitsu...). Dentro dela, **divisões** são os treinos (Treino A, Treino B, Pernas...). Dentro de cada divisão, os **exercícios**.",
          "**Academia é fixa** — o app garante que ela exista, mesmo que você apague. As outras modalidades você cria e apaga livremente.",
          "Modalidade simples, sem divisões, pode ser agendada direto nos dias da semana.",
        ],
      },
      {
        label: "MARCA DE EXERCÍCIO JÁ FEITO",
        body: [
          "Na busca de exercício, quem você **já executou** aparece com um sinal de conferido e a data da última vez. Passando o mouse, o detalhe: em quantos dias, quantas séries e seu recorde de carga.",
          "A marca vem das **séries registradas**, não do plano: exercício que você colocou na ficha mas nunca fez continua sem marca — planejar não é ter feito. Ela aparece só na busca, onde serve pra decidir; depois de escolhido, o exercício na ficha fica limpo.",
          "O topo da lista mostra quantos da busca já são conhecidos e tem um filtro **só os que já fiz**, pra montar ficha em cima do que você já sabe executar.",
        ],
      },
      {
        label: "CICLO DA FICHA: QUANTO TEMPO FICO COM ELA",
        body: [
          "A ficha da Academia tem **data de início e duração** (4, 6, 8, 12, 16 semanas ou *sem prazo*). Escolher uma duração começa o ciclo hoje. O painel mostra em que semana você está, quando termina e quantos dias faltam.",
          "*Sem prazo* é opção legítima, não ausência de configuração: ele mostra há quantos dias você está na mesma ficha, sem cobrar vencimento.",
          "Vencido o prazo, o app **avisa mas não mexe em nada** — arquivar é decisão sua. Estender a duração também vale.",
          "O contador de treinos, séries e minutos do ciclo conta o que você **registrou** naquela janela, não o que estava planejado.",
        ],
      },
      {
        label: "HISTÓRICO DE FICHAS",
        body: [
          "**Arquivar e renovar** guarda a ficha no histórico e recomeça o ciclo hoje, mantendo os exercícios. **Arquivar e montar nova** guarda e esvazia as divisões pra você montar do zero. Nenhuma das duas apaga série ou treino registrado.",
          "Ficha arquivada é **fotografia**: cópia congelada das divisões e exercícios como estavam. Mexer no plano de hoje não reescreve o passado.",
          "No histórico dá pra abrir cada ficha e ver as divisões, **restaurar** (as divisões atuais são substituídas e o ciclo recomeça — arquive a atual antes se não quiser perdê-la) ou **excluir** o registro.",
        ],
      },
      {
        label: "AGENDAR NOS DIAS DA SEMANA",
        body: [
          "Cada divisão pode ser marcada nos dias em que ela acontece. O que estiver agendado aparece na **Agenda** no dia e hora certos. Sem agendar, nada aparece lá.",
          "Marcando os dias, aparece também um campo de **hora**. Ele serve pra **Agenda**: o treino entra lá sozinho, no horário certo, sem você cadastrar o mesmo compromisso duas vezes. Sem hora, entra como dia inteiro.",
          "Com dois ou mais dias marcados aparece **horário diferente por dia**. Serve pro caso comum de fazer o mesmo treino em horas distintas — *Treino B quinta às 20:00 e domingo às 09:00*. Dia deixado em branco usa o horário padrão.",
        ],
      },
      {
        label: "REGISTRAR TREINO",
        body: [
          "Registrar é o que rende XP: tipo, divisão, duração, intensidade e uma nota. Dá pra registrar em data retroativa.",
          "O XP ganho fica **gravado no próprio registro**. Isso importa: apagar um treino devolve exatamente o XP que ele deu, nem mais nem menos, mesmo que seu multiplicador de sequência tenha mudado desde então.",
        ],
      },
      {
        label: "DIA DE FOLGA JUSTIFICADA",
        body: [
          "Doença, lesão, descanso planejado ou imprevisto: no formulário de registro dá pra **marcar o dia** em vez de deixar em branco. Vale pra data selecionada, então também funciona retroativo (até 7 dias).",
          "O dia marcado **abate 1 treino da meta da semana** — meta de 4 com uma folga cobra 3 — e **conta como dia ativo**, então a sequência geral não quebra. Contar ao app o que aconteceu é registro, mesmo sem treino.",
          "O que ele **não** faz: não dá XP e não conta como treino feito. Faltar por doença não é vitória, é neutro — o que se remove é a punição, não o esforço que não houve. No card da meta semanal as folgas aparecem com ícone próprio, separadas dos halteres.",
          "Ainda **não** vale pra hábitos: hábito diário agendado continua cobrando penalidade no dia doente. Se isso incomodar, é a próxima peça a mudar.",
        ],
      },
      {
        label: "SÉRIES DE ACADEMIA E PROGRESSÃO",
        body: [
          "Na Academia você registra série por série: exercício, carga, repetições, ou marca como *só falha*. Não rende XP — é instrumento de medida, não de pontuação.",
          "Com isso o app monta a curva de progressão por exercício (**maior carga do dia** e **volume total**, que é a soma de peso × reps) e guarda seu **recorde pessoal** de cada movimento.",
        ],
      },
    ],
    xp: {
      rows: [
        ["Treino registrado", "40 XP"],
        ["Séries de academia", "sem XP"],
        ["Penalidade: treino faltante na meta semanal", "−20 XP por treino faltante (dia de folga justificada abate a meta)"],
      ],
      note: "A penalidade é avaliada só em **semanas fechadas** e tem teto de 4 semanas. A meta semanal de treinos fica nas configurações. Na primeira vez o app apenas marca o ponto de partida — não cobra retroativo.",
    },
    tips: [
      "Ajuste a meta semanal pro número que você realmente sustenta. Meta de 6 com rotina de 3 é −60 XP por semana, toda semana.",
      "Registrar carga só faz sentido se for consistente. Duas semanas de dados não mostram progressão nenhuma.",
    ],
  },

  "/dieta": {
    title: "Dieta",
    icon: "restaurant",
    tagline: "Um plano alimentar fixo com as macros somadas. É planejamento, não diário alimentar — você monta o padrão e confere se ele fecha as suas metas.",
    sections: [
      {
        label: "COMO O PLANO FUNCIONA",
        body: [
          "Você cria **blocos de refeição** (Café da manhã, Almoço, Jantar já vêm prontos, e dá pra criar outros) e coloca itens dentro de cada um.",
          "Cada item é uma **porção base** mais uma **quantidade**. Você informa a tabela nutricional de *uma* unidade — 1 ovo, 100 g de arroz, 1 fatia — e o app multiplica pela quantidade na hora de somar.",
          "Por isso corrigir a quantidade é mexer num número: 1 ovo de 78 kcal virando 2 passa a contar 156 kcal, 13 g de proteína e 100 g, sem redigitar nada. A quantidade tem −/+ na própria linha do item e aceita fração (0,5 ou 1,5).",
          "Item medido em **g** ou **ml** funciona diferente, porque ninguém pensa *1,5 porção de arroz* — pensa *150 g*. Nesse caso a tabela é lida **por N gramas** (100 por padrão, como vem no rótulo) e o controle da linha ajusta o **total em gramas**, com passo alternável de **10 / 50 / 100 g**.",
          "Nas outras unidades (un, fatia, colher, xícara, porção) o controle é a quantidade de porções, com passo de 0,5 abaixo de 1. O campo **g/porção** aí é opcional e só serve pra mostrar o peso total: 2 × 50 g aparece como 100 g.",
          "Quando o ajuste não é 1 porção, a linha mostra também os valores da base — de onde saiu o total. Zerar o total mostra zero, não volta pra uma porção.",
          "Item criado antes dessa mudança continua valendo: sem quantidade gravada o app assume 1, então o total é exatamente o que era."
        ],
      },
      {
        label: "É PLANO, NÃO REGISTRO DIÁRIO",
        body: [
          "Isso é importante pra não se frustrar: o plano é **um só**, ele não é por dia. Você não marca *comi isso hoje*. A pergunta que esta página responde é *o padrão que eu montei fecha as minhas metas?*, não *o que eu comi na terça?*.",
        ],
      },
      {
        label: "METAS DE MACRO",
        body: [
          "As metas de calorias, proteína, carboidrato e gordura ficam nas configurações. Os totais do plano aparecem contra elas, então dá pra ajustar as gramagens até fechar.",
          "A aba **CÁLCULO** estima essas metas a partir do seu corpo e do seu treino, e grava nelas com um botão.",
        ],
      },
      {
        label: "ABA CÁLCULO: DE ONDE SAEM OS NÚMEROS",
        body: [
          "Você informa sexo, nascimento, altura e registra o peso. Com isso o app estima o **basal** — quanto o corpo gasta em repouso — por **Mifflin-St Jeor**. Se você informar % de gordura, ele troca pra **Katch-McArdle**, que usa massa magra e erra menos.",
          "O gasto do dia é basal × fator de vida cotidiana **mais o gasto real dos treinos que você registrou**, calculado por tipo de exercício e intensidade. Não é um multiplicador fixo pra semana toda: dia de treino gasta mais que dia de descanso, e o painel mostra isso dia por dia.",
          "Detalhe que quase todo app erra: ao somar o treino, o app **desconta o basal daquele período**, senão a mesma hora seria contada duas vezes.",
        ],
      },
      {
        label: "O QUE ELE SE RECUSA A FAZER",
        body: [
          "Dia da semana **sem histórico de treino** não recebe estimativa: aparece *sem dados* ou *só basal*. Chutar quanto um treino que você nunca registrou gastaria daria um número bonito e falso.",
          "O alvo calórico **nunca desce abaixo do seu basal**. Se o ritmo escolhido levaria a isso, o valor é travado e o app diz por quê. Acima de 25% de déficit ele avisa que costuma custar massa magra.",
          "**Micronutriente não é calculado.** Ferro, cálcio e afins são valores fixos por idade e sexo — não saem de peso e altura — e nenhum alimento do plano tem esse dado pra comparar. A tabela ali é referência de consulta, e o painel afirma isso.",
        ],
      },
      {
        label: "PESAGENS",
        body: [
          "Cada pesagem tem data, e o gráfico mostra a evolução. **Olhe a tendência, não o dia** — peso isolado oscila vários quilos com água, sal e intestino. Os pontos discretos são as pesagens; a linha grossa, na cor de destaque do tema, é a **média de 7 dias** — é ela o sinal.",
          "O eixo de tempo é real: mais de 21 dias sem pesar aparece como tracejado, porque ali não existe dado pra sustentar curva. O **ritmo medido** (kg por semana) sai de regressão sobre a média e só aparece com 3 pesagens em 7 dias ou mais — abaixo disso seria uma reta desenhada em cima de ruído.",
          "**Peso alvo** é opcional e não entra em cálculo de caloria: só desenha a linha de alvo e, quando o ritmo medido caminha pra lá, estima a data. Alvo muito distante da faixa recente fica marcado na borda em vez de esticar a escala e achatar a curva.",
          "É isso que fecha o ciclo: a estimativa é um palpite educado, e a curva de peso ao longo de 2 a 3 semanas é o que diz se ela estava certa. Se o peso não se move como previsto, o número errado era a estimativa — ajuste ela, não a sua fé nela.",
        ],
      },
    ],
    xp: { none: true, note: "Nada nesta página dá ou tira XP. Montar plano é trabalho de uma vez; premiar isso todo dia seria premiar abrir a tela." },
    tips: [
      "Comece pela aba CÁLCULO: sem meta calculada, você monta o plano contra um número inventado.",
      "Pese sempre na mesma condição — de manhã, em jejum, depois do banheiro. Comparar manhã com noite não mede nada.",
      "Monte o plano uma vez com calma e depois só ajuste. Não tente registrar refeição por refeição aqui — o app não foi feito pra isso.",
      "Nada disso substitui nutricionista. Fórmula de basal erra pra mais e pra menos entre pessoas do mesmo peso e altura; o valor dela é servir de ponto de partida.",
    ],
  },

  // ============================================================ MENTE
  "/humor": {
    title: "Humor",
    icon: "psychology",
    tagline: "Três registros por dia, de 5 segundos cada. A utilidade real não é o registro em si — é o cruzamento com sono, treino e foco na página de Análise.",
    sections: [
      {
        label: "TRÊS PERÍODOS",
        body: [
          "Manhã, tarde e noite, separados. O app já abre no período correspondente à hora atual (manhã até meio-dia, tarde até 18h, noite depois).",
          "Registrar os três dá muito mais informação que um só: é assim que aparece o padrão de *acordo bem e desabo à tarde*.",
        ],
      },
      {
        label: "A ESCALA",
        list: [
          "😞 Muito baixo",
          "🙁 Baixo",
          "😐 Neutro",
          "🙂 Bom",
          "😄 Ótimo",
        ],
      },
      {
        label: "ETIQUETAS DE CONTEXTO",
        body: [
          "Cada registro aceita etiquetas do que estava acontecendo: treino, jiu-jitsu, trabalho, estudo, social, descanso, sono ruim, ansiedade.",
          "As etiquetas são o que dá poder ao registro. O app calcula seu **humor médio por etiqueta** ao longo de todo o histórico — é isso que revela, com número, que dia de trabalho puxa você pra baixo ou que treino levanta.",
        ],
      },
      {
        label: "NOTA",
        body: ["Um campo livre por registro, opcional. Serve pro detalhe que a nota numérica não carrega."],
      },
      {
        label: "DIAGNÓSTICO: O QUE LEVANTA E O QUE DERRUBA",
        body: [
          "O painel compara sempre **com vs sem**, nunca média solta. *Humor 4,2 nos dias de treino* não significa nada sozinho — significa quando ao lado aparece *3,1 nos dias sem treino*. O número mostrado é a **diferença** na escala de 1 a 5, e cada linha carrega o n dos dois lados.",
          "Entram no cálculo as etiquetas (medidas por registro de período, marcadas com *·per*) e os fatores do dia: dormiu 7h+, dormiu menos de 6h, achou o sono bom, deitou depois do limite, treinou, fez sessão de foco, cumpriu todos os hábitos do dia e recaiu em algum vício.",
          "Dia **sem registro** de um fator fica de fora daquela comparação — ausência de dado não é evidência do lado ruim. Fator com menos de 3 observações de cada lado não recebe número: vai pra lista de *falta dado*, porque três dias não são tendência.",
          "Existe também a lista de **medido e sem efeito visível**. Descobrir que algo que você jurava que mexia no seu humor não mexe é resultado, não falha.",
          "Os perfis por período do dia e por dia da semana têm uma linha vertical clara: é a sua média geral da janela. O que passa dela está acima do seu normal.",
          "Tudo ali é **associação, não causa** — treino aparecer junto de humor melhor pode ser você treinar justamente quando já está bem. O uso correto é virar hipótese: mude uma coisa por duas semanas e volte pra ver.",
        ],
      },
      {
        label: "ONDE REGISTRAR",
        body: [
          "O registro de hoje mora aqui, junto do diagnóstico que ele alimenta. A página de **Sono** mostra só a faixa de carinhas dos mesmos 7 dias do gráfico de sono — leitura, pra você ver as duas linhas juntas.",
        ],
      },
    ],
    xp: { none: true, note: "Registrar humor não dá XP — a intenção é que você seja honesto, e pagar por nota alta corromperia o dado. Mas o dia **conta pra sua sequência**." },
    tips: [
      "Seja honesto mesmo em dia ruim. Registro maquiado inutiliza a análise, que é o único motivo de existir desta página.",
      "Use sempre as etiquetas. Sem elas o número não explica nada.",
    ],
  },

  "/diario": {
    title: "Diário",
    icon: "book",
    tagline: "Escrita guiada por perguntas fixas, uma entrada por dia. As perguntas são de propósito — folha em branco trava, pergunta específica não.",
    sections: [
      {
        label: "AS PERGUNTAS",
        list: [
          "**Gratidão** — o que foi bom hoje.",
          "**Situação positiva** e **qual foi a sua parte nela** — o segundo campo é o que importa: separa sorte de ação sua.",
          "**Situação negativa** e **qual foi a sua parte nela** — mesma ideia, virada. É a pergunta desconfortável e a mais útil.",
          "**Despejo** — texto livre pra tirar da cabeça o que estiver girando.",
          "**Intenção pra amanhã** — uma frase de direção.",
        ],
      },
      {
        label: "UMA ENTRADA POR DIA",
        body: [
          "Salvar de novo no mesmo dia **atualiza** a entrada, não cria outra. Você pode voltar e completar depois sem perder nada.",
        ],
      },
      {
        label: "RETROATIVO NÃO PAGA",
        body: [
          "Dá pra preencher um dia passado, e o texto fica guardado normalmente — mas **XP só é pago pela entrada de hoje**. A ideia é não incentivar preencher a semana toda de uma vez no domingo.",
        ],
      },
      {
        label: "SEQUÊNCIA DE ESCRITA",
        body: [
          "A página mostra quantos dias seguidos você escreveu. É uma contagem separada da sequência geral do app: aqui conta só o diário.",
        ],
      },
    ],
    xp: {
      rows: [["Escrever no diário (1× por dia)", "15 XP"]],
      note: "**Não existe penalidade por não escrever.** Isso é decisão de projeto, comentada no código: reflexão não se pune. Um dia sem diário não te cobra nada.",
    },
    tips: [
      "Preencher um campo já vale o XP do dia — em dia ruim, escreva só o despejo.",
      "O campo *qual foi a sua parte* na situação negativa é o de maior retorno. É o único que muda comportamento.",
    ],
  },

  "/leitura": {
    title: "Leitura",
    icon: "menu_book",
    tagline: "Uma estante com três prateleiras, progresso por página e o ritmo diário pra fechar cada livro no prazo que você definir.",
    sections: [
      {
        label: "TRÊS SITUAÇÕES",
        list: [
          "**Quero ler** — a fila.",
          "**Lendo** — em andamento, com progresso de página, e o único grupo que mostra ritmo diário.",
          "**Concluído** — com nota de estrelas e resenha.",
        ],
      },
      {
        label: "BUSCA DE LIVRO",
        body: [
          "Dá pra buscar o livro por título e o app puxa autor, capa e número de páginas automaticamente. Também dá pra cadastrar na mão se a busca não achar.",
        ],
      },
      {
        label: "PROGRESSO",
        body: [
          "Você atualiza a página atual e o app calcula a porcentagem contra o total. Marcar como concluído **completa o progresso automaticamente** e grava a data de fim.",
          "A data de início é gravada quando você move o livro pra *Lendo*.",
        ],
      },
      {
        label: "QUANTAS PÁGINAS POR DIA",
        body: [
          "Defina a **meta de término** e o app diz o ritmo necessário: páginas restantes divididas pelos dias que faltam, contando hoje. O número arredonda pra cima — fração de página não fecha prazo.",
          "O ritmo aparece também na capa do livro na prateleira, então dá pra ver sem abrir nada.",
          "Se você não quer escolher data, há atalhos de 2 semanas, 1 mês e 2 meses — cada um já mostrando o ritmo que implica, pra você decidir pelo esforço em vez de pela data.",
        ],
      },
      {
        label: "ADIANTADO OU ATRASADO",
        body: [
          "Além do ritmo, o app compara sua página atual com onde você **deveria estar hoje** na reta entre início e meta. Diferença de 5 páginas ou mais aparece como adiantado ou atrás do ritmo.",
          "Passou da meta sem terminar? Ele mostra o que falta e oferece empurrar a data. Empurrar o prazo e aceitar que o livro leva mais tempo são as duas respostas honestas — o app não finge que a meta original ainda vale.",
        ],
      },
      {
        label: "NOTA E RESENHA",
        body: [
          "Livro concluído aceita nota de 1 a 5 estrelas e um texto de resenha. Escreva enquanto está fresco — em três meses você não lembra por que deu 4.",
        ],
      },
      {
        label: "LIGAÇÃO COM O MAPA",
        body: [
          "Livro em andamento pode ser **espelhado** no Mapa: o card de lá mostra sua porcentagem de leitura ao vivo, e serve pra amarrar a leitura a uma meta maior.",
        ],
      },
    ],
    xp: { none: true, note: "Leitura não dá XP hoje. Progresso de página é fácil de inflar digitando um número, e o app não tem como verificar." },
    tips: [
      "Deixe poucos livros em *Lendo*. Cinco livros simultâneos em andamento normalmente significa nenhum sendo lido.",
      "Registre a página real ao parar de ler, não estimada depois.",
    ],
  },

  // ============================================================ PLANOS
  "/mapa": {
    title: "Mapa",
    icon: "account_tree",
    tagline: "Onde as intenções de médio e longo prazo ficam visíveis. As duas dimensões da tela carregam significado — não é quadro de recados.",
    sections: [
      {
        label: "OS DOIS EIXOS",
        body: [
          "**Colunas = horizonte de tempo.** De *Agora* até *3+ / algum dia*. Arrastar um item pra esquerda é se comprometer com ele mais cedo. A posição não é decoração.",
          "**Faixas = área da vida.** Corpo, Mente, Carreira, Dinheiro, Relações — editáveis no botão ÁREAS. A ordem dos cards dentro de uma célula é a prioridade.",
        ],
      },
      {
        label: "TRÊS TIPOS DE ITEM",
        list: [
          "**Meta** — o que você quer. Título, o porquê, situação e uma medida opcional. Texto seu; ninguém mede pra você.",
          "**Espelho** — atalho vivo pra algo que **já existe** no app. A barra dele é lida da fonte original na hora: marca o hábito em Hábitos e ela mexe aqui sozinha; renomeia lá, renomeia aqui. Não é cópia.",
          "**Nota** — ideia solta, pergunta, lembrete.",
        ],
      },
      {
        label: "DE ONDE O ESPELHO TIRA A BARRA",
        body: ["Cada tipo de fonte tem sua própria régua de progresso:"],
        table: {
          head: ["Fonte espelhada", "Barra mostra"],
          rows: [
            ["Hábito diário", "sequência atual / 21 dias"],
            ["Hábito semanal", "dias na semana / meta da semana"],
            ["Corte de vício", "dias limpo / próximo marco"],
            ["Missão", "0% ou 100%, com coluna e prazo"],
                        ["Livro", "página atual / total"],
          ],
        },
      },
      {
        label: "SE O ORIGINAL FOR APAGADO",
        body: [
          "O card fica vermelho com *Referência perdida* e oferece **reapontar** ou **excluir**. Ele nunca se apaga sozinho — a posição no mapa e as ligações valem mais que o link quebrado.",
        ],
      },
      {
        label: "LIGAÇÕES",
        body: [
          "Dois itens podem ser ligados por **leva a** ou **depende de**, dentro do próprio item. O card mostra um contador de quantas ligações tem.",
          "É aqui que o Mapa passa a valer: uma meta sozinha não se move. Coloque ao lado dela o espelho do hábito que a sustenta, ligue os dois, e o mapa mostra não só o que você quer, mas se o comportamento que leva até lá está acontecendo.",
        ],
      },
      {
        label: "FOCO DO TRIMESTRE",
        body: ["Fixe um item e ele ganha um alfinete no mapa, marcando qual é a prioridade do momento. Só um item pode estar fixado."],
      },
    ],
    xp: { none: true, note: "Planejar não dá XP — senão o caminho mais rápido pra pontuar seria criar metas em vez de cumpri-las. O XP vem das páginas que os espelhos apontam." },
    tips: [
      "No celular o mapa vira lista, e a posição se muda pelos seletores de horizonte e área dentro do item.",
      "Comece com pouco: uma meta por área da vida em *Agora* e *90 dias*. Mapa cheio de *algum dia* não orienta nada.",
      "Se uma meta não tem nenhum espelho ligado, desconfie: provavelmente não existe comportamento nenhum sustentando ela ainda.",
    ],
  },

  "/missoes": {
    title: "Missões",
    icon: "flag",
    tagline: "Um quadro estilo Trello pro que precisa sair nas próximas semanas. É o curto prazo — o longo prazo fica no Mapa.",
    sections: [
      {
        label: "COLUNAS",
        body: [
          "Vem com **A fazer**, **Em progresso** e **Concluído**, mas as colunas são suas: renomeie, crie, apague. O nome é editável direto no cabeçalho.",
          "Existe uma regra automática que vale conhecer: ao concluir um card, ele **se move sozinho** pra primeira coluna cujo nome pareça de concluídos (*concluído*, *feito*, *done*). Se nenhuma parecer, vai pra última coluna.",
        ],
      },
      {
        label: "CARD",
        list: [
          "**Título** — o que é.",
          "**Prazo** — data. Card com prazo passado aparece marcado como atrasado, aqui e no Foco.",
          "**Prioridade** — baixa, média ou alta, mostrada como bolinha colorida.",
          "**Descrição** — detalhes.",
          "**Etiquetas** — coloridas, com texto opcional.",
        ],
      },
      {
        label: "ARRASTAR",
        body: [
          "No computador, clique e arraste. No celular, **segure** o card por um instante antes de arrastar — o toque curto abre os detalhes em vez de arrastar. Dá pra reordenar dentro da coluna e mover entre colunas.",
        ],
      },
      {
        label: "ARQUIVAR CONCLUÍDOS",
        body: [
          "A coluna de concluídos cresce sem limite e vira entulho. O botão **ARQUIVAR CONCLUÍDOS** tira todos de uma vez — eles saem do quadro mas **continuam guardados**, nada é apagado.",
          "**ARQUIVADOS** mostra o arquivo no mesmo formato de quadro. Pra trazer um card de volta, abra ele e use **DESARQUIVAR**. Dá também pra arquivar um card sozinho, pelo próprio card.",
          "Card arquivado desaparece do Foco e da lista de espelhos do Mapa, mas um espelho que já apontava pra ele **continua funcionando** — arquivar não quebra referência.",
        ],
      },
      {
        label: "LIGAÇÃO COM OUTRAS PÁGINAS",
        body: [
          "Cards pendentes aparecem ao lado do cronômetro em **Foco**, ordenados por urgência. E qualquer card pode ser **espelhado no Mapa**, pra mostrar que aquela missão faz parte de uma meta maior.",
        ],
      },
    ],
    xp: { none: true, note: "Concluir card não dá XP. Card é livre de criar e de marcar como feito — pagar por isso seria pagar por digitar." },
    tips: [
      "Prazo só nos cards que realmente têm data. Prazo em tudo faz *atrasado* perder o significado.",
      "Se um card está no quadro há mais de um mês, ele não é missão: ou vira meta no Mapa, ou vira lixo.",
    ],
  },

  "/calendario": {
    title: "Agenda",
    icon: "calendar_month",
    tagline: "Compromissos com data e hora. Três visões da mesma informação, cada uma pra uma pergunta diferente.",
    sections: [
      {
        label: "AS TRÊS VISÕES",
        list: [
          "**Mês** — grade compacta com o título dos eventos em cada dia, e à direita o dia selecionado. Responde *como está a carga do mês?*.",
          "**Semana** — os sete dias lado a lado.",
          "**Dia** — linha do tempo por hora, com os eventos posicionados no horário real e uma marca da hora atual. Eventos sobrepostos ficam lado a lado.",
        ],
      },
      {
        label: "ROTINA DENTRO DA AGENDA",
        body: [
          "Os itens da **Rotina** que têm hora aparecem aqui e podem ser **marcados daqui mesmo** — é o mesmo dado e a mesma regra de XP da página de Rotina, não uma cópia. A faixa fica no topo do dia selecionado e na visão de Dia.",
          "Na grade do mês a rotina não vira lista: cada dia mostra uma pílula **feitos/total** que acende quando o dia fecha. Repetir os mesmos seis itens em cada quadradinho seria ruído.",
          "Rotina fica **fora da contagem de eventos** do mês: ela é ritmo, não compromisso, e inflaria o número que responde *o que eu tenho marcado?*. Item de rotina também não se marca no futuro.",
        ],
      },
      {
        label: "EVENTO",
        list: [
          "**Título** e **categoria** (trabalho, pessoal, saúde, treino, estudo, social, outro) — a categoria define a cor.",
          "**Dia inteiro**, ou **início e fim** com horário.",
          "**Nota** livre.",
        ],
      },
      {
        label: "REPETIR TODA SEMANA",
        body: [
          "No evento, marque **repetir toda semana** e escolha os dias. *Jiu ter e qui às 20:00* passa a existir em todas as semanas, pra sempre, sem você preencher nada.",
          "O detalhe importante: a repetição é uma **regra**, e as datas são calculadas na hora de exibir — nenhuma semana fica gravada. Consequência prática: mudar o horário muda **todas** as semanas de uma vez, não só a próxima.",
          "O botão **REPETIÇÕES**, no topo, lista suas regras pra editar ou excluir.",
        ],
      },
      {
        label: "QUANDO UMA SEMANA FURA",
        body: [
          "Abriu o evento repetido e quer tirar só aquele dia? Use **PULAR ESTA**. Aquela data entra numa lista de exceções e o resto da série segue intacto.",
          "Pra desfazer, o painel de REPETIÇÕES mostra quantas ocorrências foram puladas e tem um **RESTAURAR**.",
          "Já **EXCLUIR SÉRIE** apaga a regra inteira, de todas as semanas.",
        ],
      },
      {
        label: "TREINO APARECE SOZINHO",
        body: [
          "As divisões agendadas do seu plano de treino aparecem na agenda automaticamente, com o ícone de halter. Você **não** cadastra academia aqui — a verdade é o plano em Exercício, pra não manter o mesmo horário em dois lugares.",
          "Pra elas aparecerem no horário certo, defina a hora ao lado dos dias da semana na página de Exercício. Sem hora, aparecem como dia inteiro. Esses itens não são editáveis pela agenda.",
        ],
      },
      {
        label: "LIMITES QUE VALE SABER",
        body: [
          "Duas coisas que a agenda ainda **não** faz: evento que atravessa vários dias, e lembrete ou notificação. Cada evento vive num único dia.",
          "A repetição também é só semanal por dia da semana — não existe *a cada 2 semanas* nem *todo dia 5*.",
        ],
      },
      {
        label: "ORDEM DENTRO DO DIA",
        body: ["Eventos de dia inteiro vêm primeiro, depois os demais em ordem de horário de início."],
      },
    ],
    xp: { none: true, note: "Agenda não tem XP nem penalidade. Anotar compromisso não é disciplina; cumprir é — e o app não tem como saber se você foi." },
    tips: [
      "Compromisso fixo da semana (treino, aula, terapia) merece ser regra, não evento repetido na mão.",
      "Use categoria com consistência, senão a visão de mês vira confete sem informação.",
      "A visão de Dia é a útil de manhã; a de Mês é a útil no domingo, pra ver onde a semana já está cheia.",
    ],
  },

  // ============================================================ BALANÇO
  "/carteira": {
    title: "Carteira",
    icon: "account_balance_wallet",
    tagline: "Controle de dinheiro em três abas: o mês corrente, as despesas fixas e as metas de economia.",
    sections: [
      {
        label: "RESUMO DO MÊS",
        body: [
          "Receitas, despesas e saldo do mês selecionado, mais os gráficos: gasto por categoria e a comparação entre meses.",
          "Você lança transação com data, tipo (entrada ou saída), valor, categoria e nota. Dá pra navegar entre meses.",
        ],
      },
      {
        label: "DESPESAS FIXAS",
        body: [
          "Cadastro do que repete todo mês: nome, valor, categoria e dia de vencimento. Serve pra você saber o comprometido antes de gastar.",
          "Fixa cadastrada **não vira transação sozinha** — existe uma ação pra lançar as fixas do mês quando você quiser. Enquanto não lançar, elas contam como pendentes no cálculo do que sobra.",
        ],
      },
      {
        label: "METAS DE ECONOMIA",
        body: [
          "Objetivo com nome, alvo e quanto já foi guardado, com barra de progresso. É o único lugar do app onde se cria meta de economia.",
          "E essas metas podem ser **espelhadas no Mapa** — é assim que *30 mil de reserva* deixa de ser número solto e passa a ocupar um lugar no seu plano de vida, na área Dinheiro, no horizonte que você escolher.",
        ],
      },
    ],
    xp: { none: true, note: "Dinheiro não dá XP. O app não tem como verificar nada do que você digita aqui, e premiar número digitado seria premiar ficção." },
    tips: [
      "Cadastre as fixas primeiro. Sem elas, o saldo do mês mente pra você.",
      "Uma meta de economia por vez tem muito mais chance de fechar que quatro simultâneas.",
    ],
  },

  "/analise": {
    title: "Análise",
    icon: "insights",
    tagline: "A página que responde *o que está afetando o quê*. Ela não coleta nada — só cruza os últimos 30 dias do que você já registrou.",
    sections: [
      {
        label: "O QUE ELA MOSTRA",
        body: [
          "Séries dos últimos 30 dias de cada métrica que você registra — sono, humor, foco, treino, hábitos — pra você ver a forma da curva em vez de um número do dia.",
        ],
      },
      {
        label: "CORRELAÇÕES",
        body: [
          "O app calcula a correlação entre pares de métricas. Correlação é um número entre −1 e +1: perto de **+1** as duas coisas sobem juntas, perto de **−1** uma sobe quando a outra desce, perto de **0** não há relação aparente.",
          "É aqui que aparece coisa que você não veria olhando dia a dia — do tipo *nas noites em que durmo abaixo da meta, meu humor da tarde cai*.",
        ],
      },
      {
        label: "COMO NÃO SE ENGANAR",
        body: [
          "Duas ressalvas honestas. Primeiro: **correlação não é causa.** Treino e humor subirem juntos não diz qual puxa qual — pode ser um terceiro fator, como estar de férias.",
          "Segundo: com poucos dias registrados, qualquer correlação é ruído. Trinta dias de registro razoavelmente completo é o mínimo pra a página dizer algo. Se você registrou cinco dias, ignore os números.",
        ],
      },
      {
        label: "POR QUE ELA PODE ESTAR VAZIA",
        body: [
          "Não há o que cruzar sem registro. Se esta página parece inútil, o problema não está aqui — está na falta de dado nas outras. Ela é a recompensa por registrar com constância.",
        ],
      },
    ],
    xp: { none: true, note: "Página só de leitura. Não dá nem tira XP, não altera nada." },
    tips: [
      "Olhe uma vez por semana, não todo dia. Dado de um dia não muda uma correlação de 30.",
      "Se uma correlação te surpreender, o próximo passo é registrar mais, não mudar tudo de uma vez.",
    ],
  },

  // ============================================================ FORA DA NAVEGAÇÃO (rotas desativadas)
  "/foco": {
    title: "Foco",
    icon: "timer",
    tagline: "Cronômetro pomodoro e as missões do quadro, lado a lado. Nada mais na tela — o XP por sessão é o maior valor único do app.",
    sections: [
      {
        label: "COMO O CICLO FUNCIONA",
        body: [
          "Você define a duração do foco e da pausa nas configurações (padrão 25 e 5 minutos). O ciclo alterna sozinho: foco, pausa, foco.",
          "O timer é **global**. Ele continua rodando quando você navega pra outra página do app, e um mini-timer flutuante aparece no canto pra você acompanhar.",
        ],
      },
      {
        label: "ELE NÃO ATRASA EM ABA DE FUNDO",
        body: [
          "O cronômetro se ancora na hora do relógio, não na contagem de segundos da tela. Isso significa que ele **não atrasa** quando o navegador congela a aba em segundo plano — voltando pra aba, ele se recalcula na hora certa. Sessão só conta quando o tempo realmente passou.",
        ],
      },
      {
        label: "AS MISSÕES DO QUADRO",
        body: [
          "A coluna lateral mostra os cards pendentes do **mesmo quadro** de Missões — não é uma segunda lista. Marcar aqui move o card lá, exatamente como se você tivesse marcado no quadro.",
          "A ordem é a de urgência: atrasadas primeiro, depois as com prazo mais próximo, depois por prioridade.",
          "Pra criar, editar prazo, etiqueta ou descrição, o lugar é a página de Missões. Aqui você só executa.",
        ],
      },
      {
        label: "SÓ ISSO",
        body: [
          "A página é deliberadamente curta: cronômetro e o que precisa ser feito. Sem player de música, sem lista paralela de tarefas, sem painel de XP. Tela de foco cheia de coisa é contradição.",
        ],
      },
    ],
    xp: {
      rows: [["Sessão de foco concluída", "50 XP, escalado pela duração escolhida"]],
      note: "Sessão de foco é a única ação que **também empurra a sequência diretamente**, além de contar como dia ativo. Mudar a duração muda o XP proporcionalmente — 50 min vale o dobro de 25. Concluir missão daqui **não** dá XP, igual no quadro.",
    },
    tips: [
      "Duração maior não é melhor: vale o mesmo por minuto e é mais fácil de abandonar no meio.",
      "Escolha a missão antes de dar play. Decidir o que fazer com o cronômetro rodando já é a distração.",
    ],
  },

  "/grupos": {
    title: "Grupos",
    icon: "groups",
    tagline: "Ranking entre amigos. O detalhe que faz ele funcionar: a comparação é do **XP ganho depois de entrar**, não do XP total.",
    sections: [
      {
        label: "CRIAR E ENTRAR",
        body: [
          "Você cria um grupo e recebe um **código de convite** pra passar pra quem quiser. Entrar é colar o código. Dá pra sair de um grupo, e quem criou pode apagá-lo.",
        ],
      },
      {
        label: "POR QUE O RANKING É RELATIVO",
        body: [
          "No momento em que você entra, o app guarda uma foto do seu XP. O ranking mostra o quanto cada um acumulou **a partir dali**.",
          "Isso é de propósito: sem isso, quem usa o app há seis meses começaria com vantagem impossível de alcançar, e o ranking mediria antiguidade em vez de esforço. Com o XP relativo, um novato entra empatado com todo mundo.",
        ],
      },
      {
        label: "O QUE OS OUTROS VEEM",
        body: [
          "Só o seu nome de usuário e o XP acumulado desde a entrada. Nada do que você registra — nem sono, nem humor, nem diário, nem dinheiro — é compartilhado com ninguém.",
        ],
      },
    ],
    xp: { none: true, note: "Grupo não gera XP próprio. Ele só exibe o XP que você ganhou nas outras páginas." },
    tips: [
      "Grupo pequeno com gente que você conhece funciona; ranking grande e anônimo vira ruído.",
      "Seu nome de usuário é o que aparece — ajuste no Perfil antes de convidar alguém.",
    ],
  },
};

export const helpFor = (pathname) => HELP[pathname] || null;
