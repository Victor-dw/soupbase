# 模型与数据流程 / Architecture

## 请求流程

浏览器 → Next.js API → 服务端读取题目版本和汤底 → Vercel AI Gateway → Jev → 服务端校验固定结构 → 保存结果并返回公开字段。

浏览器只提交问题、请求 ID 和凭证来源。BYOK 通过 Authorization header 传入；每次请求创建独立 Gateway 客户端。模型会收到汤面、汤底、关键事实及必要上下文，未揭示的汤底不由正常游戏接口返回给玩家。

## 主持人

`src/server/host.ts` 定义提问提示词，使用 Choice：yes / no / irrelevant / uncertain。

- 已知或可可靠推导的事实先回答是/不是，包括无关细节。
- 未知、无关细节回答不重要；未知但关系到核心解释的信息回答暂时无法判断。
- 指代不清、混合问题和等权矛盾证据也可返回暂时无法判断。
- 普通提问的 confidence 仅展示，低于 0.70 时提示把握较低，不改写选项。

## 还原判断

`src/server/guess.ts` 定义还原提示词。每个必需关键点使用 Choice 判断成立/缺失/矛盾，另检查整体解释。结合公开汤面理解简短还原，不要求重复已知事实，也不从汤底替玩家补上缺失的核心机制。

全部关键点 supported、整体 coherent，且每项原生 confidence ≥ 0.70 才通关。缺失、非法或低置信度结果不会解锁答案。旧记录保留当时门槛；缺少门槛的旧还原记录回退到历史值 0.90。

confidence 是概率分布的统计量，不是正确率，也不是通关进度。提示和主动揭晓直接读取已保存内容，不调用模型。

## 数据与访问

- `src/shared/puzzle.ts`：题目格式和公开字段。
- `src/server/schema.sql`：数据库结构。
- `src/server/access.ts`：访客、分享、管理和会话权限。
- `src/server/api.ts`：请求处理、幂等、并发控制和持久化。
- `scripts/catalog.ts` / `sync-content.ts`：校验并同步 Git 题库。

内容修改创建新版本，已有游戏固定在原版本。私有创作不会进入 curated 公共列表；分享和管理凭证相互独立，可撤销。部署者管理自己的数据库及备份。

## Validation

Automated tests check application contracts and permissions with a mock model. The host prompt fixture prevents accidental drift. Neither proves model accuracy. Changes to prompts should be checked on labeled Chinese/English cases, including concise valid explanations, missing mechanisms, contradictions and prompt injection. Keep private inputs, raw provider logs and credentials out of public test data.
