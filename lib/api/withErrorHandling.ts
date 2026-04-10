import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

type ApiErrorCode =
  | "CONFLICT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "INTERNAL";

interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details && process.env.NODE_ENV !== "production" ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

type RouteHandler = (
  req: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Middleware-Wrapper für alle App-Router Route Handlers.
 * Fängt bekannte Fehlerklassen ab und gibt einheitliche JSON-Fehlerantworten zurück.
 *
 * Verwendung:
 *   export const GET = withErrorHandling(async (req) => { ... });
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (err) {
      // Logging — in Produktion durch strukturiertes Logging ersetzen
      console.error(
        JSON.stringify({
          level: "error",
          url: req.url,
          method: req.method,
          error: err instanceof Error ? err.message : String(err),
          stack:
            process.env.NODE_ENV !== "production" && err instanceof Error
              ? err.stack
              : undefined,
        })
      );

      if (err instanceof ConflictError) {
        return errorResponse(409, "CONFLICT", err.message);
      }
      if (err instanceof NotFoundError) {
        return errorResponse(404, "NOT_FOUND", err.message);
      }
      if (err instanceof ForbiddenError) {
        return errorResponse(403, "FORBIDDEN", err.message);
      }
      if (err instanceof UnauthorizedError) {
        return errorResponse(401, "UNAUTHORIZED", err.message);
      }
      if (err instanceof ValidationError) {
        return errorResponse(400, "VALIDATION", err.message, err.details);
      }
      if (err instanceof ZodError) {
        return errorResponse(
          400,
          "VALIDATION",
          "Ungültige Eingabedaten.",
          { issues: err.issues }
        );
      }

      return errorResponse(
        500,
        "INTERNAL",
        "Ein unerwarteter Fehler ist aufgetreten."
      );
    }
  };
}
