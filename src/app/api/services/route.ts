import { NextRequest, NextResponse } from "next/server";
import { jsonError, parsePositiveInt } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Service, ServicesResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const masterId = parsePositiveInt(request.nextUrl.searchParams.get("masterId"));

  if (!masterId) {
    return jsonError("Укажите корректный masterId", 400);
  }

  try {
    const { data: master, error: masterError } = await supabase
      .from("masters")
      .select("id")
      .eq("id", masterId)
      .maybeSingle();

    if (masterError) {
      return jsonError(masterError.message, 500);
    }

    if (!master) {
      return jsonError("Мастер не найден", 404);
    }

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select(
        "id, organization_id, master_id, name, duration_min, price, is_active, created_at",
      )
      .eq("master_id", masterId)
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (servicesError) {
      return jsonError(servicesError.message, 500);
    }

    const body: ServicesResponse = { services: (services ?? []) as Service[] };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить услуги";
    return jsonError(message, 500);
  }
}
