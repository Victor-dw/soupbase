import "server-only";
import { type TurnConfidence } from "@/shared/confidence";

/** Only expose expected numeric scores, never arbitrary provider metadata. */
export function publicConfidence(
  kind: string,
  value: unknown,
  requiredIds: string[],
  savedThreshold?: unknown,
  hasSavedThreshold = false,
): TurnConfidence {
  const scores =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const fields: {
    id: string;
    kind: TurnConfidence["checks"][number]["kind"];
  }[] =
    kind === "guess"
      ? [
          ...requiredIds.map((id) => ({ id, kind: "fact" as const })),
          { id: "coherence", kind: "coherence" },
        ]
      : [{ id: "answer", kind: "answer" }];
  const checks = fields.map(({ id, kind }) => {
    const score = scores[id];
    return {
      kind,
      score:
        typeof score === "number" &&
        Number.isFinite(score) &&
        score >= 0 &&
        score <= 1
          ? score
          : null,
    };
  });
  return {
    score: checks.every((c) => c.score !== null)
      ? Math.min(...checks.map((c) => c.score!))
      : null,
    // Older records were judged at 0.90; do not relabel them with today's threshold.
    threshold:
      hasSavedThreshold && savedThreshold === null
        ? null
        : typeof savedThreshold === "number" &&
            Number.isFinite(savedThreshold) &&
            savedThreshold >= 0 &&
            savedThreshold <= 1
          ? savedThreshold
          : 0.9,
    checks,
  };
}
