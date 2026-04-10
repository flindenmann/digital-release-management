import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface LogAuditParams {
  entity: string;
  entityId: string;
  action: AuditAction;
  userId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

/**
 * Schreibt einen AuditLog-Eintrag für jede Schreiboperation auf
 * Tasks, Meilensteinen, Releases und Benutzern.
 *
 * changedFields wird automatisch aus dem Diff zwischen oldValues und newValues
 * berechnet — nur Felder, die sich tatsächlich geändert haben.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  const changedFields: string[] =
    params.oldValues && params.newValues
      ? Object.keys(params.newValues).filter(
          (key) =>
            JSON.stringify(params.oldValues![key]) !==
            JSON.stringify(params.newValues![key])
        )
      : params.newValues
        ? Object.keys(params.newValues)
        : [];

  await prisma.auditLog.create({
    data: {
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      changedFields,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
    },
  });
}
