import { readFileSync, writeFileSync } from "node:fs";
const input = process.argv[2] || "";
const slug = input.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
if (!/^[\w.-]+\/[\w.-]+$/.test(slug)) {
  console.error("Usage: npm run deploy:button -- OWNER/REPOSITORY");
  process.exit(1);
}
const repo = `https://github.com/${slug}`;
function button(site) {
  const env = ["DATABASE_URL", "APP_ORIGIN", "AI_ACCESS_MODE"];
  if (site) env.push("AI_GATEWAY_API_KEY");
  const url = new URL("https://vercel.com/new/clone");
  url.searchParams.set("repository-url", repo);
  url.searchParams.set("env", env.join(","));
  url.searchParams.set(
    "envDefaults",
    JSON.stringify({ AI_ACCESS_MODE: site ? "both" : "byok_only" }),
  );
  url.searchParams.set(
    "envDescription",
    "Enter your PostgreSQL URL and exact HTTPS site origin. Site mode also requires your own Vercel AI Gateway key. Never put secrets in Git or this URL.",
  );
  url.searchParams.set("envLink", `${repo}/blob/HEAD/docs/deployment.md`);
  return `[![Deploy with Vercel](https://vercel.com/button)](${url})`;
}
for (const [file, body] of [
  [
    "README.md",
    `站点 Key + BYOK（部署时填写自己的 Key）：\n\n${button(true)}\n\n仅 BYOK（无需站点 Key）：\n\n${button(false)}`,
  ],
  [
    "README.en.md",
    `Site key + BYOK (enter your own key during deployment):\n\n${button(true)}\n\nBYOK only (no site key required):\n\n${button(false)}`,
  ],
]) {
  const source = readFileSync(file, "utf8");
  const pattern =
    /<!-- vercel-deploy:start -->[\s\S]*?<!-- vercel-deploy:end -->/;
  if (!pattern.test(source)) throw new Error(`Missing deploy block in ${file}`);
  writeFileSync(
    file,
    source.replace(
      pattern,
      `<!-- vercel-deploy:start -->\n${body}\n<!-- vercel-deploy:end -->`,
    ),
  );
}
console.log(
  `Updated both README deployment buttons for ${repo}. No credentials were read.`,
);
