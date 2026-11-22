# DUDE — Centro e Autocontrole (revisão atual)

## Objetivo

O Centro tem duas áreas simples, com funções diferentes:

1. **Análise pessoal:** mostra como o tempo foi usado, quais projetos e atividades receberam tempo, quais tarefas foram concluídas e quais hábitos ficaram abaixo do que foi planejado.
2. **Autocontrole:** reúne os registros de resistência, recaídas e adiamentos, mostra quais comportamentos tiveram recaídas e ajuda a observar situações que aparecem perto desses episódios.

A tela inicial de cada área prioriza o essencial. A análise mais detalhada de tempo fica recolhida atrás de **Ver análise completa**. Os textos descrevem ações e dados sem criar conclusões quando não existe uma amostra suficiente.

## 1. Análise pessoal

### Calendário dos últimos 30 dias

- Exibe 30 dias em uma grade semanal, no estilo de um calendário de atividade.
- A intensidade é calculada pelos minutos de sessões concluídas em cada dia.
- Mais tempo registrado gera um tom de verde mais escuro.
- Dias sem sessão concluída permanecem neutros.
- Ao selecionar um dia, a tela lista as sessões realizadas, horário, duração, projeto, atividade e tarefas vinculadas.
- Quando uma sessão não tem tarefas individuais salvas, o calendário pode mostrar as tarefas previstas na atividade agendada, identificando-as como previstas em vez de concluídas.

### Análises detalhadas

Períodos disponíveis: 7, 30 e 90 dias.

Fontes de dados:

- `focus_sessions`: sessões concluídas; prioriza `actual_duration_minutes` e usa `duration_minutes` como alternativa quando necessário.
- `projects` e `activities`: nomes associados às sessões.
- `session_tasks`: tarefas vinculadas a cada sessão.
- `habit_completions` e `habits`: hábitos realizados e frequência prevista.
- `daily_tasks`: tarefas registradas e concluídas.
- `scheduled_activities`: atividades agendadas, excluindo canceladas e expiradas.

Regras:

- Tempo por projeto e atividade é a soma dos minutos de sessões concluídas.
- Para projetos com atividades agendadas, compara o tempo previsto com o tempo total registrado no projeto. A diferença é apresentada como informação para revisar o planejamento, não como julgamento automático.
- A taxa de hábitos compara ocorrências realizadas com ocorrências previstas.
- Hábitos sem meta calculável não entram na taxa geral.
- A taxa de tarefas usa tarefas registradas no período.
- A taxa de atividades agendadas exclui itens cancelados e expirados.
- Um padrão de dia ou horário só é destacado com pelo menos 5 sessões em 3 dias diferentes.

## 2. Autocontrole

Períodos disponíveis: 7, 30 e 90 dias, com filtro por acompanhamento.

### Registro estruturado

Cada acontecimento pode guardar:

- comportamento acompanhado;
- resultado: resistência, recaída ou adiamento;
- data e hora em que aconteceu (`occurred_at`);
- situação que veio antes (`trigger_tag` e `preceding_activity`);
- estado emocional (`emotion_tag`);
- ambiente (`environment_tag`);
- intensidade informada da vontade, de 1 a 10 (`urge_intensity`);
- estratégia que ajudou (`recovery_action`);
- anotação livre (`trigger_note`).

`created_at` representa quando o banco recebeu o registro. `occurred_at` representa quando o acontecimento ocorreu, conforme informado pelo usuário.

### Recorde e sequência atual

Os números exibidos no menu e nos cartões de autocontrole agora representam sequências, não o total acumulado de dias com resistência:

- **Recorde:** maior sequência histórica de dias programados com resistência confirmada.
- **Atual:** sequência mais recente de dias programados com resistência confirmada.
- Uma recaída encerra a sequência atual, mas não apaga o recorde anterior.
- Se houver resistência e recaída no mesmo dia, a recaída prevalece.
- Um dia sem registro não é presumido como resistência e interrompe a sequência.
- Dias da semana em que o acompanhamento não está programado não interrompem a sequência.
- Registros futuros são ignorados.
- Em acompanhamentos por horário, a unidade exibida é **períodos consecutivos**, não dias inteiros.
- Registros repetidos do mesmo acompanhamento na mesma data contam como um único dia/período para o cálculo da sequência.

### Análises

- Recaídas por comportamento, para identificar quais acompanhamentos concentram ocorrências.
- Situações, emoções, ambientes e atividades informadas antes dos episódios.
- Dia e período do dia em que os episódios foram registrados.
- Estratégias informadas como úteis nas resistências.
- Intensidade da vontade informada nos registros.
- Atividade e projeto da última sessão concluída nas quatro horas anteriores à recaída, ou de uma sessão concluída que estava em andamento no horário informado.
- Comparação com o período anterior quando há dados suficientes.

Os dados de sessão próximos a uma recaída indicam apenas proximidade no tempo. Não são tratados como causa do episódio.

Os padrões de gatilho, emoção, ambiente e horário só são destacados com pelo menos 3 recaídas distribuídas em 2 dias diferentes. Antes disso, o painel mostra os registros sem apontar um padrão.

Quando todos os acompanhamentos estão selecionados, os dias com resistência e recaída são contados por acompanhamento. A mesma data pode aparecer em mais de um comportamento.

## 3. Linguagem da interface

- A área do Centro usa **Análise pessoal** e **Autocontrole**.
- O calendário é identificado como **Atividade nos últimos 30 dias**.
- A análise adicional é aberta por **Ver análise completa**.
- Os registros são acessados por **Novo registro** e **Registros e anotações**.
- Foram removidos dos textos visíveis termos antigos como Centro de Operações, Modo de Execução, Blindagem, Sala de Guerra, Trends, Aprendizagem e referências à palavra “foco”.
- A referência visual solicitada é aplicada somente como direção de design; ela não é citada na interface.

## 4. Arquivos principais

- `src/components/dashboard/CentroDashboard.tsx`: navegação entre Análise pessoal e Autocontrole.
- `src/components/dashboard/PersonalInsightsPanel.tsx`: calendário, detalhe diário e análises de tempo.
- `src/components/dashboard/AutocontroleLab.tsx`: registros, anotações e análises de autocontrole.
- `src/lib/behaviorInsights.ts`: calendário, distribuição de tempo e análise de padrões.
- `src/lib/avoidanceMetrics.ts`: cálculo do recorde e da sequência atual.
- `src/components/layout/MenuTab.tsx` e `src/components/layout/ActionCenter.tsx`: indicadores de recorde e sequência atual no menu.

## 5. Banco de dados

Esta rodada não adiciona tabelas nem colunas. Usa os registros e campos já presentes no projeto. **Não é necessário executar um novo SQL para estas alterações.**

## 6. Testes e limites desta entrega

- Transpilação sintática: 22/22 arquivos TypeScript/TSX alterados sem erros de sintaxe.
- Testes isolados: 11/11 cenários passaram, incluindo recorde, sequência atual, recaída, dia sem registro, dias não programados, acompanhamentos por horário, calendário e relação temporal entre sessões e recaídas.
- O script `npm run test:metrics` foi adicionado para executar os testes com `tsx` após instalar as dependências.
- A instalação de dependências não terminou neste ambiente. Portanto, o build completo do Vite e o type-check integral ainda precisam ser executados em um ambiente com as dependências instaladas.
- A integração com o Supabase real e a validação visual no navegador ainda precisam ser feitas antes de considerar a versão pronta para publicação.
