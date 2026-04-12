import { format } from "date-fns";
import { AlertTriangle, Diamond, Folder, FolderOpen, ArrowRightToLine, ArrowLeftToLine, MessageSquare } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { Task, TaskAssignee, ResourceSnapshot, ApplicationSnapshot, TaskStatus } from "@prisma/client";

type TaskWithRelations = Task & {
  applicationSnapshot: Pick<ApplicationSnapshot, "name" | "prefix">;
  assignees: (TaskAssignee & { resourceSnapshot: Pick<ResourceSnapshot, "id" | "firstName" | "lastName" | "email"> })[];
  _count: { comments: number; attachments: number };
  predecessors?: { predecessorId: string; predecessor: { id: string; key: string; startAt: string | null; endAt: string | null } }[];
  successors?: { successorId: string; successor: { id: string; key: string } }[];
};

interface TaskCardProps {
  task: TaskWithRelations;
  isInvalid?: boolean;
  onClick?: () => void;
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

  const predecessors     = task.predecessors ?? [];
  const successors       = task.successors ?? [];
  const predecessorCount = predecessors.length;
  const successorCount   = successors.length;
  const commentCount     = task._count.comments ?? 0;

  const predecessorTooltip = predecessorCount === 0 ? "" :
    `${predecessorCount} Vorgänger: ${predecessors.map((d) => d.predecessor.key).join(", ")}`;
  const successorTooltip = successorCount === 0 ? "" :
    `${successorCount} Nachfolger: ${successors.map((d) => d.successor.key).join(", ")}`;

  let rowClass = "border-b cursor-pointer transition-colors ";
  if (isSummaryTask) {
    rowClass += "bg-gray-200/80 hover:bg-gray-300/80 dark:bg-gray-700/60 dark:hover:bg-gray-700/80 font-medium";
  } else if (task.isMilestone) {
    rowClass += "bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-900/20 dark:hover:bg-blue-900/30";
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
              onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
              className="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title={isExpanded ? "Zugehörige Tasks ausblenden" : "Zugehörige Tasks anzeigen"}
            >
              {isExpanded ? <FolderOpen className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
            </button>
          )}
        </span>
      </td>
      <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{date}</td>
      <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{startTime}</td>
      <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{endTime}</td>
      <td className="py-2 px-3 text-sm whitespace-nowrap">{duration}</td>
      <td className="py-2 px-3 text-sm truncate">{task.title}</td>

      {/* Vorgänger */}
      <td className="py-2 px-3 text-center whitespace-nowrap">
        {predecessorCount > 0 ? (
          <span
            title={predecessorTooltip}
            className="inline-flex items-center justify-center gap-0.5 text-muted-foreground"
          >
            <ArrowRightToLine className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs leading-none">{predecessorCount}</span>
          </span>
        ) : null}
      </td>

      {/* Nachfolger */}
      <td className="py-2 px-3 text-center whitespace-nowrap">
        {successorCount > 0 ? (
          <span
            title={successorTooltip}
            className="inline-flex items-center justify-center gap-0.5 text-muted-foreground"
          >
            <ArrowLeftToLine className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs leading-none">{successorCount}</span>
          </span>
        ) : null}
      </td>

      {/* Kommentare */}
      <td className="py-2 px-3 text-center whitespace-nowrap">
        {commentCount > 0 ? (
          <span
            title={`${commentCount} Kommentar${commentCount !== 1 ? "e" : ""}`}
            className="inline-flex items-center justify-center gap-0.5 text-muted-foreground"
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs leading-none">{commentCount}</span>
          </span>
        ) : null}
      </td>

      {/* Applikation: bei Sammeltask leer */}
      <td className="py-2 px-3 text-sm whitespace-nowrap truncate">
        {isSummaryTask ? "" : task.applicationSnapshot.name}
      </td>
      <td className="py-2 px-3 text-sm whitespace-nowrap truncate">
        {assignees}
      </td>
      {/* Status: bei Sammeltask berechneter Minimal-Status */}
      <td className="py-2 px-3 text-sm whitespace-nowrap">
        {isSummaryTask
          ? (computedStatus ? <StatusBadge status={computedStatus as TaskStatus} /> : "")
          : <StatusBadge status={task.status} />
        }
      </td>
    </tr>
  );
}
