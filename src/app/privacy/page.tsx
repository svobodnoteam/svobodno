import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Свободно",
};

export default function PrivacyPage() {
  return (
    <main className="font-inter min-h-screen bg-cream px-4 py-12 text-graphite">
      <article className="mx-auto flex max-w-xl flex-col gap-4">
        <h1 className="font-inter text-3xl font-bold text-graphite">
          Политика конфиденциальности
        </h1>
        <p>
          Сервис «Свободно» не собирает, не хранит и не обрабатывает персональные
          данные пользователей.
        </p>
        <p>
          Кнопка «Хочу в бета-тест» открывает ваш почтовый клиент с шаблонным
          письмом. Письмо отправляется с вашего адреса — вы полностью
          контролируете отправку.
        </p>
        <p>
          Мы не передаём данные третьим лицам, потому что данные не покидают ваш
          почтовый клиент.
        </p>
        <p>
          Если у вас есть вопросы — напишите на{" "}
          <a
            href="mailto:svobodno.app.team@yandex.com"
            className="underline decoration-graphite/30 underline-offset-2 hover:text-graphite"
          >
            svobodno.app.team@yandex.com
          </a>
        </p>
        <a
          href="/"
          className="mt-4 inline-flex w-fit items-center justify-center rounded-xl bg-mint px-6 py-3 font-manrope font-medium text-white transition-colors hover:bg-mint-dark"
        >
          На главную
        </a>
      </article>
    </main>
  );
}
