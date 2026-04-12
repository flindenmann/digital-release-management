"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronDown, ChevronRight, History } from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  changedFields: string[];
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

interface HistoryPanelProps {
  historyUrl: string;
  /** Übersetzung von Feldnamen → lesbaren Labels */
  fieldLabels?: Record<string, string>;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Erstellt",
  UPDATE: "Geändert",
  DELETE: "Gelöscht",
};

const ACTION_COLOR: Record<string, string> = {
  CREATE: "text-green-700 bg-green-50 border-green-200",
  UPDATE: "text-blue-700 bg-blue-50 border-blue-200",
  DELETE: "text-red-700 bg-red-50 border-red-200",
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Ja" : "Nein";
  if (typeof val === "string") {
    // ISO-Datums erkennen
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return format(d, "dd.MM.yy HH:mm", { locale: de });
    }
    return val;
  }
  if (typeof val === "number") return String(val);
  return JSON.stringify(val);
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function HistoryPanel({ historyUrl, fieldLabels = {} }: HistoryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: AuditLogEntry[] }>({
    queryKey: ["history", historyUrl],
    queryFn: async () => {
      const res = await fetch(historyUrl);
      if (!res.ok) throw new Error("Verlauf konnte nicht geladen werden.");
      return res.json();
    },
    enabled: expanded,
  });

  const entries = data?.data ?? [];

  return (
    <div className="rounded-md border border-muted">
      {/* Header – immer sichtbar */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">Verlauf</span>
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 ml-auto" />
          : <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t divide-y max-h-64 overflow-y-auto">
          {isLoading && (
            <div className="px-3 py-3 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-5 rounded bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted-foreground">Kein Verlauf vorhanden.</p>
          )}

          {!isLoading && entries.map((entry) => {
            const isOpen = openEntryId === entry.id;
            const hasDetails = entry.action === "UPDATE" && entry.changedFields.length > 0;
            const user = `${entry.user.firstName} ${entry.user.lastName}`;
            const time = format(new Date(entry.createdAt), "dd.MM.yy HH:mm", { locale: de });

            return (
              <div key={entry.id} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {/* Aktion-Badge */}
                  <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${ACTION_COLOR[entry.action]}`}>
                    {ACTION_LABEL[entry.action]}
                  </span>

                  {/* User + Zeit */}
                  <span className="text-xs text-foreground">{user}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{time}</span>

                  {/* Aufklapp-Button für Details */}
                  {hasDetails && (
                    <button
                      type="button"
                      onClick={() => setOpenEntryId(isOpen ? null : entry.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isOpen
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>

                {/* Geänderte Felder */}
                {hasDetails && isOpen && (
                  <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-muted ml-1">
                    {entry.changedFields.map((field) => {
                      const label = fieldLabels[field] ?? field;
                      const oldVal = formatValue(entry.oldValues?.[field]);
                      const newVal = formatValue(entry.newValues?.[field]);
                      return (
                        <div key={field} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{label}</span>
                          {": "}
                          <span className="line-through opacity-60">{oldVal}</span>
                          {" → "}
                          <span>{newVal}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
