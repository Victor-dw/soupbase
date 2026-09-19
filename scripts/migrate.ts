import { migrate, seed } from "../src/server/db";
await migrate();
await seed();
console.log("Schema and public examples are ready.");
process.exit(0);
