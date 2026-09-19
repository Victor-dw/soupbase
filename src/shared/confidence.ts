export const CONFIDENCE_THRESHOLD = 0.7;
// Display only: never changes a host decision or the explanation grading threshold.
export const HOST_LOW_CONFIDENCE_THRESHOLD = 0.7;

export type TurnConfidence = {
  score: number | null;
  threshold: number | null;
  checks: { kind: "answer" | "fact" | "coherence"; score: number | null }[];
};
