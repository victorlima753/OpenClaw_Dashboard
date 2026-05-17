import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
      <Inbox className="mb-3 size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
