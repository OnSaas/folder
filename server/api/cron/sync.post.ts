import { tickDueJobs } from "~~/server/utils/sync";

export default defineEventHandler(async () => {
  return tickDueJobs();
});
