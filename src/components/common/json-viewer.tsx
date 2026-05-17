import { Card } from "@/components/ui/card";

export function JsonViewer({ value }: { value: unknown }) {
  return (
    <Card className="overflow-hidden border-border/70 bg-secondary/20">
      <pre className="max-h-96 overflow-auto p-3 text-xs leading-relaxed text-muted-foreground">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </Card>
  );
}
