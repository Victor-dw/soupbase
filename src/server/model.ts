import "server-only";
import { experimental_evaluate as evaluate } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { AppError } from "./access";
import { config } from "./config";
import { guessQuestions, gradeGuess, GUESS_PROMPT_VERSION } from "./guess";
import { hostQuestions, hostState, HOST_PROMPT_VERSION } from "./host";
import { CONFIDENCE_THRESHOLD } from "@/shared/confidence";
import { decisions, type Decision, type PuzzleInput } from "@/shared/puzzle";
export function selectKey(source: string, byok: string | null) {
  const c = config();
  if (source === "site") {
    if (c.mode === "byok_only") throw new AppError("site_disabled", 403);
    return process.env.AI_GATEWAY_API_KEY!;
  }
  if (source === "byok") {
    if (c.mode === "site_only") throw new AppError("byok_disabled", 403);
    if (!byok || byok.length < 12 || byok.length > 512 || /[\r\n]/.test(byok))
      throw new AppError("key_required", 401);
    return byok;
  }
  throw new AppError("invalid_source", 422);
}
export function hostDecision(answer: unknown): Decision {
  const choice = (answer as { choice?: unknown } | null)?.choice;
  if (typeof choice !== "string" || !decisions.includes(choice as Decision))
    throw new AppError("upstream_failed", 502);
  return choice as Decision;
}
export async function judge(
  p: PuzzleInput,
  input: string,
  history: { input: string; decision: string }[],
  kind: string,
  key: string,
) {
  const gateway = createGateway({
    apiKey: key,
    fetch: async (url, init) => {
      const host = new URL(String(url)).hostname;
      if (host !== "ai-gateway.vercel.sh")
        throw new AppError("upstream_failed", 502);
      return fetch(url, { ...init, redirect: "error" });
    },
  });
  const questions: Record<
    string,
    { type: "choice"; instructions: string; criteria: Record<string, string> }
  > = kind === "guess" ? guessQuestions(p) : hostQuestions();
  const state = hostState(p, input, kind === "guess" ? [] : history);
  try {
    const r = await evaluate({
      model: gateway.evaluationModel(config().model),
      state,
      questions,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(20000),
    });
    const confidence = r.providerMetadata?.typesafe?.confidence as
      Record<string, number> | undefined;
    const answers = r.answers as Record<
      string,
      { choice: string; probabilities: Record<string, number> }
    >;
    return {
      decision:
        kind === "guess"
          ? gradeGuess(
              p.facts.filter((f) => f.required).map((f) => f.id),
              answers,
              confidence,
            )
          : hostDecision(answers?.answer),
      metadata: {
        trace: {
          request: {
            model: config().model,
            state,
            questions,
            maxRetries: 0,
            timeoutMs: 20000,
          },
          // Explicit allowlist: never persist transport headers or provider error bodies.
          response: {
            answers: Object.fromEntries(
              Object.entries(questions).map(([id, q]) => {
                const answer = answers?.[id];
                return [
                  id,
                  {
                    choice:
                      answer && Object.hasOwn(q.criteria, answer.choice)
                        ? answer.choice
                        : null,
                    probabilities: Object.fromEntries(
                      Object.keys(q.criteria).flatMap((choice) => {
                        const value = answer?.probabilities?.[choice];
                        return typeof value === "number" &&
                          Number.isFinite(value) &&
                          value >= 0 &&
                          value <= 1
                          ? [[choice, value]]
                          : [];
                      }),
                    ),
                  },
                ];
              }),
            ),
            confidence: Object.fromEntries(
              Object.keys(questions).map((id) => {
                const value = confidence?.[id];
                return [
                  id,
                  typeof value === "number" &&
                  Number.isFinite(value) &&
                  value >= 0 &&
                  value <= 1
                    ? value
                    : null,
                ];
              }),
            ),
            usage: {
              inputTokens: r.usage.inputTokens,
              outputTokens: r.usage.outputTokens,
            },
          },
        },
        model: config().model,
        promptVersion:
          kind === "guess" ? GUESS_PROMPT_VERSION : HOST_PROMPT_VERSION,
        confidence: confidence || null,
        confidenceThreshold: kind === "guess" ? CONFIDENCE_THRESHOLD : null,
        inputTokens: r.usage.inputTokens,
        outputTokens: r.usage.outputTokens,
      },
    };
  } catch (e: unknown) {
    if (e instanceof AppError) throw e;
    const status = (e as { statusCode?: number }).statusCode;
    throw new AppError(
      status === 401 || status === 403
        ? "key_rejected"
        : status === 429
          ? "provider_rate_limit"
          : "upstream_failed",
      status === 429 ? 429 : status === 401 || status === 403 ? 401 : 502,
    );
  }
}
