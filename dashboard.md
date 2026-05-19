# Handoff de Desenvolvimento - TechSouls Command Center

_Gerado em: 18/05/2026_

## 1. Objetivo da Aplicacao

O TechSouls Command Center e um painel operacional full stack para monitorar, controlar e auditar o pipeline editorial multiagente do blog TechSouls. A aplicacao foi desenhada para acompanhar agentes OpenClaw, jobs editoriais, filas, revisao humana, payloads JSON, logs, status do workflow e acoes manuais como retry, pause, resume, cancelamento, aprovacao, rejeicao e retorno para etapas anteriores.

O produto deixou de ser apenas um MVP mockado e agora esta no caminho de producao local/EasyPanel: usa PostgreSQL e Redis reais, login simples por secret, deploy Docker standalone, integracao real bidirecional com OpenClaw Gateway por WebSocket e um worker separado para sincronizar agentes, sessoes e eventos.

## 2. Estado Atual do Desenvolvimento

Repositorio atual: `victorlima753/OpenClaw_Dashboard.git`, branch `main`.

Ultimos commits relevantes no historico local:

- `2852f33 Stabilize task priority and agent states`
- `ab4403c Wire Kanban actions to task workflow`
- `e6492c1 Add Trend Editorial OpenClaw agent`
- `f9ff4a5 Show OpenClaw agent aliases`
- `3db6ab0 Embed TechSouls OpenClaw agent map`

Estado funcional confirmado por arquivos e conversa:

- App Next.js com App Router, TypeScript, Tailwind, componentes estilo shadcn/ui, React Query, DnD Kit, Recharts, Zod e Prisma.
- Dockerfile de producao com `output: "standalone"` e workaround para Prisma 7 exigir `DATABASE_URL` no build.
- Deploy EasyPanel apontando para GitHub com caminho de build `/`.
- Auth simples por cookie/sessao com `/login`, `/api/auth/login`, `/api/auth/logout` e middleware protegendo paginas/APIs operacionais.
- PostgreSQL e Redis reais acessiveis em producao quando `DATABASE_URL` e `REDIS_URL` usam URLs internas do EasyPanel, nao URLs publicas de pgweb/Redis Commander.
- `/api/health` valida banco, Redis, ambiente, fallback mock e modo OpenClaw real.
- `/api/openclaw/status` conecta no Gateway real por WebSocket e executa RPC `status`.
- `/api/openclaw/sync-agents` sincroniza agentes descobertos pelo Gateway para o banco.
- Worker OpenClaw (`npm run worker:openclaw`) conecta de forma persistente no Gateway, faz probe de status periodico e persiste eventos/sessoes.
- O agente `Trend / Editorial Agent` foi modelado como agente canonico independente com slug `techsouls-trend-editorial`, mapeado para o agente externo OpenClaw `editorial`.
- `main` e tratado como agente default do OpenClaw e deve ficar ignorado por padrao para nao poluir a frota editorial.
- Kanban permite criar tarefas, mover cards, alterar prioridade, retry, cancelar, mandar para revisao e aprovar; as acoes agora chamam endpoints reais e registram auditoria.
- Atribuicao por status foi implementada: cada etapa do Kanban resolve o agente responsavel e reconcilia status/tarefa atual do agente.
- Botao "Sincronizar OpenClaw" e "Limpar demo data" existem em `/settings`.
- `POST /api/admin/clear-demo-data` remove apenas dados `dataSource="seed"` e preserva jobs reais OpenClaw/manuais.
- `applyOpenClawTaskUpdate` cria job novo se o Gateway/webhook reportar um `jobId` ainda inexistente.
- Sync OpenClaw le `sessions.byAgent` e `sessions.recent`, criando logs deduplicados por sessao/agente.

Validacoes executadas antes do ultimo push, segundo a conversa:

- `npm.cmd run test` passou.
- `npm.cmd run lint` passou.
- `npm.cmd run build` passou.

Nao confirmado apos este handoff:

- Se o EasyPanel ja redeployou o commit `2852f33`.
- Se os fixes de prioridade/status de agentes ja foram testados no navegador em producao apos redeploy.

## 3. Historico Narrativo do Desenvolvimento

O projeto comecou como um dashboard operacional completo para o sistema editorial multiagente TechSouls. A primeira versao implementou todas as telas solicitadas com dados mockados e seed inicial: dashboard, agentes, detalhe de agente, Kanban de tarefas, detalhe de tarefa, fila, revisao humana, auditoria e configuracoes.

Na fase local, o PostgreSQL ainda nao estava sempre disponivel, entao foi criado um fallback server-side em memoria para manter a UI utilizavel. Esse fallback continua existindo para desenvolvimento, mas a direcao atual de producao e `ALLOW_MOCK_FALLBACK=false`, com PostgreSQL/Redis reais via Docker/EasyPanel.

Depois, o projeto foi versionado no GitHub e preparado para EasyPanel. Foram adicionados Dockerfile, configuracao standalone do Next.js, health check, auth por secrets, rotas de login/logout e endpoints de diagnostico. Um problema inicial de build apareceu porque o Prisma 7 tentava resolver `DATABASE_URL` durante `prisma generate`; o Dockerfile passou a definir um placeholder nao roteavel apenas durante build/generate.

No EasyPanel, houve ajustes importantes de infraestrutura:

- `DATABASE_URL` nao pode apontar para a interface web do pgweb; deve usar conexao interna PostgreSQL.
- `REDIS_URL` nao pode apontar para Redis Commander; deve usar conexao interna Redis.
- O dashboard, Postgres, Redis e OpenClaw Gateway ficaram no mesmo projeto EasyPanel para permitir hostname interno estavel.
- O Gateway foi acessado por WebSocket interno, tipicamente `ws://techsouls_openclaw_openclaw-gateway:18789` ou hostname interno equivalente do EasyPanel.

A integracao OpenClaw teve alguns ciclos de ajuste:

- Primeiro, o Gateway respondeu `connect.challenge`, exigindo handshake.
- Depois, rejeitou parametros de conexao ate alinhar `OPENCLAW_CLIENT_MODE=backend`, protocolo e metadados.
- O comando ficticio `job_create` foi rejeitado como `unknown method`.
- Em seguida, o envio via `agent` tambem foi rejeitado por campos raiz fora do schema.
- A solucao atual encapsula a acao editorial dentro do RPC nativo `agent`, usando apenas campos aceitos: `agentId`, `sessionKey`, `idempotencyKey`, `message` e `deliver`.

Tambem houve um ajuste conceitual importante: `editorial` nao e o `main` nem o `editor-final`. Ele representa o agente independente "Trend / Editorial Agent" e deve aparecer separadamente no dashboard.

Por fim, bugs operacionais do Kanban e status dos agentes foram tratados:

- A criticidade/prioridade nao atualizava de forma confiavel.
- Cliques em botoes do card podiam ser afetados pelo drag-and-drop.
- Pausar/heartbeat podia "acordar" agentes indevidos por causa do sync OpenClaw atualizando todos os heartbeats/atividades.
- Agentes ficavam ocupados sem tarefa real ou disponiveis com tarefa ativa.

Esses pontos foram abordados com drag apenas por handle, invalidacao ampliada de queries, retorno completo do job nas APIs, reconciliacao centralizada em `src/lib/server/agent-state.ts` e derivacao de status a partir de jobs realmente ativos.

## 4. Arquitetura e Fluxo Principal

### Frontend

- `src/app/layout.tsx` define o layout raiz.
- `src/components/providers.tsx` configura tema, React Query e tooltips.
- `src/components/layout/app-shell.tsx`, `sidebar.tsx` e `header.tsx` compoem o shell operacional.
- Paginas App Router em `src/app/**/page.tsx` delegam para componentes client em `src/components/pages/**`.
- `src/lib/api/hooks.ts` concentra hooks React Query para dashboard, agentes, tarefas, fila, revisao, auditoria e OpenClaw.
- `src/lib/api/use-realtime.ts` abre `EventSource("/api/events")` e invalida queries em eventos recentes.
- `src/components/pages/tasks-page.tsx` implementa Kanban com DnD Kit, cards, botoes de acao e select de prioridade.
- `src/components/pages/settings-page.tsx` inclui operacoes administrativas: sincronizar OpenClaw, limpar demo data e abrir diagnostico.

### Backend Next.js

- Route handlers ficam em `src/app/api/**/route.ts`.
- APIs operacionais usam Prisma como fonte principal.
- `src/lib/server/api-error.ts` padroniza tratamento de erros de API.
- `src/lib/server/audit.ts` cria registros em `AgentLog`.
- `src/lib/server/tasks.ts` concentra transicoes de status, atribuicao de agente por etapa, review pendente, auditoria e dispatch OpenClaw.
- `src/lib/server/agent-state.ts` deriva `busy`, `idle`, `paused`, `offline` e `error` com base em jobs ativos e opcoes de reconciliacao.
- `src/lib/server/openclaw-events.ts` normaliza agentes/eventos OpenClaw, faz sync de agentes/sessoes, aplica updates de jobs e despacha comandos para o Gateway.

### Banco de dados

Prisma schema em `prisma/schema.prisma` define:

- `Agent`
- `ArticleJob`
- `AgentLog`
- `PayloadSnapshot`
- `Source`
- `HumanReview`
- `SystemSetting`

Enums principais:

- `AgentStatus`: `online`, `idle`, `busy`, `paused`, `offline`, `error`
- `JobStatus`: `new`, `researching`, `relevance_scoring`, `clustering`, `validating`, `writing`, `seo_optimizing`, `affiliate_routing`, `copywriting`, `editing`, `compliance_checking`, `publishing`, `drafted`, `published`, `human_review`, `discarded`, `failed`
- `JobPriority`: `low`, `normal`, `high`, `urgent`
- `LogSeverity`: `info`, `warning`, `error`, `critical`
- `ReviewStatus`: `pending`, `approved`, `rejected`, `returned_to_writer`, `returned_to_validator`
- `AuditEventType`: eventos editoriais, acoes manuais e eventos OpenClaw/webhook.

### OpenClaw

Integracao real MVP:

- Adapter em `src/lib/adapters/openclaw.ts`.
- Protocolo/handshake em `src/lib/adapters/openclaw-protocol.ts`.
- Normalizacao/eventos em `src/lib/server/openclaw-events.ts`.
- Worker persistente em `scripts/openclaw-worker.ts`.
- Contrato documentado em `docs/openclaw-event-contract.md`.

Fluxo de comandos:

1. Usuario cria/move/age sobre job no dashboard.
2. API atualiza PostgreSQL e cria audit log.
3. API chama `dispatchOpenClawCommand`.
4. Se for acao editorial, o comando usa RPC nativo `agent`.
5. O payload estruturado vai dentro de `message`.
6. Gateway aceita a execucao e retorna `runId` quando bem-sucedido.

Fluxo de sincronizacao:

1. Worker abre WebSocket no Gateway.
2. Recebe `connect.challenge`.
3. Responde com `connect` usando client metadata.
4. Envia RPC `status` periodicamente.
5. `handleOpenClawGatewayMessage` persiste agentes, sessoes e jobs detectados.
6. `/api/events` e React Query atualizam as telas.

## 5. Linguagens, Frameworks, Bibliotecas e Ferramentas

Confirmado por `package.json` e configs:

- TypeScript
- Next.js App Router
- React
- Tailwind CSS
- Componentes estilo shadcn/ui sobre Radix UI
- Lucide React
- Recharts
- React Query (`@tanstack/react-query`)
- Zustand
- Zod
- Prisma 7.8 com `@prisma/adapter-pg`
- PostgreSQL
- Redis
- DnD Kit
- Vitest
- ESLint 9
- Prettier
- `tsx`
- Docker / EasyPanel
- Node.js 22 Alpine no Dockerfile

Arquivos de configuracao relevantes:

- `package.json`
- `next.config.ts`
- `tailwind.config.ts`
- `tsconfig.json`
- `vitest.config.ts`
- `eslint.config.mjs`
- `prisma.config.ts`
- `Dockerfile`
- `docker-compose.yml`

## 6. Habilidades e Competencias Aplicadas

- Arquitetura full stack com Next.js App Router.
- Design de dashboards operacionais densos e responsivos.
- Modelagem de dados editorial/agentica com Prisma.
- Integracao WebSocket com Gateway externo.
- Normalizacao de eventos e payloads heterogeneos.
- Desenvolvimento de adapters para integracoes futuras.
- Auditoria operacional e logs estruturados.
- Estado de frontend com React Query e SSE.
- Kanban com drag-and-drop e acoes manuais.
- Deploy Docker em EasyPanel.
- Debug de build/runtime em producao.
- Hardening basico de auth/secrets.
- Handoff tecnico e documentacao de continuidade.

## 7. Mapa de Arquivos e Modulos Principais

### Raiz e deploy

- `README.md`: instrucoes resumidas de local/EasyPanel.
- `dashboard.md`: este handoff de continuidade.
- `.env.example`: variaveis esperadas com placeholders; nao contem valores reais.
- `Dockerfile`: build multi-stage para Next standalone e Prisma.
- `.dockerignore`: reduz contexto de build.
- `docker-compose.yml`: Postgres e Redis locais.
- `next.config.ts`: inclui `output: "standalone"`.
- `middleware.ts`: protege rotas operacionais e redireciona para login.

### Prisma e dados

- `prisma/schema.prisma`: modelos, enums e indices.
- `prisma/seed.ts`: seed inicial.
- `prisma/migrations/**`: migrations versionadas.
- `scripts/verify-seed.ts`: verifica quantidade/cobertura de seed.
- `src/lib/prisma.ts`: Prisma Client com adapter PostgreSQL.
- `src/lib/mock/seed-data.ts`: massa mock/seed compartilhada.
- `src/lib/server/mock-store.ts`: fallback em memoria quando habilitado.

### Dominio e validacao

- `src/lib/domain.ts`: labels, cores, colunas Kanban, status e metadados.
- `src/lib/types.ts`: tipos e DTOs compartilhados.
- `src/lib/validation/schemas.ts`: contratos Zod das APIs e webhooks.
- `src/lib/server/tasks.ts`: transicoes de job, review, atribuicao de agente e dispatch.
- `src/lib/server/agent-state.ts`: derivacao e reconciliacao do status de agentes.
- `src/lib/server/audit.ts`: criacao de logs/auditoria.

### OpenClaw

- `src/lib/adapters/openclaw.ts`: adapter real/mock para Gateway.
- `src/lib/adapters/openclaw-protocol.ts`: handshake, RPC, parsing e mensagens de erro.
- `src/lib/server/openclaw-events.ts`: mapa de agentes, sync, ingestao de jobs/sessoes e dispatch.
- `scripts/openclaw-worker.ts`: processo separado de sync em tempo real.
- `docs/openclaw-event-contract.md`: contrato esperado entre dashboard e Gateway.
- `src/app/api/openclaw/status/route.ts`: diagnostico RPC `status`.
- `src/app/api/openclaw/sync-agents/route.ts`: sync manual.
- `src/app/api/openclaw/test-job/route.ts`: cria job teste e envia ao Orchestrator.
- `src/app/api/openclaw/diagnostics/route.ts`: diagnostico agregado.

### APIs principais

- `src/app/api/health/route.ts`: health de app, banco, Redis e OpenClaw.
- `src/app/api/dashboard/route.ts`: metricas agregadas.
- `src/app/api/agents/**`: listar/detalhar/pausar/retomar/heartbeat/restart/clear errors.
- `src/app/api/tasks/**`: listar, criar, detalhar, status, retry, cancel, assign, priority.
- `src/app/api/review/**`: fluxos de revisao humana.
- `src/app/api/audit/route.ts`: logs filtraveis e criacao manual.
- `src/app/api/settings/route.ts`: settings operacionais.
- `src/app/api/events/route.ts`: SSE para frontend.
- `src/app/api/admin/clear-demo-data/route.ts`: limpeza segura de dados demo.
- `src/app/api/webhooks/openclaw/**`: ingestao por webhook.
- `src/app/api/webhooks/n8n/**` e `wordpress/**`: webhooks futuros/mockados.

### UI

- `src/components/layout/**`: shell, sidebar e header.
- `src/components/pages/dashboard-page.tsx`: KPIs, graficos e status OpenClaw.
- `src/components/pages/agents-page.tsx`: grade de agentes.
- `src/components/pages/agent-detail-page.tsx`: detalhe, logs, payloads e acoes.
- `src/components/pages/tasks-page.tsx`: Kanban e acoes dos cards.
- `src/components/pages/task-detail-page.tsx`: tabs de detalhe do job.
- `src/components/pages/queue-page.tsx`: fila.
- `src/components/pages/review-page.tsx`: revisao humana.
- `src/components/pages/audit-page.tsx`: auditoria.
- `src/components/pages/settings-page.tsx`: configuracoes e operacoes admin.
- `src/components/pages/openclaw-page.tsx`: diagnostico OpenClaw.

### Testes

- `src/lib/validation/schemas.test.ts`
- `src/lib/mock/seed-data.test.ts`
- `src/lib/adapters/openclaw-protocol.test.ts`
- `src/lib/server/openclaw-events.test.ts`
- `src/lib/auth/credentials.test.ts`

## 8. Comandos Uteis

Instalar dependencias localmente:

```powershell
npm.cmd install
```

Subir infraestrutura local:

```powershell
docker compose up -d
```

Preparar banco local:

```powershell
copy .env.example .env
npm.cmd run prisma:generate
npm.cmd run prisma:migrate -- --name init
npm.cmd run db:seed
npm.cmd run verify:seed
```

Rodar app local:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Rodar worker local, se as envs OpenClaw estiverem configuradas:

```powershell
npm.cmd run worker:openclaw
```

Verificacoes antes de commit/deploy:

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Comandos de banco em producao/EasyPanel:

```sh
npm run prisma:deploy
npm run db:seed
```

Worker no EasyPanel:

```sh
npm run worker:openclaw
```

Limpar dados demo via API:

```js
await fetch("/api/admin/clear-demo-data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "CLEAR_DEMO_DATA" })
}).then((r) => r.json())
```

Sincronizar OpenClaw via console do navegador, estando logado no dashboard:

```js
await fetch("/api/openclaw/sync-agents", { method: "POST" }).then((r) => r.json())
```

Tambem ha botao visual em `/settings`: "Sincronizar OpenClaw".

## 9. Decisoes Tecnicas Relevantes

- Prisma/PostgreSQL e a fonte principal de producao.
- `ALLOW_MOCK_FALLBACK=false` deve ser usado em producao para evitar mascarar falhas reais de banco/OpenClaw.
- Redis esta conectado para runtime/cache/realtime futuro; health check valida a porta TCP.
- Auth e simples e server-side: `ADMIN_USERNAME`, `ADMIN_PASSWORD` e `SESSION_SECRET`.
- O toggle mockado de admin deixou de ser a fonte real de permissao; usuario autenticado opera como admin inicial.
- Next.js usa route handlers como backend interno em vez de API separada.
- OpenClaw real usa WebSocket do Gateway e handshake baseado em challenge.
- Acoes editoriais usam o RPC nativo `agent`; nao usar `job_create` como metodo raiz sem o Gateway suportar explicitamente.
- `OPENCLAW_AGENT_MAP_JSON` complementa o mapa padrao, mas `editorial` sempre deve representar `techsouls-trend-editorial`, nao `techsouls-final-editor`.
- `OPENCLAW_IGNORED_AGENT_IDS=main` deve permanecer para esconder o agente default do Gateway.
- Status de agente deve ser derivado de trabalho ativo (`ArticleJob.assignedAgentId` + status em execucao), nao apenas do ultimo heartbeat.
- Paused/error/offline sao preservados salvo acoes explicitas (`resume`, `restart`, `clear-errors`, heartbeat com `wakeOffline` no agente-alvo).
- Jobs com status `new` sao atribuidos ao `techsouls-trend-editorial` quando ele existe; fallback para Orchestrator apenas se o agente ainda nao foi criado.
- `clear-demo-data` remove apenas registros de seed para nao apagar jobs reais.

Mapa OpenClaw recomendado em producao, sem segredos:

```env
OPENCLAW_AGENT_MAP_JSON={"techsouls-orchestrator":"orchestrator","techsouls-researcher":"researcher","techsouls-relevance-score":"relevance-classifier","techsouls-news-clustering":"dedup-cluster","techsouls-fact-check":"validator","techsouls-blog-writer":"writer","techsouls-seo":"seo-agent","techsouls-affiliate-router":"affiliate-agent","techsouls-copywriter":"copywriter","techsouls-final-editor":"editor-final","techsouls-compliance":"compliance-agent","techsouls-wordpress-publisher":"wp-publisher","techsouls-social":"social-agent","techsouls-analytics-cro":"analytics-cro","techsouls-audit-log":"audit-agent","techsouls-trend-editorial":"editorial"}
```

## 10. Problemas Conhecidos, Limitacoes e Riscos

- Nao confirmado: o EasyPanel ja esta rodando o commit `2852f33`; se nao, os fixes de Kanban/prioridade/status de agentes ainda nao aparecerao em producao.
- O worker precisa ser criado como segundo servico no EasyPanel, com o mesmo repositorio/build/envs e comando `npm run worker:openclaw`. Sem ele, a sincronizacao fica manual ou dependente de webhooks.
- A integracao OpenClaw depende do schema real do Gateway. O codigo atual foi ajustado ao comportamento observado: handshake challenge, RPC `status` e RPC `agent`.
- Os jobs reais dependem de eventos do OpenClaw conterem `jobId` e payloads parseaveis. Se o Orchestrator nao emitir updates estruturados, o dashboard so vera o job criado manualmente e logs de sessao.
- Redis ainda nao e usado como fila BullMQ ou pub/sub robusto; ele e validado e preparado, mas o realtime atual ainda e baseado em polling/eventos recentes.
- Os webhooks N8N/WordPress continuam preparados/mockados; nao ha publicacao real WordPress nesta etapa.
- Auth e simples; nao ha RBAC multiusuario completo.
- As credenciais reais ficam no EasyPanel. O repo nao deve receber `.env` com secrets.
- O erro de console `webpage_content_reporter.js Cannot use import statement outside a module` observado no navegador parece vir de extensao/injecao do browser, nao do app.
- `npm audit` ja havia indicado vulnerabilidades moderadas em dependencias; nao foi aplicado `npm audit fix --force` para evitar breaking changes sem revisao.
- Testes ainda nao cobrem e2e no navegador, drag-and-drop real, fluxo completo EasyPanel ou carga do worker em longa duracao.

## 11. Proximos Passos Recomendados

1. Confirmar que o EasyPanel redeployou `main` no commit `2852f33` ou superior.
2. Reiniciar o servico web e testar `/api/health`, `/api/openclaw/status` e `/settings`.
3. Criar/validar o segundo servico EasyPanel do worker com comando `npm run worker:openclaw`.
4. Verificar no banco se existe o agente `techsouls-trend-editorial` e se `externalId="editorial"`.
5. Clicar em "Sincronizar OpenClaw" em `/settings` e confirmar `updated`, `discovered`, `sessionsDiscovered` e `activitiesRecorded`.
6. Usar "Limpar demo data" em `/settings` para remover dados seed depois de confirmar que jobs OpenClaw reais aparecem.
7. Criar um job teste em `/openclaw` ou pelo endpoint de test job e confirmar que o Gateway retorna `accepted`.
8. Fazer o Orchestrator emitir updates estruturados para `/api/webhooks/openclaw/task-update` ou pelo canal/evento que o worker consiga ler.
9. Testar no Kanban: alterar prioridade, retry, cancelar, enviar para revisao e aprovar; verificar `Audit` apos cada acao.
10. Testar em `/agents`: pause/resume/heartbeat em um unico agente e confirmar que os outros nao mudam indevidamente.
11. Adicionar testes de route handlers para `priority`, `status`, `assign`, `sync-agents` e `clear-demo-data`.
12. Adicionar teste Playwright/smoke para login, dashboard, Kanban e Settings em producao/staging.
13. Evoluir Redis para pub/sub ou fila real se o volume de eventos OpenClaw crescer.
14. Definir contrato final de eventos do Orchestrator para criar/atualizar jobs com artigo, fontes, scores e logs por etapa.

## 12. Contexto Essencial para Outra IA Continuar

Antes de editar, rode:

```powershell
git status --short
npm.cmd run test
npm.cmd run lint
```

Se tocar em build/deploy, rode tambem:

```powershell
npm.cmd run build
```

Preserve estes padroes:

- Nunca colocar secrets reais no repo.
- Usar `.env.example` apenas com placeholders.
- Nao voltar a usar URL publica de pgweb/Redis Commander em `DATABASE_URL`/`REDIS_URL`.
- Nao mapear `editorial` para `techsouls-final-editor`.
- Nao remover `techsouls-trend-editorial`.
- Nao transformar `main` em agente editorial visivel sem decisao explicita.
- Toda acao manual relevante deve criar `AgentLog`.
- Toda entrada externa deve ser validada com Zod ou normalizada defensivamente.
- Status de agente deve passar por `agent-state.ts` sempre que possivel.
- Status de job deve passar por `updateJobStatus` quando a mudanca vem do dashboard.
- Jobs OpenClaw reais devem ter `dataSource="openclaw"`.
- Dados seed/demo devem ter `dataSource="seed"` para permitir limpeza segura.

Para diagnosticar problemas de OpenClaw:

1. Comece por `/api/health`.
2. Depois verifique `/api/openclaw/status`.
3. Confira envs `OPENCLAW_*` no EasyPanel.
4. Abra `/openclaw` e rode diagnostico/sync.
5. Verifique logs do servico worker.
6. Inspecione `AgentLog` em `/audit`.

Para diagnosticar problemas de Kanban:

1. Verifique `src/components/pages/tasks-page.tsx`.
2. Verifique `src/lib/api/hooks.ts` e invalidacoes.
3. Verifique endpoint especifico em `src/app/api/tasks/[jobId]/**`.
4. Verifique `src/lib/server/tasks.ts`.
5. Verifique `src/lib/server/agent-state.ts`.

Para diagnosticar status errado de agente:

1. Confirme se ha jobs ativos com `assignedAgentId`.
2. Confirme se o status do job esta em uma etapa considerada em execucao.
3. Rode sync OpenClaw.
4. Confira se `paused`, `error` ou `offline` esta sendo preservado intencionalmente.
5. Reconcile deve afetar apenas o agente anterior e o novo agente do job.

## 13. Informacoes Redigidas ou Omitidas por Seguranca

Valores reais foram omitidos. Variaveis/segredos relevantes:

- `DATABASE_URL=[REDACTED]`
- `REDIS_URL=[REDACTED]`
- `ADMIN_USERNAME=[REDACTED]`
- `ADMIN_PASSWORD=[REDACTED]`
- `SESSION_SECRET=[REDACTED]`
- `OPENCLAW_GATEWAY_TOKEN=[REDACTED]`
- `OPENCLAW_WEBHOOK_SECRET=[REDACTED]`
- `OPENCLAW_GATEWAY_WS_URL` pode revelar topologia interna; usar apenas hostname interno do EasyPanel no ambiente real.
- Senhas de Postgres/Redis exibidas pelo EasyPanel nao foram copiadas para este documento.

Formato correto, sem valores reais:

```env
DATABASE_URL=postgresql://<usuario>:[REDACTED]@<host-interno-postgres>:5432/<database>?schema=public
REDIS_URL=redis://<usuario-opcional>:[REDACTED]@<host-interno-redis>:6379
```

Se Redis nao tiver usuario/senha:

```env
REDIS_URL=redis://<host-interno-redis>:6379
```

## 14. Lacunas, Inferencias e Pontos Nao Confirmados

- Nao confirmado: o estado exato do banco em producao apos o ultimo redeploy.
- Nao confirmado: se o servico worker ja foi criado no EasyPanel e esta rodando continuamente.
- Nao confirmado: se os jobs reais do Orchestrator ja emitem payloads com `jobId`, scores, artigo e fontes.
- Nao confirmado: se o dominio final `openclaw.techsouls.com.br` ja aponta para o dashboard; durante a conversa tambem foram usadas URLs `pfjhhr.easypanel.host`.
- Inferencia: o hostname interno atual do Gateway segue o padrao do EasyPanel no projeto `techsouls_openclaw`; confirmar sempre na tela de credenciais/rede do servico.
- Inferencia: o agente `main` deve continuar ignorado porque e default/control plane, nao agente editorial TechSouls.
- Inferencia: Redis sera usado futuramente para realtime/cache/fila mais robustos, mas hoje a principal persistencia operacional esta no PostgreSQL.
- Inferencia: os ajustes do commit `2852f33` corrigem os bugs reportados de prioridade e status de agentes; ainda precisam de validacao final no ambiente EasyPanel apos deploy.
