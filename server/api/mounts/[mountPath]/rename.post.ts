import { parentObjectPath } from "~~/server/utils/object-path";
import { relocateObject } from "~~/server/utils/mounts";

export default defineEventHandler(async (event) => {
  const { mountPath } = getRouterParams(event);
  const body = await readBody(event);
  const from = String(body?.from || "");
  const name = String(body?.name || "");
  const to = `${parentObjectPath(from)}/${name}`.replace(/^\/+/, "");
  return relocateObject(mountPath, from, to, false);
});
