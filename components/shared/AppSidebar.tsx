"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, LogOut, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReleases } from "@/hooks/useReleases";

interface AppSidebarProps {
  user: { name?: string | null; email?: string | null };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const { data } = useReleases();
  const releases = data?.data ?? [];

  return (
    <aside className="flex w-60 flex-col border-r bg-card shrink-0">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <span className="font-semibold text-sm">dRM</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} active={pathname === "/dashboard"}>
          Dashboard
        </NavItem>

        {/* Releases */}
        {releases.length > 0 && (
          <div className="pt-3">
            <p className="px-2 mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Releases
            </p>
            {releases.map((release: any) => (
              <ReleaseNavItem key={release.id} release={release} pathname={pathname} />
            ))}
          </div>
        )}

        {/* Admin */}
        <div className="pt-3">
          <p className="px-2 mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Admin
          </p>
          <NavItem href="/admin/users" active={pathname.startsWith("/admin/users")}>
            Benutzer
          </NavItem>
          <NavItem href="/admin/applications" active={pathname.startsWith("/admin/applications")}>
            Applikationen
          </NavItem>
          <NavItem href="/admin/resources" active={pathname.startsWith("/admin/resources")}>
            Ressourcen
          </NavItem>
        </div>
      </nav>

      {/* User Footer */}
      <div className="border-t p-3">
        <div className="mb-2 px-2">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Abmelden
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function ReleaseNavItem({
  release,
  pathname,
}: {
  release: any;
  pathname: string;
}) {
  const base = `/releases/${release.id}`;
  const isActive = pathname.startsWith(base);

  return (
    <div>
      <Link
        href={`${base}/tasks`}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <span className="truncate">{release.name}</span>
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {release._count?.tasks ?? 0}
        </span>
      </Link>
      {isActive && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          <SubNavItem href={`${base}/tasks`} active={pathname.startsWith(`${base}/tasks`)}>Tasks</SubNavItem>
          <SubNavItem href={`${base}/milestones`} active={pathname.startsWith(`${base}/milestones`)}>Meilensteine</SubNavItem>
          <SubNavItem href={`${base}/resources`} active={pathname.startsWith(`${base}/resources`)}>Ressourcen</SubNavItem>
          <SubNavItem href={`${base}/applications`} active={pathname.startsWith(`${base}/applications`)}>Applikationen</SubNavItem>
        </div>
      )}
    </div>
  );
}

function SubNavItem({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-2 py-1 text-xs transition-colors",
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}
