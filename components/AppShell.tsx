"use client";

import React from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LayoutGrid, Building2, FolderKanban, Clapperboard, Share2, Users, Settings, Server, LogOut, ChevronDown, ChevronRight, PlusCircle, Shield, Upload, BarChart3, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type Role = "ADMIN" | "AGENT";

type User = {
  name: string;
  role: Role;
};

type Counts = {
  projectsOpen?: number;
  projectsAll?: number;
  agentsActive?: number;
};

type AppShellProps = {
  user: User;
  counts?: Counts;
  children: React.ReactNode;
};

export default function AppShell({ user, counts, children }: AppShellProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-40 border-b bg-white">
        <div className="flex w-full items-center gap-3 px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80">
              <SheetHeader className="px-4 py-3 text-left">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <Separator />
              <Sidebar user={user} counts={counts} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link href="/" className="font-semibold tracking-tight">Projektverwaltung</Link>

          <div className="ml-auto flex items-center gap-2">
            <UserPill user={user} />
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="grid w-full max-w-7xl grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="hidden border-r bg-white md:block">
          <Sidebar user={user} counts={counts} />
        </aside>

        <main className="min-h-[calc(100vh-56px)] p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

type NavItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
};

function Sidebar({ user, counts, onNavigate }: { user: User; counts?: Counts; onNavigate?: () => void }) {
  const pathname = usePathname();

  const baseItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { label: "Webseitenprojekte", href: "/projects", icon: FolderKanban },
    { label: "Filmprojekte", href: "/film-projects", icon: Clapperboard },
    { label: "SocialMedia-Projekte", href: "/social-projects", icon: Share2 },
    { label: "Kunden", href: "/clients", icon: Building2 },
    { label: "Einstellungen", href: "/settings", icon: Settings },
  ];

  const adminItems: NavItem[] = user.role === "ADMIN"
    ? [
        { label: "Admins", href: "/admin/admins", icon: Shield },
        { label: "Agenten", href: "/admin/agents", icon: Users, badge: counts ? String(counts.agentsActive ?? 0) : undefined },
        { label: "Statistik", href: "/admin/statistics", icon: BarChart3 },
        { label: "Server", href: "/admin/server", icon: Server },
        { label: "Basisinstallation", href: "/admin/basisinstallation", icon: Package },
      ]
    : [];

  const importItems: NavItem[] = user.role === "ADMIN"
    ? [
        { label: "Webseitenprojekte", href: "/admin/import", icon: Upload },
        { label: "Filmprojekte", href: "/admin/film-import", icon: Upload },
      ]
    : [];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="px-4 py-4 space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Navigation</h2>
        {(user.role === "ADMIN" || user.role === "AGENT") && (
          <Link
            href="/projects/new"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-sm font-medium text-white hover:bg-black/90"
          >
            <PlusCircle className="h-4 w-4" /> Projekt anlegen
          </Link>
        )}
      </div>
      <Separator />

      <ScrollArea className="h-full">
        <nav className="px-2 py-3">
          <NavSection label="Allgemein" items={baseItems} activePath={pathname} onNavigate={onNavigate} />

          {adminItems.length > 0 && (
            <div className="mt-6">
              <NavSection label="Admin" items={adminItems} activePath={pathname} onNavigate={onNavigate} />
            </div>
          )}

          {importItems.length > 0 && (
            <div className="mt-6">
              <NavSection label="Import" items={importItems} activePath={pathname} onNavigate={onNavigate} />
            </div>
          )}
        </nav>
      </ScrollArea>

      <div className="mt-auto space-y-2 p-3">
        <Separator />
        <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Angemeldet als</p>
            <p className="text-sm font-medium">{user.name}</p>
          </div>
          <RoleBadge role={user.role} />
        </div>
      </div>
    </div>
  );
}

function NavSection({ label, items, activePath, onNavigate }: { label: string; items: NavItem[]; activePath: string | null; onNavigate?: () => void }) {
  const [open, setOpen] = React.useState(true);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[13px] font-semibold text-gray-500 hover:text-gray-700"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} activePath={activePath} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SidebarLink({ item, activePath, onNavigate }: { item: NavItem; activePath: string | null; onNavigate?: () => void }) {
  const isActive = activePath ? activePath === item.href || activePath.startsWith(item.href + "/") : false;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        "group flex items-center justify-between rounded-xl px-2 py-2 text-sm transition",
        isActive ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        {item.label}
      </span>
      {item.badge && <Badge variant="outline" className="ml-2">{item.badge}</Badge>}
    </Link>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "ADMIN" ? "default" : "secondary"} className="uppercase">
      {role.toLowerCase()}
    </Badge>
  );
}

function UserPill({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold uppercase">
        {user.name?.slice(0, 2) || "U"}
      </div>
      <div className="leading-tight">
        <div className="text-xs font-medium">{user.name}</div>
        <div className="text-[10px] uppercase text-gray-500">{user.role}</div>
      </div>
    </div>
  );
}


