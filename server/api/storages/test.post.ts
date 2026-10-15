import { buildProbeDriver } from "~~/server/utils/storages";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const driver = await buildProbeDriver(body);
  return driver.test();
});
