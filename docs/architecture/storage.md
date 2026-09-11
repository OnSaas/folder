# Storage architecture (Folder V2)

Audit of V1 (D1) and the KV model that replaces it. Binary files stay on R2 (`hubBlob`). Metadata only in KV.

## V1 entities (D1 / Drizzle)

### users

| Field | Type | Notes |
| --- | --- | --- |
| id | text PK | UUID from OAuth |
| name | text | |
| email | text unique | lookup on login |
| avatar | text | |
| country | text | unused in API |
| status | text default active | inactive blocked |
| provider | text | github / google |
| createdAt | timestamp | |

**Reads:** `getUser`, `getUserByEmail`  
**Writes:** `createUser` on first OAuth  
**Deletes:** none

### buckets

| Field | Type | Notes |
| --- | --- | --- |
| id | text PK | ULID |
| name | text unique | URL segment `/[bucket]` |
| userId | text | one bucket per user (enforced in API) |
| size | integer | denormalized; API also SUM(files.size) |
| count | integer | unused in list API |
| createdAt / updatedAt | timestamp | |

**Reads:** by name (`getBucket`), by user (`getUserBucket`)  
**Writes:** `createBucket`  
**Deletes:** none  
**Queries:** name uniqueness

### files (files **and** folders)

Single table. `type = folder` is a directory node.

| Field | Type | Notes |
| --- | --- | --- |
| id | text PK | ULID |
| name | text | |
| contentType | text | `folder` for dirs |
| type | text | image/video/audio/document/folder/other |
| size | integer | 0 for folders |
| path | text | `{bucket}/...` |
| visibility | text | public / private / inherit |
| metadata | json | unused |
| preview | text | image path, or JSON array of thumbs on folders |
| dimensions | text | |
| count | integer | child count (increment only) |
| parentId | text default `root` | |
| bucketName | text | |
| userId | text | |
| sharedCount | integer | |
| createdAt / updatedAt / deletedAt | timestamp | trash = soft delete |

**Indexes (D1):** unique(path, deletedAt), parent_id, (bucketName, userId), deleted_at, name, (type, parentId)

**Reads:** by id, by path, children of parent, favorites join, shared join, public, recent, trash, search LIKE name, nested folders, breadcrumb by path list  
**Writes:** insert on upload / ensurePath, update size/visibility/count/preview/contentType, recursive soft-delete  
**Deletes:** soft (`deletedAt`); R2 object moved to `.trash/...`

### favorites

(fileId, userId) unique. Toggle favorite.

### shared

(fileId, userId, role). `shareFiles()` was a stub; V2 stores records.

### website

(fileId, domain, bucketName). Schema only — no API. Not carried into KV.

## V1 query map → KV

| Scene | D1 | KV |
| --- | --- | --- |
| User by id | `users.id` | `user:{id}` |
| User by email | unique email | `idx:user:email:{email}` |
| Bucket by name | unique name | `idx:bucket:name:{name}` → `bucket:{id}` |
| User's bucket | `buckets.user_id` | `idx:user:{userId}:bucket` |
| File by id | PK | `file:{id}` |
| File by path | unique path+deletedAt | `idx:path:{bucket}:{path}` (live only) |
| Children | `parent_id = ?` | `idx:children:{bucket}:{parentId}` |
| All user files | `user_id` | `idx:user:{userId}:files` |
| Favorites | join table | `idx:favorites:{userId}` |
| Shared with me | join table | `idx:shared:user:{userId}` |
| Shares on file | join | `idx:shared:file:{fileId}` |
| Trash | `deleted_at IS NOT NULL` | `idx:trash:{userId}` |
| Search | `LOWER(name) LIKE` | filter `idx:user:{userId}:files` in memory |
| Recent / published | WHERE + ORDER | same list, filter/sort in memory |
| Bucket size | `SUM(size)` | sum non-folder files in user index |

Pagination (12) and sort (`createdAt` / `updatedAt` / `name`) run in memory after fetch.

## V2 KV model

Every entity has `schemaVersion: 1`. Entity is source of truth; indexes are rebuildable.

```
user:{userId}
bucket:{bucketId}
file:{fileId}          # files and folders
share:{shareId}

idx:user:email:{email}
idx:bucket:name:{name}
idx:user:{userId}:bucket
idx:user:{userId}:files
idx:user:{userId}:root          # alias of children at parentId=root
idx:children:{bucket}:{parentId}
idx:path:{bucket}:{path}
idx:favorites:{userId}
idx:shared:user:{userId}
idx:shared:file:{fileId}
idx:trash:{userId}
```

R2 keys unchanged: file `path` is the blob key. Trash moves to `.trash/{bucket}/{iso}/{path}`.

User also stores `locale` (`en` | `zh-CN`) for i18n preference.

## Repository

Business code talks to `UserRepository` / `BucketRepository` / `FileRepository` / `ShareRepository` / `FavoriteRepository`. It does not import `hubKV`.

`server/storage/kv.ts` is the only KV adapter. A `MemoryKv` exists for tests.

## Migration

Dev: empty KV is enough.

Prod / existing D1: `npx tsx server/scripts/migrate-d1-to-kv.ts` (optional; no-op if D1 binding missing). Dual-write is skipped — this fork has no production rows.

After V2: no D1 binding, no Drizzle.

## WebDAV

Mount: `/dav` and `/webdav` (same protocol, Basic auth). Username = custom DAV username, else email. Password is plaintext `user.davPassword` (legacy SHA-256 `user.davPasswordHash`), set in Settings.

OPTIONS unauthenticated (`DAV: 1, 2`). PROPFIND 207, GET/HEAD, PUT, MKCOL, DELETE, COPY/MOVE, LOCK/UNLOCK (dummy), PROPPATCH 207. Bytes stay on R2; metadata via FileRepository.

