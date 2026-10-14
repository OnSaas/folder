import { syncJobRepository } from "~~/server/repositories/sync";

export default defineEventHandler(async () => {
  return syncJobRepository.list();
});
