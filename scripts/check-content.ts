import { readCatalog } from "./catalog";
import { readFile } from "node:fs/promises";
import { puzzleSchema } from "../src/shared/puzzle";
const examples = JSON.parse(
  await readFile("content/examples/index.json", "utf8"),
);
for (const puzzle of examples) puzzleSchema.parse(puzzle);
const catalog = await readCatalog();
console.log(
  `Validated ${examples.length} bundled examples and ${catalog.length} additional examples.`,
);
