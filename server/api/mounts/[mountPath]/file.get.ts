import { resolveMount } from "~~/server/utils/mounts";
import { sanitizeObjectPath } from "~~/server/utils/object-path";
import { serveObject } from "~~/server/storage/drivers/serve";

export default defineEventHandler(async (event) => {
  const { mountPath } = getRouterParams(event);
  const query = getQuery(event);
  const path = sanitizeObjectPath(String(query.path || ""));
  const { rec, driver } = await resolveMount(mountPath);
  if (driver.presignGet && query.proxy !== "1") {
    const url = await driver.presignGet(path, 300);
    return sendRedirect(event, url, 302);
  }
  return serveObject(event, driver, path, {
    downloadName: query.download ? path.split("/").pop() : undefined,
  });
});
