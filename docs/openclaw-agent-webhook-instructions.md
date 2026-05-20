# OpenClaw Agent Webhook Instructions

Este documento e o guia operacional para configurar os agentes reais do OpenClaw a enviarem eventos estruturados para o TechSouls Command Center.

## Endpoint

```http
POST https://openclaw.techsouls.com.br/api/webhooks/openclaw/task-update
Authorization: Bearer [OPENCLAW_WEBHOOK_SECRET]
Content-Type: application/json
```

Use a URL publica real do dashboard em producao. O valor de `OPENCLAW_WEBHOOK_SECRET` deve ficar apenas no EasyPanel/OpenClaw como secret de ambiente.

## Contrato TechSoulsJobUpdate v1

Todo agente deve enviar este formato quando concluir uma etapa do job editorial:

```json
{
  "event": "article_written",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "writer",
  "status": "seo_optimizing",
  "completedStage": "writing",
  "idempotencyKey": "writer:ts-openclaw-2026-05-18-0001:article_written:1",
  "timestamp": "2026-05-18T12:00:00.000Z",
  "severity": "info",
  "payload": {
    "title": "Titulo da pauta",
    "topic": "Topico",
    "category": "IA",
    "sourceName": "Fonte principal",
    "sourceUrl": "https://example.com",
    "articleMarkdown": "...",
    "scores": {
      "relevance": 91,
      "validation": 88,
      "seo": 82,
      "compliance": 94
    },
    "sources": [
      {
        "name": "Fonte",
        "url": "https://example.com",
        "role": "primary",
        "reliabilityScore": 85
      }
    ],
    "inputPayload": {},
    "outputPayload": {},
    "errors": []
  }
}
```

Regras:

- `jobId` e obrigatorio e deve ser o mesmo durante todo o pipeline.
- `status` e o proximo estado atual do Kanban depois que a etapa terminou.
- `completedStage` e a etapa que acabou de ser concluida.
- `idempotencyKey` deve ser estavel por tentativa para evitar duplicidade.
- Use `agentExternalId`, nao o nome visual do dashboard.
- Quando houver falha, use `status="failed"` e `severity="error"`.
- Quando precisar de humano, use `status="human_review"` e `payload.requiresHumanReview=true`.

## Mapa de agentes e eventos

| Agente OpenClaw | Evento sugerido | completedStage | Proximo status |
| --- | --- | --- | --- |
| `editorial` | `job_created` | `new` | `researching` |
| `researcher` | `research_completed` | `researching` | `relevance_scoring` |
| `relevance-classifier` | `relevance_scored` | `relevance_scoring` | `clustering` |
| `dedup-cluster` | `cluster_completed` | `clustering` | `validating` |
| `validator` | `validation_completed` | `validating` | `writing` |
| `writer` | `article_written` | `writing` | `seo_optimizing` |
| `seo-agent` | `seo_completed` | `seo_optimizing` | `affiliate_routing` |
| `affiliate-agent` | `affiliate_decided` | `affiliate_routing` | `copywriting` |
| `copywriter` | `copy_completed` | `copywriting` | `editing` |
| `editor-final` | `editorial_completed` | `editing` | `compliance_checking` |
| `compliance-agent` | `compliance_completed` | `compliance_checking` | `publishing` ou `human_review` |
| `wp-publisher` | `published` ou `drafted` | `publishing` | `published` ou `drafted` |
| `social-agent` | `social_completed` | `published` | `published` |
| `analytics-cro` | `analytics_completed` | `published` | `published` |
| `audit-agent` | `audit_completed` | qualquer etapa | status atual |

## Snippet base para colar nos agentes

Adapte `agentExternalId`, `event`, `completedStage`, `status` e `payload` em cada agente.

```text
Ao concluir sua etapa no pipeline TechSouls, envie um HTTP POST para:

https://openclaw.techsouls.com.br/api/webhooks/openclaw/task-update

Headers:
Authorization: Bearer ${OPENCLAW_WEBHOOK_SECRET}
Content-Type: application/json

Body JSON:
{
  "event": "<event_name>",
  "jobId": "<jobId recebido do Orchestrator>",
  "agentExternalId": "<seu agentId OpenClaw>",
  "status": "<proximo status do Kanban>",
  "completedStage": "<etapa concluida>",
  "idempotencyKey": "<agentId>:<jobId>:<event_name>:<attemptNumber>",
  "timestamp": "<ISO timestamp atual>",
  "severity": "info",
  "payload": {
    "title": "<titulo quando disponivel>",
    "topic": "<topico quando disponivel>",
    "category": "<categoria quando disponivel>",
    "sourceName": "<fonte principal quando disponivel>",
    "sourceUrl": "<url principal quando disponivel>",
    "scores": {},
    "sources": [],
    "inputPayload": {},
    "outputPayload": {}
  }
}
```

## Exemplos finais por agente

Use estes exemplos como modelo direto. Mantenha o mesmo `jobId` em todas as etapas do mesmo pipeline.

### editorial

```json
{
  "event": "job_created",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "editorial",
  "status": "researching",
  "completedStage": "new",
  "idempotencyKey": "editorial:ts-openclaw-2026-05-18-0001:job_created:1",
  "severity": "info",
  "payload": {
    "title": "Nova pauta sobre IA em celulares",
    "topic": "IA em smartphones",
    "category": "Celulares",
    "sourceName": "TechSouls Editorial",
    "sourceUrl": "https://techsouls.com.br/",
    "priority": "normal",
    "scores": {
      "editorial": 82
    },
    "inputPayload": {
      "signal": "trend"
    },
    "outputPayload": {
      "brief": "Investigar impacto para leitores brasileiros."
    }
  }
}
```

### researcher

```json
{
  "event": "research_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "researcher",
  "status": "relevance_scoring",
  "completedStage": "researching",
  "idempotencyKey": "researcher:ts-openclaw-2026-05-18-0001:research_completed:1",
  "severity": "info",
  "payload": {
    "sources": [
      {
        "name": "Fonte principal",
        "url": "https://example.com/noticia",
        "role": "primary",
        "reliabilityScore": 88
      }
    ],
    "outputPayload": {
      "summary": "Resumo factual da pesquisa."
    }
  }
}
```

### relevance-classifier

```json
{
  "event": "relevance_scored",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "relevance-classifier",
  "status": "clustering",
  "completedStage": "relevance_scoring",
  "idempotencyKey": "relevance-classifier:ts-openclaw-2026-05-18-0001:relevance_scored:1",
  "severity": "info",
  "payload": {
    "scores": {
      "relevance": 91
    },
    "outputPayload": {
      "decision": "continue"
    }
  }
}
```

### dedup-cluster

```json
{
  "event": "cluster_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "dedup-cluster",
  "status": "validating",
  "completedStage": "clustering",
  "idempotencyKey": "dedup-cluster:ts-openclaw-2026-05-18-0001:cluster_completed:1",
  "severity": "info",
  "payload": {
    "clusterId": "cluster-ia-smartphones-2026-05-18",
    "outputPayload": {
      "duplicatesFound": 2
    }
  }
}
```

### validator

```json
{
  "event": "validation_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "validator",
  "status": "writing",
  "completedStage": "validating",
  "idempotencyKey": "validator:ts-openclaw-2026-05-18-0001:validation_completed:1",
  "severity": "info",
  "payload": {
    "scores": {
      "validation": 88
    },
    "outputPayload": {
      "warnings": []
    }
  }
}
```

### writer

```json
{
  "event": "article_written",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "writer",
  "status": "seo_optimizing",
  "completedStage": "writing",
  "idempotencyKey": "writer:ts-openclaw-2026-05-18-0001:article_written:1",
  "severity": "info",
  "payload": {
    "articleMarkdown": "# Titulo\n\nTexto do artigo...",
    "outputPayload": {
      "wordCount": 950
    }
  }
}
```

### seo-agent

```json
{
  "event": "seo_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "seo-agent",
  "status": "affiliate_routing",
  "completedStage": "seo_optimizing",
  "idempotencyKey": "seo-agent:ts-openclaw-2026-05-18-0001:seo_completed:1",
  "severity": "info",
  "payload": {
    "scores": {
      "seo": 84
    },
    "outputPayload": {
      "metaTitle": "IA em celulares: o que muda",
      "metaDescription": "Resumo otimizado para busca."
    }
  }
}
```

### affiliate-agent

```json
{
  "event": "affiliate_decided",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "affiliate-agent",
  "status": "copywriting",
  "completedStage": "affiliate_routing",
  "idempotencyKey": "affiliate-agent:ts-openclaw-2026-05-18-0001:affiliate_decided:1",
  "severity": "info",
  "payload": {
    "hasAffiliate": true,
    "scores": {
      "monetization": 76
    },
    "outputPayload": {
      "affiliateRoute": "smartphones"
    }
  }
}
```

### copywriter

```json
{
  "event": "copy_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "copywriter",
  "status": "editing",
  "completedStage": "copywriting",
  "idempotencyKey": "copywriter:ts-openclaw-2026-05-18-0001:copy_completed:1",
  "severity": "info",
  "payload": {
    "title": "IA nos celulares: recurso novo promete mudar a rotina",
    "outputPayload": {
      "socialHeadline": "IA nos celulares: entenda o novo recurso"
    }
  }
}
```

### editor-final

```json
{
  "event": "editorial_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "editor-final",
  "status": "compliance_checking",
  "completedStage": "editing",
  "idempotencyKey": "editor-final:ts-openclaw-2026-05-18-0001:editorial_completed:1",
  "severity": "info",
  "payload": {
    "scores": {
      "editorial": 89
    },
    "outputPayload": {
      "decision": "approved_for_compliance"
    }
  }
}
```

### compliance-agent com revisao humana

```json
{
  "event": "compliance_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "compliance-agent",
  "status": "human_review",
  "completedStage": "compliance_checking",
  "idempotencyKey": "compliance-agent:ts-openclaw-2026-05-18-0001:compliance_completed:1",
  "severity": "warning",
  "payload": {
    "scores": {
      "compliance": 62
    },
    "requiresHumanReview": true,
    "humanReviewReason": "Compliance abaixo do limite minimo.",
    "outputPayload": {
      "warnings": ["Checar alegacao sensivel antes da publicacao."]
    }
  }
}
```

### compliance-agent aprovado

```json
{
  "event": "compliance_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "compliance-agent",
  "status": "publishing",
  "completedStage": "compliance_checking",
  "idempotencyKey": "compliance-agent:ts-openclaw-2026-05-18-0001:compliance_completed:2",
  "severity": "info",
  "payload": {
    "scores": {
      "compliance": 94
    },
    "requiresHumanReview": false,
    "outputPayload": {
      "decision": "approved"
    }
  }
}
```

### wp-publisher publicado

```json
{
  "event": "published",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "wp-publisher",
  "status": "published",
  "completedStage": "publishing",
  "idempotencyKey": "wp-publisher:ts-openclaw-2026-05-18-0001:published:1",
  "severity": "info",
  "payload": {
    "wordpressPostId": "12345",
    "wordpressPreviewUrl": "https://techsouls.com.br/?p=12345"
  }
}
```

### wp-publisher rascunho

```json
{
  "event": "drafted",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "wp-publisher",
  "status": "drafted",
  "completedStage": "publishing",
  "idempotencyKey": "wp-publisher:ts-openclaw-2026-05-18-0001:drafted:1",
  "severity": "info",
  "payload": {
    "wordpressPostId": "12345",
    "wordpressPreviewUrl": "https://techsouls.com.br/?p=12345"
  }
}
```

### social-agent

```json
{
  "event": "social_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "social-agent",
  "status": "published",
  "completedStage": "published",
  "idempotencyKey": "social-agent:ts-openclaw-2026-05-18-0001:social_completed:1",
  "severity": "info",
  "payload": {
    "outputPayload": {
      "channels": ["telegram"],
      "message": "Post social preparado."
    }
  }
}
```

### analytics-cro

```json
{
  "event": "analytics_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "analytics-cro",
  "status": "published",
  "completedStage": "published",
  "idempotencyKey": "analytics-cro:ts-openclaw-2026-05-18-0001:analytics_completed:1",
  "severity": "info",
  "payload": {
    "outputPayload": {
      "trackingReady": true,
      "croNotes": "Monitorar CTR nas primeiras 24h."
    }
  }
}
```

### audit-agent

```json
{
  "event": "audit_completed",
  "jobId": "ts-openclaw-2026-05-18-0001",
  "agentExternalId": "audit-agent",
  "status": "published",
  "completedStage": "published",
  "idempotencyKey": "audit-agent:ts-openclaw-2026-05-18-0001:audit_completed:1",
  "severity": "info",
  "payload": {
    "outputPayload": {
      "auditResult": "ok",
      "checkedEvents": 12
    }
  }
}
```

## Teste manual

```bash
curl -X POST "https://openclaw.techsouls.com.br/api/webhooks/openclaw/task-update" \
  -H "Authorization: Bearer [OPENCLAW_WEBHOOK_SECRET]" \
  -H "Content-Type: application/json" \
  -d '{"event":"article_written","jobId":"ts-openclaw-demo-0001","agentExternalId":"writer","status":"seo_optimizing","completedStage":"writing","idempotencyKey":"writer:ts-openclaw-demo-0001:article_written:1","payload":{"title":"Demo","topic":"OpenClaw","category":"IA","sourceName":"TechSouls","sourceUrl":"https://techsouls.com.br/","articleMarkdown":"Conteudo demo"}}'
```

Depois do envio, confira:

- `/tasks`: card no Kanban.
- `/tasks/ts-openclaw-demo-0001`: payloads, artigo e fontes.
- `/audit`: log `OpenClaw webhook`.
- `/openclaw`: contador de eventos e ultimo webhook.
