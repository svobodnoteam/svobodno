"use client";

import { useEffect, useRef, useState } from "react";

const BETA_EMAIL = "svobodno.app.team@yandex.com";

export function BetaSignupForm() {
  const [visible, setVisible] = useState(false);
  const [mailtoFailed, setMailtoFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedClientRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    setMailtoFailed(false);
    openedClientRef.current = false;

    const markOpened = () => {
      openedClientRef.current = true;
    };

    window.addEventListener("blur", markOpened);
    document.addEventListener("visibilitychange", markOpened);

    const link = document.createElement("a");
    link.href = `mailto:svobodno.app.team@yandex.com?subject=Заявка на бета-доступ&body=Привет! Хочу получить доступ к бета-версии Svobodno.`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      window.removeEventListener("blur", markOpened);
      document.removeEventListener("visibilitychange", markOpened);
      timeoutRef.current = null;

      if (!openedClientRef.current && document.visibilityState === "visible") {
        setMailtoFailed(true);
      }
    }, 2000);
  };

  return (
    <div
      ref={rootRef}
      className={`mt-8 flex w-full max-w-md flex-col items-center ${
        visible ? "animate-fade-in" : "opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={handleClick}
        className="rounded-xl bg-mint px-6 py-3 font-manrope font-medium text-white transition-colors hover:bg-mint-dark"
      >
        Хочу доступ к бета-версии
      </button>
      {mailtoFailed ? (
        <p role="alert" className="mt-3 font-inter text-sm text-red-600">
          Не удалось открыть почтовый клиент. Напишите нам на {BETA_EMAIL}
        </p>
      ) : null}
      <p className="mt-3 font-inter text-xs leading-relaxed text-graphite/50">
        Ресурс не собирает персональные данные. Письмо отправляется с вашей
        почты — вы сами контролируете отправку.
      </p>
    </div>
  );
}
