import { migrate, seed } from "../src/server/db";
await migrate();
await seed();
console.log("Schema and puzzle catalog are ready.");
process.exit(0);
