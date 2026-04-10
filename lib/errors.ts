/**
 * Zentrale Fehlerklassen für die dRM-App.
 * Werden in withErrorHandling.ts auf HTTP-Statuscodes gemappt.
 */

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** HTTP 409 — Optimistic Locking fehlgeschlagen oder Duplikat */
export class ConflictError extends AppError {
  constructor(
    message = "Dieser Datensatz wurde zwischenzeitlich geändert. Bitte Seite neu laden."
  ) {
    super(message);
  }
}

/** HTTP 404 — Ressource nicht gefunden */
export class NotFoundError extends AppError {
  constructor(resource = "Ressource") {
    super(`${resource} wurde nicht gefunden.`);
  }
}

/** HTTP 403 — Keine Berechtigung */
export class ForbiddenError extends AppError {
  constructor(message = "Sie haben keine Berechtigung für diese Aktion.") {
    super(message);
  }
}

/** HTTP 401 — Nicht authentifiziert */
export class UnauthorizedError extends AppError {
  constructor(message = "Bitte melden Sie sich an.") {
    super(message);
  }
}

/** HTTP 400 — Validierungsfehler (Zod) */
export class ValidationError extends AppError {
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}
