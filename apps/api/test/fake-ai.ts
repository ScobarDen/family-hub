// Workers AI answering from a script: each run takes the next answer, or fails like the real one.
export function createFakeAi() {
  const answers: unknown[] = [];
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];

  const binding = {
    async run(model: string, input: Record<string, unknown>): Promise<unknown> {
      calls.push({ model, input });

      const answer = answers.shift();

      if (answer instanceof Error) {
        throw answer;
      }

      return answer;
    },
  };

  return {
    // The Worker only ever calls run; the rest of the binding is not used.
    binding: binding as unknown as Ai,
    calls,
    answer(...next: unknown[]) {
      answers.push(...next);
    },
    hear(...phrases: string[]) {
      answers.push(...phrases.map((text) => ({ text })));
    },
    runOutOfNeurons() {
      answers.push(
        new Error("4006: you have used up your daily free allocation of 10,000 neurons"),
      );
    },
  };
}

export type FakeAi = ReturnType<typeof createFakeAi>;
