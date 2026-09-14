"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import BookingFormStepper, { type BookingFormStep } from "@/components/BookingFormStepper";
import { Logo } from "@/components/Logo";
import PoweredByBadge from "@/components/PoweredByBadge";
import SlotCard from "@/components/SlotCard";
import { PROJECT_TIME_ZONE, toDateKeyInTimeZone } from "@/lib/datetime";
import type {
  ApiError,
  AvailableSlot,
  Booking,
  Master,
  Organization,
  Service,
  WorkingHour,
} from "@/lib/types";

const DEFAULT_SLUG = "anton";
const DAYS_AHEAD = 14;
const PHONE_PREFIX = "7";
const PHONE_DIGITS = 11;

const WEEKDAY_LABELS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^8/, PHONE_PREFIX);
  const national = (digits.startsWith(PHONE_PREFIX) ? digits.slice(1) : digits).slice(
    0,
    PHONE_DIGITS - 1,
  );

  if (!national) {
    return "";
  }

  return [
    `+7 (${national.slice(0, 3)}`,
    national.length >= 3 ? `) ${national.slice(3, 6)}` : "",
    national.length >= 6 ? `-${national.slice(6, 8)}` : "",
    national.length >= 8 ? `-${national.slice(8, 10)}` : "",
  ].join("");
}

function toDateKey(date: Date): string {
  return toDateKeyInTimeZone(date, PROJECT_TIME_ZONE);
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAY_LABELS[date.getDay()];
  return `${weekday}, ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;
}

function slotToIso(date: string, time: string): string {
  return `${date}T${time}:00+03:00`;
}

function formatPrice(price: number | null): string {
  if (price === null) {
    return "";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatConfirmationDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type EnrichedBooking = Booking & {
  master_name?: string | null;
  master_specialization?: string | null;
  organization_name?: string | null;
  service_name?: string | null;
};

function asNullableName(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getConfirmationParties(booking: EnrichedBooking): {
  organizationTitle: string | null;
  specialistLine: string | null;
} {
  const organizationName = asNullableName(booking.organization_name);
  const masterName = asNullableName(booking.master_name);
  const specialization = asNullableName(booking.master_specialization);
  const showOrganization = organizationName !== null && organizationName !== masterName;

  if (showOrganization) {
    if (!masterName) {
      return { organizationTitle: organizationName, specialistLine: null };
    }

    return {
      organizationTitle: organizationName,
      specialistLine: specialization
        ? `Ваш мастер: ${specialization} ${masterName}`
        : `Ваш мастер: ${masterName}`,
    };
  }

  if (specialization !== null) {
    return {
      organizationTitle: null,
      specialistLine: masterName ? `${specialization} ${masterName}` : specialization,
    };
  }

  return {
    organizationTitle: null,
    specialistLine: masterName ?? "Специалист",
  };
}

function getConfirmationServiceName(
  booking: EnrichedBooking,
  selectedService: Service | null,
): string {
  return (
    asNullableName(booking.service_name) ||
    asNullableName(booking.service_type) ||
    selectedService?.name ||
    ""
  );
}

function getBookingTitle(organization: Organization, master: Master): string {
  return organization.type === "individual" ? master.name : organization.name;
}

type FieldErrors = {
  service: string;
  time: string;
  name: string;
  phone: string;
  email: string;
};

const EMPTY_FIELD_ERRORS: FieldErrors = {
  service: "",
  time: "",
  name: "",
  phone: "",
  email: "",
};

const NAME_PATTERN = /^[а-яА-ЯёЁa-zA-Z][а-яА-ЯёЁa-zA-Z\s-]{1,14}$/;
const PHONE_INPUT_PATTERN = /^[\d\s()+-]{10,20}$/;

function validateName(value: string): string {
  if (!NAME_PATTERN.test(value.trim())) {
    return "Введите имя буквами (2–15 символов)";
  }

  return "";
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function validatePhone(value: string): string {
  if (!PHONE_INPUT_PATTERN.test(value)) {
    return "Введите корректный телефон";
  }

  const digits = normalizePhone(value).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return "Введите корректный телефон";
  }

  return "";
}

function validateEmail(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const atIndex = trimmed.indexOf("@");
  if (atIndex === -1) {
    return "Некорректный email";
  }

  if (!trimmed.slice(atIndex + 1).includes(".")) {
    return "Некорректный email";
  }

  return "";
}

function validateBookingFields(input: {
  serviceId: number | null;
  time: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
}): FieldErrors {
  return {
    service: input.serviceId ? "" : "Выберите услугу",
    time: input.time ? "" : "Выберите время",
    name: validateName(input.clientName),
    phone: validatePhone(input.clientPhone),
    email: validateEmail(input.clientEmail),
  };
}

function hasFieldErrors(errors: FieldErrors): boolean {
  return Boolean(errors.service || errors.time || errors.name || errors.phone || errors.email);
}

function FieldError({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-red-600">{message}</p>;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

function hasWorkingDay(workingHours: WorkingHour[], dateKey: string): boolean {
  const moscowDate = new Date(`${dateKey}T12:00:00+03:00`);
  const jsDay = moscowDate.getUTCDay();

  return workingHours.some((row) => {
    if (!row.is_active) {
      return false;
    }

    return row.day_of_week === jsDay || (jsDay === 0 && row.day_of_week === 7);
  });
}

export default function BookingForm() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug")?.trim() || DEFAULT_SLUG;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [master, setMaster] = useState<Master | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);

  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_FIELD_ERRORS);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);

  const dates = useMemo(() => {
    const items: string[] = [];
    const todayKey = toDateKey(new Date());
    const [year, month, day] = todayKey.split("-").map(Number);

    for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
      items.push(toDateKey(new Date(Date.UTC(year, month - 1, day + offset, 12))));
    }

    return items;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMaster() {
      setIsLoadingMaster(true);
      setPageError("");
      setOrganization(null);
      setMaster(null);
      setServices([]);
      setWorkingHours([]);
      setServiceId(null);
      setDate("");
      setTime("");
      setSlots([]);
      setConfirmation(null);
      setFieldErrors(EMPTY_FIELD_ERRORS);

      try {
        const masterResponse = await fetch(`/api/master?slug=${encodeURIComponent(slug)}`);
        const masterBody = (await masterResponse.json().catch(() => null)) as {
          organization?: Organization;
          master?: Master;
          error?: string;
        } | null;

        if (!masterResponse.ok || !masterBody?.organization || !masterBody?.master) {
          throw new Error("Не удалось загрузить страницу записи");
        }

        const [servicesResponse, hoursResponse] = await Promise.all([
          fetch(`/api/services?masterId=${masterBody.master.id}`),
          fetch(`/api/working-hours?masterId=${masterBody.master.id}`),
        ]);

        const servicesBody = (await servicesResponse.json().catch(() => null)) as {
          services?: Service[];
          error?: string;
        } | null;
        const hoursBody = (await hoursResponse.json().catch(() => null)) as {
          workingHours?: WorkingHour[];
          error?: string;
        } | null;

        if (!servicesResponse.ok) {
          throw new Error(servicesBody?.error || "Не удалось загрузить услуги");
        }

        if (!hoursResponse.ok) {
          throw new Error(hoursBody?.error || "Не удалось загрузить расписание");
        }

        if (cancelled) {
          return;
        }

        setOrganization(masterBody.organization);
        setMaster(masterBody.master);
        setServices(servicesBody?.services ?? []);
        setWorkingHours(hoursBody?.workingHours ?? []);
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "Ошибка загрузки");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMaster(false);
        }
      }
    }

    void loadMaster();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!master || !serviceId || !date) {
      setSlots([]);
      return;
    }

    const currentMasterId = master.id;
    let cancelled = false;

    async function loadSlots() {
      setIsLoadingSlots(true);
      setFormError("");
      setTime("");

      try {
        const response = await fetch(
          `/api/available-slots?masterId=${currentMasterId}&serviceId=${serviceId}&date=${date}`,
        );

        if (!response.ok) {
          throw new Error(await readApiError(response, "Не удалось загрузить слоты"));
        }

        const body = (await response.json()) as { slots: AvailableSlot[] };

        if (!cancelled) {
          setSlots(body.slots);
        }
      } catch (error) {
        if (!cancelled) {
          setSlots([]);
          setFormError(error instanceof Error ? error.message : "Не удалось загрузить слоты");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSlots(false);
        }
      }
    }

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, [master, serviceId, date]);

  const selectedService = services.find((service) => service.id === serviceId) ?? null;
  const currentErrors = useMemo(
    () =>
      validateBookingFields({
        serviceId,
        time,
        clientName,
        clientPhone,
        clientEmail,
      }),
    [clientEmail, clientName, clientPhone, serviceId, time],
  );
  const formHasErrors = hasFieldErrors(currentErrors);

  function setFieldError(field: keyof FieldErrors, message: string) {
    setFieldErrors((current) => {
      if (current[field] === message) {
        return current;
      }

      return { ...current, [field]: message };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateBookingFields({
      serviceId,
      time,
      clientName,
      clientPhone,
      clientEmail,
    });

    setFieldErrors(nextErrors);

    if (hasFieldErrors(nextErrors)) {
      return;
    }

    if (!master || !serviceId || !date || !time) {
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    const trimmedEmail = clientEmail.trim();

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterId: master.id,
          serviceId,
          clientName: clientName.trim(),
          clientPhone: normalizePhone(clientPhone),
          slotTime: slotToIso(date, time),
          ...(trimmedEmail ? { client_email: trimmedEmail } : {}),
        }),
      });

      if (response.status === 409) {
        setTime("");
        setFormError("Это время уже занято, выберите другое");
        return;
      }

      if (!response.ok) {
        throw new Error(await readApiError(response, "Не удалось создать запись"));
      }

      const body = (await response.json()) as { booking: Booking };
      setConfirmation(body.booking);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Ошибка при записи");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentStep: BookingFormStep = time ? 4 : date ? 3 : serviceId ? 2 : 1;

  if (isLoadingMaster) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream p-8">
        <p>Загрузка…</p>
      </main>
    );
  }

  if (pageError || !master || !organization) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream p-8">
        <Logo />
        <h1 className="text-2xl font-bold text-graphite">Онлайн‑запись</h1>
        <p>{pageError || "Не удалось загрузить страницу записи"}</p>
        <p className="text-sm text-graphite/60">Проверьте адрес, например /?slug=anton</p>
      </main>
    );
  }

  const bookingTitle = getBookingTitle(organization, master);

  if (confirmation) {
    const details = confirmation as EnrichedBooking;
    const { organizationTitle, specialistLine } = getConfirmationParties(details);
    const serviceName = getConfirmationServiceName(details, selectedService);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-cream p-8">
        <div className="mb-6 w-full max-w-md">
          <Logo />
        </div>
        <div className="w-full max-w-md rounded-lg border border-mint bg-white p-6">
          <h1 className="text-4xl font-bold text-brand-green">Вы записаны!</h1>
          {organizationTitle ? (
            <p className="mt-2 text-xl text-graphite">{organizationTitle}</p>
          ) : null}
          {specialistLine ? (
            <p className={organizationTitle ? "mt-1 text-graphite" : "mt-2 text-xl text-graphite"}>
              {specialistLine}
            </p>
          ) : null}
          <ul className="mt-4 flex flex-col gap-2 text-sm text-graphite">
            <li>
              <span className="text-graphite/60">Услуга: </span>
              {serviceName}
            </li>
            <li>
              <span className="text-graphite/60">Дата и время: </span>
              {formatConfirmationDateTime(details.start_time || details.slot_time)}
            </li>
            <li>Бронь #{details.id}</li>
            <li>Вы записаны! Мастер свяжется с вами.</li>
          </ul>
          <button
            type="button"
            className="mt-6 w-full rounded-lg bg-amber px-6 py-3 font-medium text-white hover:bg-amber-dark"
            onClick={() => {
              setConfirmation(null);
              setClientName("");
              setClientPhone("");
              setClientEmail("");
              setTime("");
              setDate("");
              setServiceId(null);
              setFormError("");
              setFieldErrors(EMPTY_FIELD_ERRORS);
            }}
          >
            Записаться ещё
          </button>
        </div>
        <PoweredByBadge />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-cream p-8">
      <header className="relative flex w-full max-w-md flex-col items-center text-center">
        <div className="absolute left-0 top-0">
          <Logo />
        </div>
        <h1 className="px-14 py-4 text-4xl font-bold text-graphite md:px-16">
          {bookingTitle}
        </h1>
        <p className="text-xl text-graphite/70">Онлайн-запись</p>
        {organization.phone ? (
          <p className="mt-1 text-graphite/70">{organization.phone}</p>
        ) : null}
      </header>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-6 flex w-full max-w-md flex-col gap-4 rounded-lg border border-graphite/15 bg-white p-4"
      >
        <BookingFormStepper currentStep={currentStep} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Выберите услугу</legend>
          {services.length === 0 ? (
            <p className="text-sm text-graphite/60">
              Услуги не найдены, обратитесь к администратору
            </p>
          ) : (
            services.map((service) => (
              <label
                key={service.id}
                className={`flex cursor-pointer items-center justify-between rounded border p-3 text-sm ${
                  serviceId === service.id
                    ? "border-mint bg-mint-light/30 text-graphite"
                    : "border-graphite/20"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="serviceId"
                    value={service.id}
                    checked={serviceId === service.id}
                    onChange={() => {
                      setServiceId(service.id);
                      setDate("");
                      setTime("");
                      setFieldError("service", "");
                    }}
                  />
                  {service.name}
                </span>
                <span className="text-graphite/60">
                  {service.duration_min} мин
                  {service.price !== null ? ` · ${formatPrice(service.price)}` : ""}
                </span>
              </label>
            ))
          )}
          <FieldError message={fieldErrors.service} />
        </fieldset>

        {serviceId ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Выберите дату</legend>
            <div className="grid grid-cols-2 gap-2">
              {dates.map((dateKey) => {
                const enabled = hasWorkingDay(workingHours, dateKey);
                const selected = date === dateKey;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      setDate(dateKey);
                      setTime("");
                      setFieldError("time", "Выберите время");
                    }}
                    className={`rounded border px-3 py-2 text-left text-sm ${
                      selected
                        ? "border-mint bg-mint-light/30 text-graphite"
                        : "border-graphite/20"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {formatDateLabel(dateKey)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {date ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Выберите время</legend>
            {isLoadingSlots ? (
              <p className="text-sm text-graphite/60">Загрузка слотов…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-graphite/60">На эту дату свободных слотов нет</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <SlotCard
                    key={slot.time}
                    time={slot.time}
                    available={slot.available}
                    selected={time === slot.time}
                    onSelect={(nextTime) => {
                      setTime(nextTime);
                      setFieldError("time", "");
                      setFormError("");
                    }}
                  />
                ))}
              </div>
            )}
            <FieldError message={fieldErrors.time} />
          </fieldset>
        ) : fieldErrors.time ? (
          <FieldError message={fieldErrors.time} />
        ) : null}

        {time ||
        clientName ||
        clientPhone ||
        clientEmail ||
        fieldErrors.name ||
        fieldErrors.phone ||
        fieldErrors.email ? (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="name">
              Ваше имя
              <input
                id="name"
                name="name"
                type="text"
                value={clientName}
                onChange={(event) => {
                  const next = event.target.value;
                  setClientName(next);
                  setFieldError("name", validateName(next));
                }}
                placeholder="Анна"
                className="rounded border border-graphite bg-cream p-2 text-base text-graphite outline-none focus:border-mint"
              />
              <FieldError message={fieldErrors.name} />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="phone">
              Телефон
              <input
                id="phone"
                name="clientPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={clientPhone}
                onChange={(event) => {
                  const next = formatPhone(event.target.value);
                  setClientPhone(next);
                  setFieldError("phone", validatePhone(next));
                }}
                placeholder="+7 (___) ___-__-__"
                title="Введите номер в формате +7 (999) 123-45-67"
                className="rounded border border-graphite bg-cream p-2 text-base text-graphite outline-none focus:border-mint"
              />
              <FieldError message={fieldErrors.phone} />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="email">
              <input
                id="email"
                name="clientEmail"
                type="email"
                autoComplete="email"
                value={clientEmail}
                onChange={(event) => {
                  const next = event.target.value;
                  setClientEmail(next);
                  setFieldError("email", validateEmail(next));
                }}
                placeholder="Ваш email (необязательно)"
                className="rounded border border-graphite bg-cream p-2 text-base font-normal text-graphite outline-none focus:border-mint"
              />
              <FieldError message={fieldErrors.email} />
            </label>
          </>
        ) : null}

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || formHasErrors}
          className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber px-6 py-3 font-medium text-white hover:bg-amber-dark disabled:cursor-not-allowed disabled:bg-amber/50 disabled:hover:bg-amber/50"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin text-white"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="2"
                />
                <path
                  d="M14 8a6 6 0 0 0-6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Записываем...
            </>
          ) : (
            "Записаться"
          )}
        </button>
      </form>
      <PoweredByBadge />
    </main>
  );
}
