type SlotCardProps = {
  time: string;
  available: boolean;
  selected: boolean;
  onSelect: (time: string) => void;
};

export default function SlotCard({
  time,
  available,
  selected,
  onSelect,
}: SlotCardProps) {
  const stateClass = !available
    ? "cursor-not-allowed bg-graphite text-white"
    : selected
      ? "bg-mint-dark text-white ring-2 ring-amber"
      : "bg-mint text-white hover:bg-mint-dark";

  return (
    <button
      type="button"
      disabled={!available}
      onClick={() => {
        onSelect(time);
      }}
      className={`rounded px-3 py-2 text-sm font-medium ${stateClass}`}
    >
      {time}
    </button>
  );
}
