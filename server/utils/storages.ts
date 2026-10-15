import { ulid } from "ulidx";
import type { StorageRecord } from "../storage/types";
import { SCHEMA_VERSION } from "../storage/types";
import type { DriverType } from "../storage/drivers/types";
import { storageRepository } from "../repositories/storage";
import { encryptSecret } from "./storage-secret";
import { assertMountPath } from "./object-path";
import { clearDriverCache } from "../storage/drivers";
import { buildDriverFromParts } from "../storage/drivers/factory";

const DRIVER_TYPES: DriverType[] = ["s3", "webdav", "onedrive", "gdrive"];

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

function pick(body: any, existing: StorageRecord | null | undefined, key: string, fallback = "") {
  const value = body[key] ?? body.config?.[key] ?? existing?.config?.[key];
  return value === undefined || value === null ? fallback : String(value);
}

export function secretFromBody(type: DriverType, body: any) {
  if (type === "s3" && body.accessKeyId && body.secretAccessKey) {
    return { accessKeyId: body.accessKeyId, secretAccessKey: body.secretAccessKey };
  }
  if (type === "webdav" && (body.username || body.password)) {
    return { username: String(body.username || ""), password: String(body.password || "") };
  }
  if ((type === "onedrive" || type === "gdrive") && (body.refreshToken || body.clientId)) {
    return {
      clientId: String(body.clientId || ""),
      clientSecret: String(body.clientSecret || ""),
      refreshToken: String(body.refreshToken || ""),
    };
  }
  return null;
}

export async function buildProbeDriver(body: any, fetchImpl: typeof fetch = fetch) {
  const type = String(body.type || "s3") as DriverType;
  if (!DRIVER_TYPES.includes(type)) {
    throw createError({ status: 400, message: `Unsupported driver: ${type}` });
  }
  const config = configFromBody(type, body, null);
  const secret = secretFromBody(type, body) || {};
  return buildDriverFromParts("probe", type, config, secret as Record<string, string>, fetchImpl);
}

export function configFromBody(type: DriverType, body: any, existing?: StorageRecord | null) {
  if (type === "webdav") {
    return {
      endpoint: pick(body, existing, "endpoint"),
      rootPrefix: pick(body, existing, "rootPrefix"),
      allowHttp: body.allowHttp ?? existing?.config.allowHttp ?? false,
    };
  }
  if (type === "onedrive") {
    return { rootPrefix: pick(body, existing, "rootPrefix") };
  }
  if (type === "gdrive") {
    return {
      rootPrefix: pick(body, existing, "rootPrefix"),
      rootFolderId: pick(body, existing, "rootFolderId"),
    };
  }
  return {
    endpoint: pick(body, existing, "endpoint"),
    region: pick(body, existing, "region", "auto"),
    bucket: pick(body, existing, "bucket"),
    forcePathStyle: body.forcePathStyle ?? existing?.config.forcePathStyle ?? true,
    rootPrefix: pick(body, existing, "rootPrefix"),
    allowHttp: body.allowHttp ?? existing?.config.allowHttp ?? false,
    template: body.template || existing?.config.template || "",
  };
}

export async function saveStorageFromBody(body: any, existing?: StorageRecord | null) {
  const mountPath = assertMountPath(String(body.mountPath || existing?.mountPath || ""));
  const name = String(body.name || existing?.name || mountPath);
  const type = String(body.type || existing?.type || "s3") as DriverType;
  if (!DRIVER_TYPES.includes(type)) {
    throw createError({ status: 400, message: `Unsupported driver: ${type}` });
  }
  const taken = await storageRepository.getByMount(mountPath);
  if (taken && taken.id !== existing?.id && taken.id !== "primary") {
    throw createError({ status: 400, message: "Mount path already in use" });
  }
  if (mountPath === "primary") {
    throw createError({ status: 400, message: "Mount path primary is reserved" });
  }
  const config = configFromBody(type, body, existing);
  let secret = existing?.secret ?? null;
  const nextSecret = secretFromBody(type, body);
  if (nextSecret) {
    secret = await encryptSecret(JSON.stringify(nextSecret));
  }
  const now = Date.now();
  const record: StorageRecord = {
    schemaVersion: SCHEMA_VERSION,
    id: existing?.id || (ulid() as string),
    name,
    type,
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
