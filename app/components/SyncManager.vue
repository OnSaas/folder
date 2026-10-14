<script setup lang="ts">
const { t } = useI18n();
const toast = useToast();
const { data: jobs, refresh } = await useFetch("/api/sync/jobs");
const { data: storages } = await useFetch("/api/storages");
const targets = computed(() =>
  (storages.value || []).filter((item: any) => item.id !== "primary")
);
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
});
const saving = ref(false);
const running = ref("");

watch(
  targets,
  (list) => {
    if (!editing.value.targetStorageId && list[0]) editing.value.targetStorageId = list[0].id;
  },
  { immediate: true }
);

const save = async () => {
  saving.value = true;
  try {
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
        schedule:
          editing.value.scheduleKind === "interval"
            ? { kind: "interval", everyMinutes: Number(editing.value.everyMinutes) || 60 }
            : { kind: "manual" },
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
        <span class="text-xs">{{ job.schedule.kind }}</span>
      </div>
      <div class="flex gap-2">
        <UButton size="xs" variant="outline" :loading="running === job.id" @click="run(job.id)">
          {{ t("settings.syncRun") }}
        </UButton>
        <UButton size="xs" color="error" variant="ghost" @click="remove(job.id)">
          {{ t("common.delete") }}
        </UButton>
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
        v-model="editing.scheduleKind"
        :items="[
          { label: t('settings.syncManual'), value: 'manual' },
          { label: t('settings.syncInterval'), value: 'interval' },
        ]"
      />
      <UInput
        v-if="editing.scheduleKind === 'interval'"
        v-model="editing.everyMinutes"
        type="number"
        :placeholder="t('settings.syncEveryMinutes')"
      />
      <UInput v-model="editing.excludes" :placeholder="t('settings.syncExcludes')" />
      <UButton :loading="saving" :disabled="!editing.targetStorageId" @click="save">
        {{ t("common.submit") }}
      </UButton>
    </div>
  </div>
</template>
