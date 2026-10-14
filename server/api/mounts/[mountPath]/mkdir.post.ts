import { assertWritable, invalidateList, resolveMount } from "~~/server/utils/mounts";
import { sanitizeObjectPath } from "~~/server/utils/object-path";

export default defineEventHandler(async (event) => {
  const { mountPath } = getRouterParams(event);
  const body = await readBody(event);
  const path = sanitizeObjectPath(body?.path);
  const { rec, driver } = await resolveMount(mountPath);
  assertWritable(rec);
  if (!driver.mkdir) throw createError({ status: 400, message: "Driver cannot mkdir" });
  await driver.mkdir(path);
  await invalidateList(rec, path);
  return { ok: true };
});
