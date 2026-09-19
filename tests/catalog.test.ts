import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import examples from "../content/examples/index.json";
const example = examples[0];
import { readCatalog } from "../scripts/catalog";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "soup-catalog-"));
  await mkdir(path.join(root, "zh"));
  await mkdir(path.join(root, "en"));
  process.env.LOCAL_DB_PATH = path.join(root, "db");
  delete process.env.DATABASE_URL;
});

describe("example catalog", () => {
  it("validates languages and requires answer examples", async () => {
    const file = path.join(root, "zh", "test-story.json");
    await writeFile(file, JSON.stringify({ ...example, language: "en" }));
    await expect(readCatalog(root)).rejects.toThrow("language does not match");
    await writeFile(file, JSON.stringify({ ...example, golden_questions: [] }));
    await expect(readCatalog(root)).rejects.toThrow("at least four");
    await writeFile(file, JSON.stringify(example));
    expect((await readCatalog(root))[0].id).toBe("community-zh-test-story");
  });

  it("syncs idempotently, versions edits, and preserves old revisions and disabled status", async () => {
    const { syncCatalog } = await import("../scripts/sync-catalog");
    const { query, sql } = await import("../src/server/db");
    const first = await readCatalog(root);
    await syncCatalog(first);
    await syncCatalog(first);
    expect(
      (
        await query(
          sql`SELECT id FROM revisions WHERE puzzle_id=${first[0].id}`,
        )
      ).length,
    ).toBe(1);
    await query(sql`UPDATE puzzles SET disabled=true WHERE id=${first[0].id}`);
    await writeFile(
      path.join(root, "zh", "test-story.json"),
      JSON.stringify({ ...example, title: "修改后的标题" }),
    );
    const next = await readCatalog(root);
    expect(next[0].id).toBe(first[0].id);
    expect(next[0].revision).not.toBe(first[0].revision);
    await syncCatalog(next);
    const rows = await query(
      sql`SELECT revision, disabled FROM puzzles WHERE id=${first[0].id}`,
    );
    expect(rows[0]).toMatchObject({
      revision: next[0].revision,
      disabled: true,
    });
    expect(
      (
        await query(
          sql`SELECT id FROM revisions WHERE puzzle_id=${first[0].id}`,
        )
      ).length,
    ).toBe(2);
  });
  it("retires only public catalog entries and preserves session access", async () => {
    const { archiveCatalog } = await import("../scripts/sync-catalog");
    const { query, sql } = await import("../src/server/db");
    const { puzzle, session } = await import("../src/server/access");
    await query(
      sql`INSERT INTO visitors (id,secret_hash,expires_at) VALUES ('archive-test-visitor','archive-test-secret',now()+interval '1 day')`,
    );
    await query(
      sql`INSERT INTO sessions (id,visitor_id,puzzle_id,revision_id) VALUES ('archive-test-session','archive-test-visitor','sample-1','sample-1-v1')`,
    );
    await archiveCatalog(["sample-1"]);
    expect((await puzzle("sample-1")).visibility).toBe("archived");
    expect(
      (await session("archive-test-session", "archive-test-visitor"))
        .revision_id,
    ).toBe("sample-1-v1");
    expect(
      await query(
        sql`SELECT id FROM puzzles WHERE id='sample-1' AND visibility='curated'`,
      ),
    ).toHaveLength(0);
    await query(
      sql`UPDATE puzzles SET visibility='private' WHERE id='sample-2'`,
    );
    await archiveCatalog(["sample-2"]);
    await expect(puzzle("sample-2")).rejects.toMatchObject({ status: 404 });
    await query(sql`UPDATE puzzles SET disabled=true WHERE id='sample-1'`);
    await expect(puzzle("sample-1")).rejects.toMatchObject({ status: 404 });
  });
});
