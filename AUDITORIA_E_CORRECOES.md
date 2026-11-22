# Auditoria e primeira rodada de correções — DUDE

Data: 21/11/2026

## Escopo desta rodada

A análise priorizou os fluxos que foram apontados: nomes e textos da interface, acompanhamento de autocontrole, resumo comportamental, anotações e descompressão. Também foram corrigidos alguns pontos transversais que afetavam contagem de tempo, sincronização e renderizações desnecessárias.

Esta entrega altera o código do projeto, mas não foi conectada ao projeto Supabase real. A migração SQL precisa ser aplicada e os fluxos precisam ser testados na conta antes de considerar a aplicação validada em produção.

## Correções realizadas

### 1. Interface e nomenclatura

- Removidos da interface os textos “Centro de Operações” e “MODO EXECUÇÃO ATIVADO”.
- “Sala de Guerra” foi substituída por “Anotações de autocontrole”.
- “Insights Comportamentais” / “Explorar Padrões” foram simplificados para “Seu ritmo” / “Ver resumo”.
- O antigo resumo comportamental agora explica que considera os últimos 30 dias e mostra apenas dados presentes nos registros.
- “Aprendizagem”, “Limbo Descarregado”, “Capturas do Limbo” e outros termos de sistema foram substituídos por linguagem direta.
- “TÔ NAS ÚLTIMAS” foi removido. O botão agora edita o acompanhamento existente, em vez de abrir um formulário vazio.

### 2. Autocontrole: contagem e histórico

Problema encontrado: a contagem antiga usava o tempo desde a criação do controle e subtraía recaídas. Assim, o app podia mostrar 87 ou 92 dias mesmo sem check-ins que comprovassem esses dias.

Agora:

- Só um check-in de resistência pode contar como dia/janela com resistência registrada.
- A data de criação do controle não gera dias automaticamente.
- Vários check-ins no mesmo dia contam como um único dia no total.
- Se houver resistência e recaída no mesmo dia, a recaída prevalece para a sequência daquele dia.
- Dias sem registro não são tratados como dias limpos.
- A sequência atual respeita os dias da semana configurados.
- Status antigos (`resisti`, `recai`, `depois`) são interpretados para leitura; novos registros usam somente `success`, `relapse` e `pending`.
- A contagem é compartilhada por Home, Centro, Menu e histórico, evitando regras diferentes em cada tela.

### 3. Lembretes e janelas de acompanhamento

- Corrigida a identificação de janelas que atravessam a meia-noite.
- Os lembretes de dia inteiro usam períodos separados, evitando chaves duplicadas.
- A intensidade leve, equilibrada ou alta determina quantos registros podem ser solicitados.
- “Depois” grava um registro pendente e adia o lembrete por duas horas; não marca resistência nem recaída.
- A opção “Depois” não fica bloqueada pelo restante da sessão atual.
- A lógica de lembrete é atualizada a cada 30 segundos, em vez de depender de frases que mudavam a cada cinco segundos.
- Corrigidas as chaves dos cartões para que dois períodos do mesmo controle não compartilhem a mesma identidade visual.

### 4. Persistência e proteção das anotações

- Falhas de gravação não criam mais check-ins falsos no estado local.
- Atualizar ou excluir um check-in agora retorna sucesso ou falha real; a interface mostra erro quando o Supabase não confirma a operação.
- Excluir uma anotação remove somente o texto da anotação; o registro de resistência/recaída permanece.
- Remover um controle passa a preservar o histórico e as anotações, deixando os registros sem vínculo com o controle removido.
- A tela de anotações foi simplificada: mostra somente anotações salvas, permite editar e remover, e não inventa tendências.

### 5. Fluxo de recaída

Antes, escolher “Recaí” podia abrir diretamente o protocolo de foco guiado, misturando dois objetivos diferentes.

Agora:

- “Resisti” grava o check-in e permite adicionar contexto.
- “Recaí” grava a ocorrência e abre uma mensagem de apoio, sem iniciar automaticamente o protocolo de foco.
- A anotação da recaída só é marcada como salva quando o banco confirma a atualização.
- O protocolo de pausa guiada continua disponível pela ação de apoio, separado do registro de recaída.

### 6. Resumo comportamental

- “Seu ritmo” considera sessões concluídas nos últimos 30 dias.
- O horário predominante é calculado pelos minutos registrados, não pela quantidade de sessões.
- O resumo identifica projeto e atividade com mais tempo, quando há dados.
- A relação entre recaídas e humor só é mostrada quando existem pelo menos três registros correspondentes para o mesmo período.
- A interface informa quando ainda não há dados suficientes.
- A ausência de check-ins não é apresentada como ausência de recaídas.
- O resumo semanal usa sessões concluídas e registros reais, sem frases que atribuem uma identidade ao usuário.

### 7. Descompressão e anotações rápidas

- A sessão agora tem um botão explícito “Salvar anotação”.
- O salvamento usa a mesma ação de persistência da caixa de entrada e atualiza o estado local após confirmação do banco.
- Em caso de falha, o texto permanece no campo para nova tentativa.
- O cronômetro não depende da disponibilidade do áudio.
- O intervalo do cronômetro deixou de ser recriado a cada segundo.
- Foram reduzidas as partículas animadas de 20 para 8.
- O texto “neurologicamente comprovado” foi removido por ser uma afirmação sem comprovação no próprio aplicativo.
- A antiga “captura do limbo” agora aparece como anotação rápida na Caixa de entrada.

### 8. Desempenho e consistência geral

- Removido o intervalo de dez segundos da seção de autocontrole, que recalculava métricas e podia provocar renderizações frequentes.
- Removida a rotação de frases a cada cinco segundos na Home.
- Componentes grandes passaram a selecionar somente os dados relevantes do Zustand, reduzindo renderizações por mudanças não relacionadas.
- Corrigida a limpeza do áudio do protocolo guiado: o temporizador de encerramento agora atua somente sobre os nós de áudio antigos.
- A atualização ao retornar para a aplicação escuta `visibilitychange` no `document`, e não no `window`.
- Eventos de foco/visibilidade agora compartilham uma atualização com intervalo mínimo de cinco segundos.
- Resumos de tempo passaram a priorizar `actual_duration_minutes`; duração planejada não é contabilizada como tempo real de uma sessão incompleta.

## Migração Supabase obrigatória

Arquivo: `006_autocontrole_consistency.sql`

Aplicar no SQL Editor do Supabase, depois das migrações anteriores. Fazer backup antes de executar.

A migração:

- adiciona campos usados pelo acompanhamento e pelos check-ins;
- alinha os status e períodos aceitos, mantendo compatibilidade com valores antigos;
- altera a relação de `avoidance_checkins.habit_id` para `ON DELETE SET NULL`, preservando registros e anotações quando um controle é removido;
- cria a tabela `inbox_captures` caso ela ainda não exista, com RLS;
- cria índices para as consultas de check-ins e da caixa de entrada.

Sem essa migração, as novas gravações e a preservação do histórico não podem ser consideradas funcionais no banco real.

## Verificações feitas nesta rodada

- Transpilação sintática dos 75 arquivos TypeScript/TSX: sem erros de sintaxe.
- Testes isolados da métrica:
  - controle sem check-ins: sequência e total iguais a zero;
  - dois registros de resistência na mesma data: um único dia contabilizado;
  - resistência e recaída na mesma data: a recaída prevalece;
  - lacuna em dia monitorado: interrompe a sequência.

## O que ainda precisa ser validado

- A instalação de dependências não terminou neste ambiente. Por isso, `npm run build` não pôde ser certificado; a tentativa terminou com `vite: Permission denied` após a instalação incompleta.
- Não houve conexão com o Supabase real, então RLS, migração, permissões e persistência precisam ser confirmados no projeto do usuário.
- Não foi possível fazer teste manual em Android ou navegador autenticado.

### Roteiro de teste após aplicar a migração

1. Executar `npm ci` e depois `npm run build`.
2. Criar um acompanhamento de dia inteiro com intensidade equilibrada.
3. Registrar resistência, recaída e “Depois”; confirmar que pendências não viram dias com resistência.
4. Criar uma janela noturna que atravesse a meia-noite e validar os lembretes.
5. Abrir as anotações, editar uma, remover outra e confirmar que os check-ins continuam no histórico.
6. Remover um controle e confirmar que as anotações permanecem como registros sem vínculo.
7. Na Home, escolher “Recaí” e confirmar que aparece o fluxo de apoio, sem abrir o protocolo guiado.
8. Abrir “Preciso de apoio”, concluir a pausa e testar a gravação com e sem texto.
9. Abrir Descompressão, iniciar o cronômetro, pausar, retomar e salvar uma anotação; confirmar que ela aparece na Caixa de entrada.

## Observação

Esta é uma primeira rodada focada nos problemas relatados e nos defeitos diretamente relacionados. Não equivale a uma certificação completa de todas as telas, integrações e cenários de produção.
