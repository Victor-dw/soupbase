import { spawnSync } from "node:child_process";

// Production clones initialize their own database. Previews must opt in with
// an isolated database; never give untrusted PR builds production credentials.
const setup =
  process.env.DATABASE_SETUP === "true" ||
  (process.env.VERCEL_ENV === "production" &&
    process.env.DATABASE_SETUP !== "false");
function fail(message) {
  console.error(message);
  process.exit(1);
}
if (process.env.VERCEL === "1") {
  if (!process.env.DATABASE_URL)
    fail("Set DATABASE_URL in Vercel Environment Variables.");
  try {
    const u = new URL(process.env.APP_ORIGIN || "");
    if (u.protocol !== "https:" || u.origin !== process.env.APP_ORIGIN)
      throw new Error();
  } catch {
    fail(
      "Set APP_ORIGIN to your exact HTTPS site origin, without a trailing slash.",
    );
  }
  const mode = process.env.AI_ACCESS_MODE || "byok_only";
  if (!["byok_only", "site_only", "both"].includes(mode))
    fail("Invalid AI_ACCESS_MODE.");
  if (mode !== "byok_only" && !process.env.AI_GATEWAY_API_KEY)
    fail(
      "Site access requires AI_GATEWAY_API_KEY in Vercel Environment Variables.",
    );
  if (process.env.AI_MOCK === "true")
    fail("AI_MOCK must be disabled for deployment.");
}
if (setup && !process.env.DATABASE_URL)
  fail("Database setup requires DATABASE_URL.");
const build = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status || 1);
if (setup) {
  for (const file of ["migrate.ts", "sync-content.ts"]) {
    const result = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", `scripts/${file}`],
      { encoding: "utf8" },
    );
    // Database failures can include connection details. Keep raw errors out of build logs.
    if (result.status !== 0)
      fail(
        `Database setup failed in ${file}. Check connectivity and permissions; raw database errors are withheld.`,
      );
  }
  console.log("Database initialized and public puzzle catalog synced.");
} else {
  console.log(
    "Database setup skipped. Initialize this environment separately before use.",
  );
}
