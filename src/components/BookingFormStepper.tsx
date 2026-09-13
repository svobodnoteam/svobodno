const STEPS = ["Услуга", "Дата", "Слоты", "Контакты"] as const;

export type BookingFormStep = 1 | 2 | 3 | 4;

type BookingFormStepperProps = {
  currentStep: BookingFormStep;
};

export default function BookingFormStepper({
  currentStep,
}: BookingFormStepperProps) {
  return (
    <ol className="flex w-full items-center gap-1 text-[11px] sm:gap-2 sm:text-xs">
      {STEPS.map((label, index) => {
        const step = (index + 1) as BookingFormStep;
        const isCurrent = step === currentStep;
        const isDone = step < currentStep;

        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full font-heading text-[11px] font-extrabold ${
                isCurrent
                  ? "bg-amber text-white"
                  : isDone
                    ? "bg-mint text-white"
                    : "bg-graphite/15 text-graphite"
              }`}
            >
              {step}
            </span>
            <span
              className={`truncate font-medium ${
                isCurrent ? "text-amber-dark" : isDone ? "text-mint-dark" : "text-graphite/50"
              }`}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span
                className={`ml-auto hidden h-px flex-1 sm:block ${
                  isDone ? "bg-mint" : "bg-graphite/20"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}