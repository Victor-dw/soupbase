import "server-only";

export function typesafeKey() {
  return (
    process.env.TYPESAFE_API_KEY ||
    process.env.TYPESAFE_AI_API_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    ""
  );
}

export function typesafeBase() {
  return (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai/v1").replace(
    /\/$/,
    "",
  );
}

export function deepseekBase() {
  return (process.env.DEEPSEEK_BASE_URL || "https://www.xictory.xyz/v1").replace(
    /\/$/,
    "",
  );
}

export function config() {
  const mode = process.env.AI_ACCESS_MODE || "byok_only";
  if (!["byok_only", "site_only", "both"].includes(mode))
    throw new Error("Invalid AI_ACCESS_MODE");
  if (mode !== "byok_only" && !typesafeKey())
    throw new Error("Site mode requires TYPESAFE_API_KEY");
  return {
    mode,
    model: process.env.JEV_MODEL || "jev-latest",
    deepseekModel: process.env.DEEPSEEK_MODEL || "gemini-3.1-flash-lite",
    hasDeepSeek: Boolean(process.env.DEEPSEEK_API_KEY),
    repository: "https://github.com/spoonnotfound/soupbase",
  };
}
