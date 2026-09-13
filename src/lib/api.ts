import { NextResponse } from "next/server";

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
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
