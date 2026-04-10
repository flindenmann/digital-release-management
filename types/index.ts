/**
 * Zentrale TypeScript-Typen für die dRM-App.
 *
 * Prisma-generierte Typen werden direkt aus @prisma/client importiert.
 * Hier leben ergänzende DTO-Typen, API-Payload-Typen und UI-Typen.
 */

export type {
  User,
  Team,
  GlobalResource,
  GlobalApplication,
  Release,
  ProjectUser,
  ResourceSnapshot,
  ApplicationSnapshot,
  Task,
  TaskAssignee,
  TaskDependency,
  TaskAttachment,
  TaskComment,
  Milestone,
  MilestoneDependency,
  AuditLog,
  ProjectRole,
  TaskStatus,
  MilestoneStatus,
  DependencyType,
  AuditAction,
  AttachmentType,
} from "@prisma/client";

// ─── Session-Erweiterung ──────────────────────────────────────────────────────

import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      mustChangePassword: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    mustChangePassword: boolean;
  }
}

// ─── API-Antworttypen ─────────────────────────────────────────────────────────

export type ApiErrorCode =
  | "CONFLICT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "INTERNAL";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessBody<T> {
  data: T;
}

export type ApiResponse<T> = ApiSuccessBody<T> | ApiErrorBody;

// ─── Task-Key-Generierung ─────────────────────────────────────────────────────

/** Generiert einen Task-Key: "{PREFIX}-{4-stellige laufende Nummer}" */
export function formatTaskKey(prefix: string, counter: number): string {
  return `${prefix}-${String(counter).padStart(4, "0")}`;
}

// ─── Realtime-Konfiguration ───────────────────────────────────────────────────

export const REALTIME_ENABLED =
  process.env.REALTIME_ENABLED === "true";

export const POLLING_INTERVAL_MS = 10_000;
