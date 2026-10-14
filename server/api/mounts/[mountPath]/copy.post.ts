import { relocateObject } from "~~/server/utils/mounts";

export default defineEventHandler(async (event) => {
  const { mountPath } = getRouterParams(event);
  const body = await readBody(event);
  return relocateObject(mountPath, body?.from, body?.to, true);
});
