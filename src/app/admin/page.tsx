"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import PoweredByBadge from "@/components/PoweredByBadge";
import { formatInMoscow } from "@/lib/datetime";
import { createClient } from "@/utils/supabase/client";

const POLL_INTERVAL_MS = 10_000;
const HIGHLIGHT_MS = 8_000;

interface Booking {
  id: number;
  organization_id: number | null;
  master_id: number;
  master_name?: string;
  client_name: string;
  client_phone: string;
  service_type: string | null;
  slot_time: string | null;
  status?: string | null;
  cancelled_at?: string | null;
  created_at: string | null;
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function playSound(type: "new" | "cancel") {
  console.log("[playSound]", type);
  const src = type === "cancel" ? "/sound-cancel.ogg" : "/sound-new.wav";
  const audio = new Audio(src);
  audio.volume = 1.0;
  audio.muted = false;
  audio.currentTime = 0;
  void audio
    .play()
    .then(() => console.log("[playSound] OK:", src))
    .catch((err) => console.warn("[playSound] blocked:", err));
}

function AdminPageContent() {
  const searchParams = useSearchParams();
  const orgId = parsePositiveInt(searchParams.get("orgId"));
  const masterId = parsePositiveInt(searchParams.get("masterId"));
  const isOrgMode = orgId != null;
  const scopeId = isOrgMode ? orgId : masterId;
  const bookingsQuery = useMemo(() => {
    if (isOrgMode) {
      return `orgId=${orgId}`;
    }

    if (masterId) {
      return `masterId=${masterId}`;
    }

    return null;
  }, [isOrgMode, masterId, orgId]);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(bookingsQuery));
  const [hasError, setHasError] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const [realtimeReady, setRealtimeReady] = useState(false);
  const isLoadingRef = useRef(false);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const soundedIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);
  const highlightTimersRef = useRef<Map<number, number>>(new Map());

  const highlightRows = useCallback((ids: number[]) => {
    if (ids.length === 0) {
      return;
    }

    setHighlightedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      return next;
    });

    ids.forEach((id) => {
      const previous = highlightTimersRef.current.get(id);
      if (previous) {
        window.clearTimeout(previous);
      }

      const timer = window.setTimeout(() => {
        setHighlightedIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        highlightTimersRef.current.delete(id);
      }, HIGHLIGHT_MS);

      highlightTimersRef.current.set(id, timer);
    });
  }, []);

  const notifyNewBookings = useCallback(
    (ids: number[]) => {
      const fresh = ids.filter((id) => !soundedIdsRef.current.has(id));
      if (fresh.length === 0) {
        return;
      }

      fresh.forEach((id) => soundedIdsRef.current.add(id));
      playSound("new");
      highlightRows(fresh);
    },
    [highlightRows],
  );

  const loadBookings = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!bookingsQuery || isLoadingRef.current) {
        return;
      }

      isLoadingRef.current = true;
      if (!options?.silent) {
        setIsLoading(true);
      }
      setHasError(false);

      try {
        const response = await fetch(`/api/bookings?${bookingsQuery}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Не удалось загрузить записи");
        }

        const body = (await response.json()) as { bookings?: Booking[] };
        const next = body.bookings ?? [];
        const nextIds = new Set(next.map((booking) => booking.id));
        const prevIds = knownIdsRef.current;

        if (isFirstLoadRef.current) {
          knownIdsRef.current = nextIds;
          nextIds.forEach((id) => soundedIdsRef.current.add(id));
          isFirstLoadRef.current = false;
        } else {
          const fresh: number[] = [];
          nextIds.forEach((id) => {
            if (!prevIds.has(id)) {
              fresh.push(id);
            }
          });
          knownIdsRef.current = nextIds;
          if (fresh.length > 0) {
            const unsounded = fresh.filter((id) => !soundedIdsRef.current.has(id));
            if (unsounded.length > 0) {
              playSound("new");
              unsounded.forEach((id) => soundedIdsRef.current.add(id));
            }
            highlightRows(fresh);
          }
        }

        setBookings(next);
      } catch {
        setHasError(true);
        setBookings([]);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [bookingsQuery, highlightRows],
  );

  useEffect(() => {
    isFirstLoadRef.current = true;
    isLoadingRef.current = false;
    knownIdsRef.current = new Set();
    soundedIdsRef.current = new Set();
    setBookings([]);
    setHasError(false);
    setIsLoading(Boolean(bookingsQuery));
  }, [bookingsQuery]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadBookings({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadBookings]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("bookings-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
        },
        (payload) => {
          const row = payload.new as Partial<Booking>;
          if (isOrgMode) {
            if (row.organization_id !== orgId) {
              return;
            }
          } else if (masterId) {
            if (row.master_id != null && row.master_id !== masterId) {
              return;
            }
          } else {
            return;
          }

          if (typeof row.id === "number") {
            notifyNewBookings([row.id]);
          } else {
            playSound("new");
          }

          void loadBookings({ silent: true });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "bookings",
        },
        () => {
          playSound("cancel");
          void loadBookings({ silent: true });
        },
      )
      .subscribe((status) => {
        setRealtimeReady(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isOrgMode, loadBookings, masterId, notifyNewBookings, orgId]);

  useEffect(() => {
    function unlockAudio() {
      const audio = new Audio("/sound-new.wav");
      audio.volume = 0;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {
          // ignore
        });
    }

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
    };
  }, []);

  useEffect(() => {
    return () => {
      highlightTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      highlightTimersRef.current.clear();
    };
  }, []);

  function handleReload() {
    if (isLoadingRef.current) {
      return;
    }

    void loadBookings();
  }

  async function handleCancel(booking: Booking) {
    if (!confirm("Отменить запись?")) {
      return;
    }

    try {
      const response = await fetch(`/api/bookings?id=${booking.id}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        alert("Не удалось отменить запись");
        return;
      }

      const body = (await response.json()) as Partial<Booking>;
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? { ...item, ...body, status: body.status ?? "cancelled" }
            : item,
        ),
      );
      playSound("cancel");
      console.log("[cancel] booking cancelled:", booking.id);
    } catch {
      alert("Не удалось отменить запись");
    }
  }

  const title = isOrgMode ? "Записи организации" : "Записи мастера";
  const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const archiveBookings = bookings.filter((booking) => booking.status === "cancelled");
  const visibleBookings = activeTab === "active" ? activeBookings : archiveBookings;

  return (
    <div className="min-h-screen bg-cream text-graphite">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Logo />
          <div>
            <h1 className="text-3xl font-bold text-graphite">{title}</h1>
            <p className="mt-2 text-sm text-graphite/60">
              Обновляется автоматически каждые 10 секунд
              {realtimeReady ? " · Realtime подключён" : " · ожидание Realtime"}
            </p>
            <p className="mt-1 text-graphite/60">
              {scopeId
                ? isOrgMode
                  ? `Организация #${orgId}`
                  : `Мастер #${masterId}`
                : "Укажите ?orgId=N или ?masterId=N"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReload}
          disabled={isLoading || !bookingsQuery}
          className="rounded-lg bg-amber px-6 py-3 font-medium text-white hover:bg-amber-dark disabled:cursor-not-allowed disabled:bg-amber/50 disabled:hover:bg-amber/50"
        >
          Обновить
        </button>
      </div>

      {!bookingsQuery ? (
        <p>Укажите параметр orgId или masterId в адресе страницы</p>
      ) : isLoading ? (
        <p>Загрузка…</p>
      ) : hasError ? (
        <div className="flex flex-col items-start gap-3">
          <p>Ошибка загрузки записей</p>
          <button
            type="button"
            onClick={handleReload}
            className="rounded-lg bg-amber px-6 py-3 font-medium text-white hover:bg-amber-dark"
          >
            Повторить
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeTab === "active"
                  ? "bg-mint text-white"
                  : "bg-white text-graphite hover:bg-mint-light/40"
              }`}
            >
              Активные
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === "active" ? "bg-white/20" : "bg-cream text-graphite"
                }`}
              >
                {activeBookings.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("archive")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeTab === "archive"
                  ? "bg-mint text-white"
                  : "bg-white text-graphite hover:bg-mint-light/40"
              }`}
            >
              Архив
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === "archive" ? "bg-white/20" : "bg-cream text-graphite"
                }`}
              >
                {archiveBookings.length}
              </span>
            </button>
          </div>

          {visibleBookings.length === 0 ? (
            <p>
              {bookings.length === 0
                ? "Записей пока нет"
                : activeTab === "active"
                  ? "Активных записей нет"
                  : "В архиве пока нет записей"}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-graphite/15 bg-white">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-graphite font-semibold uppercase text-white">
                    <th className="whitespace-nowrap px-4 py-3">Имя клиента</th>
                    {isOrgMode ? (
                      <th className="whitespace-nowrap px-4 py-3">Мастер</th>
                    ) : null}
                    <th className="whitespace-nowrap px-4 py-3">Телефон</th>
                    <th className="whitespace-nowrap px-4 py-3">Услуга</th>
                    <th className="whitespace-nowrap px-4 py-3">Дата и время</th>
                    <th className="whitespace-nowrap px-4 py-3">Статус</th>
                    {activeTab === "archive" ? (
                      <th className="whitespace-nowrap px-4 py-3">Дата отмены</th>
                    ) : (
                      <th className="whitespace-nowrap px-4 py-3"></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleBookings.map((booking, index) => {
                    const isCancelled = booking.status === "cancelled";

                    return (
                      <tr
                        key={booking.id ?? `${booking.client_phone}-${index}`}
                        className={`border-t border-graphite/10 ${
                          highlightedIds.has(booking.id) ? "booking-row-new" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          {booking.client_name}
                        </td>
                        {isOrgMode ? (
                          <td className="whitespace-nowrap px-4 py-3">
                            {booking.master_name || `Мастер #${booking.master_id}`}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-4 py-3">
                          {booking.client_phone}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {booking.service_type}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatInMoscow(booking.slot_time)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {isCancelled ? (
                            <span className="text-graphite line-through">Отменена</span>
                          ) : (
                            <span className="text-mint-dark">Активна</span>
                          )}
                        </td>
                        {activeTab === "archive" ? (
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatInMoscow(booking.cancelled_at)}
                          </td>
                        ) : (
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                void handleCancel(booking);
                              }}
                              className="rounded-lg border border-graphite px-3 py-1.5 font-medium text-graphite hover:bg-graphite hover:text-white"
                            >
                              Отменить
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <PoweredByBadge />
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center bg-cream p-8">
          <p>Загрузка…</p>
          <PoweredByBadge />
        </main>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
