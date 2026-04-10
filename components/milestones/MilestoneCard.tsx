import { format } from "date-fns";
import { AlertTriangle, Lock } from "lucide-react";
import { MilestoneStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  MilestoneStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" }
> = {
  OPEN:     { label: "Offen",      variant: "outline" },
  PLANNED:  { label: "Geplant",    variant: "warning" },
  DONE:     { label: "Erledigt",   variant: "success" },
  ARCHIVED: { label: "Archiviert", variant: "secondary" },
};

interface MilestoneCardProps {
  milestone: {
    id: string;
    key: string;
    title: string;
    description?: string | null;
    dateTime: string;
    isFixed: boolean;
    status: MilestoneStatus;
    applicationSnapshot: { name: string; prefix: string };
    responsible?: { firstName: string; lastName: string } | null;
    predecessors?: {
      type: string;
      task?: { endAt?: string | null; startAt?: string | null } | null;
      predecessorMilestone?: { dateTime?: string | null } | null;
    }[];
  };
  hasConflict?: boolean;
  onClick?: () => void;
}

export function MilestoneCard({ milestone, hasConflict = false, onClick }: MilestoneCardProps) {
  const { label, variant } = STATUS_CONFIG[milestone.status];
  const dt = new Date(milestone.dateTime);
  const dateStr = format(dt, "dd.MM.yyyy");
  const timeStr = format(dt, "HH:mm");
  const responsible = milestone.responsible
    ? `${milestone.responsible.firstName} ${milestone.responsible.lastName}`
    : "–";

  return (
    <tr
      className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Spalte 1: Nummer */}
      <td className="py-2 px-3 text-sm font-mono whitespace-nowrap text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {hasConflict && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-amber-500 shrink-0"
              title="Meilenstein-Konflikt: Vorgänger liegt nach dem Meilenstein-Datum"
            />
          )}
          {milestone.key}
        </span>
      </td>
      {/* Spalte 2: Datum */}
      <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{dateStr}</td>
      {/* Spalte 3: Uhrzeit */}
      <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{timeStr}</td>
      {/* Spalte 4: Applikation */}
      <td className="py-2 px-3 text-sm whitespace-nowrap max-w-[160px] truncate">
        {milestone.applicationSnapshot.name}
      </td>
      {/* Spalte 5: Titel */}
      <td className="py-2 px-3 text-sm">{milestone.title}</td>
      {/* Spalte 6: Verantwortlich */}
      <td className="py-2 px-3 text-sm whitespace-nowrap">{responsible}</td>
      {/* Spalte 7: Typ (fix/variabel) */}
      <td className="py-2 px-3 text-sm whitespace-nowrap">
        {milestone.isFixed && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-xs">Fix</span>
          </span>
        )}
      </td>
      {/* Spalte 8: Status */}
      <td className="py-2 px-3 text-sm whitespace-nowrap">
        <Badge variant={variant}>{label}</Badge>
      </td>
    </tr>
  );
}
