import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";

type AuthenticatedHandler = (
  req: NextRequest,
  context: { params: Record<string, string> },
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>
) => Promise<NextResponse>;

type RouteHandler = (
  req: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Stellt sicher, dass nur authentifizierte User einen Route Handler aufrufen.
 * Gibt HTTP 401 zurück, wenn keine gültige Session vorhanden ist.
 *
 * Verwendung:
 *   export const GET = withErrorHandling(withAuth(async (req, ctx, session) => { ... }));
 */
export function withAuth(handler: AuthenticatedHandler): RouteHandler {
  return async (req, context) => {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new UnauthorizedError();
    }
    return handler(req, context, session);
  };
}
