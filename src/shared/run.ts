export type Compass = {
  identity: string[];
  scene: string[];
  cause: string[];
};

export type RunState = {
  id: string;
  status: "active" | "ended";
  streak: number;
  locale: string;
  currentPuzzleId: string | null;
  currentSessionId: string | null;
  endedReason: string | null;
};

export function difficultyForStreak(streak: number) {
  if (streak <= 1) return "easy" as const;
  if (streak <= 4) return "medium" as const;
  return "hard" as const;
}