# 贡献海龟汤 / Contribute a puzzle

每道题一个 JSON 文件，使用现有 `schema_version: "1.0"`。复制 `content/puzzle.template.json`，保存为 `content/puzzles/zh/your-story.json` 或 `content/puzzles/en/your-story.json`。中文和英文可以分别贡献，无需同时提供翻译。

Use one JSON file per puzzle. Copy `content/puzzle.template.json` into `zh/your-story.json` or `en/your-story.json`. The language field must match the directory. Filenames use lowercase ASCII letters, digits and hyphens. Either language is welcome; translations are optional.

## 字段 / Fields

- `title`：题目标题 / title.
- `surface`：玩家可见的汤面 / public story.
- `solution`：完整汤底 / full solution.
- `facts`：最多 8 条事实，至少一条 `required: true`；只把真正决定通关的事实标为必需 / up to eight facts; mark only essential solution facts as required.
- `unknowns`、`character_claims`：可选的未设定信息、角色说法；不填写人工无关项 / optional unspecified facts and character claims; no manual relevance list.
- `hints`：最多 3 条渐进提示 / up to three progressive hints.
- `difficulty`、`tags`：难度和标签 / difficulty and tags.
- `source`：原创、改编或授权来源、作者及说明 / origin, author, and permission notes.
- `golden_questions`：至少 4 个问题及预期答案、理由。答案使用 `yes`、`no`、`irrelevant`、`uncertain` / at least four questions with expected choices and reasons.

完整字段约束以 `src/shared/puzzle.ts` 为准。保留文件名即可保持题目 ID；改名会创建新题。
The schema in `src/shared/puzzle.ts` is authoritative. Keep filenames stable: renaming creates a new puzzle.

## 提交流程 / Pull requests

1. Fork 仓库，新增 JSON / fork and add your file.
2. 执行 `npm ci`、`npm run content:check` / install and validate; no database or API key needed.
3. 提交 PR，说明来源、署名、使用许可以及测试问题 / submit a PR with provenance and permissions.
4. CI 自动验证格式；维护者检查内容、许可和预期答案后合并 / CI validates structure; a maintainer reviews content, permissions, and expected answers.

只贡献自己有权公开的内容；汤底会随文件公开。原创题请明确同意按 `content/LICENSE.md` 的 CC0 方式提供；改编或授权题必须说明允许在此公开和再分发的依据。网页创建关闭不影响 GitHub PR 投稿。
Only submit content you have permission to publish, including its solution. State CC0 dedication for original contributions in the PR. Adapted/licensed content needs explicit redistribution permission and attribution; linking a source alone is not permission.

CI 不调用付费模型，也不保证 Jev 的判题准确率。模型实测由维护者另行运行。
CI does not call paid models or establish model accuracy.

## 同步网站 / Deployment sync

在维护者控制的发布环境设置 `DATABASE_URL`，先执行 `npm run db:migrate`，再执行 `npm run content:sync`。不要向外部 PR 提供生产数据库或模型 Key；PR 检查只读仓库文件。
Set `DATABASE_URL` in a trusted release environment; run `npm run db:migrate`, then `npm run content:sync`. Never expose production credentials to contributor PRs.

同步可重复执行；内容变更生成新版本，新游戏使用新版本，旧游戏继续原版本。此命令不删除文件对应的已有数据库题目，也不恢复被停用的题目。下架用 `npm run content -- disable <id>`。发布同步请串行运行，不要让多个版本同时写同一数据库。
Sync is idempotent and retains old revisions. File deletion does not unpublish a puzzle; use the disable command. Disabled puzzles remain disabled. Serialize sync jobs targeting the same database.

本地 PGlite 同步前停止开发服务，避免多进程访问同一数据目录；外部 PostgreSQL 不受此限制。
Stop the dev server before syncing into the local PGlite directory. This restriction does not apply to external PostgreSQL.

## 归档 / Archiving

`content/archived.json` 可列出需从公共列表移除的题目 ID；同步后保留旧版本和既有游戏。停用命令会阻断访问，归档不会。发行版默认归档列表为空。
The archive list removes entries from discovery while preserving existing games. Disabling a puzzle blocks access instead.

主持人采用事实优先：已知事实即使无关也回答是/不是；只对未知细节区分不重要或暂时无法判断。请据此填写 `golden_questions`。
Known facts receive yes/no even when incidental. Only unknown details are classified by relevance; write expected answers accordingly.
