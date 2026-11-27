import { cpSync, lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";

// `skills update` links each skill to an absolute path under `.agents/`, which breaks on every
// other machine; the repo keeps the files themselves.
const skillsDirectory = join(".claude", "skills");

for (const name of readdirSync(skillsDirectory)) {
  const path = join(skillsDirectory, name);

  if (lstatSync(path).isSymbolicLink()) {
    const target = realpathSync(path);

    rmSync(path);
    cpSync(target, path, { recursive: true });
  }
}

rmSync(".agents", { recursive: true, force: true });
