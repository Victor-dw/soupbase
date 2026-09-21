import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import doorbell from "../content/puzzles/zh/doorbell.json";

const { id: _id, ...sample } = doorbell;
let generated = 0;
let compassCalls = 0;
vi.mock("../src/server/deepseek", () => ({
  generatePuzzle: async ({ language }: { language: string }) => {
    generated += 1;
    return {
      ...sample,
      language,
      title: "生成题 " + generated,
    };
  },
  generateCompass: async () => {
    compassCalls += 1;
    return {
      identity: [`身份问句 ${compassCalls}`, "他喝醉了吗？"],
      scene: ["事发地点靠近海吗？", "关掉的灯能被远处看见吗？"],
      cause: ["新闻里有事故吗？", "他是因为内疚才死的吗？"],
    };
  },
}));
vi.mock("@ai-sdk/typesafe-ai", () => ({
  createTypeSafeAi: ({ apiKey }: { apiKey: string }) => ({
    evaluationModel: () => ({ key: apiKey }),
  }),
}));
vi.mock("ai", () => ({
  experimental_evaluate: async () => ({
    answers: { answer: { choice: "yes", probabilities: {} } },
    providerMetadata: { typesafe: { confidence: { answer: 0.99 } } },
    usage: { inputTokens: 10, outputTokens: 1 },
  }),
}));

import { handle } from "../src/server/api";
import { query, sql } from "../src/server/db";

const origin = "http://localhost:3100";
class Client {
  cookie = "";
  async request(path: string, method = "GET", body?: unknown) {
    const response = await handle(
      new NextRequest(origin + "/api/" + path, {
        method,
        headers: {
          origin,
          "content-type": "application/json",
          cookie: this.cookie,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      path.split("/"),
    );
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    return { status: response.status, data: await response.json() };
  }
}

beforeAll(async () => {
  await mkdir(".data", { recursive: true });
  process.env.LOCAL_DB_PATH = ".data/test-run-" + randomUUID();
  delete process.env.DATABASE_URL;
  process.env.AI_ACCESS_MODE = "byok_only";
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key-not-real";
});

describe("survival runs", () => {
  it("cooks a private run puzzle that stays out of the catalog", async () => {
    const c = new Client();
    const r = await c.request("runs", "POST", { locale: "zh" });
    expect(r.status).toBe(201);
    expect(r.data.run.status).toBe("active");
    expect(r.data.game.puzzle.title).toMatch(/^生成题 /);
    expect(r.data.game.solution).toBeUndefined();
    const catalog = await c.request("puzzles");
    expect(
      catalog.data.some((p: { id: string }) => p.id === r.data.game.puzzle.id),
    ).toBe(false);
    const library = await c.request("library");
    expect(
      library.data.puzzles.some(
        (p: { id: string }) => p.id === r.data.game.puzzle.id,
      ),
    ).toBe(false);
  });

  it("resumes the active run and keeps generated titles on the server", async () => {
    const c = new Client();
    const a = await c.request("runs", "POST", { locale: "zh" });
    const b = await c.request("runs", "POST", { locale: "zh" });
    expect(b.data.run.id).toBe(a.data.run.id);
    expect(b.data.game.id).toBe(a.data.game.id);
    const [row] = await query(
      sql`SELECT titles FROM runs WHERE id=${a.data.run.id}`,
    );
    expect(JSON.stringify(row.titles)).toContain("生成题");
  });

  it("rerolls a new generated case without adding it to the catalog", async () => {
    const c = new Client();
    const a = await c.request("runs", "POST", { locale: "zh" });
    const b = await c.request(`runs/${a.data.run.id}/reroll`, "POST", {});
    expect(b.status).toBe(200);
    expect(b.data.run.id).toBe(a.data.run.id);
    expect(b.data.game.id).not.toBe(a.data.game.id);
    expect(b.data.game.puzzle.title).not.toBe(a.data.game.puzzle.title);
    const catalog = await c.request("puzzles");
    expect(
      catalog.data.some(
        (p: { id: string }) => p.id === b.data.game.puzzle.id,
      ),
    ).toBe(false);
  });

  it("caches compass until the player asks for a fresh batch", async () => {
    const c = new Client();
    const r = await c.request("runs", "POST", { locale: "zh" });
    const sid = r.data.game.id;
    const first = await c.request(`sessions/${sid}/compass`, "POST", {});
    expect(first.status).toBe(200);
    expect(first.data.compass.identity).toHaveLength(2);
    const cached = await c.request(`sessions/${sid}/compass`, "POST", {});
    expect(cached.data.compass.identity[0]).toBe(first.data.compass.identity[0]);
    const refreshed = await c.request(`sessions/${sid}/compass`, "POST", {
      refresh: true,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.data.compass.identity[0]).not.toBe(
      first.data.compass.identity[0],
    );
  });
});
