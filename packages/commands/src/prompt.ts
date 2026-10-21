export type CommandPerson = { id: string; name: string };

export type CommandPet = { id: string; name: string; species: string };

// What the model needs to resolve «в пятницу» and «Асе» without guessing.
export type CommandContext = {
  today: string;
  weekday: string;
  timeZone: string;
  speaker: CommandPerson;
  members: CommandPerson[];
  // Pets in care only: an archived Pet gets no new entries.
  pets: CommandPet[];
};

export type ChatMessage = { role: "system" | "user"; content: string };

const rules = [
  "Ты разбираешь короткую команду члена семьи для приложения Family Hub и отвечаешь только JSON по схеме.",
  'Умеешь создавать самостоятельное напоминание (outcome = "reminder") или событие календаря (outcome = "event").',
  "«Напомни …», «напоминай …» без события — reminder. Событие с датой без слова «напомни» («в субботу в 12 груминг», «3 марта день рождения мамы») — event.",
  'Запись в журнал питомца — outcome = "care_entry": прививка (vaccination), обработка (treatment), визит к ветеринару (vet_visit), вес (weight), трата (expense) или заметка (note).',
  'У care_entry: petId — только id из списка питомцев; если питомец один, а имя не названо — его id; если питомцев несколько и имя не названо или подходит нескольким — petId = null и ambiguities { field: "pet", mention, candidateIds }.',
  "У care_entry: date — когда это было (YYYY-MM-DD, «вчера» от сегодняшней даты), time — HH:MM или null; если не сказано — оба null, это значит «сейчас».",
  'У care_entry details — по схеме вида: стоимость cost { amount в целых рублях, category vet | medicine } у прививки, обработки и визита; dueDate — следующий срок («следующая через год», «повторить через 3 месяца») в YYYY-MM-DD; вес weightKg в кг с шагом 0.1; трата amount в целых рублях и category food | vet | medicine | grooming | toys | other. Если вид непонятен — details = null и missing ["details"].',
  "Фото голосом не добавляются.",
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

function petsOf(pets: CommandPet[]): string {
  return pets.length === 0
    ? "- нет"
    : pets.map(({ id, name, species }) => `- ${name} (${species}): ${id}`).join("\n");
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
        `Питомцы:\n${petsOf(context.pets)}`,
      ].join("\n"),
    },
    { role: "user", content: text },
  ];
}
