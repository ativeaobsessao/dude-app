# DUDE — Implementação final da seção Descompressão

## Base utilizada

Esta versão parte do último projeto entregue nesta conversa: `dude-sessao-guiada-corrigida.zip`. As demais áreas do projeto foram preservadas; as alterações funcionais desta rodada se concentram na Descompressão, nos cartões de anotações e no armazenamento desses cartões.

## O que foi implementado

### Aparência noturna
- Fundo marrom quase preto (`#100D0A`) e superfícies escuras e quentes.
- Textos em marfim suave, detalhes âmbar e verde oliva discreto.
- Nenhum azul, ciano, roxo ou branco puro é usado como cor de destaque na seção.
- A meta `theme-color` e o fundo do documento mudam enquanto a seção está aberta e voltam ao valor anterior ao sair.
- `color-scheme: dark` é aplicado ao contêiner e ao campo de escrita; o teclado nativo ainda respeita o tema configurado no Android/Gboard.

### Elementos visuais
- Seletor entre **Lótus** e **Orbe**.
- Lótus geométrico: quatro círculos concêntricos em branco gelo suave, expandindo e contraindo juntos em um ciclo de 12 segundos. Não é uma ilustração de uma flor real.
- Orbe: esfera verde oliva discreta, com um percurso de 16 segundos em cada direção.
- A preferência visual fica salva localmente para a próxima sessão.
- As animações respeitam `prefers-reduced-motion` e ficam estáticas quando a página está em segundo plano.

### Áudio e temporizador
- Ruído marrom gerado localmente com Web Audio API; não depende de um arquivo externo.
- Buffer de 30 segundos com crossfade na junção do loop para reduzir cliques audíveis.
- Headroom de pico no buffer, filtro passa-altas em 28 Hz, passa-baixas em 360 Hz, compressor suave e controle de volume.
- Entrada e saída graduais do som.
- Duração de 15, 30 ou 60 minutos, além de duração personalizada entre 5 e 720 minutos.
- O temporizador começa ao iniciar o som e continua contando mesmo se o usuário pausar o áudio.
- Ao chegar a zero, o som é encerrado, as anotações pendentes são salvas e a seção chama o fechamento que retorna à tela anterior/Home.
- O Wake Lock foi removido da Descompressão: a seção não tenta manter a tela acesa.

### Anotações
- Enter salva; Shift + Enter insere uma nova linha. O campo solicita a ação `done` ao teclado móvel.
- É possível criar vários cartões, editar cartões existentes e excluí-los com confirmação.
- Os cartões usam a tabela já existente `inbox_captures`.
- A atualização de um cartão foi adicionada ao Zustand/Supabase (`updateInboxCapture`).
- A Home já contém o componente `InboxCaptures`; ele agora apresenta o título **Anotações para organizar** e oferece salvar nas anotações, criar tarefa, manter para depois ou excluir.
- Não foi adicionada migração SQL: a implementação usa a tabela e a política RLS já presentes no esquema do projeto.

## Arquivos alterados

- `src/components/dashboard/DecompressionSession.tsx`
- `src/components/dashboard/InboxCaptures.tsx`
- `src/store/useDataStore.ts`
- `src/lib/brownNoise.ts` (novo)
- `tests/brownNoise.test.ts` (novo)
- `index.html` (idioma pt-BR e viewport com safe area)
- `public/sw.js` (cache atualizado para `dude-v9`, evitando servir a versão anterior após a publicação)

## Limitações que precisam ser consideradas nos testes

1. Uma aplicação web/PWA não consegue garantir que o navegador mantenha um `AudioContext` ativo depois que o Android bloqueia a tela. Alguns aparelhos suspendem o áudio ou atrasam temporizadores em segundo plano. O código agenda o fim do áudio no relógio do `AudioContext` e recalcula o temporizador ao retornar à página, mas reprodução/encerramento garantidos com a tela bloqueada exigiriam uma implementação Android nativa com serviço em primeiro plano.
2. O aplicativo solicita tema escuro para os campos, mas não consegue forçar a aparência do teclado de terceiros em todos os aparelhos. O tema do Gboard deve ser configurado no Android quando necessário.
3. A cor e a intensidade da tela não eliminam fisicamente a emissão de luz azul do display. O modo noturno e a redução extra de brilho do Android continuam sendo recomendações complementares.
4. A qualidade sonora foi avaliada por propriedades do sinal gerado e pela continuidade do loop em testes automatizados; não houve teste de audição em alto-falantes/fones reais nem medição acústica. O volume deve ser ajustado em nível confortável.

## Validação realizada neste ambiente

- Transpilação sintática dos 82 arquivos TypeScript/TSX (excluindo o arquivo de declaração `src/vite-env.d.ts`): aprovada.
- Verificações isoladas do gerador de ruído: aprovadas (tamanho, valores finitos, headroom, média/DC, continuidade do loop e rejeição de parâmetros inválidos).
- `npm ci` não pôde ser concluído neste ambiente porque o acesso ao registry do npm falhou com `EAI_AGAIN`; por isso, `npm run lint`, `npm run test:metrics` e `npm run build` ainda precisam ser executados em um ambiente com acesso às dependências.

## Comandos para validação no computador/GitHub

```bash
npm ci
npm run lint
npm run test:metrics
npm run build
```

Nenhum SQL novo é necessário para esta rodada.
