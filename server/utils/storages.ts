import { ulid } from "ulidx";
import type { StorageRecord } from "../storage/types";
import { SCHEMA_VERSION } from "../storage/types";
import { storageRepository } from "../repositories/storage";
import { encryptSecret } from "./storage-secret";
import { assertMountPath } from "./object-path";
import { S3Driver } from "../storage/drivers/s3";
import { clearDriverCache } from "../storage/drivers";

export function toPublicStorage(rec: StorageRecord) {
  return {
    id: rec.id,
    name: rec.name,
    type: rec.type,
    mountPath: rec.mountPath,
    readOnly: rec.readOnly,
    config: rec.config,
    status: rec.status,
    lastCheckedAt: rec.lastCheckedAt,
    lastError: rec.lastError,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    hasSecret: Boolean(rec.secret),
  };
}

export async function buildS3Driver(body: any) {
  const endpoint = String(body.endpoint || body.config?.endpoint || "");
  const region = String(body.region || body.config?.region || "auto");
  const bucket = String(body.bucket || body.config?.bucket || "");
  const accessKeyId = String(body.accessKeyId || "");
  const secretAccessKey = String(body.secretAccessKey || "");
  return new S3Driver("probe", {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: body.forcePathStyle !== false,
    rootPrefix: String(body.rootPrefix || body.config?.rootPrefix || ""),
    allowHttp: body.allowHttp === true,
  });
}

export async function saveStorageFromBody(body: any, existing?: StorageRecord | null) {
  const mountPath = assertMountPath(String(body.mountPath || existing?.mountPath || ""));
  const name = String(body.name || existing?.name || mountPath);
  const type = String(body.type || existing?.type || "s3");
  if (type !== "s3") {
    throw createError({ status: 400, message: "Only s3 drivers are supported in v1" });
  }
  const taken = await storageRepository.getByMount(mountPath);
  if (taken && taken.id !== existing?.id && taken.id !== "primary") {
    throw createError({ status: 400, message: "Mount path already in use" });
  }
  if (mountPath === "primary") {
    throw createError({ status: 400, message: "Mount path primary is reserved" });
  }
  const config = {
    endpoint: String(body.endpoint || body.config?.endpoint || existing?.config.endpoint || ""),
    region: String(body.region || body.config?.region || existing?.config.region || "auto"),
    bucket: String(body.bucket || body.config?.bucket || existing?.config.bucket || ""),
    forcePathStyle: body.forcePathStyle ?? existing?.config.forcePathStyle ?? true,
    rootPrefix: String(body.rootPrefix || body.config?.rootPrefix || existing?.config.rootPrefix || ""),
    allowHttp: body.allowHttp ?? existing?.config.allowHttp ?? false,
    template: body.template || existing?.config.template || "",
  };
  let secret = existing?.secret ?? null;
  if (body.accessKeyId && body.secretAccessKey) {
    secret = await encryptSecret(
      JSON.stringify({
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
      })
    );
  } else if (body.secret === "") {
    // keep existing
  }
  const now = Date.now();
  const record: StorageRecord = {
    schemaVersion: SCHEMA_VERSION,
    id: existing?.id || (ulid() as string),
    name,
    type: "s3",
    mountPath,
    readOnly: Boolean(body.readOnly ?? existing?.readOnly ?? false),
    config,
    secret,
    status: existing?.status || "unknown",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  clearDriverCache();
  if (existing) return storageRepository.update(record, existing);
  return storageRepository.create(record);
}
