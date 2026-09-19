import { query, sql } from "../src/server/db";
const [command, id] = process.argv.slice(2);
if (command === "cleanup") {
  await query(
    sql`DELETE FROM sessions WHERE updated_at<now()-interval '30 days'`,
  );
  await query(sql`DELETE FROM puzzles WHERE disabled`);
  console.log("Expired games and deleted puzzles purged.");
} else if (command === "curate" && id) {
  await query(
    sql`UPDATE puzzles SET visibility='curated' WHERE id=${id} AND NOT disabled`,
  );
  console.log("Puzzle added to the curated catalog.");
} else if (command === "disable" && id) {
  await query(sql`UPDATE puzzles SET disabled=true WHERE id=${id}`);
  console.log("Puzzle disabled.");
} else {
  console.log("Use: npm run content -- curate <id> | disable <id> | cleanup");
  process.exitCode = 1;
}
process.exit(process.exitCode || 0);
