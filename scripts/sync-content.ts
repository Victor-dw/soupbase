import { readCatalog } from "./catalog";
import { syncCatalog } from "./sync-catalog";
// Validate the whole catalog before writing anything.
const catalog = await readCatalog();
await syncCatalog(catalog);
console.log(
  `Synced ${catalog.length} puzzles. Existing games keep their revisions.`,
);
process.exit(0);
