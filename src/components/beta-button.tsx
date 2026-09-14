"use client";

import { useEffect, useRef, useState } from "react";

const BETA_EMAIL = "svobodno.app.team@yandex.com";

export function BetaButton() {
  const [visible, setVisible] = useState(false);
  const [mailtoFailed, setMailtoFailed] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
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
    if (!acceptedPrivacy) {
      return;
    }

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
        disabled={!acceptedPrivacy}
        className="rounded-xl bg-mint px-6 py-3 font-manrope font-medium text-white transition-colors hover:bg-mint-dark disabled:cursor-not-allowed disabled:bg-mint/50 disabled:hover:bg-mint/50"
      >
        Хочу доступ к бета-версии
      </button>
      {mailtoFailed ? (
        <p role="alert" className="mt-3 font-inter text-sm text-red-600">
          Не удалось открыть почтовый клиент. Напишите нам на {BETA_EMAIL}
        </p>
      ) : null}
      <div className="mt-3 flex items-start gap-2 text-left font-inter text-xs leading-relaxed text-graphite/50">
        <input
          id="privacy-consent"
          type="checkbox"
          checked={acceptedPrivacy}
          onChange={(event) => setAcceptedPrivacy(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-mint"
        />
        <p>
          <label htmlFor="privacy-consent">Я ознакомлен с </label>
          <a href="/privacy" className="underline decoration-graphite/30 underline-offset-2 hover:text-graphite">
            политикой конфиденциальности
          </a>
        </p>
      </div>
    </div>
  );
}
