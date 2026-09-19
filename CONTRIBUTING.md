# Contributing

Use Node 24 and `npm ci`. Before opening a PR, run `npm run typecheck`, `npm test`, and `npm run build`.

Tests use mock AI and a separate local database. Never add real credentials, private submissions, or production data to fixtures. Public examples must have clear reuse permission. An API key is not required to work on the interface, hint/reveal flow, or authoring.

Keep public and secret puzzle DTOs separate. Changes to credential handling or access control need a regression test. Model behavior changes need a distinct evaluation report; application mock tests do not establish model accuracy.

## Puzzle contributions

See [the bilingual puzzle guide](content/puzzles/README.md) and [JSON template](content/puzzle.template.json). Add one file per puzzle and run `npm run content:check`. Website uploads may remain disabled; GitHub contributions are reviewed through pull requests. No database or model key is required.

## Maintainer commands

- `npm run db:migrate`: initialize tables and base examples.
- `npm run content:sync`: validate and sync Git puzzle files and the archive list.
- `npm run content -- curate <id>`: publish a reviewed database puzzle.
- `npm run content -- disable <id>`: block puzzle access.
- `npm run content -- cleanup`: remove sessions inactive for 30 days and disabled puzzles.

These commands use the process environment, not automatic Next.js `.env.local` loading. For local environment files, use `node --env-file=.env.local --conditions=react-server --import tsx scripts/<script>.ts`, or export variables first. Stop the dev server before using local PGlite maintenance commands. Back up production before destructive maintenance.
