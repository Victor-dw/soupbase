import archived from "../content/archived.json";
import { readCatalog } from "./catalog";
import { syncCatalog, archiveCatalog } from "./sync-catalog";
// Validate the whole catalog before writing anything.
const catalog = await readCatalog();
await syncCatalog(catalog);
await archiveCatalog(archived);
console.log(
  `Synced ${catalog.length} community puzzles. Existing games keep their revisions.`,
);
process.exit(0);
