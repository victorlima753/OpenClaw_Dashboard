# Handoff de Desenvolvimento - TechSouls Command Center

_Gerado em: 17/05/2026_

## 1. Objetivo da Aplicação

O TechSouls Command Center é um painel operacional full stack para monitorar e controlar um pipeline editorial multiagente do blog brasileiro TechSouls. A aplicação foi criada para operadores humanos acompanharem agentes, filas, jobs editoriais, revisão humana, logs, payloads JSON, status do workflow e ações manuais como retry, pause, resume, cancelamento, aprovação, rejeição e retorno para etapas anteriores.

O objetivo da V1 é entregar uma superfície navegável e evolutiva, sem integrações reais com OpenClaw, N8N, Inoreader ou WordPress. A arquitetura já reserva pontos de extensão para essas integrações, mas usa seed/mock data e fallback em memória para permitir desenvolvimento mesmo sem PostgreSQL local.

## 2. Estado Atual do Desenvolvimento

A aplicação Next.js foi implementada do zero no repositório. O app possui shell com sidebar fixa, header, busca global visual, tema claro/escuro, toggle mockado de operador/admin, pages principais e route handlers REST/SSE.

Funciona hoje:

- `/dashboard`: métricas, gráficos, atividades recentes e alertas críticos.
- `/agents` e `/agents/[agentId]`: cards de agentes, detalhes, histórico, logs, payloads e ações mockadas.
- `/tasks` e `/tasks/[jobId]`: Kanban, drag-and-drop admin-only, detalhes com abas, payloads, fontes, artigo e ações.
- `/queue`: fila operacional com retry, cancelamento e promoção de prioridade.
- `/review`: revisão humana com aprovar, rejeitar, salvar rascunho, devolver ao Writer e devolver ao Validator.
- `/audit`: logs filtráveis e payload JSON expansível.
- `/settings`: configurações operacionais mockadas.
- `GET /api/events`: SSE simulado para invalidar queries e demonstrar realtime.
- Webhooks futuros para OpenClaw, N8N e WordPress, aceitando payloads validados e registrando auditoria.
- Fallback automático para `src/lib/server/mock-store.ts` quando o Prisma não consegue conectar ao PostgreSQL (`ECONNREFUSED`).

Validações já executadas com sucesso durante o desenvolvimento:

- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run test`
- `npm.cmd run verify:seed`
- `npm.cmd run prisma:generate`

Estado de runtime observado na última sessão: o app respondeu em `http://127.0.0.1:3000/dashboard`; os endpoints principais retornaram `200` com header `x-techsouls-data-source: mock` porque o PostgreSQL não estava disponível.

## 3. Histórico Narrativo do Desenvolvimento

O pedido original era construir uma aplicação web completa para o painel operacional do sistema multiagente TechSouls, com Next.js, TypeScript, Tailwind, shadcn/ui, Prisma, PostgreSQL, Redis, SSE/WebSocket, Zod e Recharts. Como o repositório estava vazio exceto por `.git`, a implementação seguiu como projeto novo.

Primeiro foi definido um plano de MVP completo: todas as páginas, APIs mockadas, seed, Prisma schema e arquitetura pronta para integrações futuras. As decisões principais foram: UI em PT-BR, rotas/APIs em inglês, tema claro/escuro desde a V1, admin mockado por toggle no header, realtime por SSE e PostgreSQL como banco principal.

Durante a implementação, o Prisma instalado era versão 7.8.0. Isso exigiu adaptar a configuração para `prisma.config.ts` e usar `@prisma/adapter-pg`, porque o campo `url` no datasource do `schema.prisma` não é mais usado no mesmo formato antigo.

Depois de subir o servidor, foi identificado que os endpoints retornavam `500` quando o PostgreSQL não estava rodando. Como o ambiente local não tinha Docker no PATH, foi adicionado um fallback server-side em memória (`mock-store`) baseado nos mesmos seeds. Assim, o painel fica utilizável imediatamente e ainda preserva Prisma/PostgreSQL como caminho principal quando o banco estiver disponível.

## 4. Arquitetura e Fluxo Principal

Fluxo de frontend:

- `src/app/layout.tsx` aplica providers globais e o `AppShell`.
- `src/components/layout/app-shell.tsx` renderiza sidebar, header e conteúdo principal.
- `src/components/providers.tsx` configura `next-themes`, React Query e TooltipProvider.
- Páginas em `src/app/*/page.tsx` delegam para componentes client em `src/components/pages/*`.
- Hooks em `src/lib/api/hooks.ts` encapsulam React Query para dashboard, agents, tasks, queue, review e audit.
- `src/lib/api/use-realtime.ts` abre `EventSource("/api/events")` e invalida queries em eventos de status, task, audit e erro crítico.

Fluxo de backend:

- Route handlers ficam em `src/app/api/**/route.ts`.
- Cada rota tenta Prisma primeiro.
- Se Prisma falhar por indisponibilidade de banco, a rota usa `mockStore` e retorna header `x-techsouls-data-source: mock`.
- Ações manuais persistem audit log via Prisma quando há banco ou via `mockStore.audit()` no fallback.
- `src/lib/validation/schemas.ts` concentra validação Zod para criação de tarefa, mudança de status, prioridade, auditoria, webhooks e settings.

Fluxo de dados:

- Prisma schema define `Agent`, `ArticleJob`, `AgentLog`, `PayloadSnapshot`, `Source`, `HumanReview` e `SystemSetting`.
- `prisma/seed.ts` popula PostgreSQL com agentes, tarefas, logs, payloads, fontes, revisões e settings.
- `src/lib/mock/seed-data.ts` é a fonte comum dos dados mockados e também alimenta `mockStore`.
- `src/lib/domain.ts` define labels, status metadata, cores e colunas do Kanban.

Integrações futuras:

- `src/lib/adapters/types.ts` define contratos para OpenClaw, N8N, WordPress, Queue e Realtime.
- `src/lib/adapters/mock.ts` implementa adapters mockados.
- Webhooks em `src/app/api/webhooks/**` aceitam eventos, chamam adapters mockados e criam audit logs.

## 5. Linguagens, Frameworks, Bibliotecas e Ferramentas

Stack confirmada por `package.json` e arquivos de configuração:

- TypeScript
- Next.js App Router
- React
- Tailwind CSS
- Componentes estilo shadcn/ui implementados localmente sobre Radix UI
- Lucide React
- Recharts
- React Query (`@tanstack/react-query`)
- Zustand para estado local do modo admin
- Zod para validação
- Prisma 7 + `@prisma/adapter-pg`
- PostgreSQL via Docker Compose
- Redis preparado no Docker Compose, ainda sem integração real de fila
- DnD Kit para Kanban drag-and-drop
- Vitest para testes
- ESLint 9 + `eslint-config-next`
- Prettier
- `tsx` para scripts TypeScript

Ferramentas/ambiente:

- Node.js foi usado via `npm.cmd` no Windows.
- Docker Compose está configurado, mas Docker não estava disponível no PATH na última sessão.
- Prisma usa `prisma.config.ts`; não recolocar `url = env("DATABASE_URL")` em `schema.prisma` sem verificar compatibilidade da versão.

## 6. Habilidades e Competências Aplicadas

Foram aplicadas competências de:

- Arquitetura full stack com Next.js App Router.
- Design de dashboard operacional denso, responsivo e orientado a ação.
- Modelagem de dados Prisma/PostgreSQL.
- Design de APIs REST internas.
- Mock architecture para substituir integrações externas sem bloquear desenvolvimento.
- Fallback resiliente quando banco não está disponível.
- UI com estado client-side, React Query, SSE e invalidação de cache.
- Kanban com drag-and-drop e controle de permissão admin mockado.
- Validação de contratos com Zod.
- Testes de seed e schemas com Vitest.
- Documentação e handoff técnico.

## 7. Mapa de Arquivos e Módulos Principais

Arquivos de projeto e configuração:

- `package.json`: scripts, dependências e configuração de seed Prisma.
- `README.md`: instruções básicas de instalação e execução.
- `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`: configuração do app Next/Tailwind/TypeScript.
- `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`: lint, formatação e testes.
- `docker-compose.yml`: serviços PostgreSQL e Redis para desenvolvimento local.
- `.env.example`: variáveis esperadas. Valores reais devem ser redigidos.
- `prisma.config.ts`: configuração Prisma 7 com datasource via `DATABASE_URL`.

Banco e dados:

- `prisma/schema.prisma`: schema relacional e enums principais.
- `prisma/seed.ts`: seed para PostgreSQL.
- `scripts/verify-seed.ts`: checa mínimos de seed sem depender do banco.
- `src/lib/mock/seed-data.ts`: dados mockados compartilhados por seed e fallback.
- `src/lib/server/mock-store.ts`: store em memória usado quando PostgreSQL está indisponível.

Domínio, validação e infraestrutura:

- `src/lib/domain.ts`: metadados de status, labels, prioridades e colunas Kanban.
- `src/lib/types.ts`: DTOs e tipos compartilhados entre UI e APIs.
- `src/lib/validation/schemas.ts`: contratos Zod das APIs.
- `src/lib/prisma.ts`: Prisma Client com adapter PostgreSQL.
- `src/lib/server/audit.ts`: helper de audit log.
- `src/lib/server/tasks.ts`: helpers de status/stage e includes de job.
- `src/lib/adapters/types.ts` e `src/lib/adapters/mock.ts`: contratos e implementações mockadas para integrações futuras.

Frontend:

- `src/app/layout.tsx`: layout raiz.
- `src/app/globals.css`: tokens de tema claro/escuro e estilos globais.
- `src/components/layout/*`: shell, sidebar e header.
- `src/components/ui/*`: componentes base locais.
- `src/components/common/*`: status badges, JSON viewer e empty state.
- `src/components/pages/*`: páginas client de dashboard, agentes, tarefas, fila, revisão, auditoria e settings.
- `src/lib/api/hooks.ts`: hooks React Query.
- `src/lib/api/use-realtime.ts`: SSE client.
- `src/lib/store/admin-store.ts`: estado persistido do modo admin.

APIs:

- `src/app/api/dashboard/route.ts`: métricas agregadas.
- `src/app/api/agents/**`: listagem, detalhe e ações de agentes.
- `src/app/api/tasks/**`: listagem, detalhe e ações de jobs.
- `src/app/api/queue/route.ts`: fila operacional.
- `src/app/api/review/**`: revisão humana e decisões.
- `src/app/api/audit/route.ts`: logs e criação manual de audit events.
- `src/app/api/settings/route.ts`: leitura e atualização de settings.
- `src/app/api/events/route.ts`: SSE mockado.
- `src/app/api/webhooks/**`: endpoints futuros para OpenClaw, N8N e WordPress.
- `src/app/favicon.ico/route.ts` e `src/app/icon.svg`: ícones para evitar 404 de favicon.

Testes:

- `src/lib/mock/seed-data.test.ts`: mínimos do seed e cobertura de colunas Kanban.
- `src/lib/validation/schemas.test.ts`: contratos principais de validação.

## 8. Comandos Úteis

Instalar dependências:

```powershell
npm.cmd install
```

Subir infraestrutura local, quando Docker estiver disponível:

```powershell
docker compose up -d
```

Preparar Prisma/PostgreSQL:

```powershell
copy .env.example .env
npm.cmd run prisma:generate
npm.cmd run prisma:migrate -- --name init
npm.cmd run db:seed
```

Rodar desenvolvimento:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Verificações:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test
npm.cmd run verify:seed
```

Formatar:

```powershell
npm.cmd run format
```

Observação Windows: se `npm` for bloqueado por política de execução do PowerShell, usar `npm.cmd`.

## 9. Decisões Técnicas Relevantes

- O MVP usa Next.js App Router com route handlers em vez de um backend separado.
- Prisma/PostgreSQL é a fonte principal planejada, mas há fallback mock server-side para manter a UI utilizável sem banco local.
- Realtime usa SSE mockado, não WebSocket. Isso é suficiente para status, logs e atualizações unidirecionais do painel.
- O modo admin é um toggle local com Zustand, não autenticação real.
- O Kanban permite drag-and-drop apenas quando `isAdmin` está ativo.
- As integrações OpenClaw, N8N e WordPress foram representadas por adapters e webhooks mockados, sem chamadas externas reais.
- UI em PT-BR, rotas e APIs em inglês.
- A V1 prioriza ergonomia operacional e densidade legível, não estética de landing page.
- Prisma 7 exige `prisma.config.ts` e adapter; preservar esse padrão.
- Valores de `.env.example` existem apenas como exemplo/mock e não devem virar credenciais reais no frontend.

## 10. Problemas Conhecidos, Limitações e Riscos

- Não há autenticação real. O toggle admin é apenas conveniência de desenvolvimento.
- O fallback mock em memória não persiste entre reinícios do servidor.
- Redis está no `docker-compose.yml`, mas não há implementação real de fila Redis.
- Docker não estava disponível no PATH na última sessão; sem Docker/PostgreSQL, o app roda em modo mock.
- Os webhooks apenas validam e registram eventos; não integram de verdade com OpenClaw, N8N ou WordPress.
- O SSE é simulado e encerra stream após 60 segundos por implementação atual.
- Os testes cobrem seed e schemas, mas ainda não cobrem UI, drag-and-drop, route handlers reais com banco, nem fluxos e2e.
- Algumas strings antigas geradas no seed/mock podem apresentar encoding estranho se o terminal ler arquivos com codificação incorreta; revisar copy PT-BR antes de produção.
- `npm install` reportou vulnerabilidades moderadas em dependências. Não foi executado `npm audit fix --force` para evitar breaking changes sem revisão.
- Não há migrations versionadas confirmadas no repo; `prisma/migrations` deve ser gerado quando o banco local estiver disponível.

## 11. Próximos Passos Recomendados

1. Ativar Docker/PostgreSQL local e rodar migration + seed para validar o caminho Prisma real.
2. Adicionar testes de route handlers com banco de teste ou camada mockada controlada.
3. Adicionar testes de UI com Playwright ou Testing Library para navegação principal, modo admin e ações.
4. Implementar autenticação real e RBAC antes de qualquer uso multiusuário.
5. Substituir o mock de fila por Redis/BullMQ ou adapter equivalente.
6. Definir contrato real com OpenClaw para eventos de agente e updates de tarefa.
7. Implementar persistência segura de settings sensíveis no backend, sem expor credenciais no cliente.
8. Melhorar observabilidade: health check de banco, banner de fonte de dados (`mock` vs `database`) e logs estruturados.
9. Revisar visual mobile e estados vazios/carregamento com screenshots.
10. Criar migrations iniciais versionadas após confirmar ambiente PostgreSQL.

## 12. Contexto Essencial para Outra IA Continuar

Antes de editar, rode:

```powershell
npm.cmd run lint
npm.cmd run test
```

Se o objetivo envolver banco, primeiro confirme Docker/PostgreSQL:

```powershell
docker compose up -d
npm.cmd run prisma:migrate -- --name init
npm.cmd run db:seed
```

Preserve estes padrões:

- Route handlers devem tentar Prisma primeiro e usar `mockStore` somente quando o banco estiver indisponível.
- Toda ação manual relevante deve criar audit log.
- Status, labels e colunas devem passar por `src/lib/domain.ts`.
- Payloads externos devem ser validados com Zod antes de qualquer processamento.
- Não inserir credenciais reais em arquivos client-side.
- Não trocar o modo admin mockado por autenticação parcial sem desenhar a política de permissão.
- Não remover `mockStore` enquanto o ambiente local ainda puder não ter PostgreSQL.

Para investigar bugs no frontend, comece pelos hooks em `src/lib/api/hooks.ts`, depois pela página em `src/components/pages/*`, e só então pela route handler correspondente em `src/app/api/**`.

Para investigar bugs de dados, compare:

- `src/lib/mock/seed-data.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/lib/server/mock-store.ts`

## 13. Informações Redigidas ou Omitidas por Segurança

Foram omitidos ou redigidos valores sensíveis e credenciais. Variáveis relevantes existem em `.env.example`, mas seus valores devem ser tratados como placeholders:

- `DATABASE_URL=[REDACTED]`
- `MOCK_API_KEY=[REDACTED]`
- `N8N_WEBHOOK_URL=[REDACTED]`
- `OPENCLAW_ORCHESTRATOR_URL=[REDACTED]`
- `WORDPRESS_ENDPOINT=[REDACTED]`

O `docker-compose.yml` contém credenciais locais simples para desenvolvimento. Não usar esses valores em produção.

## 14. Lacunas, Inferências e Pontos Não Confirmados

- Não confirmado: ambiente Docker funcional na máquina do usuário. Na sessão observada, `docker` não estava disponível no PATH.
- Não confirmado: execução completa de migrations contra PostgreSQL real.
- Não confirmado: comportamento em produção/deploy, pois só foram executados build e dev local.
- Inferência: o pipeline OpenClaw real enviará eventos compatíveis com os webhooks planejados, mas os contratos finais ainda precisam ser definidos.
- Inferência: Redis será usado para fila/cache futuramente, pois está no plano e no Docker Compose, mas ainda não há código que consuma Redis.
- Não confirmado: política real de autenticação, auditoria regulatória e permissões de publicação automática.
- Não confirmado: requisitos finais de design visual da marca TechSouls além do painel operacional claro/escuro.
