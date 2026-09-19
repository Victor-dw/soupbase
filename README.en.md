# Soupbase

A text-focused, bilingual lateral-thinking puzzle game hosted by Jev. Ask questions, reveal hints, submit an explanation, or create a private puzzle and share a revocable play link.

[中文](README.md) · [Deployment](docs/deployment.md) · [Puzzle contributions](content/puzzles/README.md) · [Architecture](docs/architecture.md) · [Security](docs/security.md)

## Deploy to Vercel

<!-- vercel-deploy:start -->
Site key + BYOK (enter your own key during deployment):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase&env=DATABASE_URL%2CAPP_ORIGIN%2CAI_ACCESS_MODE%2CAI_GATEWAY_API_KEY&envDefaults=%7B%22AI_ACCESS_MODE%22%3A%22both%22%7D&envDescription=Enter+your+PostgreSQL+URL+and+exact+HTTPS+site+origin.+Site+mode+also+requires+your+own+Vercel+AI+Gateway+key.+Never+put+secrets+in+Git+or+this+URL.&envLink=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase%2Fblob%2FHEAD%2Fdocs%2Fdeployment.md)

BYOK only (no site key required):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase&env=DATABASE_URL%2CAPP_ORIGIN%2CAI_ACCESS_MODE&envDefaults=%7B%22AI_ACCESS_MODE%22%3A%22byok_only%22%7D&envDescription=Enter+your+PostgreSQL+URL+and+exact+HTTPS+site+origin.+Site+mode+also+requires+your+own+Vercel+AI+Gateway+key.+Never+put+secrets+in+Git+or+this+URL.&envLink=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase%2Fblob%2FHEAD%2Fdocs%2Fdeployment.md)
<!-- vercel-deploy:end -->

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
cp .env.example .env.local
npm run content:sync
npm run dev
```

Open [localhost:3000/en](http://localhost:3000/en). Local development uses PGlite in the ignored `.data/postgres` directory. Stop the dev server before running database maintenance or content sync against this directory. Production requires PostgreSQL.

The default is BYOK: enter a **Vercel AI Gateway key** in Settings. It is held in page memory and cleared on refresh. Model calls incur provider charges. Browsing, authoring, hints and revealing the solution do not need a model key.

Vercel reads `vercel.json`; production builds initialize PostgreSQL and sync the catalog. Enter `DATABASE_URL`, your exact HTTPS `APP_ORIGIN`, and (for site access) `AI_GATEWAY_API_KEY` in the Vercel form or Project Settings → Environment Variables. Never put their values in Git or Deploy Button URLs. Preview environments require separate credentials and explicit database setup.

## Features and configuration

- Chinese/English UI, light/dark themes, saved games, hints and explanation checks.
- Four host answers: Yes, No, Irrelevant, Cannot determine yet, with native confidence.
- Private authoring and JSON import/export. Sharing never publishes to the public catalog.
- `AI_ACCESS_MODE`: `byok_only` (default), `site_only`, or `both`. Site access requires server-side `AI_GATEWAY_API_KEY`; credentials never silently fall back.
- `UPLOADS_ENABLED=false` disables new puzzle creation; existing shares remain accessible.
- `ENABLE_GUESS=false` disables explanation submissions.
- `NEXT_PUBLIC_REPOSITORY_URL` enables an optional GitHub/Star link.

There are no accounts, anonymous daily quotas, moderation queues or Star-based unlocks. Site-key usage budgets are the operator's responsibility.

BYOK requests pass through the deployment server, which can read the key. The application does not persist or intentionally log it; open source does not prove a remote deployment runs identical code. See [security boundaries](docs/security.md).

## Content and contributions

The release includes three original Chinese examples and their English versions. Base examples are in `content/examples/index.json`; additional translations and community contributions are individual JSON files in `content/puzzles/`.

Copy the [template](content/puzzle.template.json), follow the [bilingual guide](content/puzzles/README.md), and submit a PR with permission details. A maintainer reviews it; deployment content sync is explicit. Public solutions are visible in the repository. Keep private puzzles, management links and database backups out of Git.

## Development

```sh
npm run content:check
npm run typecheck
npm test
npm run build
```

Tests use isolated databases and a mock model, without API credentials or paid calls. They do not establish model accuracy. The stack is Next.js, React, TypeScript, PostgreSQL/PGlite and Vercel AI SDK. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) for code; [CC0 1.0](content/LICENSE.md) for bundled original puzzles. User submissions and third-party material are not automatically relicensed. Adaptations require documented permission, not merely a source URL.
