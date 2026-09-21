# 汤底 · Soupbase

一个中英文海龟汤网站：Jev 坐堂判题，DeepSeek 现煮无限题库。界面是迷雾侦探社——汤面档案、审讯室、调查罗盘、生存连关。

[Jev](https://typesafe.ai/) 走 TypeSafe 官网 API，负责提问判定与还原评分。DeepSeek 走兼容 OpenAI 的网关，只负责煮题和调查罗盘，看不到正在玩的汤底。玩家界面不展示 confidence。

[English](README.en.md) · [部署](docs/deployment.md) · [模型与架构](docs/architecture.md) · [安全边界](docs/security.md)

## 部署到 Vercel

<!-- vercel-deploy:start -->
站点 Key + BYOK（部署时填写自己的 Key）：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase&env=AI_ACCESS_MODE%2CAI_GATEWAY_API_KEY&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D&envDefaults=%7B%22AI_ACCESS_MODE%22%3A%22both%22%7D&envDescription=Connect+Neon+Postgres+in+the+deployment+flow.+Choose+AI_ACCESS_MODE%3B+site+mode+also+requires+your+own+Vercel+AI+Gateway+key.&envLink=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase%2Fblob%2FHEAD%2Fdocs%2Fdeployment.md)

仅 BYOK（无需站点 Key）：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase&env=AI_ACCESS_MODE&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D&envDefaults=%7B%22AI_ACCESS_MODE%22%3A%22byok_only%22%7D&envDescription=Connect+Neon+Postgres+in+the+deployment+flow.+Choose+AI_ACCESS_MODE%3B+site+mode+also+requires+your+own+Vercel+AI+Gateway+key.&envLink=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase%2Fblob%2FHEAD%2Fdocs%2Fdeployment.md)
<!-- vercel-deploy:end -->

## 功能

- 四种主持回答：是、不是、不重要、暂时无法判断。由 Jev 判定，界面不显示把握数字。
- 无限探案：过一题立刻现煮下一题；揭底结束本趟。生成题默认不进题库，可收藏。
- 调查罗盘由 DeepSeek 根据汤面和已问问题出是非问句。
- 网页创作；题目默认私有，分享链接可撤销，不进入公共题库。
- 无账号系统。

## 本地运行

需要 Node.js 24 和 npm。

```sh
npm ci
cp .env.example .env.local
npm run content:sync
npm run dev
```

打开 [localhost:3000/zh](http://localhost:3000/zh)。默认使用 PGlite，无需安装 PostgreSQL；数据保存在 Git 忽略的 `.data/postgres`。同步和维护本地数据库前先停止开发服务，不要用多个进程同时打开该目录。

默认 BYOK：在右上角设置中输入 **Vercel AI Gateway Key**。Key 只保留在页面内存，刷新后需要重填；调用会产生供应商费用。没有 Key 也可以浏览题目、创作、查看提示和揭底。

Vercel 部署通过 Neon 集成创建 PostgreSQL 并自动注入连接串；域名自动取当前请求，无需手填。见[部署指南](docs/deployment.md)。

## 凭证配置

| 配置 | 作用 |
| --- | --- |
| `AI_ACCESS_MODE=byok_only` | 默认：玩家使用自己的 Key |
| `AI_ACCESS_MODE=site_only` | 使用服务端 `AI_GATEWAY_API_KEY` |
| `AI_ACCESS_MODE=both` | 玩家选择站点 Key 或 BYOK，不自动回退 |

唯一功能设置是 `AI_ACCESS_MODE`。站点 Key 保存在服务端 `AI_GATEWAY_API_KEY`；`DATABASE_URL` 由集成提供。网页只支持创作和私有链接分享，不提供文件上传/导入导出，也不会自动发布到公共题库。

BYOK 请求会经过部署者服务器，服务器能读取 Key；开源并不意味着浏览器直连供应商。本应用代码不持久化或主动记录模型 Key。更完整的信任边界见[安全说明](docs/security.md)。站点 Key 模式没有内置消费限额，额度管理由部署者负责。

## 题库

题目统一存放在 `content/puzzles/zh/` 和 `content/puzzles/en/`，一题一个 JSON。每个文件包含固定的 `id` 和 `src/shared/puzzle.ts` 定义的题目字段。新增题目时添加文件，再执行下面的校验和同步命令；修改题目时保留原有 `id`，已有游戏继续使用原来的题目版本。

```sh
npm run content:check
npm run content:sync
```


管理链接相当于密码；分享链接只授予游玩权限。不要把管理链接、私有题目或数据库备份提交到 Git。公开题目的汤底也随仓库公开，系统不用于防作弊。

## 开发与验证

```sh
npm run content:check
npm run typecheck
npm test
npm run build
```

测试使用隔离数据库和模拟模型，不需要真实 Key，也不消耗模型额度。覆盖访问控制、分享撤销、版本固定、凭证隔离、并发及判题结果处理。测试通过不等于模型答案永远正确。

技术栈：Next.js App Router、React、TypeScript、PostgreSQL / PGlite、Vercel AI SDK。

## 许可

代码采用 [MIT](LICENSE)。内置原创题目采用 [CC0 1.0](content/LICENSE.md)；用户私有创作的题目不适用此许可。
