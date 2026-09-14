"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !body?.ok) {
        setError(body?.error || "Неверный секрет");
        return;
      }

      window.location.assign("/admin?slug=anton");
    } catch {
      setError("Не удалось войти");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="font-inter flex min-h-screen items-center justify-center bg-cream px-4 text-graphite">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="secret">
          Секрет
          <input
            id="secret"
            name="secret"
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="rounded-lg border border-graphite/15 bg-white px-3 py-2 font-inter text-base font-normal text-graphite"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-amber px-6 py-3 font-medium text-white hover:bg-amber-dark disabled:cursor-not-allowed disabled:bg-amber/50"
        >
          Войти
        </button>
      </form>
    </main>
  );
}
