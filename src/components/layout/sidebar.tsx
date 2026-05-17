"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  ClipboardCheck,
  Columns3,
  LayoutDashboard,
  ListChecks,
  RadioTower,
  Settings,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/tasks", label: "Tasks", icon: Columns3 },
  { href: "/queue", label: "Queue", icon: ListChecks },
  { href: "/review", label: "Human Review", icon: ClipboardCheck },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
  { href: "/openclaw", label: "OpenClaw", icon: RadioTower },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-card/95 backdrop-blur lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">TechSouls</p>
              <p className="text-xs text-muted-foreground">Command Center</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  active && "bg-secondary text-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          <p>V1 operacional</p>
          <p>OpenClaw real via Gateway e worker.</p>
        </div>
      </div>
    </aside>
  );
}
