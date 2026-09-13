const WEEKDAY_SHORT_TO_JS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const PROJECT_TIME_ZONE = "Europe/Moscow";
export const MOSCOW_OFFSET = "+03:00";

const TIME_ZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function hasExplicitTimeZone(value: string): boolean {
  return TIME_ZONE_SUFFIX.test(value.trim());
}

function toIsoDateTime(value: string): string {
  return value.includes("T") ? value : value.replace(" ", "T");
}

/**
 * Значение для записи в slot_time: не переводим в UTC через toISOString().
 * Если зона уже есть — оставляем как есть. Если нет — считаем Москвой и добавляем +03:00.
 */
export function toStoredSlotTime(raw: string): string {
  const value = raw.trim();
  if (hasExplicitTimeZone(value)) {
    return value;
  }

  return `${toIsoDateTime(value)}${MOSCOW_OFFSET}`;
}

/** slot_time из БД считается UTC, если в строке нет явной зоны. */
export function parseDbSlotTimeAsUtc(slotTime: string): Date {
  const value = toIsoDateTime(slotTime.trim());
  if (hasExplicitTimeZone(value)) {
    return new Date(value);
  }

  return new Date(`${value}Z`);
}

export function formatInMoscow(value: string | Date | null | undefined): string {
  if (!value) {
    return "Время не указано";
  }

  const date = value instanceof Date ? value : parseDbSlotTimeAsUtc(value);
  if (Number.isNaN(date.getTime())) {
    return "Время не указано";
  }

  return date.toLocaleString("ru-RU", {
    timeZone: PROJECT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateKeyInTimeZone(date: Date, timeZone = PROJECT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDaysToDateKey(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return [
    utc.getUTCFullYear(),
    String(utc.getUTCMonth() + 1).padStart(2, "0"),
    String(utc.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** День недели в таймзоне организации: 0 = воскресенье … 6 = суббота. */
export function dayOfWeekInTimeZone(date: string, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone,
  }).format(new Date(`${date}T12:00:00.000Z`));

  return WEEKDAY_SHORT_TO_JS[weekday] ?? 0;
}

export function matchesWorkingDay(storedDay: number, jsDay: number): boolean {
  if (storedDay === jsDay) {
    return true;
  }

  // ISO: воскресенье = 7
  return jsDay === 0 && storedDay === 7;
}

export function toHHMM(time: string): string {
  return time.slice(0, 5);
}

export function parseTimeParts(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = toHHMM(time).split(":").map(Number);
  return { hours, minutes };
}

export function minutesOfDay(time: string): number {
  const { hours, minutes } = parseTimeParts(time);
  return hours * 60 + minutes;
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getTimeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );

  return asUtc - utcMs;
}

/** Стена-часы даты/времени в таймзоне организации → UTC Date. */
export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const { hours, minutes } = parseTimeParts(time);
  const naiveUtc = Date.UTC(year, month - 1, day, hours, minutes, 0);
  const instant = naiveUtc - getTimeZoneOffsetMs(naiveUtc, timeZone);
  return new Date(naiveUtc - getTimeZoneOffsetMs(instant, timeZone));
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}
