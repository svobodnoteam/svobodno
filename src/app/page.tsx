import { BetaButton } from "@/components/beta-button";
import { Logo } from "@/components/Logo";
import PoweredByBadge from "@/components/PoweredByBadge";

export default function Home() {
  return (
    <main className="bg-cream min-h-screen flex flex-col items-center px-4">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Logo size={80} />
        <h1 className="font-manrope text-2xl font-semibold text-graphite mt-6">
          Скоро: сервис онлайн-записи «Свободно»
        </h1>
        <p className="font-inter text-base text-graphite/60 mt-2 max-w-md">
          Онлайн-запись нового поколения для вашего бизнеса
        </p>
        <BetaButton />
      </div>
      <PoweredByBadge />
    </main>
  );
}
