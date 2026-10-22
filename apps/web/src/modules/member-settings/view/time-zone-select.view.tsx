type TimeZoneSelectProps = {
  value: string;
  zones: string[];
  onChoose: (timeZone: string) => void;
};

export function TimeZoneSelect({ value, zones, onChoose }: TimeZoneSelectProps) {
  return (
    <select
      aria-label="Часовой пояс"
      className="max-w-44 truncate bg-transparent text-right text-muted-foreground outline-none"
      value={value}
      onChange={(event) => {
        onChoose(event.target.value);
      }}
    >
      {zones.map((name) => (
        <option key={name} value={name}>
          {name.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
