import { NextResponse } from "next/server";

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    if (trimmed.slice(0, separator) === name) {
      return decodeURIComponent(trimmed.slice(separator + 1));
    }
  }

  return undefined;
}

export function isValidAdminSecret(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return false;
  }

  if (request.headers.get("x-admin-secret") === secret) {
    return true;
  }

  return getCookieValue(request.headers.get("cookie"), "admin-secret") === secret;
}

export function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
