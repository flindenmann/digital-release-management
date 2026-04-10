"use client";

import { format, differenceInDays } from "date-fns";
import { AlertTriangle } from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface TimelineMilestone {
  id: string;
  key: string;
  title: string;
  startAt?: string | null;
  status: string;
  applicationSnapshot?: { name: string; prefix: string } | null;
  assignees?: Array<{ resourceSnapshot: { firstName: string; lastName: string } }>;
  hasConflict?: boolean;
}

interface MilestoneTimelineProps {
  milestones: TimelineMilestone[];
  onMilestoneClick?: (milestone: TimelineMilestone) => void;
}

// ─── Farben pro Status ────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { fill: string; stroke: string; textColor: string; label: string }> = {
  OPEN:     { fill: "#e5e7eb", stroke: "#9ca3af", textColor: "#6b7280", label: "Offen" },
  PLANNED:  { fill: "#fef9c3", stroke: "#eab308", textColor: "#854d0e", label: "Geplant" },
  DONE:     { fill: "#dcfce7", stroke: "#22c55e", textColor: "#166534", label: "Erledigt" },
  ARCHIVED: { fill: "#f3f4f6", stroke: "#d1d5db", textColor: "#9ca3af", label: "Archiviert" },
};

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Konstanten Layout ────────────────────────────────────────────────────────

const LINE_Y = 148;          // px: y-Position der Zeitlinie (von oben)
const DIAMOND = 14;          // px: Diamant-Kantenlänge
const ABOVE_CONNECTOR = 68;  // px: Länge des Verbindungsstrichs nach oben
const BELOW_CONNECTOR = 56;  // px: Länge des Verbindungsstrichs nach unten
const LABEL_HEIGHT = 64;     // px: reservierte Höhe pro Label-Block
const DATE_AREA_H = 36;      // px: Höhe des Datums-Bereichs unter der Zeitlinie
const CONTAINER_H = LINE_Y + DATE_AREA_H + BELOW_CONNECTOR + LABEL_HEIGHT + 12;
// ≈ 148 + 36 + 56 + 64 + 12 = 316 px

// ─── Komponente ───────────────────────────────────────────────────────────────

export function MilestoneTimeline({ milestones, onMilestoneClick }: MilestoneTimelineProps) {
  const sorted = [...milestones]
    .filter((m) => m.startAt)
    .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">Keine Meilensteine mit Datum vorhanden.</p>
      </div>
    );
  }

  // ── Zeitspanne berechnen ──────────────────────────────────────────────────

  const minTs = new Date(sorted[0].startAt!).getTime();
  const maxTs = new Date(sorted[sorted.length - 1].startAt!).getTime();
  const rangeDays = Math.max(differenceInDays(new Date(maxTs), new Date(minTs)), 1);
  const padDays = Math.max(Math.ceil(rangeDays * 0.08), 3);
  const startTs = minTs - padDays * 86_400_000;
  const endTs = maxTs + padDays * 86_400_000;
  const totalMs = endTs - startTs;

  function xPct(dateStr: string): number {
    return clamp(((new Date(dateStr).getTime() - startTs) / totalMs) * 100, 0, 100);
  }

  // ── Tick-Beschriftungen ───────────────────────────────────────────────────

  const totalDays = Math.ceil((endTs - startTs) / 86_400_000);
  const tickEvery =
    totalDays <= 7   ? 1 :
    totalDays <= 30  ? 7 :
    totalDays <= 90  ? 14 :
    totalDays <= 365 ? 30 : 90;

  const ticks: number[] = [];
  let cur = startTs;
  while (cur <= endTs) {
    ticks.push(cur);
    cur += tickEvery * 86_400_000;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border bg-background overflow-x-auto">
      {/* ── Haupt-Timeline-Bereich ─────────────────────────────────────── */}
      <div className="relative min-w-[620px] px-4" style={{ height: `${CONTAINER_H}px` }}>

        {/* Tick-Linien (vertikal, subtil) */}
        {ticks.map((ts, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `calc(${((ts - startTs) / totalMs) * 100}% + 16px)`,
              top: LINE_Y - ABOVE_CONNECTOR - LABEL_HEIGHT,
              bottom: 0,
              width: "1px",
              backgroundColor: "#f1f5f9",
            }}
          />
        ))}

        {/* Zeitlinie */}
        <div
          className="absolute"
          style={{
            left: "16px",
            right: "16px",
            top: `${LINE_Y}px`,
            height: "2px",
            backgroundColor: "#cbd5e1",
          }}
        />

        {/* Tick-Markierungen und Datumslabels */}
        {ticks.map((ts, i) => {
          const leftPct = ((ts - startTs) / totalMs) * 100;
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `calc(${leftPct}% + 16px)` }}
            >
              {/* Tick-Strich */}
              <div
                style={{
                  position: "absolute",
                  top: `${LINE_Y + 2}px`,
                  width: "1px",
                  height: "6px",
                  backgroundColor: "#94a3b8",
                  left: 0,
                }}
              />
              {/* Datums-Label */}
              <div
                style={{
                  position: "absolute",
                  top: `${LINE_Y + 12}px`,
                  left: "-22px",
                  width: "44px",
                  textAlign: "center",
                  fontSize: "10px",
                  color: "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                {format(new Date(ts), "dd.MM.")}
              </div>
            </div>
          );
        })}

        {/* Meilensteine */}
        {sorted.map((m, i) => {
          const x = xPct(m.startAt!);
          const isAbove = i % 2 === 0;
          const style = STATUS_STYLE[m.status] ?? STATUS_STYLE.OPEN;
          const dt = new Date(m.startAt!);

          return (
            <div
              key={m.id}
              className="absolute"
              style={{ left: `calc(${x}% + 16px)` }}
            >
              {/* Verbindungslinie */}
              <div
                style={{
                  position: "absolute",
                  left: "-1px",
                  width: "2px",
                  backgroundColor: style.stroke,
                  opacity: 0.45,
                  ...(isAbove
                    ? {
                        bottom: `${CONTAINER_H - LINE_Y + DIAMOND / 2 - 1}px`,
                        height: `${ABOVE_CONNECTOR}px`,
                      }
                    : {
                        top: `${LINE_Y + DIAMOND / 2 + 1}px`,
                        height: `${BELOW_CONNECTOR}px`,
                      }),
                }}
              />

              {/* Diamant */}
              <div
                className="absolute cursor-pointer transition-all hover:scale-125"
                style={{
                  width: `${DIAMOND}px`,
                  height: `${DIAMOND}px`,
                  backgroundColor: style.fill,
                  border: `2px solid ${style.stroke}`,
                  transform: `translateX(-50%) translateY(-50%) rotate(45deg)`,
                  top: `${LINE_Y}px`,
                  left: "0",
                  zIndex: 10,
                  boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.15)",
                }}
                onClick={() => onMilestoneClick?.(m)}
                title={m.title}
              />

              {/* Label */}
              <div
                className="absolute cursor-pointer select-none"
                style={{
                  left: "-56px",
                  width: "112px",
                  textAlign: "center",
                  ...(isAbove
                    ? {
                        bottom: `${CONTAINER_H - LINE_Y + DIAMOND / 2 + ABOVE_CONNECTOR + 4}px`,
                      }
                    : {
                        top: `${LINE_Y + DIAMOND / 2 + BELOW_CONNECTOR + 6}px`,
                      }),
                }}
                onClick={() => onMilestoneClick?.(m)}
              >
                <div className="flex flex-col items-center gap-0.5">
                  {m.hasConflict && (
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  <span
                    className="font-mono leading-none"
                    style={{ fontSize: "10px", color: style.stroke }}
                  >
                    {m.key}
                  </span>
                  <span
                    className="font-medium leading-tight line-clamp-2"
                    style={{ fontSize: "11px", color: style.textColor, maxWidth: "108px" }}
                  >
                    {m.title}
                  </span>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {format(dt, "dd.MM. HH:mm")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legende ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap px-4 py-2 border-t bg-muted/20">
        {Object.entries(STATUS_STYLE).map(([status, s]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              style={{
                width: "10px",
                height: "10px",
                backgroundColor: s.fill,
                border: `1.5px solid ${s.stroke}`,
                transform: "rotate(45deg)",
                flexShrink: 0,
              }}
            />
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
