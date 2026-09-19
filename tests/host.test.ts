import { describe, expect, it } from "vitest";
import { hostQuestions, hostState } from "../src/server/host";
import { puzzleSchema } from "../src/shared/puzzle";
import comparison from "./fixtures/host-prompt.json";
import doorbell from "../content/puzzles/zh/doorbell.json";
const { id: _puzzleId, ...puzzleContent } = doorbell;

describe("four-answer host", () => {
  it("uses the evaluated facts-first prompt without changing its rules or criteria", () => {
    expect(hostQuestions()).toEqual(comparison.questions);
  });
  it("imports legacy puzzles without carrying forward manually defined relevance", () => {
    const p = puzzleSchema.parse({
      ...puzzleContent,
      irrelevant_topics: ["门铃是否发声"],
      golden_questions: [
        { question: "旧问题", expected: "unknown", reason: "旧格式" },
      ],
    });
    expect(p).not.toHaveProperty("irrelevant_topics");
    expect(p.golden_questions[0].expected).toBe("uncertain");
    const state = hostState(
      { ...p, irrelevant_topics: ["门铃是否发声"] } as typeof p,
      "门铃响了吗？",
      [{ input: "先前问题", decision: "split" }],
    );
    expect(state.reference).not.toHaveProperty("irrelevant_topics");
    expect(state.history[0].decision).toBe("uncertain");
    expect(Object.keys(hostQuestions().answer.criteria)).toEqual([
      "yes",
      "no",
      "irrelevant",
      "uncertain",
    ]);
  });
});
