import { cachedList, resolveMount } from "~~/server/utils/mounts";
import { sanitizeObjectPath } from "~~/server/utils/object-path";

export default defineEventHandler(async (event) => {
  const { mountPath } = getRouterParams(event);
  const query = getQuery(event);
  const { rec, driver } = await resolveMount(mountPath);
  return cachedList(rec, driver, sanitizeObjectPath(String(query.path || "")), query.cursor ? String(query.cursor) : undefined);
});
