export type CommandPerson = { id: string; name: string };

// What the model needs to resolve «в пятницу» and «Асе» without guessing.
export type CommandContext = {
  today: string;
  weekday: string;
  timeZone: string;
  speaker: CommandPerson;
  members: CommandPerson[];
};

export type ChatMessage = { role: "system" | "user"; content: string };

const rules = [
  "Ты разбираешь короткую команду члена семьи для приложения Family Hub и отвечаешь только JSON по схеме.",
  'Умеешь создавать самостоятельное напоминание (outcome = "reminder") или событие календаря (outcome = "event").',
  "«Напомни …», «напоминай …» без события — reminder. Событие с датой без слова «напомни» («в субботу в 12 груминг», «3 марта день рождения мамы») — event.",
  "«Напомни за день до …», «напомни за час до …» о событии — event с reminderOffsets: at-start (в момент начала), 15m, 1h, 1d, 1w; не больше трёх.",
  'Удаление, изменение существующих записей, управление семьёй и всё прочее — outcome = "unsupported".',
  'Если фраза непонятна или это не команда — outcome = "unrecognized".',
  "Относительные даты («завтра», «в пятницу») переводи в YYYY-MM-DD от сегодняшней даты; время — HH:MM.",
  "Не выдумывай: чего нет во фразе, ставь null и перечисляй в missing (у reminder: text, date, time; у event: title, date).",
  "У event: title — что за событие, note — уточнение или null. Дата без времени — событие на весь день, time = null. Окончание (endDate, endTime) — только если оно названо, иначе null.",
  'У event нет получателей: «только мне» делает его visibility "private", иначе "shared"; ambiguities у event всегда пустой.',
  'recipientIds (только у reminder) — только id из списка участников. null значит «всем». «Напомни мне» или «только мне» — visibility "private" и recipientIds только с id говорящего; иначе visibility "shared".',
  'Если имя подходит нескольким участникам, не выбирай: добавь в ambiguities { field: "recipients", mention, candidateIds } и не клади их в recipientIds.',
  "recurrence: null или { frequency: weekly | monthly | yearly, until: YYYY-MM-DD или null }.",
];

function membersOf(members: CommandPerson[]): string {
  return members.map(({ id, name }) => `- ${name}: ${id}`).join("\n");
}

export function promptOf(context: CommandContext, text: string): ChatMessage[] {
  return [
    { role: "system", content: rules.join("\n") },
    {
      role: "system",
      content: [
        `Сегодня ${context.today} (${context.weekday}), часовой пояс ${context.timeZone}.`,
        `Говорит: ${context.speaker.name} (${context.speaker.id}).`,
        `Участники семьи:\n${membersOf(context.members)}`,
      ].join("\n"),
    },
    { role: "user", content: text },
  ];
}
