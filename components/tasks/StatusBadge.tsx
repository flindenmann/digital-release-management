import { TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" }
> = {
  OPEN:     { label: "Offen",       variant: "outline" },
  PLANNED:  { label: "Geplant",     variant: "warning" },
  DONE:     { label: "Erledigt",    variant: "success" },
  ARCHIVED: { label: "Archiviert",  variant: "secondary" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { label, variant } = STATUS_CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}
