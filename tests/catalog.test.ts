import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import doorbell from "../content/puzzles/zh/doorbell.json";
const example = { ...doorbell, id: "test-story" };
import { readCatalog } from "../scripts/catalog";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "soup-catalog-"));
  await mkdir(path.join(root, "zh"));
  await mkdir(path.join(root, "en"));
  process.env.LOCAL_DB_PATH = path.join(root, "db");
  delete process.env.DATABASE_URL;
});

describe("puzzle catalog", () => {
  it("validates puzzle languages", async () => {
    const file = path.join(root, "zh", "test-story.json");
    await writeFile(file, JSON.stringify({ ...example, language: "en" }));
    await expect(readCatalog(root)).rejects.toThrow("language does not match");
    await writeFile(file, JSON.stringify(example));
    expect((await readCatalog(root))[0].id).toBe("test-story");
  });

  it("rejects duplicate IDs across languages", async () => {
    const file = path.join(root, "en", "duplicate.json");
    await writeFile(file, JSON.stringify({ ...example, language: "en" }));
    await expect(readCatalog(root)).rejects.toThrow("duplicate puzzle id");
    const { unlink } = await import("node:fs/promises");
    await unlink(file);
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
});
