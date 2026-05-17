import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value?: number | null; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
      />
    </div>
  );
}
