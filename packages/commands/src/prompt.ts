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
  'Всё, что предстоит сделать или что будет («напомни в четверг про ветеринара», «в субботу в 12 груминг», «3 марта день рождения мамы», «купить корм»), — дело: outcome = "task".',
  'То, что уже случилось с питомцем («Бьюик весит 32 кг», «вчера сделали прививку»), — запись в журнал питомца: outcome = "care_entry": прививка (vaccination), обработка (treatment), визит к ветеринару (vet_visit), вес (weight), трата (expense) или заметка (note).',
  'У care_entry: petId — только id из списка питомцев; если питомец один, а имя не названо — его id; если питомцев несколько и имя не названо или подходит нескольким — petId = null и ambiguities { field: "pet", mention, candidateIds }.',
  "У care_entry: date — когда это было (YYYY-MM-DD, «вчера» от сегодняшней даты), time — HH:MM или null; если не сказано — оба null, это значит «сейчас». repeatOn — когда повторить прививку, обработку или визит («следующая через год», «повторить через 3 месяца») в YYYY-MM-DD, иначе null.",
  'У care_entry details — по схеме вида: стоимость cost { amount в целых рублях, category vet | medicine } у прививки, обработки и визита; вес weightKg в кг с шагом 0.1; трата amount в целых рублях и category food | vet | medicine | grooming | toys | other. Если вид непонятен — details = null и missing ["details"].',
  "Фото голосом не добавляются.",
  "У task: title — что сделать или что за событие, note — уточнение или null. date — день или null, если день не назван; time — HH:MM или null для всего дня. Окончание (endDate, endTime) — только если оно названо, иначе null.",
  'У task напоминания reminderOffsets: at-start (в момент), 15m, 1h, 1d, 1w; не больше трёх. Слово «напомни» без срока — ["at-start"], «напомни за день» — ["1d"], без слова «напомни» — []. 15m и 1h — только если есть время; без даты напоминаний нет.',
  'У task recipientIds — кому напомнить, только id из списка участников; null значит по умолчанию. «Напомни мне» или «только мне» — visibility "private" и recipientIds только с id говорящего; иначе visibility "shared".',
  "У task petId — id питомца из списка, если дело про питомца, иначе null.",
  'Если имя подходит нескольким участникам или питомцам, не выбирай: добавь в ambiguities { field: "recipients" или "pet", mention, candidateIds }.',
  'Удаление, изменение существующих записей, управление семьёй и всё прочее — outcome = "unsupported".',
  'Если фраза непонятна или это не команда — outcome = "unrecognized".',
  "Относительные даты («завтра», «в пятницу») переводи в YYYY-MM-DD от сегодняшней даты; время — HH:MM.",
  "Не выдумывай: чего нет во фразе, ставь null и перечисляй в missing (у task: title).",
  "recurrence: null или { frequency: weekly | monthly | yearly, until: YYYY-MM-DD или null }; без даты повторения нет.",
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
