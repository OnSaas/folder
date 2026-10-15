# ⚠️ Disclaimer

Folder is still in development and is **not ready for production use**. Use it at your own risk.

- The author assumes **no responsibility** for any data loss, security breaches, or damages resulting from the use of this software.
- This project is provided **"as is"**, **without any warranty** of any kind, including but not limited to fitness for a particular purpose.

By using this software, you acknowledge and accept these terms.

## Third-party storage and sync

Folder can connect to third-party storage (S3-compatible, WebDAV, OneDrive, Google Drive) and copy your primary drive into them.

- Credentials for those services are encrypted with `NUXT_STORAGE_SECRET` and stored in your own KV namespace. Anyone with access to that secret and your KV data can decrypt them.
- Sync jobs run with the transport you configure. Review the **delete policy** before enabling a job: `mirror` removes destination files that are not present in the source and **cannot be undone**.
- DAV usernames and passwords are stored in plain text, by design, because clients need to send them as-is.
- Large files and long jobs are bounded by Cloudflare Workers limits. A job that cannot finish in one tick resumes on the next run.

