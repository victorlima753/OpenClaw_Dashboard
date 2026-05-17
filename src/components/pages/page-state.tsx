import { Loader2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PageLoading({ label = "Carregando dados operacionais..." }: { label?: string }) {
  return (
    <div className="flex min-h-96 items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function PageError({ error }: { error: unknown }) {
  return (
    <Card className="border-red-500/30 bg-red-500/10 p-5">
      <div className="flex gap-3">
        <TriangleAlert className="size-5 text-red-300" />
        <div>
          <p className="font-medium text-red-200">Nao foi possivel carregar os dados.</p>
          <p className="mt-1 text-sm text-red-200/70">
            {error instanceof Error ? error.message : "Verifique DATABASE_URL, migrations e seed."}
          </p>
        </div>
      </div>
    </Card>
  );
}
