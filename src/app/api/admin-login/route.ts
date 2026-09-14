import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import {
  getClientIp,
  isRateLimited,
  peekRateLimited,
  resetRateLimit,
} from "@/lib/rate-limit";

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const limitKey = `admin-login:${getClientIp(request)}`;

  if (peekRateLimited(limitKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)) {
    return jsonError("Слишком много неудачных попыток. Подождите 15 минут", 429);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400);
  }

  const secret =
    body && typeof body === "object" && !Array.isArray(body) && typeof (body as { secret?: unknown }).secret === "string"
      ? (body as { secret: string }).secret
      : "";

  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    isRateLimited(limitKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
    return NextResponse.json({ error: "Неверный секрет" }, { status: 401 });
  }

  resetRateLimit(limitKey);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin-secret", secret, {
    httpOnly: true,
    maxAge: 86400,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
