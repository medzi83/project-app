"use client";

import React from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, LayoutGrid, Building2, FolderKanban, Clapperboard, Share2, Users, Settings, Server, LogOut, ChevronDown, ChevronRight, PlusCircle, Shield, Upload, BarChart3, Package, Mail, Landmark, Zap, Megaphone, MessageSquareHeart, ExternalLink, HardDrive, FileText, Handshake, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DevModeToggle from "@/components/DevModeToggle";
import FeedbackDialog from "@/components/FeedbackDialog";
import { GlobalClientSearch } from "@/components/GlobalClientSearch";
import { FeedbackNotificationBadge, FeedbackNotificationProvider } from "@/components/FeedbackNotificationBadge";
import { PSNLogo } from "@/components/PSNLogo";

export type Role = "ADMIN" | "AGENT" | "SALES";

type User = {
  name: string;
  role: Role;
  categories?: string[];
};

type Counts = {
  projectsOpen?: number;
  projectsAll?: number;
  agentsActive?: number;
  feedbackOpen?: number;
};

type DevModeData = {
  isDevMode: boolean;
  currentViewUserId?: string | null;
  currentViewUserName?: string | null;
  availableAgents: Array<{ id: string; name: string | null; categories: string[] }>;
};

type Agency = {
  id: string;
  name: string;
  logoIconPath: string | null;
};

type AppShellProps = {
  user: User;
  counts?: Counts;
  devMode?: DevModeData;
  agencies?: Agency[];
  children: React.ReactNode;
};

export default function AppShell({ user, counts, devMode, agencies, children }: AppShellProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const navigationRole = user.role;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <FeedbackNotificationProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <div className="sticky top-0 z-40 border-b border-white/20 bg-white/80 backdrop-blur-lg shadow-sm">
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

          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <PSNLogo size="small" animated={false} />
              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">Projektverwaltung</span>
            </Link>
            {agencies && agencies.length > 0 && (
              <div className="flex items-center gap-2">
                {agencies.filter(a => a.logoIconPath).map((agency) => (
                  <div key={agency.id} className="group relative">
                    <Image
                      src={agency.logoIconPath!}
                      alt={agency.name}
                      width={24}
                      height={24}
                      className="h-6 w-6 object-contain rounded opacity-70 hover:opacity-100 transition-opacity"
                      unoptimized
                    />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
                      {agency.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Global Client Search */}
            {(navigationRole === "ADMIN" || navigationRole === "AGENT" || navigationRole === "SALES") && (
              <GlobalClientSearch />
            )}

            {(navigationRole === "ADMIN" || navigationRole === "AGENT") && (
              <Button asChild size="sm" className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all">
                <Link href="/projects/new">
                  <PlusCircle className="h-4 w-4" />
                  Projekt anlegen
                </Link>
              </Button>
            )}
            {(navigationRole === "ADMIN" || navigationRole === "AGENT") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Ticketsystem
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href="https://eventomaxx.freshdesk.com/a/dashboard/default" target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      <span>Eventomaxx</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="https://vendoweb.freshdesk.com/a/dashboard/default" target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      <span>Vendoweb</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {mounted && devMode && devMode.availableAgents.length > 0 && (
              <DevModeToggle
                currentUserId={devMode.currentViewUserId}
                currentUserName={devMode.currentViewUserName}
                agents={devMode.availableAgents}
              />
            )}
            {mounted && (
              <FeedbackDialog />
            )}
            {mounted && <UserPill user={user} />}
          </div>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-white/40 bg-white/60 backdrop-blur-md md:block shadow-sm">
          <Sidebar user={user} counts={counts} />
        </aside>

        <main className="min-h-[calc(100vh-56px)] w-full p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
    </FeedbackNotificationProvider>
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
  const navigationRole = user.role;
  const hasSocialMediaCategory = user.categories?.includes("SOCIALMEDIA") ?? false;

  const baseItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { label: "Webseitenprojekte", href: "/projects", icon: FolderKanban },
    { label: "Filmprojekte", href: "/film-projects", icon: Clapperboard },
    { label: "SocialMedia-Projekte", href: "/social-projects", icon: Share2 },
    { label: "Kunden", href: "/clients", icon: Building2 },
  ];

  const adminItems: NavItem[] = navigationRole === "ADMIN"
    ? [
        { label: "Admins", href: "/admin/admins", icon: Shield },
        { label: "Agenten", href: "/admin/agents", icon: Users, badge: counts ? String(counts.agentsActive ?? 0) : undefined },
        { label: "Vertrieb", href: "/admin/vertrieb", icon: Handshake },
        { label: "Agenturen", href: "/admin/agencies", icon: Landmark },
        { label: "Hinweise", href: "/admin/notices", icon: Megaphone },
        { label: "Kummerkasten", href: "/admin/kummerkasten", icon: MessageSquareHeart, badge: counts?.feedbackOpen ? String(counts.feedbackOpen) : undefined },
        { label: "Statistik", href: "/admin/statistics", icon: BarChart3 },
        { label: "Server", href: "/admin/server", icon: Server },
        { label: "Emailvorlagen", href: "/admin/email-templates", icon: Mail },
        { label: "E-Mail Trigger", href: "/admin/email-triggers", icon: Zap },
        { label: "Basisinstallation", href: "/admin/basisinstallation", icon: Package },
        { label: "Joomla Backup", href: "/admin/joomla-backup", icon: HardDrive },
        { label: "Orgamax ERP", href: "/admin/orgamax", icon: Database },
      ]
    : [];

  // Social Media agents can access email templates
  const socialMediaItems: NavItem[] = hasSocialMediaCategory && navigationRole === "AGENT"
    ? [
        { label: "Emailvorlagen", href: "/admin/email-templates", icon: Mail },
      ]
    : [];

  const importItems: NavItem[] = navigationRole === "ADMIN"
    ? [
        { label: "Webseitenprojekte", href: "/admin/import", icon: Upload },
        { label: "Filmprojekte", href: "/admin/film-import", icon: Upload },
      ]
    : [];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="px-4 py-4">
        <h2 className="text-sm font-medium text-muted-foreground">Navigation</h2>
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

          {socialMediaItems.length > 0 && (
            <div className="mt-6">
              <NavSection label="Social Media" items={socialMediaItems} activePath={pathname} onNavigate={onNavigate} />
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
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-3 shadow-sm">
          <div>
            <p className="text-xs text-blue-600 font-medium">Angemeldet als</p>
            <p className="text-sm font-semibold text-gray-900">{user.name}</p>
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
        "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all",
        isActive
          ? "bg-gradient-to-r from-blue-500 to-indigo-600 font-medium text-white shadow-md"
          : "text-gray-700 hover:bg-white/80 hover:text-gray-900 hover:shadow-sm",
      ].join(" ")}
    >
      <span className="flex items-center gap-2.5">
        {Icon && <Icon className={`h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-70'}`} />}
        {item.label}
      </span>
      {item.badge && <Badge variant={isActive ? "secondary" : "outline"} className="ml-2">{item.badge}</Badge>}
    </Link>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const roleLabel = role === "ADMIN" ? "admin" : role === "AGENT" ? "agent" : "vertrieb";
  return (
    <Badge
      variant={role === "ADMIN" ? "default" : "secondary"}
      className={`uppercase font-semibold ${role === "ADMIN" ? "bg-gradient-to-r from-purple-600 to-pink-600 border-0" : ""}`}
    >
      {roleLabel}
    </Badge>
  );
}

function UserPill({ user }: { user: User }) {
  const roleLabel = user.role === "ADMIN" ? "admin" : user.role === "AGENT" ? "agent" : "vertrieb";

  const handleSignOut = React.useCallback(async () => {
    if (typeof window !== "undefined") {
      const globalAny = window as typeof window & { __NEXTAUTH?: { baseUrl?: string; basePath?: string } };
      globalAny.__NEXTAUTH = globalAny.__NEXTAUTH ?? {};
      const currentBaseUrl = globalAny.__NEXTAUTH.baseUrl;
      const origin = window.location.origin;
      if (!currentBaseUrl || currentBaseUrl.startsWith("http://localhost")) {
        globalAny.__NEXTAUTH.baseUrl = origin;
      }
      if (!globalAny.__NEXTAUTH.basePath) {
        globalAny.__NEXTAUTH.basePath = "/api/auth";
      }
    }

    try {
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error("Sign-out failed; falling back to manual redirect", error);
      if (typeof window !== "undefined") {
        window.location.href = "/api/auth/signout?callbackUrl=/login";
      }
    }
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full border bg-white px-3 py-1 hover:bg-gray-50 transition-colors relative">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold uppercase">
            {user.name?.slice(0, 2) || "U"}
          </div>
          <div className="leading-tight">
            <div className="text-xs font-medium">{user.name}</div>
            <div className="text-[10px] uppercase text-gray-500">{roleLabel}</div>
          </div>
          <ChevronDown className="h-3 w-3 text-gray-500" />
          <div className="absolute -top-1 -right-1">
            <FeedbackNotificationBadge />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground uppercase">{roleLabel}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notices" className="flex items-center cursor-pointer">
            <Megaphone className="mr-2 h-4 w-4" />
            <span>Hinweis-Historie</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/kummerkasten" className="flex items-center cursor-pointer">
            <MessageSquareHeart className="mr-2 h-4 w-4" />
            <span>Kummerkasten-Feedback</span>
            <FeedbackNotificationBadge />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Einstellungen</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/changelog" className="flex items-center cursor-pointer">
            <FileText className="mr-2 h-4 w-4" />
            <span>Changelog</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600 cursor-pointer"
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Abmelden</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


