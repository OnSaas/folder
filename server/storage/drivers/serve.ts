import { R2Driver } from "./r2";
import type { StorageDriver } from "./types";

function parseRange(header: string | undefined, size: number) {
  if (!header || !header.startsWith("bytes=")) return null;
  const spec = header.slice(6).split(",")[0];
  const [startRaw, endRaw] = spec.split("-");
  const start = startRaw ? Number(startRaw) : 0;
  const end = endRaw ? Number(endRaw) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function serveObject(
  event: any,
  driver: StorageDriver,
  path: string,
  opts?: { downloadName?: string }
) {
  if (driver instanceof R2Driver) {
    return driver.serve(event, path);
  }

  const result = await driver.get(path);
  if (!result) {
    throw createError({ status: 404, message: "Not Found" });
  }
  const { meta } = result;
  if (meta.etag) {
    const inm = getHeader(event, "if-none-match");
    if (inm && inm === meta.etag) {
      setResponseStatus(event, 304);
      return "";
    }
    setHeader(event, "ETag", meta.etag);
  }
  setHeader(event, "Content-Type", meta.contentType || "application/octet-stream");
  if (opts?.downloadName) {
    setHeader(
      event,
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(opts.downloadName)}"`
    );
  }
  const rangeHeader = getHeader(event, "range");
  const range = driver.caps.range ? parseRange(rangeHeader, meta.size) : null;
  if (range) {
    const sliced = await driver.get(path, { range });
    if (!sliced) {
      throw createError({ status: 404, message: "Not Found" });
    }
    setResponseStatus(event, 206);
    setHeader(
      event,
      "Content-Range",
      `bytes ${range.start}-${range.end}/${meta.size}`
    );
    setHeader(event, "Content-Length", String(range.end - range.start + 1));
    return sliced.body;
  }
  setHeader(event, "Content-Length", String(meta.size));
  return result.body;
}
