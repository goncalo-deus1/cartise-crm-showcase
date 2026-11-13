import type { NextRequest } from "next/server";
import { DOMAIN_RE } from "@/lib/domain";
import { getCurrentMember } from "@/lib/team";

const WEEK = 60 * 60 * 24 * 7;
const MAX_BYTES = 200_000;
/** Raster formats only: an SVG served from our own origin could run script. */
const IMAGE_TYPES = new Set([
  "image/png",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** Icon services, best first. Both answer 404 when they have nothing for the domain. */
const SOURCES = [
  (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`,
  (d: string) => `https://icons.duckduckgo.com/ip3/${d}.ico`,
];

/**
 * GET /api/logo?d=smileup.pt → the company's icon, for team members only.
 * Fetched server-side so the browser never sends lead domains to third parties, and
 * cached in the browser for a week. 404 when no service has an icon.
 */
export async function GET(request: NextRequest) {
  // The /dev sample previews (development only) show logos without signing in.
  if (process.env.NODE_ENV !== "development" && !(await getCurrentMember())) {
    return new Response(null, { status: 403 });
  }
  const domain = (request.nextUrl.searchParams.get("d") ?? "").trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) return new Response(null, { status: 400 });

  let unreachable = false;
  for (const source of SOURCES) {
    try {
      const res = await fetch(source(domain), { signal: AbortSignal.timeout(4000), next: { revalidate: WEEK } });
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const length = Number(res.headers.get("content-length") ?? 0);
      if (!res.ok || !IMAGE_TYPES.has(type) || length > MAX_BYTES) {
        await res.body?.cancel();
        continue;
      }
      const body = await res.arrayBuffer();
      if (body.byteLength === 0 || body.byteLength > MAX_BYTES) continue;
      return new Response(body, {
        headers: {
          "Content-Type": type,
          "Cache-Control": `private, max-age=${WEEK}`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    } catch {
      unreachable = true; // timeout or network error: try the next source
    }
  }
  // A real "no icon" is remembered for a day; a failed lookup is retried next time.
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": unreachable ? "no-store" : "private, max-age=86400" },
  });
}
