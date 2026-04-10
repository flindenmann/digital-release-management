import { ProjectRole } from "@prisma/client";

/**
 * Zentrales Berechtigungssystem.
 *
 * Verwendung:
 *   if (!can(userRole, "task:delete")) throw new ForbiddenError();
 *
 * Rollen sind pro Release vergeben (Tabelle ProjectUser).
 * Eine Person kann in Release A Release Manager und in Release B Sachbearbeiter sein.
 */

export type Action =
  // Tasks
  | "task:view"
  | "task:view:all"       // alle Tasks sehen (vs. nur eigene)
  | "task:create"
  | "task:edit"
  | "task:delete"
  | "task:archive"
  // Milestones
  | "milestone:view"
  | "milestone:edit"
  // Releases
  | "release:manage"
  // Users
  | "user:manage"
  // Global Lists
  | "globalList:edit"
  // Import / Export
  | "import:export";

const PERMISSIONS: Record<ProjectRole, Set<Action>> = {
  RELEASE_MANAGER: new Set([
    "task:view",
    "task:view:all",
    "task:create",
    "task:edit",
    "task:delete",
    "task:archive",
    "milestone:view",
    "milestone:edit",
    "release:manage",
    "user:manage",
    "globalList:edit",
    "import:export",
  ]),
  SACHBEARBEITER: new Set([
    "task:view",
    "task:create",
    "task:edit",
    "task:archive",
    "milestone:view",
  ]),
  MANAGER: new Set([
    "task:view",
    "task:view:all",
    "milestone:view",
  ]),
};

/**
 * Prüft ob ein User (mit seiner Rolle in einem bestimmten Release)
 * eine Aktion ausführen darf.
 *
 * @param role     Rolle des Users im betreffenden Release
 * @param action   Die zu prüfende Aktion
 * @returns        true wenn erlaubt, false wenn verboten
 */
export function can(role: ProjectRole, action: Action): boolean {
  return PERMISSIONS[role]?.has(action) ?? false;
}

/**
 * Sachbearbeiter sehen nur ihre eigenen Tasks — diese Funktion prüft,
 * ob ein User alle Tasks sehen darf oder nur eigene.
 */
export function canViewAllTasks(role: ProjectRole): boolean {
  return can(role, "task:view:all");
}
