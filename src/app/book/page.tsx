import { Suspense } from "react";
import BookingForm from "../booking-form";

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-8">
          <p>Загрузка…</p>
        </main>
      }
    >
      <BookingForm />
    </Suspense>
  );
}
