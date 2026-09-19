# 部署

## Vercel 一键部署

### 维护者：绑定公开仓库

在公开仓库根目录运行（参数是你自己的 GitHub 仓库，不是 API Key）：

```sh
npm run deploy:button -- OWNER/REPOSITORY
```

脚本更新中英文 README，生成「站点 Key + BYOK」和「仅 BYOK」两个按钮。链接只包含仓库地址、所需变量名、非敏感的模式默认值和文档地址，不读取 `.env.local`，也不携带 Key 或数据库密码。提交更新后的 README 即可。

### 部署者：准备 PostgreSQL 和填入配置

1. 准备独立 PostgreSQL 数据库，可使用 Neon、Supabase 或其他兼容服务；复制连接串，按供应商要求保留 SSL 参数。初始化需要建表权限。
2. 点击 README 中适合自己的按钮，授权 Vercel 创建仓库/项目，选择项目名。
3. 在部署表单填写下面的变量。`APP_ORIGIN` 必须对应最终访问域名，例如项目名为 `your-soup` 时填写 `https://your-soup.vercel.app`；如该名字不可用，以实际分配域名为准。不要加末尾斜杠。
4. Node.js 24、安装 `npm ci`；`vercel.json` 已设置构建命令 `npm run vercel-build`。
5. 生产构建成功后，构建脚本自动执行建表、基础示例初始化、Git 题库同步。数据库不可达会使部署失败，不会把原始数据库错误或连接串打印到构建日志。
6. 上线后检查提问、创作、分享和揭底。增加自定义域名时更新 `APP_ORIGIN` 并重新部署；网站只能接受与所配置 origin 一致的修改请求。

“一键”指 Vercel 克隆和部署流程；仍需你授权账户、准备数据库并填写凭证。本项目不会自动购买或创建数据库。

### 环境变量

| 变量 | 必需性 / 内容 |
| --- | --- |
| `DATABASE_URL` | 必填，PostgreSQL 连接串；仅服务端使用 |
| `APP_ORIGIN` | 必填，正式站点的完整 HTTPS origin，无末尾斜杠 |
| `AI_ACCESS_MODE` | `both`：站点 Key 和 BYOK；`site_only`：仅站点；`byok_only`：仅用户 Key |
| `AI_GATEWAY_API_KEY` | `both` / `site_only` 必填，你自己的 Vercel AI Gateway Key；仅服务端使用 |
| `UPLOADS_ENABLED` | 默认 `true`；`false` 禁止新增私有题目，已有分享不受影响 |
| `ENABLE_GUESS` | 默认 `true`，启用还原判题 |
| `JEV_MODEL` | 默认 `typesafe-ai/jev` |
| `DATABASE_SETUP` | 生产默认执行数据库初始化/同步；`false` 跳过，`true` 可为隔离预览库显式开启 |
| `NEXT_PUBLIC_REPOSITORY_URL` | 可选，公开 GitHub 仓库地址，用于页面的自愿 Star 入口 |

**你自己部署并提供额度：选择站点 Key + BYOK，填 `AI_ACCESS_MODE=both` 和自己的 `AI_GATEWAY_API_KEY`。** 玩家仍可在网站设置中选择自己的 Key；不同来源不会自动回退。仅 BYOK 按钮不要求部署者填模型 Key。

### Key 只放 Vercel，不进仓库

部署后也可进入项目 **Settings → Environment Variables** 添加/更新 `AI_GATEWAY_API_KEY`，选择 Production，保存后重新部署。数据库连接串同样处理。有敏感变量选项时可将两者标记为 Sensitive。

也可以在自己的终端使用 Vercel CLI 的交互输入：

```sh
vercel link
vercel env add AI_GATEWAY_API_KEY production
vercel env add DATABASE_URL production
vercel --prod
```

不要把真实值作为 shell 命令参数、写进 README、`vercel.json`、Deploy Button URL 或 `NEXT_PUBLIC_*` 变量。仓库的 `.env.example` 只有空值；真实 `.env*`、`.vercel/` 和本地数据库均被 Git 忽略。分享/管理凭证也不能提交 Git。

### 预览、更新与数据库

- Production 和 Preview 分开配置数据库和 Key。外部 PR 构建不得获得生产凭证。
- Preview 默认不执行数据库初始化；若要可用的预览环境，提供其独立的 `DATABASE_URL`、匹配的 `APP_ORIGIN`，并设 `DATABASE_SETUP=true`。缺少必填变量的 Vercel 构建会明确失败。
- Production 默认每次构建后同步题库。初始建表可重复执行，不替代未来的正式版本化迁移。发布到同一数据库的部署应串行，迁移前备份。
- 设置 `DATABASE_SETUP=false` 后，需要在可信环境手动执行 `npm run db:migrate` 和 `npm run content:sync`。
- 构建脚本初始化数据库后，若 Vercel 的后续发布阶段失败，数据库变更不会自动回滚。
- 函数和数据库选择相近区域。API 使用 Node runtime，模型超时 20 秒，路由 maxDuration 30 秒。
- 站点 Key 没有内置匿名消费限额；需要停用站点额度时切回 `byok_only` 并重新部署。

官方说明：[部署按钮环境变量](https://vercel.com/docs/deploy-button/environment-variables)、[环境变量管理](https://vercel.com/docs/environment-variables)。

## 腾讯云 Docker

需要先安装 Docker Compose，域名解析到服务器。创建被 Git 忽略的 `.env`，至少包含：

```dotenv
DOMAIN=soup.example.com
POSTGRES_PASSWORD=replace-with-a-long-random-alphanumeric-password
AI_ACCESS_MODE=byok_only
```

密码用于数据库 URL 时须适当 URL 编码；以上建议直接使用足够长的随机字母数字串。

```sh
docker compose up --build -d
```

migrate 服务先初始化数据库并同步 Git 题库；app 使用 Next standalone 输出；Caddy 提供 HTTPS。仅代理暴露 80/443，数据库不暴露公网端口。首次域名/TLS 建立要检查日志。Docker 路径需要在目标服务器验证；源码构建检查不等于容器或生产部署验收。

升级先备份，手动运行新的迁移，再切换应用版本。不要依赖重新执行旧的一次性迁移容器自动升级未来数据库结构。备份例如通过 `docker compose exec -T db pg_dump -U soupbase soupbase` 导出到受保护位置，并保存到另一机器；定期恢复演练。

设置 `UPLOADS_ENABLED`、`ENABLE_GUESS` 和 `JEV_MODEL` 可调整实例行为。`NEXT_PUBLIC_REPOSITORY_URL` 在镜像构建时传入，修改后需重新构建。

## 运行数据

软删除立即阻断访问，物理删除由维护命令处理；数据库备份可能暂留旧内容。上线时设定并公布备份保留周期。每日运行 cleanup 属于部署者的运行安排，应用不内置匿名配额和账单系统。
