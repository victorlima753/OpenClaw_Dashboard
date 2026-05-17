"use client";

import { usePathname } from "next/navigation";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApi = pathname?.startsWith("/api");

  if (isApi || pathname === "/login") return children;

  return (
    <div className="min-h-screen bg-background ops-grid">
      <Sidebar />
      <div className="min-h-screen lg:pl-64">
        <Header />
        <main className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
