# TechSouls Command Center - Fechamento de Produção

## Secrets obrigatórios

Configure no EasyPanel do app web e, quando aplicável, nos serviços que chamam os webhooks:

```env
SESSION_SECRET=<minimo-32-caracteres>
ADMIN_USERNAME=<email-ou-admin>
ADMIN_PASSWORD=<senha-inicial-forte>
OPENCLAW_WEBHOOK_SECRET=<secret-compartilhado-openclaw>
N8N_WEBHOOK_SECRET=<secret-compartilhado-n8n>
WORDPRESS_WEBHOOK_SECRET=<secret-compartilhado-wordpress>
INOREADER_WEBHOOK_SECRET=<secret-compartilhado-inoreader-ou-openclaw>
ALERT_WEBHOOK_URL=<opcional-url-generica-para-alertas>
```

O primeiro `db:seed` cria um usuário admin inicial a partir de `ADMIN_USERNAME` e `ADMIN_PASSWORD`. Depois disso, gerencie usuários em **Settings -> Usuarios e permissoes**.

## RBAC

- `admin`: configurações, usuários, agentes, ações de jobs, revisão humana, limpar demo data e reconhecer alertas.
- `editor`: ações de jobs, revisão humana e reconhecer alertas.
- `viewer`: somente leitura.

As permissões são aplicadas no middleware das APIs, não apenas na interface.

## Webhooks finais

Todos usam `Authorization: Bearer <SECRET>`, `Content-Type: application/json` e `idempotencyKey`.

### N8N affiliate-result

`POST /api/webhooks/n8n/affiliate-result`

```json
{
  "jobId": "ts-openclaw-2026-05-19-0001",
  "idempotencyKey": "n8n:affiliate:ts-openclaw-2026-05-19-0001:1",
  "status": "accepted",
  "payload": {
    "hasAffiliate": true,
    "monetizationScore": 84,
    "affiliateProvider": "amazon",
    "affiliateUrl": "https://example.com/produto",
    "decision": "affiliate_link_selected"
  }
}
```

### WordPress publish-result

`POST /api/webhooks/wordpress/publish-result`

```json
{
  "jobId": "ts-openclaw-2026-05-19-0001",
  "idempotencyKey": "wordpress:publish:ts-openclaw-2026-05-19-0001:1",
  "status": "published",
  "payload": {
    "wordpressPostId": "12345",
    "wordpressPreviewUrl": "https://techsouls.com.br/post"
  }
}
```

### Inoreader item

`POST /api/webhooks/inoreader/item`

```json
{
  "jobId": "ts-inoreader-2026-05-19-0001",
  "idempotencyKey": "inoreader:item:ts-inoreader-2026-05-19-0001:1",
  "payload": {
    "title": "Nova pauta de IA",
    "topic": "IA",
    "category": "Inteligencia Artificial",
    "sourceName": "Inoreader",
    "sourceUrl": "https://example.com/noticia",
    "relevanceHint": 77
  }
}
```

## Alertas

O dashboard cria `SystemAlert` para payload inválido, falha de publicação, falha de afiliado e outros eventos críticos. Se `ALERT_WEBHOOK_URL` estiver configurado, cada alerta também é enviado por POST genérico.

## Backup recomendado no EasyPanel

1. Ative backup/snapshot do serviço Postgres no EasyPanel.
2. Antes de migrations em produção, gere um backup manual.
3. Depois do deploy, rode:

```bash
npm run prisma:deploy
npm run db:seed
```

4. Valide:

```text
/api/health
/api/openclaw/diagnostics
/api/alerts
```

## Checklist final

- Worker `npm run worker:openclaw` rodando como serviço separado.
- `ALLOW_MOCK_FALLBACK=false` em produção.
- Secrets dos webhooks configurados.
- Usuário admin inicial criado.
- Agentes OpenClaw emitindo `TechSoulsJobUpdate v1`.
- N8N e WordPress chamando os webhooks finais com idempotência.
- Dashboard sem dados demo após usar “Limpar demo data”.
