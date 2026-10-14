# Folder

单用户自托管网盘，跑在 Cloudflare Workers 上。文件在 R2，元数据在 KV，密码登录。公开目录可以当静态站。WebDAV 在 `/dav` 和 `/webdav`。

线上：https://box.oonn.me

## 技术栈

- 前端：Nuxt、Nuxt UI
- 后端：Nitro，预设 `cloudflare_module`
- 元数据：Cloudflare KV
- 文件：Cloudflare R2
- 登录：PBKDF2 哈希（Worker secret）+ 加密 cookie

## 部署

推到 `main`，或在 Actions 里手动跑 **Deploy Worker**。同一分支上一次还在跑的部署会被取消。

流程：

1. `pnpm install --frozen-lockfile`（锁文件是 `pnpm-lock.yaml`）
2. `nuxt prepare`，然后跑测试
3. 用仓库机密写出 `wrangler.jsonc`（不进 git）
4. `pnpm run deploy`：`nuxt build`，补上 Nitro 的 `EventEmitter` 补丁，再从 `dist/server` 执行 `wrangler deploy --keep-vars`

`--keep-vars` 不会清掉线上已有的 Worker secret。

### 仓库机密

| 名称 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 部署 |
| `CLOUDFLARE_ACCOUNT_ID` | OnSaas 账号。机密和变量各一份 |
| `CLOUDFLARE_KV_NAMESPACE_ID` | KV 绑定 |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 桶名 |

自定义域 `box.oonn.me` 写在工作流里，不是新绑的域。

### Worker secret

这两项在 Cloudflare 上，不进 GitHub。忘了密码就重新生成哈希并覆盖：

```sh
pnpm run hash-password
npx wrangler secret put NUXT_ADMIN_PASSWORD_HASH
```

`NUXT_SESSION_PASSWORD` 至少 32 位。改登录哈希后旧会话失效。可选 `NUXT_BUCKET_NAME`，默认 `files`。

## 本地

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install
cp .env.example .env
pnpm run dev
```

本机部署要先把 `wrangler.example.jsonc` 复制成 `wrangler.jsonc`，填 `account_id`、KV id、R2 桶名，再 `pnpm run deploy`。`wrangler.jsonc` 不进 git。

## 许可

见 [LICENSE](LICENSE)。免责声明见 [DISCLAIMER](DISCLAIMER.md)。
