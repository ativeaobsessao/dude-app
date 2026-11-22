# Sessão guiada — revisão e implementação

## Escopo

A implementação parte da versão `dude-centro-autocontrole-v2.zip` e preserva as etapas já existentes. Não exige alteração de banco de dados nem migração SQL.

## Ritmo e transições respiratórias

A sessão principal continua com 213 segundos (3min33s), distribuídos assim:

| Etapa | Duração | Regra |
|---|---:|---|
| Abertura | 8 s | Mensagem inicial acolhedora |
| Primeira sequência | 57 s | Três ciclos de 4 s inspirando, 7 s de pausa confortável e 8 s expirando |
| Transição | 5 s | Só começa depois da terceira expiração completa |
| Segunda sequência | 28 s | Um ciclo completo de 4-4-4-4 e um último ciclo de 4-4-4; a pausa após a expiração é omitida no último ciclo |
| Acompanhamento visual | 30 s | Movimento visual opcional |
| Anotação | 85 s | Texto opcional, sem obrigar o usuário a escrever |

No tempo adicional, a sequência é: 8 s de acolhimento, 60 s de respiração (três ciclos completos e um último ciclo que termina na expiração), 5 s de transição e depois acompanhamento visual/anotação sem limite de tempo.

Todas as transições de uma etapa respiratória para outra acontecem depois que a expiração termina. A contagem, a instrução e a animação usam a mesma duração. Se alguma etapa não for confortável, a interface orienta a voltar à respiração natural.

## Movimento visual

- A luz verde percorre horizontalmente toda a largura disponível.
- Cada travessia leva 16 segundos tanto no celular quanto no computador, mantendo o mesmo ritmo visual relativo à tela.
- A trajetória não é diagonal e não usa aceleração aleatória.
- A animação respeita `prefers-reduced-motion`; nesse caso, a luz fica estática.
- O elemento não intercepta toques nem fica acima de textos, campos ou botões.

## Cronômetro e continuidade

- O tempo é calculado por um horário final absoluto, não pela soma de intervalos.
- Ao voltar de uma aba suspensa, o contador se atualiza pelo tempo real transcorrido.
- A sessão em andamento pode ser recuperada pelo armazenamento local.
- O tempo adicional também usa horário inicial absoluto.

## Áudio

- O áudio começa desligado e só é ativado após toque/clique explícito.
- O botão informa se o som está ligado, desligado ou indisponível.
- O volume gerado é limitado a um nível baixo.
- A sessão continua funcionando sem áudio.
- As frequências não são apresentadas como tratamento nem como promessa de efeito psicológico.

## Registros e autocontrole

- A sessão guiada não cria registros de resistência ou recaída.
- Uma anotação escrita é salva na caixa de entrada com a identificação `Pausa guiada`.
- Quando a pausa está associada a um comportamento específico, o nome aparece apenas como contexto da anotação.
- A abertura genérica da sessão não seleciona automaticamente o primeiro hábito de autocontrole.
- O fluxo de vitória/resistência explícita permanece separado.

## Proteção e acessibilidade

- O botão de fechar abre uma confirmação antes de interromper a sessão.
- A confirmação avisa quando existe texto ainda não salvo.
- O cronômetro pode manter a tela ativa quando o navegador oferece Wake Lock; a sessão continua mesmo sem esse recurso.
- A preferência do sistema por movimento reduzido é respeitada.
- Os textos foram simplificados e retiram linguagem militarizada, técnica ou artificial.

## Arquivos alterados

- `src/components/dashboard/UrgeSurfingProtocol.tsx`
- `src/components/dashboard/AntiVicioModal.tsx`
- `src/components/dashboard/HeroSection.tsx`
- `src/lib/guidedSession.ts` (novo)
- `tests/guidedSession.test.ts` (novo)

## Validação

- Sintaxe TypeScript/TSX verificada nos quatro arquivos alterados.
- Tipagem estrita do motor de etapas `guidedSession.ts` aprovada.
- 17 testes automatizados de métricas existentes, insights e nova sessão guiada aprovados em execução isolada com Node.
- O build completo do Vite não foi certificado: a instalação de dependências (`npm ci`) excedeu o tempo disponível e o modo offline não encontrou todos os pacotes no cache.
- Nenhum SQL foi alterado ou é necessário para esta implementação.
