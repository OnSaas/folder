import { assertWritable, invalidateList, resolveMount } from "~~/server/utils/mounts";
import { sanitizeObjectPath } from "~~/server/utils/object-path";

export default defineEventHandler(async (event) => {
  const { mountPath } = getRouterParams(event);
  const body = await readBody(event);
  const path = sanitizeObjectPath(body?.path);
  const { rec, driver } = await resolveMount(mountPath);
  assertWritable(rec);
  const plan = driver.initUpload
    ? await driver.initUpload(path, { contentType: body?.contentType, size: body?.size })
    : { kind: "proxy" as const };
  return plan;
});
