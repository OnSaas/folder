import type { DriverType, StorageDriver } from "./types";
import { S3Driver } from "./s3";
import { WebDavDriver } from "./webdav";
import { OneDriveDriver } from "./onedrive";
import { GDriveDriver } from "./gdrive";

export function buildDriverFromParts(
  id: string,
  type: DriverType,
  config: Record<string, unknown>,
  secret: Record<string, string>,
  fetchImpl: typeof fetch = fetch
): StorageDriver {
  if (type === "webdav") {
    return new WebDavDriver(
      id,
      {
        endpoint: String(config.endpoint || ""),
        username: secret.username || "",
        password: secret.password || "",
        rootPrefix: String(config.rootPrefix || ""),
        allowHttp: config.allowHttp === true,
      },
      fetchImpl
    );
  }
  if (type === "onedrive") {
    return new OneDriveDriver(
      id,
      {
        clientId: secret.clientId || "",
        clientSecret: secret.clientSecret || "",
        refreshToken: secret.refreshToken || "",
        rootPrefix: String(config.rootPrefix || ""),
      },
      fetchImpl
    );
  }
  if (type === "gdrive") {
    return new GDriveDriver(
      id,
      {
        clientId: secret.clientId || "",
        clientSecret: secret.clientSecret || "",
        refreshToken: secret.refreshToken || "",
        rootPrefix: String(config.rootPrefix || ""),
        rootFolderId: String(config.rootFolderId || ""),
      },
      fetchImpl
    );
  }
  return new S3Driver(
    id,
    {
      endpoint: String(config.endpoint || ""),
      region: String(config.region || "auto"),
      bucket: String(config.bucket || ""),
      accessKeyId: secret.accessKeyId || "",
      secretAccessKey: secret.secretAccessKey || "",
      forcePathStyle: config.forcePathStyle !== false,
      rootPrefix: String(config.rootPrefix || ""),
      allowHttp: config.allowHttp === true,
    },
    fetchImpl
  );
}
