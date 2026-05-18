# OpenClaw Event Contract

This document defines the MVP contract between OpenClaw Gateway/agents and TechSouls Command Center.

## Runtime

- Dashboard web app receives authenticated webhooks and exposes admin actions.
- `dashboard-worker` keeps a persistent WebSocket connection to OpenClaw Gateway.
- The worker persists Gateway messages into Postgres through `handleOpenClawGatewayMessage`.
- `/api/events` streams database-backed SSE events to the frontend.

## Environment

Required in production:

```env
ALLOW_MOCK_FALLBACK=false
OPENCLAW_USE_MOCK=false
OPENCLAW_GATEWAY_WS_URL=ws://techsouls_openclaw_openclaw-gateway:18789
OPENCLAW_GATEWAY_TOKEN=<gateway-token>
OPENCLAW_AUTH_MODE=query
OPENCLAW_CLIENT_MODE=backend
OPENCLAW_AGENT_MAP_JSON={"techsouls-orchestrator":"orchestrator","techsouls-researcher":"researcher","techsouls-relevance-score":"relevance-classifier","techsouls-news-clustering":"dedup-cluster","techsouls-fact-check":"validator","techsouls-blog-writer":"writer","techsouls-seo":"seo-agent","techsouls-affiliate-router":"affiliate-agent","techsouls-copywriter":"copywriter","techsouls-final-editor":"editor-final","techsouls-compliance":"compliance-agent","techsouls-wordpress-publisher":"wp-publisher","techsouls-social":"social-agent","techsouls-analytics-cro":"analytics-cro","techsouls-audit-log":"audit-agent"}
OPENCLAW_WEBHOOK_SECRET=<shared-webhook-secret>
```

Optional command aliases only if your Gateway or plugin exposes different RPC names. Leave this unset for the default integration; editorial job actions will use the native `agent` RPC automatically.

```env
OPENCLAW_COMMAND_MAP_JSON={"agent_pause":"operator.agent.pause","agent_resume":"operator.agent.resume","agent_restart":"operator.agent.restart"}
```

If this variable is not set, editorial job actions default to the native OpenClaw `agent` RPC. The dashboard sends the action as a structured message to the mapped Orchestrator session (`agent:<orchestratorId>:main`). This matches the Gateway API where direct agent turns use `agent`, while `status` remains a native read RPC.

## Job Update Webhook

Endpoint:

```http
POST /api/webhooks/openclaw/task-update
Authorization: Bearer <OPENCLAW_WEBHOOK_SECRET>
Content-Type: application/json
```

Payload:

```json
{
  "event": "validation_completed",
  "jobId": "ts-2026-05-17-0001",
  "agentSlug": "validator",
  "status": "validating",
  "payload": {
    "jobId": "ts-2026-05-17-0001",
    "externalId": "openclaw-run-001",
    "title": "Samsung anuncia novo recurso de IA para celulares Galaxy",
    "topic": "IA em smartphones",
    "category": "Celulares",
    "sourceName": "Samsung Newsroom",
    "sourceUrl": "https://example.com/samsung-ai",
    "currentStage": "Validator",
    "status": "validating",
    "priority": "high",
    "relevanceScore": 91,
    "validationScore": 88,
    "complianceScore": null,
    "hasAffiliate": true,
    "requiresHumanReview": false,
    "outputPayload": {
      "decision": "valid_source",
      "warnings": []
    }
  }
}
```

Behavior:

- Creates the `ArticleJob` if it does not exist.
- Marks `dataSource=openclaw`.
- Updates status, stage, scores, affiliate flags, WordPress fields and article content when present.
- Creates payload snapshots and audit logs.
- Updates the mapped agent as busy/online depending on job state.

## Agent Event Webhook

Endpoint:

```http
POST /api/webhooks/openclaw/agent-event
Authorization: Bearer <OPENCLAW_WEBHOOK_SECRET>
Content-Type: application/json
```

Payload:

```json
{
  "event": "heartbeat",
  "agentSlug": "writer",
  "jobId": "ts-2026-05-17-0001",
  "status": "busy",
  "payload": {
    "agentId": "writer",
    "currentTaskId": "ts-2026-05-17-0001"
  }
}
```

## Gateway Status Shape

The sync endpoint and worker understand the current Gateway status response:

```json
{
  "heartbeat": {
    "agents": [
      { "agentId": "orchestrator", "enabled": true, "every": "30m", "everyMs": 1800000 }
    ]
  },
  "sessions": {
    "byAgent": [
      {
        "agentId": "writer",
        "count": 1,
        "recent": [
          {
            "sessionId": "session-123",
            "kind": "direct",
            "updatedAt": 1779053939504,
            "inputTokens": 1200,
            "outputTokens": 480,
            "totalTokens": 1680,
            "model": "gemini-flash-latest"
          }
        ]
      }
    ]
  }
}
```

Behavior:

- `heartbeat.agents` updates mapped `Agent.externalId`, `openClawEnabled`, status and last sync time.
- `sessions.byAgent[].recent[]` creates deduplicated audit logs with stage `OpenClaw session`.
- Worker heartbeat is stored in `SystemSetting.openclaw_worker_status`.

## Dashboard Actions

The dashboard sends real Gateway commands through WebSocket. By default, editorial actions below are wrapped into the native `agent` method unless `OPENCLAW_COMMAND_MAP_JSON` overrides them:

- `job_create`
- `task_update`
- `task_retry`
- `task_cancel`
- `task_priority`
- `task_assign`
- `agent_pause`
- `agent_resume`
- `agent_restart`
- `human_review_approved`
- `human_review_rejected`
- `human_review_drafted`
- `human_review_return_to_writer`
- `human_review_return_to_validator`

Every command payload includes:

```json
{
  "source": "techsouls-command-center",
  "action": "task_retry",
  "jobId": "ts-2026-05-17-0001",
  "agentId": "writer",
  "agentExternalId": "writer",
  "dashboardAgentId": "clx...",
  "agentSlug": "techsouls-blog-writer"
}
```

## Demo Cleanup

`POST /api/admin/clear-demo-data` now removes only rows with `ArticleJob.dataSource="seed"` and their related logs, snapshots, sources and reviews. Jobs created manually or ingested from OpenClaw are preserved.
