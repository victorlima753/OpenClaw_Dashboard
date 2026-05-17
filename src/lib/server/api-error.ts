import { NextResponse } from "next/server";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : null;
}

export function isDatabaseSetupError(error: unknown) {
  const code = errorCode(error);
  const message = errorMessage(error);
  return (
    code === "P1001" ||
    code === "P2021" ||
    code === "P2022" ||
    message.includes("Can't reach database") ||
    message.includes("does not exist") ||
    message.includes("ECONNREFUSED")
  );
}

export function apiErrorResponse(error: unknown, context: string) {
  const code = errorCode(error);
  const message = errorMessage(error);
  const databaseSetupError = isDatabaseSetupError(error);

  console.error(`[${context}]`, error);

  return NextResponse.json(
    {
      error: databaseSetupError ? "Banco de dados indisponivel ou sem migrations aplicadas." : "Erro interno.",
      context,
      code,
      message,
      hint: databaseSetupError
        ? "Confira DATABASE_URL no EasyPanel e execute: npm run prisma:deploy && npm run db:seed."
        : "Verifique os logs do container no EasyPanel."
    },
    { status: 500 }
  );
}
