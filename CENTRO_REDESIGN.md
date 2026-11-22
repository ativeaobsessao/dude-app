# DUDE — Redesenho do Centro

## Objetivo

O Centro foi reorganizado em duas áreas com responsabilidades distintas:

1. **Seu tempo:** mostra como o tempo registrado foi distribuído entre projetos e atividades, a regularidade dos hábitos atômicos e a relação entre planejamento e execução.
2. **Autocontrole:** reúne registros de resistência, recaídas e adiamentos, anotações e fatores contextuais informados pelo usuário.

A interface não utiliza mensagens que atribuam características pessoais sem evidência. Quando a amostra é pequena, informa a limitação em vez de apresentar uma conclusão.

## 1. Seu tempo

Períodos disponíveis: 7, 30 e 90 dias.

### Fontes de dados

- `focus_sessions`: somente sessões concluídas; prioriza `actual_duration_minutes` e usa `duration_minutes` como alternativa para sessões concluídas sem duração real.
- `projects`: nome do projeto vinculado à sessão.
- `activities`: nome da atividade vinculada, com `activity_name` como primeira opção.
- `habit_completions`: ocorrências concluídas de cada hábito.
- `habits`: frequência semanal ou dias recorrentes configurados.
- `daily_tasks`: tarefas e conclusão no período.
- `scheduled_activities`: atividades agendadas, excluindo canceladas e expiradas.

### Regras de cálculo

- Tempo por projeto e atividade é a soma dos minutos de sessões concluídas.
- A taxa de hábitos compara registros realizados com ocorrências previstas. Para hábitos recorrentes, conta os dias configurados; nos demais, usa a frequência semanal proporcional ao período.
- Hábitos sem meta calculável não entram na taxa geral.
- A taxa de tarefas usa tarefas registradas no período.
- A taxa de atividades agendadas exclui itens cancelados e expirados.
- Um padrão de dia ou horário só é destacado com pelo menos 5 sessões concluídas distribuídas em 3 dias diferentes.

## 2. Autocontrole

Períodos disponíveis: 7, 30 e 90 dias, com filtro por acompanhamento.

### Registro estruturado

Cada acontecimento pode guardar:

- comportamento acompanhado;
- resultado: resistência, recaída ou adiamento;
- data e hora em que aconteceu (`occurred_at`);
- gatilho percebido (`trigger_tag`);
- estado emocional (`emotion_tag`);
- ambiente ou contexto (`environment_tag`);
- atividade imediatamente anterior (`preceding_activity`);
- intensidade subjetiva do impulso, de 1 a 10 (`urge_intensity`);
- estratégia que ajudou (`recovery_action`);
- anotação livre (`trigger_note`).

`created_at` continua representando quando o banco recebeu o registro. `occurred_at` representa quando o usuário informa que o acontecimento ocorreu. Isso evita confundir o horário de registro tardio com o horário do episódio.

### Regras de cálculo

- Resistências, recaídas e adiamentos são contados como acontecimentos separados.
- Taxas de resistência e recaída usam somente acontecimentos conclusivos (resistência + recaída); adiamentos não entram no denominador.
- Dias com resistência e dias com recaída são dias distintos, não uma contagem de check-ins. Se houver resistência e recaída no mesmo dia, a recaída prevalece na classificação daquele dia.
- Dias sem registro não são classificados como dias sem recaída nem como dias de resistência.
- A distribuição por gatilho, emoção, ambiente, dia e horário só é apresentada com pelo menos 3 recaídas distribuídas em 2 dias diferentes.
- Comparações com o período anterior só aparecem quando há pelo menos 3 acontecimentos conclusivos no período atual e no anterior.
- Associações são descrições dos registros; não são apresentadas como causas.

## Migração

Arquivos: `007_behavior_lab.sql` (somente os novos campos) e `MIGRACAO_CENTRO_DUDE.sql` (pacote consolidado 006 + 007).

A migração é aditiva. Cria colunas estruturadas e um índice para a consulta do histórico, sem apagar ou reescrever registros antigos. Executar depois das migrações de base e da `006_autocontrole_consistency.sql` quando ela ainda for necessária no projeto.

## Arquivos principais

- `src/components/dashboard/CentroDashboard.tsx`: navegação do Centro.
- `src/components/dashboard/PersonalInsightsPanel.tsx`: visão de tempo, projetos, atividades e hábitos.
- `src/components/dashboard/AutocontroleLab.tsx`: histórico, análise e formulário de acontecimentos.
- `src/lib/behaviorInsights.ts`: cálculos determinísticos e regras de amostra.
- `src/components/dashboard/HeroSection.tsx`: captura estruturada após uma recaída registrada na Home.
- `src/components/dashboard/AntiVicioModal.tsx`: captura de contexto e estratégia após uma resistência.

## Verificações realizadas nesta rodada

- Transpilação sintática dos arquivos TypeScript/TSX alterados: sem erros de sintaxe.
- Type-check isolado do módulo `behaviorInsights.ts`: aprovado.
- Testes isolados dos cálculos com dados simulados:
  - distribuição de minutos por projeto e atividade;
  - taxa de hábitos, tarefas e atividades agendadas;
  - padrões de recaída com amostra suficiente;
  - classificação de um dia com resistência e recaída como dia de recaída;
  - taxa calculada sem contar adiamentos.

## Validação ainda necessária

A instalação de dependências não terminou neste ambiente; portanto, não foi possível certificar `npm run build` nem testar a aplicação autenticada contra o Supabase real. A migração 007, persistência, permissões RLS e os fluxos completos precisam ser validados no projeto Supabase do usuário antes da publicação.
