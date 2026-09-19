import type { readCatalog } from "./catalog";
import { publicContent } from "../src/shared/puzzle";
import { query, sql } from "../src/server/db";
export async function syncCatalog(
  catalog: Awaited<ReturnType<typeof readCatalog>>,
) {
  for (const { id, revision, puzzle } of catalog) {
    await query(
      sql`INSERT INTO puzzles (id, visibility) VALUES (${id}, 'curated') ON CONFLICT DO NOTHING`,
    );
    await query(sql`INSERT INTO revisions (id, puzzle_id, public_content, secret_content)
    VALUES (${revision}, ${id}, ${JSON.stringify(publicContent(puzzle))}::jsonb, ${JSON.stringify(puzzle)}::jsonb)
    ON CONFLICT DO NOTHING`);
    await query(
      sql`UPDATE puzzles SET revision=${revision} WHERE id=${id} AND owner_id IS NULL`,
    );
  }
}
