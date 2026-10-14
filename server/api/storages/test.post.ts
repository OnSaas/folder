import { buildS3Driver } from "~~/server/utils/storages";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const driver = await buildS3Driver(body);
  return driver.test();
});
