import { formatTimeZone } from "@/common/format-date";

type TimeZoneSelectProps = {
  value: string;
  zones: string[];
  onChoose: (timeZone: string) => void;
};

export function TimeZoneSelect({ value, zones, onChoose }: TimeZoneSelectProps) {
  return (
    <select
      aria-label="Часовой пояс"
      className="w-38 shrink-0 truncate bg-transparent text-right text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
      value={value}
      onChange={(event) => {
        onChoose(event.target.value);
      }}
    >
      {zones.map((name) => (
        <option key={name} value={name}>
          {formatTimeZone(name)}
        </option>
      ))}
    </select>
  );
}
