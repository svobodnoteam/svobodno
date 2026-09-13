import { Icon } from "./Icon";

export default function PoweredByBadge() {
  return (
    <a
      href="https://svobodno.app"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Свободно - сервис онлайн-записи"
      className="mt-8 mb-4 flex items-center gap-1.5 text-xs text-graphite/60 hover:text-graphite"
    >
      <Icon size="32" color="green" />
      <span>
        <span className="text-mint">С</span>
        <span className="text-gray-900">вободн</span>
        <span className="text-amber">о</span>
        {" - сервис онлайн-записи"}
      </span>
    </a>
  );
}
