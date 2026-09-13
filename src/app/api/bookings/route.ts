import { NextRequest, NextResponse } from "next/server";
import { jsonError, parsePositiveInt } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Booking, BookingStatus } from "@/lib/types";

const BOOKING_COLUMNS =
  "id, organization_id, master_id, client_name, client_phone, service_type, slot_time, status, cancelled_at, created_at";

export const dynamic = "force-dynamic";

type BookingRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function nullableTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readTrimmedString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value.trim();
    }
  }

  return undefined;
}

function readPositiveInt(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return undefined;
}

function readInstantMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function serviceDurationMin(service: BookingRow): number | null {
  const raw = service.duration_min ?? service.duration;
  const duration = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return duration;
}

function serviceTypeName(service: BookingRow): string {
  if (typeof service.name === "string" && service.name.trim()) {
    return service.name.trim();
  }

  if (typeof service.type === "string" && service.type.trim()) {
    return service.type.trim();
  }

  return "";
}

function rangesOverlapMs(newStart: number, newEnd: number, existingStart: number, existingEnd: number) {
  return newStart < existingEnd && newEnd > existingStart;
}

function toBooking(
  created: BookingRow,
  fallback: {
    serviceId: number;
    startIso: string;
    endIso: string;
    status: BookingStatus;
    clientEmail?: string;
  },
): Booking {
  const startTime =
    (typeof created.start_time === "string" && created.start_time) ||
    (typeof created.slot_time === "string" && created.slot_time) ||
    fallback.startIso;
  const endTime = (typeof created.end_time === "string" && created.end_time) || fallback.endIso;
  const email =
    (typeof created.client_email === "string" && created.client_email) || fallback.clientEmail;
  const status = (created.status as BookingStatus | undefined) || fallback.status;

  return {
    id: Number(created.id),
    organization_id: (created.organization_id as number | null) ?? null,
    master_id: Number(created.master_id),
    service_id: (created.service_id as number | undefined) ?? fallback.serviceId,
    client_name: String(created.client_name ?? ""),
    client_phone: String(created.client_phone ?? ""),
    ...(email ? { client_email: email } : {}),
    service_type: String(created.service_type ?? ""),
    start_time: startTime,
    slot_time: typeof created.slot_time === "string" ? created.slot_time : startTime,
    end_time: endTime,
    status,
    cancelled_at: (created.cancelled_at as string | null) ?? undefined,
    created_at: String(created.created_at ?? new Date().toISOString()),
  };
}

function missingBookingsColumn(message: string): string | null {
  const match = message.match(/Could not find the '([^']+)' column of 'bookings'/);
  return match?.[1] ?? null;
}

async function insertBookingRow(admin: ReturnType<typeof getSupabaseAdmin>, payload: Record<string, unknown>) {
  const current = { ...payload };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await admin.from("bookings").insert(current).select("*").single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = missingBookingsColumn(error.message);
    if (missingColumn && Object.prototype.hasOwnProperty.call(current, missingColumn)) {
      delete current[missingColumn];
      continue;
    }

    return { data: null, error };
  }

  return {
    data: null,
    error: { message: "Не удалось создать запись", code: "500" },
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400);
  }

  const record = asRecord(body);
  if (!record) {
    return jsonError(
      "Ожидаются поля master_slug или master_id, service_id, start_time, client_name, client_phone",
      400,
    );
  }

  const masterIdInput = readPositiveInt(record, ["master_id", "masterId"]);
  const masterSlug = readTrimmedString(record, ["master_slug", "masterSlug"]);
  const serviceId = readPositiveInt(record, ["service_id", "serviceId"]);
  const startTimeRaw = readTrimmedString(record, ["start_time", "startTime", "slotTime"]);
  const clientName = readTrimmedString(record, ["client_name", "clientName"]);
  const clientPhone = readTrimmedString(record, ["client_phone", "clientPhone"]);
  const clientEmailRaw = readTrimmedString(record, ["client_email", "clientEmail"]);
  const clientEmail = clientEmailRaw ? clientEmailRaw : undefined;

  if (!masterIdInput && !masterSlug) {
    return jsonError("Укажите master_slug или master_id", 400);
  }

  if (!serviceId) {
    return jsonError("Укажите корректный service_id", 400);
  }

  if (!clientName) {
    return jsonError("Укажите имя клиента", 400);
  }

  if (!clientPhone) {
    return jsonError("Укажите телефон клиента", 400);
  }

  if (!startTimeRaw) {
    return jsonError("Укажите start_time", 400);
  }

  const startTime = new Date(startTimeRaw);
  if (Number.isNaN(startTime.getTime())) {
    return jsonError("start_time должен быть валидной ISO-датой", 400);
  }

  try {
    const admin = getSupabaseAdmin();

    let master: { id: number; organization_id: number | null } | null = null;

    if (masterIdInput) {
      const { data, error } = await admin
        .from("masters")
        .select("id, organization_id")
        .eq("id", masterIdInput)
        .maybeSingle();

      if (error) {
        return jsonError(error.message, 500);
      }

      master = (data as { id: number; organization_id: number | null } | null) ?? null;
    } else if (masterSlug) {
      const { data: organization, error: organizationError } = await admin
        .from("organizations")
        .select("id")
        .eq("slug", masterSlug)
        .maybeSingle();

      if (organizationError) {
        return jsonError(organizationError.message, 500);
      }

      if (organization) {
        const { data, error } = await admin
          .from("masters")
          .select("id, organization_id")
          .eq("organization_id", (organization as { id: number }).id)
          .order("is_admin", { ascending: false })
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          return jsonError(error.message, 500);
        }

        master = (data as { id: number; organization_id: number | null } | null) ?? null;
      }

      if (!master) {
        const { data, error } = await admin
          .from("masters")
          .select("id, organization_id")
          .eq("slug", masterSlug)
          .maybeSingle();

        if (!error) {
          master = (data as { id: number; organization_id: number | null } | null) ?? null;
        }
      }
    }

    if (!master) {
      return jsonError("Мастер не найден", 404);
    }

    const { data: service, error: serviceError } = await admin
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) {
      return jsonError(serviceError.message, 500);
    }

    if (!service) {
      return jsonError("Услуга не найдена", 404);
    }

    const typedService = service as BookingRow;
    const durationMin = serviceDurationMin(typedService);
    const serviceType = serviceTypeName(typedService);

    if (durationMin == null) {
      return jsonError("У услуги задана некорректная длительность", 500);
    }

    const endTime = new Date(startTime.getTime() + durationMin * 60000);
    const startIso = startTime.toISOString();
    const endIso = endTime.toISOString();
    const newStartMs = startTime.getTime();
    const newEndMs = endTime.getTime();

    console.log("[POST] conflict check for:", master.id, startIso, endIso);
    const { data: existingRows, error: existingError } = await admin
      .from("bookings")
      .select("*")
      .eq("master_id", master.id)
      .neq("status", "cancelled");

    if (existingError) {
      return jsonError(existingError.message, 500);
    }

    const existingBookings = (existingRows ?? []) as BookingRow[];
    console.log("[POST] existing bookings:", existingBookings.length);

    const hasOverlap = existingBookings.some((row) => {
      const existingStart =
        readInstantMs(row.start_time) ?? readInstantMs(row.slot_time);
      if (existingStart == null) {
        return false;
      }

      const existingEnd = readInstantMs(row.end_time) ?? existingStart + durationMin * 60000;
      return rangesOverlapMs(newStartMs, newEndMs, existingStart, existingEnd);
    });

    if (hasOverlap) {
      return jsonError("Это время уже занято", 409);
    }

    console.log("[POST] inserting with start_time:", startIso, "end_time:", endIso);
    const insertPayload: Record<string, unknown> = {
      organization_id: master.organization_id ?? null,
      master_id: master.id,
      service_id: serviceId,
      start_time: startIso,
      end_time: endIso,
      slot_time: startIso,
      client_name: clientName,
      client_phone: clientPhone,
      service_type: serviceType,
      status: "pending",
    };

    if (clientEmail) {
      insertPayload.client_email = clientEmail;
    } else {
      insertPayload.client_email = null;
    }

    const { data: booking, error: insertError } = await insertBookingRow(admin, insertPayload);

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonError("Это время уже занято", 409);
      }

      return jsonError(insertError.message, 500);
    }

    const created = (booking ?? {}) as BookingRow;
    const organizationId = readPositiveInt(created, ["organization_id"]);
    const lookupServiceId = readPositiveInt(created, ["service_id"]) ?? serviceId;

    const [masterLookup, organizationLookup, serviceLookup] = await Promise.all([
      admin.from("masters").select("name, specialization").eq("id", created.master_id).maybeSingle(),
      organizationId
        ? admin.from("organizations").select("name").eq("id", organizationId).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("services").select("name").eq("id", lookupServiceId).maybeSingle(),
    ]);

    const masterRow = asRecord(masterLookup.data);
    const organizationRow = asRecord(organizationLookup.data);
    const serviceRow = asRecord(serviceLookup.data);

    const mappedBooking = toBooking(created, {
      serviceId,
      startIso,
      endIso,
      status: "pending",
      clientEmail,
    });

    const enrichedBooking = {
      ...mappedBooking,
      ...created,
      master_name: nullableTrimmedString(masterRow?.name),
      master_specialization: nullableTrimmedString(masterRow?.specialization),
      organization_name: nullableTrimmedString(organizationRow?.name),
      service_name: nullableTrimmedString(serviceRow?.name),
    };

    return NextResponse.json(
      {
        ...enrichedBooking,
        booking: enrichedBooking,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать запись";
    return jsonError(message, 500);
  }
}

export async function GET(request: NextRequest) {
  const orgId = parsePositiveInt(request.nextUrl.searchParams.get("orgId"));
  const masterId = parsePositiveInt(request.nextUrl.searchParams.get("masterId"));

  if (!orgId && !masterId) {
    return jsonError("Требуется параметр orgId или masterId", 400);
  }

  try {
    const admin = getSupabaseAdmin();
    let query = admin
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .order("slot_time", { ascending: true });

    if (orgId) {
      query = query.eq("organization_id", orgId);
    } else if (masterId) {
      query = query.eq("master_id", masterId);
    }

    const { data, error } = await query;

    console.log("[GET] bookings:", data?.length, "first status:", data?.[0]?.status);

    if (error) {
      return jsonError(error.message, 500);
    }

    const bookings = (data ?? []) as Array<{
      id: number;
      organization_id: number | null;
      master_id: number;
      client_name: string;
      client_phone: string;
      service_type: string | null;
      slot_time: string | null;
      status: string | null;
      cancelled_at: string | null;
      created_at: string | null;
    }>;

    const masterIds = [...new Set(bookings.map((b) => b.master_id))];
    let masterNames: Record<number, string> = {};

    if (masterIds.length > 0) {
      const { data: mastersData } = await admin
        .from("masters")
        .select("id, name")
        .in("id", masterIds);

      masterNames = Object.fromEntries(
        ((mastersData || []) as Array<{ id: number; name: string }>).map((m) => [
          m.id,
          m.name,
        ]),
      );
    }

    return NextResponse.json(
      {
        bookings: bookings.map((booking) => ({
          ...booking,
          master_name: masterNames[booking.master_id] || `Мастер #${booking.master_id}`,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить записи";
    return jsonError(message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  const id = parsePositiveInt(request.nextUrl.searchParams.get("id"));

  if (!id) {
    return jsonError("Требуется id", 400);
  }

  try {
    const admin = getSupabaseAdmin();

    console.log("[PATCH] updating booking:", id);

    const { data, error } = await admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    console.log("[PATCH] result:", data, "error:", error);

    if (error) {
      return jsonError(error.message, 500);
    }

    const updated = Array.isArray(data) ? data[0] : data;

    if (!updated) {
      return jsonError("Запись не найдена", 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отменить запись";
    return jsonError(message, 500);
  }
}
