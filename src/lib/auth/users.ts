import { prisma } from "@/lib/prisma";
import { getRequiredCredential, normalizeCredential } from "@/lib/auth/credentials";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { Prisma, UserRole } from "@prisma/client";

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export function normalizeEmail(value: string) {
  return normalizeCredential(value).toLowerCase();
}

export async function ensureBootstrapAdmin() {
  const count = await prisma.user.count();
  if (count > 0) return null;

  const username = normalizeCredential(getRequiredCredential("ADMIN_USERNAME", "admin"));
  const password = normalizeCredential(getRequiredCredential("ADMIN_PASSWORD", "admin"));
  const email = username.includes("@") ? username : `${username}@techsouls.local`;

  return prisma.user.create({
    data: {
      name: username,
      email: normalizeEmail(email),
      passwordHash: hashPassword(password),
      role: "admin",
      status: "active"
    },
    select: userSelect
  });
}

export async function authenticateUser(usernameOrEmail: string, password: string) {
  await ensureBootstrapAdmin();

  const login = normalizeCredential(usernameOrEmail);
  const email = normalizeEmail(login.includes("@") ? login : `${login}@techsouls.local`);
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { name: login }]
    }
  });

  if (!user || user.status !== "active" || !verifyPassword(password, user.passwordHash)) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole
  };
}

export async function listUsers() {
  await ensureBootstrapAdmin();
  return prisma.user.findMany({ select: userSelect, orderBy: [{ role: "asc" }, { name: "asc" }] });
}
