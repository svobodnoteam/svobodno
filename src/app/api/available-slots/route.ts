import { NextRequest, NextResponse } from "next/server";
import { jsonError, parsePositiveInt } from "@/lib/api";
import {
  addMinutes,
  dayOfWeekInTimeZone,
  formatMinutes,
  isValidDateString,
  matchesWorkingDay,
  minutesOfDay,
  parseDbSlotTimeAsUtc,
  PROJECT_TIME_ZONE,
  rangesOverlap,
  toHHMM,
  zonedDateTimeToUtc,
} from "@/lib/datetime";
import { getSupabaseAdmin, supabase } from "@/lib/supabase";
import type {
  AvailableSlot,
  AvailableSlotsResponse,
  Organization,
  Service,
  WorkingHour,
} from "@/lib/types";

export async function GET(request: NextRequest) {
  const masterId = parsePositiveInt(request.nextUrl.searchParams.get("masterId"));
  const serviceId = parsePositiveInt(request.nextUrl.searchParams.get("serviceId"));
  const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";

  if (!masterId) {
    return jsonError("Укажите корректный masterId", 400);
  }

  if (!serviceId) {
    return jsonError("Укажите корректный serviceId", 400);
  }

  if (!isValidDateString(date)) {
    return jsonError("Укажите дату в формате YYYY-MM-DD", 400);
  }

  try {
    const { data: master, error: masterError } = await supabase
      .from("masters")
      .select("id, organization_id")
      .eq("id", masterId)
      .maybeSingle();

    if (masterError) {
      return jsonError(masterError.message, 500);
    }

    if (!master) {
      return jsonError("Мастер не найден", 404);
    }

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, master_id, duration_min, is_active")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) {
      return jsonError(serviceError.message, 500);
    }

    if (!service) {
      return jsonError("Услуга не найдена", 404);
    }

    const typedService = service as Pick<
      Service,
      "id" | "master_id" | "duration_min" | "is_active"
    >;

    if (typedService.master_id !== masterId || !typedService.is_active) {
      return jsonError("Услуга недоступна для этого мастера", 400);
    }

    const durationMin = typedService.duration_min;
    if (!Number.isInteger(durationMin) || durationMin <= 0) {
      return jsonError("У услуги задана некорректная длительность", 500);
    }

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", master.organization_id)
      .maybeSingle();

    if (organizationError) {
      return jsonError(organizationError.message, 500);
    }

    const timeZone =
      (organization as Pick<Organization, "timezone"> | null)?.timezone || PROJECT_TIME_ZONE;
    const jsDay = dayOfWeekInTimeZone(date, timeZone);

    const { data: workingHours, error: hoursError } = await supabase
      .from("working_hours")
      .select("id, master_id, day_of_week, start_time, end_time, is_active")
      .eq("master_id", masterId)
      .eq("is_active", true);

    if (hoursError) {
      return jsonError(hoursError.message, 500);
    }

    const dayHours = ((workingHours ?? []) as WorkingHour[]).filter((row) =>
      matchesWorkingDay(row.day_of_week, jsDay),
    );

    const dayStart = zonedDateTimeToUtc(date, "00:00", timeZone);
    const dayEnd = addMinutes(dayStart, 24 * 60);

    const { data: catalog, error: catalogError } = await supabase
      .from("services")
      .select("name, duration_min")
      .eq("master_id", masterId);

    if (catalogError) {
      return jsonError(catalogError.message, 500);
    }

    const durationByName = new Map(
      ((catalog ?? []) as Pick<Service, "name" | "duration_min">[]).map((row) => [
        row.name,
        row.duration_min,
      ]),
    );

    const { data: bookings, error: bookingsError } = await getSupabaseAdmin()
      .from("bookings")
      .select("slot_time, service_type")
      .eq("master_id", masterId)
      .neq("status", "cancelled")
      .gte("slot_time", `${date}T00:00:00+03:00`)
      .lt("slot_time", `${date}T23:59:59+03:00`);

    if (bookingsError) {
      return jsonError(bookingsError.message, 500);
    }

    const busy = (
      (bookings ?? []) as Array<{ slot_time: string; service_type: string | null }>
    )
      .map((booking) => {
        // В БД slot_time лежит как UTC — переводим в тот же instant, что и слоты МСК.
        const start = parseDbSlotTimeAsUtc(booking.slot_time);
        const existingDuration =
          (booking.service_type && durationByName.get(booking.service_type)) || durationMin;
        return { start, end: addMinutes(start, existingDuration) };
      })
      .filter((range) => {
        if (Number.isNaN(range.start.getTime()) || Number.isNaN(range.end.getTime())) {
          return false;
        }

        return range.start < dayEnd && range.end > dayStart;
      });

    const now = new Date();
    const slots: AvailableSlot[] = [];

    for (const hours of dayHours) {
      const startMinutes = minutesOfDay(hours.start_time);
      const endMinutes = minutesOfDay(hours.end_time);

      for (let cursor = startMinutes; cursor + durationMin <= endMinutes; cursor += durationMin) {
        const time = formatMinutes(cursor);
        const slotStart = zonedDateTimeToUtc(date, time, timeZone);
        const slotEnd = addMinutes(slotStart, durationMin);

        if (slotStart <= now) {
          continue;
        }

        const overlaps = busy.some((range) =>
          rangesOverlap(slotStart, slotEnd, range.start, range.end),
        );

        if (!overlaps) {
          slots.push({ time: toHHMM(time), available: true });
        }
      }
    }

    const unique = new Map<string, AvailableSlot>();
    for (const slot of slots) {
      unique.set(slot.time, slot);
    }

    const body: AvailableSlotsResponse = {
      slots: [...unique.values()].sort((a, b) => a.time.localeCompare(b.time)),
    };

    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить слоты";
    return jsonError(message, 500);
  }
}
