import { readCatalog } from "./catalog";
const catalog = await readCatalog();
console.log(`Validated ${catalog.length} puzzles.`);
