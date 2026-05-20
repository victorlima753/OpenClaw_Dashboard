import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "techsouls_session";

export type SessionPayload = {
  userId: string;
  username: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(value: string) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlDecode(value: string) {
  return decoder.decode(base64UrlToBytes(value));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres em producao.");
  }
  return "development-session-secret-change-before-production";
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function constantEqual(left: string, right: string) {
  const max = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let index = 0; index < max; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

export type Permission =
  | "read"
  | "operate_jobs"
  | "review_jobs"
  | "manage_settings"
  | "manage_users"
  | "manage_agents"
  | "clear_demo_data"
  | "ack_alerts";

export const rolePermissions: Record<SessionPayload["role"], Permission[]> = {
  admin: ["read", "operate_jobs", "review_jobs", "manage_settings", "manage_users", "manage_agents", "clear_demo_data", "ack_alerts"],
  editor: ["read", "operate_jobs", "review_jobs", "ack_alerts"],
  viewer: ["read"]
};

export function permissionsForRole(role: SessionPayload["role"]) {
  return rolePermissions[role] ?? rolePermissions.viewer;
}

export function hasPermission(session: Pick<SessionPayload, "role"> | null, permission: Permission) {
  return Boolean(session && permissionsForRole(session.role).includes(permission));
}

export async function createSessionToken(input: {
  userId: string;
  username: string;
  email: string;
  role: SessionPayload["role"];
}) {
  const payload: SessionPayload = {
    userId: input.userId,
    username: input.username,
    email: input.email,
    role: input.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = await hmac(encodedPayload);
  if (!constantEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (
      !payload.userId ||
      !payload.username ||
      !payload.email ||
      !["admin", "editor", "viewer"].includes(payload.role) ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  };
}
