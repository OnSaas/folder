<script setup lang="ts">
const { t } = useI18n();
const toast = useToast();
const { data: jobs, refresh } = await useFetch("/api/sync/jobs");
const { data: storages } = await useFetch("/api/storages");
const targets = computed(() =>
  (storages.value || []).filter((item: any) => item.id !== "primary")
);
const browserTz = import.meta.client
  ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  : "UTC";

const editing = ref({
  name: "Backup",
  sourcePrefix: "",
  targetStorageId: "",
  targetPrefix: "",
  mode: "incremental",
  deletePolicy: "keep",
  conflict: "newer",
  excludes: ".DS_Store, *.tmp",
  scheduleKind: "manual",
  everyMinutes: 60,
  cronExpr: "0 3 * * *",
  tz: browserTz,
});
const saving = ref(false);
const running = ref("");
const history = ref<Record<string, any[]>>({});
const openHistory = ref("");

watch(
  targets,
  (list) => {
    if (!editing.value.targetStorageId && list[0]) editing.value.targetStorageId = list[0].id;
  },
  { immediate: true }
);

const describeSchedule = (job: any) => {
  if (job.schedule.kind === "manual") return t("settings.syncManual");
  if (job.schedule.kind === "interval") {
    return `${t("settings.syncEveryMinutes")}: ${job.schedule.everyMinutes}`;
  }
  return `${job.schedule.expr} (${job.schedule.tz || "UTC"})`;
};

const loadHistory = async (id: string) => {
  if (openHistory.value === id) {
    openHistory.value = "";
    return;
  }
  openHistory.value = id;
  try {
    history.value[id] = await $fetch(`/api/sync/jobs/${id}/runs`);
  } catch {
    history.value[id] = [];
  }
};

const save = async () => {
  saving.value = true;
  try {
    const schedule =
      editing.value.scheduleKind === "interval"
        ? { kind: "interval", everyMinutes: Number(editing.value.everyMinutes) || 60 }
        : editing.value.scheduleKind === "cron"
          ? { kind: "cron", expr: editing.value.cronExpr, tz: editing.value.tz || "UTC" }
          : { kind: "manual" };
    await $fetch("/api/sync/jobs", {
      method: "POST",
      body: {
        name: editing.value.name,
        sourcePrefix: editing.value.sourcePrefix,
        targetStorageId: editing.value.targetStorageId,
        targetPrefix: editing.value.targetPrefix,
        mode: editing.value.mode,
        deletePolicy: editing.value.deletePolicy,
        conflict: editing.value.conflict,
        excludes: editing.value.excludes.split(",").map((item) => item.trim()).filter(Boolean),
        schedule,
      },
    });
    toast.add({ title: t("common.success"), color: "success" });
    await refresh();
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    saving.value = false;
  }
};

const run = async (id: string) => {
  running.value = id;
  try {
    await $fetch(`/api/sync/jobs/${id}/run`, { method: "POST" });
    toast.add({ title: t("settings.syncRan"), color: "success" });
    await refresh();
    if (openHistory.value === id) await loadHistory(id);
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    running.value = "";
  }
};

const remove = async (id: string) => {
  await $fetch(`/api/sync/jobs/${id}`, { method: "DELETE" });
  await refresh();
};

const formatWhen = (value?: number) =>
  value ? new Date(value).toLocaleString() : "—";
</script>
<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-lg font-light">{{ t("settings.sync") }}</h3>
    <p class="text-sm opacity-70">{{ t("settings.syncHint") }}</p>
    <div
      v-for="job in jobs || []"
      :key="job.id"
      class="border border-neutral-200 dark:border-neutral-700 p-3 flex flex-col gap-2"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="font-medium truncate">{{ job.name }}</p>
          <p class="text-xs font-mono opacity-70">
            {{ job.sourcePrefix || "/" }} → {{ job.targetStorageId }}/{{ job.targetPrefix || "" }}
          </p>
        </div>
        <UBadge
          v-if="job.failedPaths?.length"
          size="xs"
          color="error"
          variant="solid"
        >
          {{ job.failedPaths.length }}
        </UBadge>
      </div>
      <p class="text-xs opacity-70">{{ describeSchedule(job) }}</p>
      <p class="text-xs opacity-60">{{ t("settings.syncNext") }}: {{ formatWhen(job.nextRunAt) }}</p>
      <div class="flex flex-wrap gap-2">
        <UButton size="xs" variant="outline" :loading="running === job.id" @click="run(job.id)">
          {{ t("settings.syncRun") }}
        </UButton>
        <UButton size="xs" variant="ghost" @click="loadHistory(job.id)">
          {{ t("settings.syncHistory") }}
        </UButton>
        <UButton size="xs" color="error" variant="ghost" @click="remove(job.id)">
          {{ t("common.delete") }}
        </UButton>
      </div>
      <div v-if="openHistory === job.id" class="flex flex-col gap-1 border-t border-neutral-200 dark:border-neutral-700 pt-2">
        <p v-if="!history[job.id]?.length" class="text-xs opacity-60">{{ t("settings.syncNoRuns") }}</p>
        <div
          v-for="entry in history[job.id] || []"
          :key="entry.id"
          class="text-xs flex flex-wrap gap-x-3 opacity-80"
        >
          <span>{{ formatWhen(entry.startedAt) }}</span>
          <span>{{ entry.status }}</span>
          <span>{{ t("settings.syncStats", { copied: entry.stats.copied, skipped: entry.stats.skipped, failed: entry.stats.failed }) }}</span>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <p class="font-medium">{{ t("settings.syncAdd") }}</p>
      <UInput v-model="editing.name" :placeholder="t('settings.syncName')" />
      <UInput v-model="editing.sourcePrefix" :placeholder="t('settings.syncSource')" />
      <USelect
        v-model="editing.targetStorageId"
        :items="targets.map((item: any) => ({ label: item.name, value: item.id }))"
      />
      <UInput v-model="editing.targetPrefix" :placeholder="t('settings.syncTarget')" />
      <USelect
        v-model="editing.mode"
        :items="[
          { label: t('settings.syncIncremental'), value: 'incremental' },
          { label: t('settings.syncFull'), value: 'full' },
        ]"
      />
      <USelect
        v-model="editing.deletePolicy"
        :items="[
          { label: t('settings.syncKeep'), value: 'keep' },
          { label: t('settings.syncTrash'), value: 'trash' },
          { label: t('settings.syncMirror'), value: 'mirror' },
        ]"
      />
      <p v-if="editing.deletePolicy === 'mirror'" class="text-xs text-red-500">
        {{ t("settings.syncMirrorWarn") }}
      </p>
      <USelect
        v-model="editing.conflict"
        :items="[
          { label: t('settings.syncNewer'), value: 'newer' },
          { label: t('settings.syncOverwrite'), value: 'overwrite' },
          { label: t('settings.syncSkip'), value: 'skip' },
        ]"
      />
      <USelect
        v-model="editing.scheduleKind"
        :items="[
          { label: t('settings.syncManual'), value: 'manual' },
          { label: t('settings.syncInterval'), value: 'interval' },
          { label: t('settings.syncCron'), value: 'cron' },
        ]"
      />
      <UInput
        v-if="editing.scheduleKind === 'interval'"
        v-model="editing.everyMinutes"
        type="number"
        :placeholder="t('settings.syncEveryMinutes')"
      />
      <template v-if="editing.scheduleKind === 'cron'">
        <UInput v-model="editing.cronExpr" :placeholder="t('settings.syncCronExpr')" />
        <UInput v-model="editing.tz" :placeholder="t('settings.syncTimezone')" />
      </template>
      <UInput v-model="editing.excludes" :placeholder="t('settings.syncExcludes')" />
      <UButton :loading="saving" :disabled="!editing.targetStorageId" @click="save">
        {{ t("common.submit") }}
      </UButton>
    </div>
  </div>
</template>
