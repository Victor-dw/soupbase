import "server-only";
export function config() {
  if (process.env.NODE_ENV === "production" && !process.env.APP_ORIGIN)
    throw new Error("APP_ORIGIN is required in production");
  const mode = process.env.AI_ACCESS_MODE || "byok_only";
  if (!["byok_only", "site_only", "both"].includes(mode))
    throw new Error("Invalid AI_ACCESS_MODE");
  if (mode !== "byok_only" && !process.env.AI_GATEWAY_API_KEY)
    throw new Error("Site mode requires AI_GATEWAY_API_KEY");
  const mock = process.env.AI_MOCK === "true";
  if (mock && process.env.NODE_ENV === "production")
    throw new Error("Mock provider is forbidden in production");
  return {
    mode,
    model: process.env.JEV_MODEL || "typesafe-ai/jev",
    uploads: process.env.UPLOADS_ENABLED !== "false",
    mock,
    repository: validRepo(
      process.env.NEXT_PUBLIC_REPOSITORY_URL ??
        "https://github.com/spoonnotfound/soupbase",
    ),
    guess: process.env.ENABLE_GUESS !== "false",
    version: "0.1.2",
  };
}
function validRepo(value?: string) {
  return value && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(value)
    ? value
    : null;
}
