type CredentialName = "ADMIN_USERNAME" | "ADMIN_PASSWORD";

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  const first = trimmed.at(0);
  const last = trimmed.at(-1);
  if ((first === `"` || first === "'" || first === "`") && first === last) return trimmed.slice(1, -1).trim();
  return trimmed;
}

export function normalizeCredential(value: string) {
  return stripWrappingQuotes(value.replace(/^\uFEFF/, ""));
}

export function getRequiredCredential(name: CredentialName, fallback: string) {
  const value = process.env[name];
  const normalized = value ? normalizeCredential(value) : "";
  if (normalized) return normalized;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} deve estar configurado em producao.`);
  return fallback;
}
