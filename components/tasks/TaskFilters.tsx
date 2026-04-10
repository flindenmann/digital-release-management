"use client";

import { TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS: { value: TaskStatus | "ALL"; label: string }[] = [
  { value: "ALL",      label: "Alle" },
  { value: "OPEN",     label: "Offen" },
  { value: "PLANNED",  label: "Geplant" },
  { value: "DONE",     label: "Erledigt" },
  { value: "ARCHIVED", label: "Archiviert" },
];

interface TaskFiltersProps {
  activeStatus: TaskStatus | "ALL";
  onStatusChange: (status: TaskStatus | "ALL") => void;
  onlyOwn: boolean;
  onOnlyOwnChange: (value: boolean) => void;
  canViewAll: boolean;
}

export function TaskFilters({
  activeStatus,
  onStatusChange,
  onlyOwn,
  onOnlyOwnChange,
  canViewAll,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        {STATUS_OPTIONS.filter(
          (o) => o.value !== "ARCHIVED" || activeStatus === "ARCHIVED"
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeStatus === opt.value
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {canViewAll && (
        <Button
          variant={onlyOwn ? "default" : "outline"}
          size="sm"
          onClick={() => onOnlyOwnChange(!onlyOwn)}
        >
          Nur meine Tasks
        </Button>
      )}
    </div>
  );
}
