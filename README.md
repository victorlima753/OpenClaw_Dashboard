# OpenClaw Dashboard

Ambiente de gestao dos agentes de IA da TechSouls.

## TechSouls Command Center

Painel operacional full stack para monitorar o pipeline multiagente editorial do blog TechSouls.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS + componentes no estilo shadcn/ui
- Prisma + PostgreSQL
- Redis pronto via Docker Compose
- SSE mockado para eventos em tempo real
- Zod, Recharts, Zustand e React Query

## Rodando localmente

```powershell
copy .env.example .env
docker compose up -d
npm.cmd install
npm.cmd run prisma:migrate -- --name init
npm.cmd run db:seed
npm.cmd run dev
```

Se o PowerShell bloquear `npm`, use `npm.cmd`, como nos scripts acima.
Em desenvolvimento, se `ADMIN_USERNAME` e `ADMIN_PASSWORD` não estiverem no `.env`, o login padrão é `admin` / `admin`.

## Produção no EasyPanel

Crie o app `techsouls-command-center` no projeto EasyPanel `techsouls_openclaw`, usando este repositório como source e o `Dockerfile` da raiz. Aponte o domínio público `openclaw.techsouls.com.br` para o dashboard.

Secrets mínimos:

- `DATABASE_URL`
- `REDIS_URL`
- `PUBLIC_APP_URL=https://openclaw.techsouls.com.br`
- `ALLOW_MOCK_FALLBACK=false`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `OPENCLAW_GATEWAY_WS_URL`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_AUTH_MODE=query`
- `OPENCLAW_PROTOCOL_VERSION=4`
- `OPENCLAW_MIN_PROTOCOL_VERSION=3`
- `OPENCLAW_OPERATOR_SCOPES=operator.read,operator.write,operator.admin,operator.approvals`
- `OPENCLAW_CLIENT_ID=gateway-client`
- `OPENCLAW_CLIENT_MODE=backend`
- `OPENCLAW_WEBHOOK_SECRET`
- `OPENCLAW_AGENT_MAP_JSON`

No EasyPanel, `ADMIN_USERNAME` e `ADMIN_PASSWORD` podem ser preenchidos com ou sem aspas. O app normaliza aspas externas e espaços acidentais para evitar erro de login quando o valor é copiado do `.env.example`.

Comandos de release:

```sh
npm run prisma:deploy
npm run db:seed
```

Crie também um segundo serviço no EasyPanel para o worker realtime com o mesmo build/envs e comando:

```sh
npm run worker:openclaw
```
