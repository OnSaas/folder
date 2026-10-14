export default defineTask({
  meta: {
    name: "sync:tick",
    description: "Run due backup jobs",
  },
  async run() {
    const { tickDueJobs } = await import("../utils/sync");
    return { result: await tickDueJobs() };
  },
});
