import { describe, it, expect } from "vitest";
import { gradeGuess, guessQuestions } from "../src/server/guess";
import { puzzleSchema } from "../src/shared/puzzle";
import examples from "../content/examples/index.json";
const ids = ["f2", "f3"];
const complete = {
  f2: { choice: "supported" },
  f3: { choice: "supported" },
  coherence: { choice: "coherent" },
};
const confidence = { f2: 0.99, f3: 0.99, coherence: 0.99 };
describe("conservative completion gate", () => {
  it("accepts contextual explanations at the new boundary but still rejects missing facts", () => {
    const scores = { f2: 0.7, f3: 0.72, coherence: 0.71 };
    expect(gradeGuess(ids, complete, scores)).toBe("solved");
    expect(
      gradeGuess(ids, { ...complete, f3: { choice: "missing" } }, scores),
    ).toBe("incomplete");
  });

  it("requires every required fact plus a coherent explanation", () => {
    expect(
      Object.keys(guessQuestions(puzzleSchema.parse(examples[0]))),
    ).toEqual(["f2", "f3", "coherence"]);
    expect(gradeGuess(ids, complete, confidence)).toBe("solved");
    expect(
      gradeGuess(ids, { ...complete, f3: { choice: "missing" } }, confidence),
    ).toBe("incomplete");
    expect(
      gradeGuess(
        ids,
        { ...complete, coherence: { choice: "conflicting" } },
        confidence,
      ),
    ).toBe("incomplete");
  });
  it.each([undefined, null, NaN, Infinity, -1, 1.01, 0.699, "0.99"])(
    "does not unlock a solution with invalid confidence %s",
    (c) => {
      expect(gradeGuess(ids, complete, { ...confidence, f2: c })).toBe(
        "uncertain",
      );
    },
  );
  it("refuses missing, extra or unknown answers and empty required-fact sets", () => {
    for (const answers of [
      null,
      {},
      { ...complete, f3: undefined },
      { ...complete, extra: { choice: "supported" } },
      { ...complete, f3: { choice: "solved" } },
    ])
      expect(gradeGuess(ids, answers, confidence)).toBe("uncertain");
    expect(gradeGuess([], complete, confidence)).toBe("uncertain");
    expect(
      gradeGuess(
        ids,
        { ...complete, coherence: { choice: "uncertain" } },
        confidence,
      ),
    ).toBe("uncertain");
  });
});
