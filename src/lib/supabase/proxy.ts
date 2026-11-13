import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /dev is a sample-data preview for UI work; it 404s outside `next dev`.
// The digest route checks its own CRON_SECRET (Vercel Cron has no user session).
// Listed exactly, so new /api routes never become public by accident.
const CRON_PATHS = ["/api/cron/digest", "/api/cron/zoho"];
// In development the /dev sample previews (and the logos they show) work without signing in.
const PUBLIC_PATHS = process.env.NODE_ENV === "development" ? ["/login", "/dev", "/api/logo"] : ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token. Do not run code between createServerClient and getClaims.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isPublic = CRON_PATHS.includes(path) || PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!signedIn && !isPublic) return redirectKeepingCookies(request, response, "/login");
  if (signedIn && path === "/login") return redirectKeepingCookies(request, response, "/");

  return response;
}

/** Redirect, but carry over any auth cookies Supabase just refreshed or cleared. */
function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}
