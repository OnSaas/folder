import { userRepository } from "../repositories/user";
import { bucketRepository } from "../repositories/bucket";
import { fileRepository } from "../repositories/file";
import {
  deleteFiles,
  ensurePath,
  insertUpdateFile,
  moveFile,
  renameFile,
} from "./db";
import { copyBlob } from "./blob";
import { getContentType, cleanPath } from "~~/shared/utils/helper";
import type { FileRecord } from "../storage/types";

export const DAV_ALLOW =
  "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH, LOCK, UNLOCK";

export function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function parseBasicAuth(header?: string | null): { user: string; pass: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function davRelPath(pathname: string) {
  let path = decodeURIComponent(pathname || "/");
  if (path.startsWith("/dav")) path = path.slice(4);
  path = path.replace(/^\/+|\/+$/g, "");
  return path;
}

export function hrefFor(rel: string) {
  const clean = rel.replace(/^\/+|\/+$/g, "");
  return clean ? `/dav/${clean.split("/").map(encodeURIComponent).join("/")}` : "/dav/";
}

function rfc1123(ms: number) {
  return new Date(ms).toUTCString();
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

export function propfindXml(
  items: Array<{
    href: string;
    isCollection: boolean;
    displayName: string;
    contentType?: string;
    size?: number;
    createdAt: number;
    updatedAt: number;
    etag?: string;
  }>
) {
  const responses = items
    .map((item) => {
      const resource =
        item.isCollection
          ? `<D:resourcetype><D:collection/></D:resourcetype>`
          : `<D:resourcetype/>`;
      const length = item.isCollection
        ? ""
        : `<D:getcontentlength>${item.size || 0}</D:getcontentlength>`;
      const type = item.isCollection
        ? `<D:getcontenttype>httpd/unix-directory</D:getcontenttype>`
        : `<D:getcontenttype>${xmlEscape(item.contentType || "application/octet-stream")}</D:getcontenttype>`;
      const etag = item.etag ? `<D:getetag>${xmlEscape(item.etag)}</D:getetag>` : "";
      return `<D:response>
<D:href>${xmlEscape(item.href)}</D:href>
<D:propstat>
<D:prop>
<D:displayname>${xmlEscape(item.displayName)}</D:displayname>
${resource}
${length}
${type}
<D:getlastmodified>${rfc1123(item.updatedAt)}</D:getlastmodified>
<D:creationdate>${iso(item.createdAt)}</D:creationdate>
${etag}
<D:supportedlock>
<D:lockentry><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype></D:lockentry>
</D:supportedlock>
</D:prop>
<D:status>HTTP/1.1 200 OK</D:status>
</D:propstat>
</D:response>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">${responses}</D:multistatus>`;
}

export async function resolveDavUser(username: string, password: string) {
  const byDav = await userRepository.getByDavUsername(username);
  const byEmail = byDav ? null : await userRepository.getByEmail(username);
  const user = byDav || byEmail;
  if (!user || user.status !== "active") return null;
  if (user.davPassword) {
    if (!timingSafeEqual(password, user.davPassword)) return null;
  } else if (user.davPasswordHash) {
    const hash = await sha256Hex(password);
    if (!timingSafeEqual(hash, user.davPasswordHash)) return null;
  } else {
    return null;
  }
  const bucket = await bucketRepository.getByUser(user.id);
  if (!bucket) return null;
  return { user, bucket };
}

function fileHref(file: FileRecord, bucketName: string) {
  const rel = file.path.startsWith(bucketName + "/")
    ? file.path.slice(bucketName.length + 1)
    : file.path === bucketName
      ? ""
      : file.path;
  const href = hrefFor(rel);
  return file.type === "folder" && !href.endsWith("/") ? `${href}/` : href;
}

function toPropItem(file: FileRecord, bucketName: string) {
  return {
    href: fileHref(file, bucketName),
    isCollection: file.type === "folder",
    displayName: file.name,
    contentType: file.contentType,
    size: file.size,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    etag: `"${file.id}-${file.updatedAt}"`,
  };
}

async function resolveNode(bucketName: string, rel: string) {
  if (!rel) return { kind: "root" as const, file: null };
  const path = cleanPath(`${bucketName}/${rel}`);
  const file = await fileRepository.getByPath(bucketName, path);
  if (!file) return { kind: "missing" as const, file: null, path };
  return { kind: file.type === "folder" ? ("folder" as const) : ("file" as const), file, path };
}

function destinationRel(event: any, destHeader: string | undefined) {
  if (!destHeader) return null;
  try {
    const base = getRequestURL(event);
    const dest = new URL(destHeader, base);
    if (dest.host && dest.host !== base.host) return null;
    return davRelPath(dest.pathname);
  } catch {
    return davRelPath(destHeader);
  }
}

function lockXml(token: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
<D:lockdiscovery>
<D:activelock>
<D:locktype><D:write/></D:locktype>
<D:lockscope><D:exclusive/></D:lockscope>
<D:depth>infinity</D:depth>
<D:timeout>Second-3600</D:timeout>
<D:locktoken><D:href>opaquelocktoken:${xmlEscape(token)}</D:href></D:locktoken>
</D:activelock>
</D:lockdiscovery>
</D:prop>`;
}

async function copyNode(
  bucketName: string,
  file: FileRecord,
  destFullPath: string,
  userId: string
) {
  if (file.type === "folder") {
    await ensurePath(bucketName, destFullPath, userId);
    const children = await fileRepository.listChildren(bucketName, file.id);
    for (const child of children.filter((c) => !c.deletedAt)) {
      await copyNode(bucketName, child, `${destFullPath}/${child.name}`, userId);
    }
    return;
  }
  await copyBlob(file.path, destFullPath);
  await insertUpdateFile(bucketName, "root", {
    fullPath: destFullPath,
    contentType: file.contentType,
    size: file.size,
    userId,
  });
}

export async function handleDav(event: any) {
  const method = getMethod(event).toUpperCase();
  const url = getRequestURL(event);
  const rel = davRelPath(url.pathname);

  setResponseHeader(event, "DAV", "1, 2");
  setResponseHeader(event, "Allow", DAV_ALLOW);
  setResponseHeader(event, "MS-Author-Via", "DAV");
  setResponseHeader(event, "Accept-Ranges", "bytes");

  if (method === "OPTIONS") {
    setResponseStatus(event, 200);
    return "";
  }

  const creds = parseBasicAuth(getHeader(event, "authorization"));
  if (!creds) {
    setResponseHeader(event, "WWW-Authenticate", 'Basic realm="Folder DAV"');
    throw createError({ status: 401, message: "Unauthorized" });
  }
  const session = await resolveDavUser(creds.user, creds.pass);
  if (!session) {
    setResponseHeader(event, "WWW-Authenticate", 'Basic realm="Folder DAV"');
    throw createError({ status: 401, message: "Unauthorized" });
  }

  const { user, bucket } = session;
  const node = await resolveNode(bucket.name, rel);
  const overwrite = (getHeader(event, "overwrite") || "T").toUpperCase() !== "F";
  const depth = (getHeader(event, "depth") || "infinity").toLowerCase();

  if (method === "PROPFIND") {
    if (node.kind === "missing") throw createError({ status: 404, message: "Not Found" });
    const items = [];
    if (node.kind === "root") {
      items.push({
        href: "/dav/",
        isCollection: true,
        displayName: bucket.name,
        createdAt: bucket.createdAt,
        updatedAt: bucket.updatedAt,
        etag: `"${bucket.id}-${bucket.updatedAt}"`,
      });
      if (depth !== "0") {
        const children = await fileRepository.listChildren(bucket.name, "root");
        for (const child of children.filter((c) => !c.deletedAt)) {
          items.push(toPropItem(child, bucket.name));
        }
      }
    } else if (node.file) {
      items.push(toPropItem(node.file, bucket.name));
      if (node.kind === "folder" && depth !== "0") {
        const children = await fileRepository.listChildren(bucket.name, node.file.id);
        for (const child of children.filter((c) => !c.deletedAt)) {
          items.push(toPropItem(child, bucket.name));
        }
      }
    }
    setResponseStatus(event, 207);
    setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
    return propfindXml(items);
  }

  if (method === "PROPPATCH") {
    setResponseStatus(event, 207);
    setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
    return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
<D:response><D:href>${xmlEscape(hrefFor(rel))}</D:href>
<D:propstat><D:prop/><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
</D:response></D:multistatus>`;
  }

  if (method === "GET" || method === "HEAD") {
    if (node.kind === "root" || node.kind === "folder") {
      const children =
        node.kind === "root"
          ? await fileRepository.listChildren(bucket.name, "root")
          : await fileRepository.listChildren(bucket.name, node.file!.id);
      const listing = children
        .filter((c) => !c.deletedAt)
        .map((c) => `${c.type === "folder" ? "d" : "-"} ${c.name}`)
        .join("\n");
      setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
      if (method === "HEAD") return "";
      return listing + (listing ? "\n" : "");
    }
    if (node.kind !== "file" || !node.file) throw createError({ status: 404, message: "Not Found" });
    setResponseHeader(event, "Content-Type", node.file.contentType || "application/octet-stream");
    setResponseHeader(event, "Content-Length", String(node.file.size || 0));
    setResponseHeader(event, "ETag", `"${node.file.id}-${node.file.updatedAt}"`);
    setResponseHeader(event, "Last-Modified", rfc1123(node.file.updatedAt));
    if (method === "HEAD") return "";
    const blob = await hubBlob().get(node.file.path);
    if (!blob) throw createError({ status: 404, message: "Not Found" });
    return blob;
  }

  if (method === "MKCOL") {
    if (node.kind !== "missing") throw createError({ status: 405, message: "Method Not Allowed" });
    const fullPath = cleanPath(`${bucket.name}/${rel}`);
    const parentRel = rel.split("/").slice(0, -1).join("/");
    const parent = await resolveNode(bucket.name, parentRel);
    if (parentRel && parent.kind === "missing") throw createError({ status: 409, message: "Conflict" });
    await ensurePath(bucket.name, fullPath, user.id);
    setResponseStatus(event, 201);
    setResponseHeader(event, "Location", hrefFor(rel) + "/");
    return "";
  }

  if (method === "PUT") {
    if (node.kind === "folder" || node.kind === "root") {
      throw createError({ status: 405, message: "Method Not Allowed" });
    }
    const fullPath = cleanPath(`${bucket.name}/${rel}`);
    const raw = await readRawBody(event, false);
    let bytes: Uint8Array;
    if (!raw) bytes = new Uint8Array();
    else if (typeof raw === "string") bytes = new TextEncoder().encode(raw);
    else bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
    const contentType = getHeader(event, "content-type") || getContentType(fullPath);
    await hubBlob().put(fullPath, bytes, { contentType });
    const parentRel = rel.split("/").slice(0, -1).join("/");
    const parent = parentRel
      ? await fileRepository.getByPath(bucket.name, cleanPath(`${bucket.name}/${parentRel}`))
      : { id: "root" };
    await insertUpdateFile(bucket.name, parent?.id || "root", {
      fullPath,
      contentType,
      size: bytes.byteLength,
      userId: user.id,
    });
    setResponseStatus(event, node.kind === "file" ? 204 : 201);
    return "";
  }

  if (method === "DELETE") {
    if (node.kind === "root" || node.kind === "missing" || !node.file) {
      throw createError({ status: 404, message: "Not Found" });
    }
    await deleteFiles(bucket.name, [node.file.id]);
    setResponseStatus(event, 204);
    return "";
  }

  if (method === "COPY" || method === "MOVE") {
    if (node.kind === "root" || node.kind === "missing" || !node.file) {
      throw createError({ status: 404, message: "Not Found" });
    }
    const destRel = destinationRel(event, getHeader(event, "destination"));
    if (destRel == null) throw createError({ status: 400, message: "Destination required" });
    const dest = await resolveNode(bucket.name, destRel);
    if (dest.kind !== "missing" && !overwrite) {
      throw createError({ status: 412, message: "Precondition Failed" });
    }
    if (dest.kind !== "missing" && dest.file && overwrite) {
      await deleteFiles(bucket.name, [dest.file.id]);
    }
    const destFull = cleanPath(`${bucket.name}/${destRel}`);
    const destName = destRel.split("/").pop() || node.file.name;
    const destParentRel = destRel.split("/").slice(0, -1).join("/");
    const destParent = destParentRel
      ? await fileRepository.getByPath(bucket.name, cleanPath(`${bucket.name}/${destParentRel}`))
      : null;
    if (destParentRel && (!destParent || destParent.type !== "folder")) {
      throw createError({ status: 409, message: "Conflict" });
    }
    const parentId = destParentRel ? destParent!.id : "root";
    if (method === "COPY") {
      await copyNode(bucket.name, node.file, destFull, user.id);
    } else {
      await moveFile(bucket.name, node.file.id, parentId);
      if (destName !== node.file.name) {
        await renameFile(bucket.name, node.file.id, destName);
      }
    }
    setResponseStatus(event, dest.kind === "missing" ? 201 : 204);
    return "";
  }

  if (method === "LOCK") {
    const token = crypto.randomUUID();
    setResponseStatus(event, 200);
    setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
    setResponseHeader(event, "Lock-Token", `<opaquelocktoken:${token}>`);
    return lockXml(token);
  }

  if (method === "UNLOCK") {
    setResponseStatus(event, 204);
    return "";
  }

  throw createError({ status: 405, message: "Method Not Allowed" });
}
