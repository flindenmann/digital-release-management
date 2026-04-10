import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Authentifizierter User mit mustChangePassword → auf set-password weiterleiten
    if (
      token?.mustChangePassword &&
      pathname !== "/set-password" &&
      !pathname.startsWith("/api/auth")
    ) {
      return NextResponse.redirect(new URL("/set-password", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Route nur aufrufen wenn ein Token vorhanden ist
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Öffentliche Routen ohne Auth
        if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
          return true;
        }
        return Boolean(token);
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    // Alle Routen ausser statischen Assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
