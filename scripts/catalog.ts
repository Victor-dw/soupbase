import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { puzzleSchema } from "../src/shared/puzzle";

export async function readCatalog(root = path.resolve("content/puzzles")) {
  const entries = [];
  const ids = new Set<string>();
  for (const language of ["zh", "en"] as const) {
    for (const name of (
      await readdir(
        /* turbopackIgnore: true */ path.join(
          /* turbopackIgnore: true */ root,
          language,
        ),
      )
    ).sort()) {
      if (name === ".gitkeep") continue;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(name))
        throw new Error(`Invalid puzzle filename: ${language}/${name}`);
      const file = path.join(/* turbopackIgnore: true */ root, language, name);
      const raw = await readFile(/* turbopackIgnore: true */ file, "utf8");
      if (Buffer.byteLength(raw) > 65536)
        throw new Error(`${file}: exceeds 64 KiB`);
      const { id, ...content } = JSON.parse(raw);
      if (
        typeof id !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
        id.length > 100
      )
        throw new Error(`${file}: invalid puzzle id`);
      if (ids.has(id)) throw new Error(`${file}: duplicate puzzle id ${id}`);
      ids.add(id);
      const puzzle = puzzleSchema.parse(content);
      if (puzzle.language !== language)
        throw new Error(`${file}: language does not match directory`);
      const hash = createHash("sha256")
        .update(JSON.stringify(puzzle))
        .digest("hex");
      entries.push({ id, revision: `${id}-${hash}`, puzzle });
    }
  }
  return entries;
}
