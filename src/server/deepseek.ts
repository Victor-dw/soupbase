import "server-only";
import { z } from "zod";
import { puzzleSchema, type PuzzleInput } from "@/shared/puzzle";
import type { Compass } from "@/shared/run";
import { AppError } from "./access";
import { config, deepseekBase } from "./config";
import { hostOf, lockedFetch } from "./outbound";

const draftSchema = z.object({
  title: z.string().trim().min(1).max(80),
  surface: z.string().trim().min(1).max(2000),
  solution: z.string().trim().min(1).max(6000),
  facts: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(500),
        required: z.boolean(),
      }),
    )
    .min(1)
    .max(8),
  hints: z.array(z.string().trim().min(1).max(500)).max(3).default([]),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  unknowns: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
});

const compassSchema = z.object({
  identity: z.array(z.string().trim().min(1).max(80)).min(2).max(4),
  scene: z.array(z.string().trim().min(1).max(80)).min(2).max(4),
  cause: z.array(z.string().trim().min(1).max(80)).min(2).max(4),
});

async function chatJson(prompt: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new AppError("deepseek_unavailable", 503);
  const base = deepseekBase();
  const model = config().deepseekModel;
  const res = await lockedFetch(hostOf(base))(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Return only valid JSON. No markdown.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (res.status === 401 || res.status === 403)
    throw new AppError("key_rejected", 401);
  if (res.status === 429) throw new AppError("provider_rate_limit", 429);
  if (!res.ok) throw new AppError("upstream_failed", 502);
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new AppError("upstream_failed", 502);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("upstream_failed", 502);
  }
}

function toPuzzle(
  draft: z.infer<typeof draftSchema>,
  language: "zh" | "en",
  difficulty: PuzzleInput["difficulty"],
): PuzzleInput {
  return puzzleSchema.parse({
    schema_version: "1.0",
    language,
    title: draft.title,
    surface: draft.surface,
    solution: draft.solution,
    facts: draft.facts.map((f, i) => ({
      id: `f${i + 1}`,
      text: f.text,
      required: f.required,
    })),
    unknowns: draft.unknowns,
    character_claims: [],
    hints: draft.hints,
    difficulty,
    tags: draft.tags,
    source: {
      kind: "original",
      author: language === "zh" ? "无限探案" : "Endless case",
      note: "Generated for a survival run; not a public catalog entry.",
    },
  });
}

export async function generatePuzzle(input: {
  language: "zh" | "en";
  difficulty: PuzzleInput["difficulty"];
  avoidTitles: string[];
}): Promise<PuzzleInput> {
  const avoid = input.avoidTitles.filter(Boolean).slice(0, 12).join("、");
  const prompt =
    input.language === "zh"
      ? `创作一道原创海龟汤（情境推理）题目，难度 ${input.difficulty}。
要求：汤面短而反常；汤底唯一、无超自然、无灵异；至少 1 条 required 关键事实。
不要使用这些标题：${avoid || "无"}。
JSON 字段：title, surface, solution, facts[{text, required}], hints[最多3], tags, unknowns。`
      : `Write an original lateral-thinking (situation) puzzle, difficulty ${input.difficulty}.
The surface is short and odd; the solution is unique, naturalistic, no supernatural.
At least one required fact. Do not reuse titles: ${avoid || "none"}.
JSON keys: title, surface, solution, facts[{text, required}], hints (max 3), tags, unknowns.`;
  let last: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const raw = draftSchema.parse(await chatJson(prompt));
      if (!raw.facts.some((f) => f.required)) raw.facts[0].required = true;
      return toPuzzle(raw, input.language, input.difficulty);
    } catch (e) {
      last = e;
    }
  }
  if (last instanceof AppError) throw last;
  throw new AppError("generate_failed", 502);
}

export async function generateCompass(input: {
  language: "zh" | "en";
  surface: string;
  history: { input: string; decision: string }[];
  avoid?: string[];
}): Promise<Compass> {
  const asked = input.history
    .slice(-8)
    .map((t) => `${t.input} → ${t.decision}`)
    .join("\n");
  const avoid = (input.avoid || []).filter(Boolean).slice(0, 16).join("、");
  const prompt =
    input.language === "zh"
      ? `你是海龟汤调查罗盘。只能根据汤面和已问过的是非问题，建议下一步是非问句。
绝对不要编造或暗示汤底。问句必须能用「是/不是」回答。换一批新问句，不要重复：${avoid || "无"}。
汤面：${input.surface}
已问：${asked || "无"}
JSON：{"identity":["..."],"scene":["..."],"cause":["..."]}，每类 2-4 句。`
      : `Suggest yes/no investigation questions from the surface and asked questions only.
Never imply the solution. Write a fresh batch, do not repeat: ${avoid || "none"}.
Surface: ${input.surface}
Asked: ${asked || "none"}
JSON: {"identity":["..."],"scene":["..."],"cause":["..."]}, 2-4 each.`;
  return compassSchema.parse(await chatJson(prompt));
}