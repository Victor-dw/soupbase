# 汤底 · Soupbase

一个以文字为中心的中英文海龟汤网站，由 Jev 担任主持人。支持提问、逐步提示、提交还原，以及私有创作和链接分享。

[English](README.en.md) · [部署](docs/deployment.md) · [贡献题目](content/puzzles/README.md) · [模型与架构](docs/architecture.md) · [安全边界](docs/security.md)

## 部署到 Vercel

<!-- vercel-deploy:start -->
站点 Key + BYOK（部署时填写自己的 Key）：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase&env=DATABASE_URL%2CAPP_ORIGIN%2CAI_ACCESS_MODE%2CAI_GATEWAY_API_KEY&envDefaults=%7B%22AI_ACCESS_MODE%22%3A%22both%22%7D&envDescription=Enter+your+PostgreSQL+URL+and+exact+HTTPS+site+origin.+Site+mode+also+requires+your+own+Vercel+AI+Gateway+key.+Never+put+secrets+in+Git+or+this+URL.&envLink=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase%2Fblob%2FHEAD%2Fdocs%2Fdeployment.md)

仅 BYOK（无需站点 Key）：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase&env=DATABASE_URL%2CAPP_ORIGIN%2CAI_ACCESS_MODE&envDefaults=%7B%22AI_ACCESS_MODE%22%3A%22byok_only%22%7D&envDescription=Enter+your+PostgreSQL+URL+and+exact+HTTPS+site+origin.+Site+mode+also+requires+your+own+Vercel+AI+Gateway+key.+Never+put+secrets+in+Git+or+this+URL.&envLink=https%3A%2F%2Fgithub.com%2Fspoonnotfound%2Fsoupbase%2Fblob%2FHEAD%2Fdocs%2Fdeployment.md)
<!-- vercel-deploy:end -->

## 功能

- 四种主持回答：是、不是、不重要、暂时无法判断；展示模型原生 confidence。
- 中文 / 英文界面、深浅主题、游戏记录、主动揭晓。
- 创作和 JSON 导入导出；题目默认私有，分享链接可撤销，不进入公共题库。
- 支持 BYOK、站点提供 Key，或两者并存。
- 无账号系统；不包含匿名每日配额、内容审核或 Star 解锁。

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

更换端口或域名时同步修改 `APP_ORIGIN`。生产环境需要 PostgreSQL 和显式配置的 `APP_ORIGIN`，见[部署指南](docs/deployment.md)。

## 凭证与创作配置

| 配置 | 作用 |
| --- | --- |
| `AI_ACCESS_MODE=byok_only` | 默认：玩家使用自己的 Key |
| `AI_ACCESS_MODE=site_only` | 使用服务端 `AI_GATEWAY_API_KEY` |
| `AI_ACCESS_MODE=both` | 玩家选择站点 Key 或 BYOK，不自动回退 |
| `UPLOADS_ENABLED=true` | 开启私有创作、JSON 导入和链接分享 |
| `UPLOADS_ENABLED=false` | 关闭新增题目入口和 API；已有题目与分享仍保留 |
| `ENABLE_GUESS=false` | 关闭提交还原 |
| `NEXT_PUBLIC_REPOSITORY_URL` | 可选 GitHub 仓库链接，显示自愿 Star 入口 |

BYOK 请求会经过部署者服务器，服务器能读取 Key；开源并不意味着浏览器直连供应商。本应用代码不持久化或主动记录模型 Key。更完整的信任边界见[安全说明](docs/security.md)。站点 Key 模式没有内置消费限额，额度管理由部署者负责。

## 题目与贡献

公开发行内容包括三道中文原创示例和对应英文版本。基础示例位于 `content/examples/index.json`，补充翻译及后续贡献放在 `content/puzzles/`，一题一个 JSON。题目格式由 `src/shared/puzzle.ts` 定义。

```sh
npm run content:check
npm run content:sync
```

贡献题目请复制 [JSON 模板](content/puzzle.template.json)，参考[题目指南](content/puzzles/README.md)，通过 GitHub PR 提交。维护者检查来源、许可和逻辑后合并；部署者同步后才会更新数据库。网页分享不等于公共投稿。

管理链接相当于密码；分享链接只授予游玩权限。不要把管理链接、私有题目或数据库备份提交到 Git。公开题目的汤底也随仓库公开，系统不用于防作弊。

## 开发与验证

```sh
npm run content:check
npm run typecheck
npm test
npm run build
```

测试使用隔离数据库和模拟模型，不需要真实 Key，也不消耗模型额度。覆盖访问控制、分享撤销、版本固定、凭证隔离、并发及判题结果处理。测试通过不等于模型答案永远正确。

技术栈：Next.js App Router、React、TypeScript、PostgreSQL / PGlite、Vercel AI SDK。运行与维护脚本见[贡献指南](CONTRIBUTING.md)。

## 许可

代码采用 [MIT](LICENSE)。内置原创题目采用 [CC0 1.0](content/LICENSE.md)；用户提交内容不自动继承代码许可。第三方改编题需另行提供明确许可，不能仅凭来源链接加入公开题库。
