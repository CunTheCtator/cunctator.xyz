import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const isAdmin = req.nextauth.token?.isAdmin === true;

    if (!isAdmin) {
      const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
      if (isApiRoute) {
        return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/api/auth/signin", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => token !== null,
    },
  }
);

// /api/upload is deliberately NOT matched here: middleware passthrough
// truncates multipart bodies somewhere past 5MB, and the spec requires
// 15MB+ uploads. The route enforces auth itself via requireAdmin (401).
export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/documents/:path*"],
};
