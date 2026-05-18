import { KANBAN_COLUMNS } from "../src/lib/domain";
import { prisma } from "../src/lib/prisma";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredAgentSlugs = [
  "techsouls-orchestrator",
  "techsouls-trend-editorial",
  "techsouls-relevance-score",
  "techsouls-news-clustering",
  "techsouls-fact-check",
  "techsouls-blog-writer",
  "techsouls-affiliate-router",
  "techsouls-compliance",
  "techsouls-wordpress-publisher",
  "techsouls-audit-log"
];

async function main() {
  const [
    agents,
    jobCount,
    logCount,
    reviewCount,
    sourceCount,
    failedCount,
    publishedCount,
    settingsCount,
    jobsByStatus
  ] = await Promise.all([
    prisma.agent.findMany({ select: { slug: true } }),
    prisma.articleJob.count(),
    prisma.agentLog.count(),
    prisma.humanReview.count(),
    prisma.source.count(),
    prisma.articleJob.count({ where: { status: "failed" } }),
    prisma.articleJob.count({ where: { status: "published" } }),
    prisma.systemSetting.count(),
    prisma.articleJob.groupBy({ by: ["status"], _count: { _all: true } })
  ]);

  const agentSlugs = new Set(agents.map((agent) => agent.slug));
  const statusCounts = new Map(jobsByStatus.map((entry) => [entry.status, entry._count._all]));

  for (const slug of requiredAgentSlugs) {
    assert(agentSlugs.has(slug), `Agente obrigatorio ausente no banco: ${slug}`);
  }

  assert(agents.length === 16, "Seed deve conter exatamente 16 agentes no banco.");
  assert(jobCount >= 20, "Seed deve conter pelo menos 20 tarefas no banco.");
  assert(logCount >= 100, "Seed deve conter pelo menos 100 logs no banco.");
  assert(reviewCount >= 5, "Seed deve conter pelo menos 5 revisoes humanas no banco.");
  assert(failedCount >= 3, "Seed deve conter pelo menos 3 tarefas falhadas no banco.");
  assert(publishedCount >= 5, "Seed deve conter pelo menos 5 tarefas publicadas no banco.");
  assert(sourceCount >= jobCount, "Cada job deve ter ao menos uma fonte no banco.");
  assert(settingsCount > 0, "Seed deve conter configuracoes do sistema no banco.");

  for (const column of KANBAN_COLUMNS) {
    assert((statusCounts.get(column.status) ?? 0) > 0, `Coluna sem dados no banco: ${column.status}`);
  }

  console.log(
    `Seed verificado no Postgres: ${agents.length} agentes, ${jobCount} jobs, ${logCount} logs, ${reviewCount} revisoes.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
