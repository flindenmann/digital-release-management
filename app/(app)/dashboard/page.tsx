"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectRole } from "@prisma/client";
import { CalendarClock, CheckCircle2, CircleDot, ListTodo, Layers } from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface TaskCounts {
  OPEN: number;
  PLANNED: number;
  DONE: number;
  ARCHIVED: number;
}

interface NextMilestone {
  id: string;
  title: string;
  dateTime: string;
  status: string;
}

interface DashboardRelease {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  role: ProjectRole | null;
  taskCounts: TaskCounts;
  totalTasks: number;
  progress: number;
  nextMilestone: NextMilestone | null;
}

interface DashboardSummary {
  totalReleases: number;
  totalOpen: number;
  totalPlanned: number;
  totalDone: number;
  upcomingMilestonesCount: number;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const ROLE_LABEL: Record<ProjectRole, string> = {
  RELEASE_MANAGER: "Release Manager",
  SACHBEARBEITER: "Sachbearbeiter",
  MANAGER: "Manager",
};

function formatMilestoneDate(dateStr: string): { label: string; urgent: boolean } {
  const date = new Date(dateStr);
  const days = differenceInDays(date, new Date());

  if (isToday(date)) return { label: "Heute", urgent: true };
  if (isTomorrow(date)) return { label: "Morgen", urgent: true };
  if (days <= 7) return { label: `in ${days} Tagen`, urgent: true };
  return { label: format(date, "d. MMM yyyy", { locale: de }), urgent: false };
}

// ─── Summary-Karte ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  urgent?: boolean;
}

function SummaryCard({ label, value, icon, colorClass, urgent }: SummaryCardProps) {
  return (
    <div className={`rounded-lg border bg-card p-4 flex items-center gap-4 ${urgent && value > 0 ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ counts, progress }: { counts: TaskCounts; progress: number }) {
  const total = counts.OPEN + counts.PLANNED + counts.DONE;
  if (total === 0) return <p className="text-xs text-muted-foreground">Keine Tasks</p>;

  const pctOpen    = Math.round((counts.OPEN    / total) * 100);
  const pctPlanned = Math.round((counts.PLANNED / total) * 100);
  const pctDone    = Math.round((counts.DONE    / total) * 100);

  return (
    <div className="space-y-1.5">
      {/* Segmentierter Balken */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted gap-px">
        {counts.DONE > 0    && <div className="bg-green-500 transition-all" style={{ width: `${pctDone}%` }} />}
        {counts.PLANNED > 0 && <div className="bg-yellow-400 transition-all" style={{ width: `${pctPlanned}%` }} />}
        {counts.OPEN > 0    && <div className="bg-gray-300 transition-all"   style={{ width: `${pctOpen}%` }} />}
      </div>
      {/* Legende */}
      <div className="flex items-center gap-3 flex-wrap">
        {counts.OPEN > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
            {counts.OPEN} Offen
          </span>
        )}
        {counts.PLANNED > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
            {counts.PLANNED} Geplant
          </span>
        )}
        {counts.DONE > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            {counts.DONE} Erledigt
          </span>
        )}
        <span className="ml-auto text-xs font-medium text-muted-foreground">{progress}%</span>
      </div>
    </div>
  );
}

// ─── Release-Karte ────────────────────────────────────────────────────────────

function ReleaseCard({ release }: { release: DashboardRelease }) {
  const milestone = release.nextMilestone;
  const milestoneDate = milestone ? formatMilestoneDate(milestone.dateTime) : null;

  return (
    <div className="rounded-lg border bg-card flex flex-col gap-0 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 pb-3 border-b bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-base leading-tight">{release.name}</h2>
          {release.role && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {ROLE_LABEL[release.role]}
            </Badge>
          )}
        </div>
        {release.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{release.description}</p>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Fortschrittsbalken */}
        <ProgressBar counts={release.taskCounts} progress={release.progress} />

        {/* Nächster Meilenstein */}
        {milestone && milestoneDate && (
          <div className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-xs ${milestoneDate.urgent ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-muted/50 text-muted-foreground"}`}>
            <CalendarClock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-medium">{milestoneDate.label}</span>
              <span className="mx-1">·</span>
              <span className="truncate">{milestone.title}</span>
            </div>
          </div>
        )}

        {!milestone && (
          <p className="text-xs text-muted-foreground">Kein anstehender Meilenstein</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link href={`/releases/${release.id}/tasks`}>Tasks</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="flex-1">
          <Link href={`/releases/${release.id}/milestones`}>Meilensteine</Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<{ data: { releases: DashboardRelease[]; summary: DashboardSummary } }>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Fehler beim Laden des Dashboards.");
      return res.json();
    },
  });

  const releases = data?.data?.releases ?? [];
  const summary  = data?.data?.summary;

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Übersicht über alle Releases</p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg border bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-52 rounded-lg border bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden des Dashboards.
        </div>
      )}

      {!isLoading && !isError && releases.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Noch keine Releases vorhanden.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ein Release Manager kann über die Sidebar ein neues Release anlegen.
          </p>
        </div>
      )}

      {!isLoading && !isError && summary && releases.length > 0 && (
        <div className="space-y-6">
          {/* Summary-Karten */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Releases"
              value={summary.totalReleases}
              icon={<Layers className="h-5 w-5 text-blue-600" />}
              colorClass="bg-blue-100"
            />
            <SummaryCard
              label="Offene Tasks"
              value={summary.totalOpen}
              icon={<CircleDot className="h-5 w-5 text-gray-600" />}
              colorClass="bg-gray-100"
            />
            <SummaryCard
              label="Geplante Tasks"
              value={summary.totalPlanned}
              icon={<ListTodo className="h-5 w-5 text-yellow-600" />}
              colorClass="bg-yellow-100"
            />
            <SummaryCard
              label="Meilensteine (7 Tage)"
              value={summary.upcomingMilestonesCount}
              icon={<CalendarClock className="h-5 w-5 text-amber-600" />}
              colorClass="bg-amber-100"
              urgent
            />
          </div>

          {/* Release-Karten */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {releases.map((release) => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </div>

          {/* Gesamtfortschritt */}
          {summary.totalOpen + summary.totalPlanned + summary.totalDone > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Gesamtfortschritt (alle Releases)</p>
                <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {summary.totalDone} von {summary.totalOpen + summary.totalPlanned + summary.totalDone} Tasks erledigt
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{
                    width: `${Math.round((summary.totalDone / (summary.totalOpen + summary.totalPlanned + summary.totalDone)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
