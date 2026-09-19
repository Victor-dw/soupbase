import "server-only";
export function config() {
  const mode = process.env.AI_ACCESS_MODE || "byok_only";
  if (!["byok_only", "site_only", "both"].includes(mode))
    throw new Error("Invalid AI_ACCESS_MODE");
  if (mode !== "byok_only" && !process.env.AI_GATEWAY_API_KEY)
    throw new Error("Site mode requires AI_GATEWAY_API_KEY");
  return {
    mode,
    model: "typesafe-ai/jev",
    repository: "https://github.com/spoonnotfound/soupbase",
    version: "0.1.2",
  };
}
