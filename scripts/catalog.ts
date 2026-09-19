import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { puzzleSchema } from "../src/shared/puzzle";

export async function readCatalog(root = path.resolve("content/puzzles")) {
  const entries = [];
  for (const language of ["zh", "en"] as const) {
    for (const name of (await readdir(path.join(root, language))).sort()) {
      if (name === ".gitkeep") continue;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(name))
        throw new Error(`Invalid puzzle filename: ${language}/${name}`);
      const file = path.join(root, language, name);
      const raw = await readFile(file, "utf8");
      if (Buffer.byteLength(raw) > 65536)
        throw new Error(`${file}: exceeds 64 KiB`);
      const puzzle = puzzleSchema.parse(JSON.parse(raw));
      if (puzzle.language !== language)
        throw new Error(`${file}: language does not match directory`);
      if (puzzle.golden_questions.length < 4)
        throw new Error(`${file}: include at least four expected questions`);
      const id = `community-${language}-${name.slice(0, -5)}`;
      const hash = createHash("sha256")
        .update(JSON.stringify(puzzle))
        .digest("hex");
      entries.push({ id, revision: `${id}-${hash}`, puzzle });
    }
  }
  return entries;
}
