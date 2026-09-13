import { NextRequest, NextResponse } from "next/server";
import { jsonError, parsePositiveInt } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { WorkingHour, WorkingHoursResponse } from "@/lib/types";

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

    const { data: workingHours, error: hoursError } = await supabase
      .from("working_hours")
      .select("id, master_id, day_of_week, start_time, end_time, is_active")
      .eq("master_id", masterId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (hoursError) {
      return jsonError(hoursError.message, 500);
    }

    const body: WorkingHoursResponse = {
      workingHours: (workingHours ?? []) as WorkingHour[],
    };

    return NextResponse.json(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить рабочие часы";
    return jsonError(message, 500);
  }
}
