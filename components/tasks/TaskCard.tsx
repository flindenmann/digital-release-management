import { format } from "date-fns";
import { AlertTriangle, Diamond, Folder, FolderOpen } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { Task, TaskAssignee, ResourceSnapshot, ApplicationSnapshot, TaskStatus } from "@prisma/client";

type TaskWithRelations = Task & {
  applicationSnapshot: Pick<ApplicationSnapshot, "name" | "prefix">;
  assignees: (TaskAssignee & { resourceSnapshot: Pick<ResourceSnapshot, "id" | "firstName" | "lastName" | "email"> })[];
  _count: { comments: number; attachments: number };
};

interface TaskCardProps {
  task: TaskWithRelations;
  isInvalid?: boolean;
  onClick?: () => void;
  // Sammeltask-spezifische Props
  isChild?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  computedStartAt?: string | null;
  computedEndAt?: string | null;
  computedStatus?: string | null;
  computedDurationMinutes?: number | null;
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "–";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TaskCard({
  task,
  isInvalid = false,
  onClick,
  isChild = false,
  isExpanded,
  onToggleExpand,
  computedStartAt,
  computedEndAt,
  computedStatus,
  computedDurationMinutes,
}: TaskCardProps) {
  const isSummaryTask = task.isSummaryTask;

  // Für Sammeltasks: berechnete Zeiten verwenden
  const effectiveStartAt = isSummaryTask ? (computedStartAt ?? null) : task.startAt;
  const effectiveEndAt   = isSummaryTask ? (computedEndAt   ?? null) : task.endAt;

  const date = effectiveStartAt
    ? format(new Date(effectiveStartAt), "dd.MM.yyyy")
    : effectiveEndAt
    ? format(new Date(effectiveEndAt), "dd.MM.yyyy")
    : "–";

  const startTime = effectiveStartAt ? format(new Date(effectiveStartAt), "HH:mm") : "–";
  const endTime   = effectiveEndAt   ? format(new Date(effectiveEndAt),   "HH:mm") : "–";
  const duration  = isSummaryTask
    ? formatDuration(computedDurationMinutes ?? null)
    : formatDuration(task.durationMinutes);

  const assignees =
    task.assignees.length > 0
      ? task.assignees
          .map((a) => `${a.resourceSnapshot.firstName} ${a.resourceSnapshot.lastName}`)
          .join(", ")
      : "–";

  // Hintergrundfarbe
  let rowClass = "border-b cursor-pointer transition-colors ";
  if (isSummaryTask) {
    rowClass += "bg-gray-100/70 hover:bg-gray-200/70 dark:bg-gray-800/50 dark:hover:bg-gray-800/70 font-medium";
  } else if (task.isMilestone) {
    rowClass += "bg-yellow-50/30 hover:bg-yellow-100/40 dark:bg-yellow-900/10 dark:hover:bg-yellow-900/20";
  } else {
    rowClass += "hover:bg-muted/50";
  }

  return (
    <tr className={rowClass} onClick={onClick}>
      {/* Nr. / Key */}
      <td className="py-2 px-3 text-sm font-mono whitespace-nowrap text-muted-foreground">
        <span className={`flex items-center gap-1.5 ${isChild ? "pl-6" : ""}`}>
          {isInvalid && (
            <span title="Zeiten veraltet — Vorgänger wurde verschoben">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            </span>
          )}
          {task.key}
          {task.isMilestone && (
            <Diamond className="h-3 w-3 text-purple-500 shrink-0" />
          )}
          {isSummaryTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              className="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title={isExpanded ? "Zugehörige Tasks ausblenden" : "Zugehörige Tasks anzeigen"}
            >
              {isExpanded
                ? <FolderOpen className="h-3.5 w-3.5" />
                : <Folder className="h-3.5 w-3.5" />
              }
            </button>
          )}
        </span>
      </td>
      <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{date}</td>
      <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{startTime}</td>
      <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{endTime}</td>
      <td className="py-2 px-3 text-sm whitespace-nowrap">
        {duration}
      </td>
      <td className="py-2 px-3 text-sm">{task.title}</td>
      {/* Applikation: bei Sammeltask leer (Kinder können verschiedene haben) */}
      <td className="py-2 px-3 text-sm whitespace-nowrap max-w-[160px] truncate">
        {isSummaryTask ? "" : task.applicationSnapshot.name}
      </td>
      <td className="py-2 px-3 text-sm whitespace-nowrap max-w-[180px] truncate">
        {assignees}
      </td>
      {/* Status: bei Sammeltask berechneter Minimal-Status der Kinder */}
      <td className="py-2 px-3 text-sm whitespace-nowrap">
        {isSummaryTask
          ? (computedStatus ? <StatusBadge status={computedStatus as TaskStatus} /> : "")
          : <StatusBadge status={task.status} />
        }
      </td>
    </tr>
  );
}
