import { Badge } from "@/components/ui/badge";
import { AGENT_STATUS_META, JOB_STATUS_META, PRIORITY_META, SEVERITY_META } from "@/lib/domain";
import type { AgentStatus, JobPriority, JobStatus, LogSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const meta = AGENT_STATUS_META[status];
  return (
    <Badge className={cn("gap-1.5", meta.className)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = JOB_STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const meta = PRIORITY_META[priority];
  return <span className={cn("text-xs font-semibold", meta.className)}>{meta.label}</span>;
}

export function SeverityBadge({ severity }: { severity: LogSeverity }) {
  const meta = SEVERITY_META[severity];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
