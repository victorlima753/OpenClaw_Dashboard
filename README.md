# TechSouls Command Center

Painel operacional full stack para monitorar o pipeline multiagente do blog TechSouls.

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
