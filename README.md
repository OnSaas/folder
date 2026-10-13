> [!Note]
> This project is no longer actively maintained. Use it at your own risk.

# Folder

Single-user, self-hosted file manager on Cloudflare Workers. Store files in R2, metadata in KV, sign in with a password. Public folders can be served as a static site. WebDAV is available at `/dav` and `/webdav`.

## Stack

- Frontend: Nuxt, Nuxt UI
- Backend: Nitro on Cloudflare Workers
- Metadata: Cloudflare KV
- Blobs: Cloudflare R2
- Auth: password (PBKDF2 hash in a Worker secret) + encrypted session cookie

## Deploy

1. Create a KV namespace and an R2 bucket.
2. Copy `wrangler.example.jsonc` to `wrangler.jsonc` and fill in `account_id`, KV id, and R2 bucket name.
3. Install and hash a password:

```sh
git clone https://github.com/OnSaas/folder.git
cd folder
npm install
npm run hash-password
```

4. Put secrets (do not commit them):

```sh
npx wrangler secret put NUXT_ADMIN_PASSWORD_HASH
npx wrangler secret put NUXT_SESSION_PASSWORD
```

`NUXT_SESSION_PASSWORD` must be at least 32 characters. Optional: `NUXT_BUCKET_NAME` (default `files`).

5. Deploy:

```sh
npm run deploy
```

The deploy script keeps existing Worker vars (`--keep-vars`).

6. After the first login, check that existing files are still there, WebDAV still connects, and `POST /api/auth/logout` then `GET /api/bucket` returns 401.

Forgot the password: generate a new hash and overwrite `NUXT_ADMIN_PASSWORD_HASH`. Old sessions become invalid.

## Local development

```sh
cp .env.example .env
npm install
npm run dev
```

## Disclaimer

Not maintained. **Use at your own risk.** See [DISCLAIMER](DISCLAIMER.md).

## License

Read [LICENSE](LICENSE)
