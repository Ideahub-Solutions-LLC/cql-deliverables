import { env } from "cloudflare:workers";
import { SESSION_COOKIE, readCookie, sessionCookie, sha256Hex } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return Response.json({ error: "This sign-out request could not be verified." }, { status: 403 });
  }
  const token = readCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE);
  if (token && env.DB) {
    await env.DB!.prepare("DELETE FROM delivery_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  }
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie("", request.url, 0) } },
  );
}
